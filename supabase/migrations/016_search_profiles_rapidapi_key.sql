-- Migration 016: Add rapidapi_key to search_profiles
-- Each user stores their own RapidAPI key for job search providers (JSearch, LinkedIn API)

ALTER TABLE public.search_profiles
  ADD COLUMN IF NOT EXISTS rapidapi_key TEXT;
