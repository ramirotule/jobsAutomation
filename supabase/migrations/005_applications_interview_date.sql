-- Add field for interview scheduling
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS interview_at TIMESTAMPTZ;
