-- Migration 020: Direct mail template (ES/EN) + CV file upload support
--
-- profiles.cover_letter_es/en, dm_es/en, linkedin_url, github_url, portfolio_url
-- and search_profiles.apify_key were originally added via Supabase Studio
-- without a tracked migration. This migration versions them (IF NOT EXISTS is
-- a no-op where they already exist) and adds the new direct-mail + CV-file columns.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS github_url TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_letter_es TEXT,
  ADD COLUMN IF NOT EXISTS cover_letter_en TEXT,
  ADD COLUMN IF NOT EXISTS dm_es TEXT,
  ADD COLUMN IF NOT EXISTS dm_en TEXT,
  ADD COLUMN IF NOT EXISTS dm2_es TEXT,
  ADD COLUMN IF NOT EXISTS dm2_en TEXT,
  ADD COLUMN IF NOT EXISTS dm2_attach_cv BOOLEAN DEFAULT false;

ALTER TABLE public.search_profiles
  ADD COLUMN IF NOT EXISTS apify_key TEXT;

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT;

-- ============================================================
-- STORAGE: CV files bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users manage their own CV files" ON storage.objects;

    CREATE POLICY "Users manage their own CV files" ON storage.objects
      FOR ALL TO authenticated
      USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text)
      WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
END $$;
