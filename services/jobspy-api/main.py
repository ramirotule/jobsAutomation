import os
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from jobspy import scrape_jobs
from jobspy.jobs import Country
import pandas as pd

# python-jobspy's Country enum only covers ~65 countries. When scraping
# worldwide-remote, LinkedIn's own per-listing location parser
# (scrapers/linkedin/__init__.py:_get_location) calls Country.from_string()
# on EACH job's own country text — if that job happens to be in a country
# missing from the enum (Armenia, Bulgaria, Slovakia, etc. all aren't
# there), it raises and aborts the ENTIRE scrape, not just that one job.
# Patched here (not by editing the installed package) so the fix survives
# a fresh `pip install -r requirements.txt` on redeploy.
_original_country_from_string = Country.from_string.__func__


def _safe_country_from_string(cls, country_str: str):
    try:
        return _original_country_from_string(cls, country_str)
    except ValueError:
        return cls.WORLDWIDE


Country.from_string = classmethod(_safe_country_from_string)

app = FastAPI(title="JobSpy API", version="1.0.0")

# CORS — allow your Vercel frontend
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
API_SECRET = os.getenv("API_SECRET", "")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST"],
    allow_headers=["*"],
)


def verify_api_key(x_api_key: str = Header(default="")):
    """Simple API key auth to prevent abuse."""
    if API_SECRET and x_api_key != API_SECRET:
        raise HTTPException(status_code=401, detail="Invalid API key")


class SearchRequest(BaseModel):
    query: str = Field(default="frontend developer", description="Job title or search term")
    sites: list[str] = Field(default=["linkedin", "indeed", "glassdoor"], description="Sites to scrape")
    location: str = Field(default="Remote", description="Location filter")
    is_remote: bool = Field(default=True, description="Remote jobs only")
    results_wanted: int = Field(default=50, ge=5, le=100, description="Max results per site")
    hours_old: int = Field(default=24, ge=1, le=168, description="Max age in hours")
    exclude_companies: list[str] = Field(default=[], description="Companies to exclude (lowercase)")
    exclude_locations: list[str] = Field(default=["brazil", "brasil"], description="Locations to exclude")
    country: str | None = Field(default="argentina", description="Scope to a single LatAm country (e.g. 'argentina'). Pass null to scan all of LatAm instead.")


# Indeed has no "region" concept — it's strictly per-country, so "Latin
# America" isn't a valid country_indeed value there (confirmed: raises
# "Invalid country string"). LinkedIn's own location search DOES resolve
# "Latin America" as a real free-text location (verified manually — returns
# genuine LatAm results: Peru, Mexico, Brazil, Argentina). So Indeed needs a
# loop over each LatAm country jobspy actually supports; LinkedIn gets it in
# one shot.
LATAM_COUNTRIES = [
    "argentina", "brazil", "chile", "colombia", "costa rica",
    "ecuador", "mexico", "panama", "peru", "uruguay", "venezuela",
]
LATAM_LOCATION = "Latin America"


class JobResult(BaseModel):
    external_id: str
    site: str
    title: str
    company: str
    location: str
    apply_url: str
    description: str
    modality: str
    posted_at: str | None
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str = "USD"
    required_skills: list[str] = []


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/search", dependencies=[Depends(verify_api_key)])
def search_jobs(req: SearchRequest):
    try:
        sites_lower = [s.lower() for s in req.sites]
        non_indeed_sites = [s for s in req.sites if s.lower() != "indeed"]

        # Scoping to one country turns the Indeed loop below from 11 sequential
        # scrapes into 1 — this is the main lever for search latency.
        indeed_countries = [req.country.lower()] if req.country else LATAM_COUNTRIES
        linkedin_location = req.country.title() if req.country else LATAM_LOCATION

        dataframes = []

        # LinkedIn (and any other non-Indeed site): one call, region or single country.
        if non_indeed_sites:
            scrape_params: dict = {
                "site_name": non_indeed_sites,
                "location": linkedin_location,
                "is_remote": req.is_remote,
                "job_type": "fulltime",
                "results_wanted": req.results_wanted,
                "hours_old": req.hours_old,
                "search_term": req.query,
            }
            df_main = scrape_jobs(**scrape_params)
            if not df_main.empty:
                dataframes.append(df_main)

        # Indeed: no region concept, loop per country and merge.
        if "indeed" in sites_lower:
            per_country_wanted = req.results_wanted if req.country else max(5, min(req.results_wanted, 15))
            for country in indeed_countries:
                try:
                    df_country = scrape_jobs(
                        site_name=["indeed"],
                        location=country,
                        is_remote=req.is_remote,
                        job_type="fulltime",
                        results_wanted=per_country_wanted,
                        hours_old=req.hours_old,
                        country_indeed=country,
                        search_term=req.query,
                    )
                    if not df_country.empty:
                        dataframes.append(df_country)
                except Exception as e:
                    print(f"[Indeed:{country}] skipped due to error: {e}")

        df = pd.concat(dataframes, ignore_index=True) if dataframes else pd.DataFrame()

        if df.empty:
            return {"success": True, "count": 0, "data": [], "message": "No jobs found"}

        # Normalize and filter
        exclude_companies_set = set(c.lower().strip() for c in req.exclude_companies)
        exclude_locations_lower = [loc.lower() for loc in req.exclude_locations]
        seen_companies: set[str] = set()
        results: list[dict] = []

        for _, row in df.iterrows():
            title = _clean(row, "title")
            company = _clean(row, "company")
            location = _clean(row, "location")

            if not title:
                continue

            # Deduplicate by company
            company_key = company.lower().strip()
            if company_key in seen_companies:
                continue
            seen_companies.add(company_key)

            # Exclude blacklisted companies
            if company_key in exclude_companies_set:
                continue

            # Exclude unwanted locations
            location_lower = location.lower()
            if any(exc in location_lower for exc in exclude_locations_lower):
                continue

            # Detect remote honestly, per row: prefer jobspy's own is_remote column
            # (populated from the site's own data when available). LinkedIn never
            # fills this column (always None), so fall back to a text heuristic —
            # and check the TITLE too, not just location: sites commonly write
            # "Remote" in the title (e.g. "Mobile Engineer (React Native) - Remote,
            # Vietnam") rather than in the structured location field.
            raw_is_remote = row.get("is_remote")
            remote_keywords = ("remote", "remoto", "home office")
            if pd.notnull(raw_is_remote):
                is_remote_job = bool(raw_is_remote)
            else:
                title_lower = title.lower()
                is_remote_job = any(
                    kw in location_lower or kw in title_lower for kw in remote_keywords
                )

            # When remote-only was requested, actually enforce it instead of just
            # labeling every result "remote" regardless of the real job.
            if req.is_remote and not is_remote_job:
                continue

            # Parse salary
            salary_min = _num(row, "min_amount")
            salary_max = _num(row, "max_amount")
            salary_currency = _clean(row, "currency") or "USD"

            # Parse date
            posted_at = None
            date_val = row.get("date_posted")
            if pd.notnull(date_val):
                posted_at = str(date_val)

            # Extract skills from description
            description = _clean(row, "description")
            skills = _extract_skills(description)

            results.append({
                "external_id": _clean(row, "id") or f"jobspy-{len(results)}",
                "site": _clean(row, "site") or "unknown",
                "title": title,
                "company": company,
                "location": location,
                "apply_url": _clean(row, "job_url") or "",
                "description": description,
                "modality": "remote" if is_remote_job else "onsite",
                "posted_at": posted_at,
                "salary_min": salary_min,
                "salary_max": salary_max,
                "salary_currency": salary_currency,
                "required_skills": skills,
            })

        return {"success": True, "count": len(results), "data": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Helpers
# ============================================================
KNOWN_SKILLS = [
    "javascript", "typescript", "react", "react native", "next.js", "nextjs",
    "node.js", "nodejs", "vue", "angular", "svelte", "graphql", "rest",
    "html", "css", "tailwind", "sass", "webpack", "vite", "jest", "vitest",
    "testing library", "cypress", "playwright", "git", "docker",
    "aws", "gcp", "azure", "postgresql", "mysql", "mongodb", "redis",
    "python", "java", "kotlin", "swift", "go", "rust", "php",
    "figma", "storybook", "redux", "zustand", "expo",
    "firebase", "supabase", "vercel", "ci/cd", "agile", "scrum",
]


def _extract_skills(text: str) -> list[str]:
    if not text:
        return []
    lower = text.lower()
    return [s for s in KNOWN_SKILLS if s in lower]


def _clean(row, col: str) -> str:
    val = row.get(col, "")
    if pd.isna(val):
        return ""
    return str(val).strip()


def _num(row, col: str):
    val = row.get(col)
    if pd.isna(val) or val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
