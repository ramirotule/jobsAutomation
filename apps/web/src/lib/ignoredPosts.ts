// ============================================================
// Ignored LinkedIn posts — Supabase (per-user, cross-device)
// ============================================================

import { supabase } from '@/lib/supabase'

export async function getIgnoredPostKeys(): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from('ignored_linkedin_posts')
    .select('post_key')
    .eq('user_id', user.id);

  return new Set((data ?? []).map(row => row.post_key as string));
}

export async function ignorePostRemote(postKey: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('ignored_linkedin_posts')
    .upsert({ user_id: user.id, post_key: postKey }, { onConflict: 'user_id,post_key' });
}

export async function clearIgnoredPostsRemote(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('ignored_linkedin_posts')
    .delete()
    .eq('user_id', user.id);
}
