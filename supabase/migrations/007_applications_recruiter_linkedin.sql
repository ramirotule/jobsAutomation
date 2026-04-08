-- Add recruiter_linkedin to applications table
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS recruiter_linkedin TEXT;
