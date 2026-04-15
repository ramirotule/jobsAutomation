import { createClient as createCoreClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import type { JobMatch, JobPost, SearchProfile, Application, Alert, JobFilters } from '@/types'

// Usar el cliente unificado que maneja cookies/sesión correctamente
export const supabase = createClient()

// Supabase client con service role para uso server-side (n8n / cron)
export function createServiceClient() {
  return createCoreClient(
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
    socialMediaId:    row.social_media_id ?? {},
    lastSocialMediaPostedAt: row.last_social_media_posted_at ?? '',
  }
}

export async function getJobPosts(
  filters: JobFilters = {},
  page = 0,
  pageSize = 25,
  client = supabase
): Promise<{ data: JobPost[]; total: number }> {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { data: [], total: 0 };

  // Use the view that excludes applied jobs by default as per user request
  let query = client
    .from('v_available_vacancies')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('posted_at', { ascending: false, nullsFirst: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('job_posts')
    .delete()
    .eq('user_id', user.id)

  if (error) throw error
}

export async function deleteFilteredJobPosts(filters: JobFilters): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let query = supabase
    .from('job_posts')
    .delete()
    .eq('user_id', user.id)

  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,company.ilike.%${filters.search}%`)
  }

  const { error } = await query
  if (error) throw error
}

export async function ignoreJobPost(job: JobPost, muteCompany: boolean = false): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 1. Add to ignored_jobs table
  const { error: ignoreError } = await supabase
    .from('ignored_jobs')
    .upsert({
      user_id: user.id,
      external_id: job.externalId || null,
      company: muteCompany ? job.company : null,
      reason: 'User muted'
    }, { onConflict: 'user_id, external_id' });

  if (ignoreError) throw ignoreError;

  // 2. Remove from active job_posts
  if (muteCompany) {
    const { error: deleteError } = await supabase
      .from('job_posts')
      .delete()
      .eq('user_id', user.id)
      .eq('company', job.company);
    if (deleteError) throw deleteError;
  } else {
    await deleteJobPost(job.id);
  }
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
export async function getDashboardStats(client = supabase) {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const today   = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: posts }, { data: apps }] = await Promise.all([
    client.from('job_posts').select('id, posted_at, created_at').eq('user_id', user.id),
    client.from('applications').select('id, status').eq('user_id', user.id),
  ])

  const allPosts = posts ?? []
  const allApps  = apps  ?? []

  const statusCount = (s: string) => allApps.filter(a => a.status === s).length

  return {
    total:      allPosts.length,
    todayNew:   allPosts.filter(p => (p.posted_at ?? p.created_at ?? '').startsWith(today)).length,
    weekNew:    allPosts.filter(p => (p.posted_at ?? p.created_at ?? '') >= weekAgo).length,
    applied:    allApps.length,
    screening:  statusCount('screening'),
    interview:  statusCount('interview'),
    offer:      statusCount('offer'),
    rejected:   statusCount('rejected'),
    ghosted:    statusCount('ghosted'),
  }
}

/**
 * Función para registrar un usuario nuevo (Sign Up)
 */
export async function signUpUser(
  email: string, 
  password: string, 
  metadata?: {
    first_name?: string;
    last_name?: string;
    target_area?: string;
    target_roles?: string[];
  }
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata
    }
  })

  if (error) throw error
  return data
}

/**
 * Función para iniciar sesión (Sign In con Password)
 */
export async function signInUser(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}
