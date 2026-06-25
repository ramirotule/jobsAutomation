import os
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from jobspy import scrape_jobs
import pandas as pd

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
    country_indeed: str = Field(default="", description="Country for Indeed")
    exclude_companies: list[str] = Field(default=[], description="Companies to exclude (lowercase)")
    exclude_locations: list[str] = Field(default=["brazil", "brasil"], description="Locations to exclude")


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
        # When remote, use "worldwide" instead of the raw location string
        location = req.location
        if req.is_remote or location.lower() == "remote":
            location = "worldwide"

        scrape_params: dict = {
            "site_name": req.sites,
            "location": location,
            "is_remote": req.is_remote,
            "job_type": "fulltime",
            "results_wanted": req.results_wanted,
            "hours_old": req.hours_old,
        }

        if req.country_indeed:
            scrape_params["country_indeed"] = req.country_indeed

        # Google requires google_search_term instead of search_term
        if "google" in req.sites:
            scrape_params["google_search_term"] = req.query
        else:
            scrape_params["search_term"] = req.query

        df = scrape_jobs(**scrape_params)

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

            # Detect remote from location text
            is_remote_job = req.is_remote or "remote" in location_lower

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
