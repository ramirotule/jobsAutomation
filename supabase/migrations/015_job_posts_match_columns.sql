-- Add AI match scoring columns to job_posts
ALTER TABLE public.job_posts ADD COLUMN IF NOT EXISTS match_score INT;
ALTER TABLE public.job_posts ADD COLUMN IF NOT EXISTS match_result JSONB;

-- Index for filtering by score
CREATE INDEX IF NOT EXISTS idx_job_posts_match_score ON public.job_posts(match_score);
