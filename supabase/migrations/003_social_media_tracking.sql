-- Addition of social media tracking to job_posts
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS social_media_id JSONB DEFAULT '{}';
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS last_social_media_posted_at TIMESTAMPTZ;

-- Update the view to include these new columns
DROP VIEW IF EXISTS v_job_matches_full;
CREATE VIEW v_job_matches_full AS
SELECT
  jm.id,
  jm.score,
  jm.score_breakdown,
  jm.match_reasons,
  jm.flags,
  jm.status,
  jm.notes,
  jm.is_notified,
  jm.created_at,
  jp.title,
  jp.company,
  jp.location,
  jp.modality,
  jp.seniority,
  jp.salary_min,
  jp.salary_max,
  jp.salary_currency,
  jp.salary_period,
  jp.required_skills,
  jp.apply_url,
  jp.posted_at,
  jp.social_media_id,
  jp.last_social_media_posted_at,
  js.display_name AS source_name,
  js.name AS source_slug
FROM job_matches jm
JOIN job_posts jp ON jp.id = jm.job_post_id
JOIN job_sources js ON js.id = jp.source_id;
