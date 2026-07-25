-- Migration 017: Ignored LinkedIn posts
-- Persists the "Ignorar" action from /buscar-empleo (previously only in localStorage)
-- so it survives across devices/browsers, tied to the user account.

CREATE TABLE IF NOT EXISTS public.ignored_linkedin_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_key   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, post_key)
);

CREATE INDEX IF NOT EXISTS idx_ignored_linkedin_posts_user_id ON public.ignored_linkedin_posts(user_id);

ALTER TABLE public.ignored_linkedin_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own ignored linkedin posts" ON public.ignored_linkedin_posts;

CREATE POLICY "Users can manage their own ignored linkedin posts"
  ON public.ignored_linkedin_posts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
