-- Migration 011: Job Posts Deduplication and Multitenancy refinement
-- This migration ensures job_posts are correctly associated with users and avoids duplicates

-- 1. Ensure user_id exists in job_posts
ALTER TABLE public.job_posts 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Add external_id if missing (it should be there from 001, but let's be sure)
ALTER TABLE public.job_posts 
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- 3. Create a unique constraint to prevent duplicates for the same user
-- We include title and company because sometimes external_id might change but it's the same post
-- Or just use external_id if it's reliable. Standardizing on (user_id, external_id).
ALTER TABLE public.job_posts DROP CONSTRAINT IF EXISTS job_posts_user_external_unique;
ALTER TABLE public.job_posts 
ADD CONSTRAINT job_posts_user_external_unique UNIQUE (user_id, external_id);

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_job_posts_user_id ON public.job_posts(user_id);
