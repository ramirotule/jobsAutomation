-- Migration 014: Ignored Jobs table
-- This table stores jobs or companies that the user wants to ignore in future scrapes

CREATE TABLE IF NOT EXISTS public.ignored_jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    external_id TEXT, -- To ignore a specific job
    company TEXT,     -- To ignore all jobs from a company
    reason TEXT,      -- Optional reason (e.g. "Presencial")
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_ignored_jobs_user_id ON public.ignored_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ignored_jobs_company ON public.ignored_jobs(company);
CREATE INDEX IF NOT EXISTS idx_ignored_jobs_external_id ON public.ignored_jobs(external_id);

-- Add unique constraint to avoid duplicates
ALTER TABLE public.ignored_jobs ADD CONSTRAINT ignored_jobs_user_external_unique UNIQUE (user_id, external_id);

-- Enable RLS
ALTER TABLE public.ignored_jobs ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own ignored jobs
CREATE POLICY "Users can manage their own ignored jobs"
    ON public.ignored_jobs
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
