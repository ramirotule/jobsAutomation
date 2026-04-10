-- Migration 013: Ultra Aggressive Deduplication (One per Company)
-- This migration restricts each user to only having one job post per company

-- 1. Remove the previous constraint (title + company)
ALTER TABLE public.job_posts DROP CONSTRAINT IF EXISTS job_posts_user_title_company_unique;

-- 2. Add the ultra-strict constraint: (user_id, company)
ALTER TABLE public.job_posts DROP CONSTRAINT IF EXISTS job_posts_user_company_unique;
ALTER TABLE public.job_posts 
ADD CONSTRAINT job_posts_user_company_unique UNIQUE (user_id, company);
