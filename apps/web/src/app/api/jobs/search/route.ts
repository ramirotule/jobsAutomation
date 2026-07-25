import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { saveNormalizedJobs, type NormalizedJob } from '@/lib/jobSearch'

// ============================================================
// JobSpy — the only provider. Self-hosted microservice (services/jobspy-api)
// covering LinkedIn + Indeed + Glassdoor together.
// ============================================================
async function fetchJobSpy(
  query: string,
  location: string,
  datePosted: string,
  remoteOnly: boolean,
  excludeCompanies: Set<string>,
): Promise<{ jobs: NormalizedJob[]; rawCount: number }> {
  const baseUrl = process.env.JOBSPY_API_URL
  if (!baseUrl) {
    throw new Error('JOBSPY_API_URL not configured. Set it in .env.local (e.g. http://localhost:8000)')
  }

  const apiSecret = process.env.JOBSPY_API_SECRET || ''

  const hoursMap: Record<string, number> = {
    'hour': 1,
    'today': 24,
    '3days': 72,
    'week': 168,
    'month': 720,
    'all': 168,
  }

  const body = {
    query,
    // Glassdoor doesn't support a worldwide/remote-everywhere search — it needs
    // a specific country, which conflicts with "remote in every country".
    sites: ['linkedin', 'indeed'],
    location: remoteOnly ? 'Remote' : location,
    is_remote: remoteOnly || location === 'Remote',
    results_wanted: 50,
    hours_old: hoursMap[datePosted] || 168,
    exclude_companies: Array.from(excludeCompanies),
    exclude_locations: ['brazil', 'brasil'],
  }

  console.log(`[JobSpy] Fetching: ${baseUrl}/search`, JSON.stringify({ query, location, is_remote: body.is_remote, hours_old: body.hours_old }))

  const res = await fetch(`${baseUrl}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiSecret ? { 'X-API-Key': apiSecret } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`[JobSpy] error ${res.status}:`, errText)
    throw new Error(`JobSpy error ${res.status}: ${errText}`)
  }

  const json = await res.json()
  const rawJobs: any[] = json.data || []
  console.log(`[JobSpy] raw jobs: ${rawJobs.length}`)

  const jobs: NormalizedJob[] = rawJobs.map((job: any) => ({
    external_id: job.external_id || `jobspy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    // The microservice's own per-job `site` field reflects what it actually
    // scraped (linkedin/indeed/glassdoor) — shown as a badge on each job card.
    source: (job.site || 'jobspy').toLowerCase(),
    title: job.title || '',
    company: job.company || '',
    location: job.location || '',
    apply_url: job.apply_url || null,
    description: job.description || '',
    modality: job.modality || 'remote',
    posted_at: job.posted_at || new Date().toISOString(),
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: job.salary_currency || 'USD',
    salary_period: 'yearly',
    required_skills: job.required_skills || [],
  }))

  return { jobs, rawCount: rawJobs.length }
}

// ============================================================
// Route handler
// ============================================================
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const query: string = body.query || 'frontend developer'
    const location: string = body.location || 'Remote'
    const datePosted: string = body.datePosted || 'all'
    const remoteOnly: boolean = body.remoteOnly ?? false

    // Excluded companies / ignored jobs — JobSpy also excludes server-side,
    // this is a redundant client-side double-check.
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const [{ data: recentApps }, { data: ignoredJobs }] = await Promise.all([
      supabase
        .from('applications')
        .select('company')
        .eq('user_id', user.id)
        .gte('applied_at', oneWeekAgo.toISOString()),
      supabase
        .from('ignored_jobs')
        .select('external_id, company')
        .eq('user_id', user.id),
    ])

    const allExcluded = new Set([
      ...(recentApps || []).map((a) => a.company?.toLowerCase().trim()),
      ...(ignoredJobs || []).map((ij) => ij.company?.toLowerCase().trim()).filter(Boolean),
    ])

    const result = await fetchJobSpy(query, location, datePosted, remoteOnly, allExcluded)

    // Hard safety net: never persist onsite/hybrid jobs when remote-only was
    // requested, regardless of whether JobSpy's own filter worked.
    const normalizedJobs = remoteOnly
      ? result.jobs.filter((job) => job.modality === 'remote')
      : result.jobs

    const saveResult = await saveNormalizedJobs(supabase, user.id, 'jobspy', normalizedJobs)

    return NextResponse.json({ success: true, count: saveResult.count, message: saveResult.message })
  } catch (error: any) {
    console.error('[JobSearch] error:', error)
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 })
  }
}
