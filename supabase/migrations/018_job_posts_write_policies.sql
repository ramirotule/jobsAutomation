-- Migration 018: job_posts write policies
-- job_posts only ever had a public SELECT policy (001, 010). No INSERT/UPDATE/DELETE
-- policy was ever added, so every job search (any provider) silently failed to
-- persist results once user_id was introduced (011) and RLS was enforced (010).

DROP POLICY IF EXISTS "Users can insert their own job posts" ON public.job_posts;
DROP POLICY IF EXISTS "Users can update their own job posts" ON public.job_posts;
DROP POLICY IF EXISTS "Users can delete their own job posts" ON public.job_posts;

CREATE POLICY "Users can insert their own job posts"
  ON public.job_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job posts"
  ON public.job_posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job posts"
  ON public.job_posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
