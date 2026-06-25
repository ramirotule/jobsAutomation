# jobHunter — n8n Automation Workflows

Two n8n workflows that complement the Next.js web app by running jobs on a schedule and responding to on-demand webhook calls.

---

## Workflows

### 1. `job-search-jsearch.json` — Scheduled Job Search

Runs every 2 hours. For every active search profile in Supabase it:

1. Reads `search_profiles` where `is_active = true`
2. Generates up to 3 search queries per profile from `target_roles`
3. Calls the JSearch API (via RapidAPI) for each query
4. Normalizes the raw results into the `job_posts` schema (same logic as `/api/jobs/search`)
5. Filters out companies in `ignored_jobs` and deduplicates by company
6. Upserts into `job_posts` with conflict resolution on `user_id, company`
7. Optionally sends a Telegram message when new jobs are found

### 2. `cv-tailor-on-match.json` — On-Demand CV Tailoring

A webhook triggered from the app when the user clicks "Tailor CV". It:

1. Receives `{ userId, jobId }` via POST
2. Fetches the job post, active resume, and search profile from Supabase in parallel
3. Builds a Gemini prompt using the same logic as `/api/cv/tailor`
4. Calls `gemini-1.5-flash` and parses the JSON response
5. Returns `{ tailored_cv, changes_made, keywords_added, match_improvement, cover_letter_suggestion }`

---

## Prerequisites

| Service | What you need |
|---------|--------------|
| RapidAPI | Account + JSearch subscription (free tier available) |
| Supabase | Project with the schema from `supabase/migrations/` applied |
| Google AI | Gemini API key (free tier available) |
| Telegram (optional) | Bot token + chat ID for notifications |
| n8n | Self-hosted instance (Railway recommended) |

---

## Deploy n8n to Railway

1. Create a new Railway project
2. Add a **PostgreSQL** service (n8n uses it for workflow state)
3. Add a new service from the **n8n Docker image**: `n8nio/n8n:latest`
4. Copy variables from `.env.example` into Railway > Service > Variables
   - The `DB_POSTGRESDB_*` variables using `${{Postgres.*}}` syntax are resolved automatically by Railway
5. Deploy — n8n will be available at your Railway-generated URL

---

## Import Workflows

1. Open your n8n editor (`https://your-n8n.railway.app`)
2. Go to **Workflows > Import from file**
3. Import `job-search-jsearch.json` and `cv-tailor-on-match.json` separately
4. Activate both workflows (toggle top-right)

For the webhook workflow, copy the generated webhook URL and set it in your app:
```
NEXT_PUBLIC_N8N_CV_TAILOR_WEBHOOK=https://your-n8n.railway.app/webhook/cv-tailor
```

---

## Environment Variables

These must be set on your n8n Railway service. They map to the n8n `$env.*` expressions in the workflows.

| Variable | Description |
|----------|-------------|
| `RAPIDAPI_KEY` | RapidAPI key for JSearch |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS — keep secret) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID (optional) |

---

## Customize Search Queries

Edit the **"Code — Build Search Queries"** node in `job-search-jsearch.json`:

- Queries are derived from `search_profiles.target_roles` in Supabase
- The workflow takes the first 3 roles per profile to stay within RapidAPI rate limits
- To add more queries, increase the `.slice(0, 3)` limit or add a second JSearch node

Change the schedule in the **"Cron — Every 2 Hours"** node:

```
0 */2 * * *   — every 2 hours (default)
0 */6 * * *   — every 6 hours (lower API usage)
0 8,12,18 * * * — 3x per day at 8am, noon, 6pm
```

---

## Architecture Notes

- The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. These workflows run server-side and never expose the key to the browser.
- Upsert conflicts on `job_posts` use `user_id, company` as the conflict key (same as the app API route).
- The CV tailor webhook returns immediately with the tailored content — no async job queue needed for the current scale.
- If Telegram variables are empty, the notification node will fail silently (`continueOnFail` is set) without breaking the search workflow.
