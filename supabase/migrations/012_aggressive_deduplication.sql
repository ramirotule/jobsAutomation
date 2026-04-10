-- Migration 012: Aggressive Job Deduplication
-- This migration changes the unique constraint to title + company to avoid LinkedIn multiple-location duplicates

-- 1. Remove the previous constraint based on external_id
ALTER TABLE public.job_posts DROP CONSTRAINT IF EXISTS job_posts_user_external_unique;

-- 2. Add an even stricter constraint: (user_id, title, company)
-- We will trim spaces and use lower case in the future, but currently this will handle exact matches
ALTER TABLE public.job_posts DROP CONSTRAINT IF EXISTS job_posts_user_title_company_unique;
ALTER TABLE public.job_posts 
ADD CONSTRAINT job_posts_user_title_company_unique UNIQUE (user_id, title, company);
