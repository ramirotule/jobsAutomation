import { createClient } from '@supabase/supabase-js'
import type { JobMatch, JobPost, SearchProfile, Application, Alert, JobFilters } from '@/types'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Supabase client con service role para uso server-side (n8n / cron)
export function createServiceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ============================================================
// Job Posts (panel principal — lee directo de job_posts)
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapJobPost(row: any): JobPost {
  return {
    id:               row.id,
    sourceId:         row.source_id ?? '',
    externalId:       row.external_id ?? '',
    title:            row.title ?? '',
    company:          row.company ?? '',
    description:      row.description ?? '',
    location:         row.location ?? '',
    modality:         row.modality ?? 'unknown',
    seniority:        row.seniority ?? 'unknown',
    salaryMin:        row.salary_min,
    salaryMax:        row.salary_max,
    salaryCurrency:   row.salary_currency ?? 'USD',
    salaryPeriod:     row.salary_period ?? 'yearly',
    requiredSkills:   row.required_skills ?? [],
    niceToHaveSkills: row.nice_to_have_skills ?? [],
    applyUrl:         row.apply_url ?? '',
    postedAt:         row.posted_at ?? '',
    isActive:         row.is_active ?? true,
    createdAt:        row.created_at ?? '',
  }
}

export async function getJobPosts(
  filters: JobFilters = {},
  page = 0,
  pageSize = 25,
): Promise<{ data: JobPost[]; total: number }> {
  let query = supabase
    .from('job_posts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (filters.modality?.length)  query = query.in('modality', filters.modality)
  if (filters.seniority?.length) query = query.in('seniority', filters.seniority)
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,company.ilike.%${filters.search}%`)
  }

  const { data, count, error } = await query
  if (error) throw error
  return { data: (data ?? []).map(mapJobPost), total: count ?? 0 }
}

// ============================================================
// Job Post por ID (detalle de vacante)
// ============================================================
export async function getJobById(id: string): Promise<JobPost | null> {
  const { data, error } = await supabase
    .from('job_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return mapJobPost(data)
}

// ============================================================
// Borrar vacantes
// ============================================================
export async function deleteJobPost(id: string): Promise<void> {
  const { error } = await supabase
    .from('job_posts')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function deleteAllJobPosts(): Promise<void> {
  const { error } = await supabase
    .from('job_posts')
    .delete()
    .not('id', 'is', null)

  if (error) throw error
}

// ============================================================
// Job Matches (panel principal — cuando job_matches esté poblado)
// ============================================================
export async function getJobMatches(
  profileId: string,
  filters: JobFilters = {},
  page = 0,
  pageSize = 25,
): Promise<{ data: JobMatch[]; total: number }> {
  let query = supabase
    .from('v_job_matches_full')
    .select('*', { count: 'exact' })
    .eq('search_profile_id', profileId)
    .order('score', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (filters.status?.length)    query = query.in('status', filters.status)
  if (filters.minScore)          query = query.gte('score', filters.minScore)
  if (filters.modality?.length)  query = query.in('modality', filters.modality)
  if (filters.seniority?.length) query = query.in('seniority', filters.seniority)
  if (filters.sourceSlug?.length) query = query.in('source_slug', filters.sourceSlug)
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,company.ilike.%${filters.search}%`)
  }

  const { data, count, error } = await query
  if (error) throw error
  return { data: (data ?? []) as JobMatch[], total: count ?? 0 }
}

export async function updateMatchStatus(
  matchId: string,
  status: JobMatch['status'],
  notes?: string,
): Promise<void> {
  const { error } = await supabase
    .from('job_matches')
    .update({ status, ...(notes !== undefined && { notes }) })
    .eq('id', matchId)

  if (error) throw error
}

// ============================================================
// Search Profile
// ============================================================
export async function getSearchProfile(userId: string): Promise<SearchProfile | null> {
  const { data, error } = await supabase
    .from('search_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data as SearchProfile
}

export async function upsertSearchProfile(
  userId: string,
  profile: Partial<SearchProfile>,
): Promise<SearchProfile> {
  const { data, error } = await supabase
    .from('search_profiles')
    .upsert({ ...profile, user_id: userId })
    .select()
    .single()

  if (error) throw error
  return data as SearchProfile
}

// ============================================================
// Applications
// ============================================================
export async function createApplication(
  application: Omit<Application, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Application> {
  const { data, error } = await supabase
    .from('applications')
    .insert(application)
    .select()
    .single()

  if (error) throw error

  // Actualizar status del match a 'applied'
  await updateMatchStatus(application.jobMatchId, 'applied')

  return data as Application
}

export async function getApplications(userId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      *,
      job_match:job_matches(
        score,
        job_post:job_posts(title, company, apply_url, modality, source:job_sources(display_name))
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Application[]
}

// ============================================================
// Stats para el dashboard (desde job_posts)
// ============================================================
export async function getDashboardStats() {
  const today   = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: posts }, { data: apps }] = await Promise.all([
    supabase.from('job_posts').select('id, created_at'),
    supabase.from('applications').select('id, status'),
  ])

  const allPosts = posts ?? []
  const allApps  = apps  ?? []

  const statusCount = (s: string) => allApps.filter(a => a.status === s).length

  return {
    total:      allPosts.length,
    todayNew:   allPosts.filter(p => p.created_at.startsWith(today)).length,
    weekNew:    allPosts.filter(p => p.created_at >= weekAgo).length,
    applied:    allApps.length,
    screening:  statusCount('screening'),
    interview:  statusCount('interview'),
    offer:      statusCount('offer'),
    rejected:   statusCount('rejected'),
    ghosted:    statusCount('ghosted'),
  }
}
