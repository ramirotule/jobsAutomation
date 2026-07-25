-- Migration 019: job_posts.source
-- job_posts had no way to record which provider/site produced a row, so results
-- from different sources (jobspy/jsearch/linkedin-api/getonboard/computrabajo)
-- were indistinguishable once saved — no way to verify a source icon actually
-- returned jobs from that source.

ALTER TABLE public.job_posts ADD COLUMN IF NOT EXISTS source TEXT;
CREATE INDEX IF NOT EXISTS idx_job_posts_source ON public.job_posts(source);
