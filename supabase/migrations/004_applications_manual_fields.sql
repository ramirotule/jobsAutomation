-- Add fields for manual application entries
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS recruiter_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_type TEXT CHECK (contact_type IN ('self_initiated', 'recruiter_initiated'));

-- Update v_job_matches_full view to include new fields if it's used directly for applications (it's not but good to keep consistency)
-- Actually applications doesn't use the view, let's just update the table.
