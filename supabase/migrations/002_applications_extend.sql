-- Extend applications table for single-user job tracking (no auth)
-- Add missing columns needed by the web app

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS job_id         UUID REFERENCES job_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title          TEXT,
  ADD COLUMN IF NOT EXISTS company        TEXT,
  ADD COLUMN IF NOT EXISTS location       TEXT,
  ADD COLUMN IF NOT EXISTS apply_url      TEXT,
  ADD COLUMN IF NOT EXISTS salary_expectation INT,
  ADD COLUMN IF NOT EXISTS currency       TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS benefits       TEXT;

-- Make user_id nullable (single-user app without auth)
ALTER TABLE applications ALTER COLUMN user_id DROP NOT NULL;

-- Allow anon access (single-user personal app, no auth required)
DROP POLICY IF EXISTS "Users own their applications" ON applications;
CREATE POLICY "Allow all on applications" ON applications FOR ALL USING (true) WITH CHECK (true);
