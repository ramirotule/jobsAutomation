// ============================================================
// Shared job-search normalization & persistence
// Used by api/jobs/search (jsearch/jobspy/linkedin-api/getonboard,
// synchronous) and api/computrabajo-search (Apify, async).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

export interface NormalizedJob {
  external_id: string
  source: string
  title: string
  company: string
  location: string
  apply_url: string | null
  description: string
  modality: string
  posted_at: string
  salary_min?: number | null
  salary_max?: number | null
  salary_currency: string
  salary_period: string
  required_skills: string[]
}

const KNOWN_SKILLS = [
  'javascript', 'typescript', 'react', 'react native', 'next.js', 'nextjs',
  'node.js', 'nodejs', 'vue', 'angular', 'svelte', 'graphql', 'rest', 'api',
  'html', 'css', 'tailwind', 'sass', 'webpack', 'vite', 'jest', 'vitest',
  'testing library', 'cypress', 'playwright', 'git', 'github', 'gitlab',
  'docker', 'aws', 'gcp', 'azure', 'postgresql', 'mysql', 'mongodb',
  'redis', 'python', 'java', 'kotlin', 'swift', 'go', 'rust', 'php',
  'figma', 'storybook', 'redux', 'zustand', 'mobx', 'rxjs', 'expo',
  'firebase', 'supabase', 'vercel', 'netlify', 'ci/cd', 'agile', 'scrum',
]

export function extractSkillsFromText(text: string | string[] | undefined): string[] {
  if (!text) return []
  const str = Array.isArray(text) ? text.join(' ') : text
  const lower = str.toLowerCase()
  return KNOWN_SKILLS.filter((skill) => lower.includes(skill))
}

export interface SaveResult {
  count: number
  message?: string
}

export async function saveNormalizedJobs(
  supabase: SupabaseClient,
  userId: string,
  provider: string,
  normalizedJobs: NormalizedJob[],
): Promise<SaveResult> {
  if (normalizedJobs.length === 0) {
    return { count: 0, message: `${provider} returned no results. Try a different term, location, or remove date filters.` }
  }

  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const [{ data: recentApps }, { data: ignoredJobs }] = await Promise.all([
    supabase
      .from('applications')
      .select('company')
      .eq('user_id', userId)
      .gte('applied_at', oneWeekAgo.toISOString()),
    supabase
      .from('ignored_jobs')
      .select('external_id, company')
      .eq('user_id', userId),
  ])

  const excludedCompanies = new Set((recentApps || []).map((a: any) => a.company?.toLowerCase().trim()))
  const ignoredCompanies = new Set(
    (ignoredJobs || []).map((ij: any) => ij.company?.toLowerCase().trim()).filter(Boolean),
  )

  const filtered = normalizedJobs.filter((job) => {
    const companyName = job.company?.toLowerCase().trim()
    if (excludedCompanies.has(companyName)) return false
    if (companyName && ignoredCompanies.has(companyName)) return false
    return true
  })

  const seen = new Set<string>()
  const deduped = filtered.filter((job) => {
    const key = job.company?.toLowerCase().trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  console.log(`[${provider}] after filter: ${filtered.length}, after dedup: ${deduped.length} / ${normalizedJobs.length}`)

  if (deduped.length === 0) {
    return { count: 0, message: `Found ${normalizedJobs.length} jobs but all were filtered (applied or blacklisted companies).` }
  }

  const { error: dbError } = await supabase
    .from('job_posts')
    .upsert(
      deduped.map((job) => ({ user_id: userId, ...job })),
      { onConflict: 'user_id, company' },
    )

  if (dbError) throw new Error(dbError.message)

  return { count: deduped.length }
}
