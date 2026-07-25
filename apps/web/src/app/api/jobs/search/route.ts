import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { extractSkillsFromText, saveNormalizedJobs, type NormalizedJob } from '@/lib/jobSearch'

// ============================================================
// Provider configs
// ============================================================
type Provider = 'jobspy' | 'jsearch' | 'linkedin-api' | 'indeed' | 'glassdoor' | 'getonboard'

const PROVIDERS_CONFIG: Record<Provider, { host: string; basePath: string }> = {
  'jobspy': {
    host: '', // uses JOBSPY_API_URL env var
    basePath: '/search',
  },
  'jsearch': {
    host: 'jsearch.p.rapidapi.com',
    basePath: '/search',
  },
  'linkedin-api': {
    host: 'linkedin-job-search-api.p.rapidapi.com',
    basePath: '/active-jb',
  },
  'indeed': {
    host: '', // uses JOBSPY_API_URL env var (jobspy filtered to a single site)
    basePath: '/search',
  },
  'glassdoor': {
    host: '', // uses JOBSPY_API_URL env var (jobspy filtered to a single site)
    basePath: '/search',
  },
  'getonboard': {
    host: 'www.getonbrd.com', // official public API, no RapidAPI key needed
    basePath: '/api/v0/search/jobs',
  },
}

const COUNTRY_MAP: Record<string, string> = {
  'Argentina': 'ar',
  'United States': 'us',
  'España': 'es',
  'México': 'mx',
  'Remote': 'us',
  'Colombia': 'co',
  'Chile': 'cl',
  'Uruguay': 'uy',
  'Brasil': 'br',
}

// ============================================================
// JobSpy provider (self-hosted microservice)
// ============================================================
async function fetchJobSpy(
  query: string,
  location: string,
  datePosted: string,
  remoteOnly: boolean,
  excludeCompanies: Set<string>,
  sites: string[] = ['linkedin', 'indeed', 'glassdoor'],
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
    sites,
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
    // Trust the microservice's own per-job `site` field over our request intent —
    // it reflects what jobspy actually scraped, not just what we asked for.
    source: (job.site || sites[0] || 'jobspy').toLowerCase(),
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
// JSearch provider
// ============================================================
async function fetchJSearch(
  apiKey: string,
  query: string,
  location: string,
  datePosted: string,
  remoteOnly: boolean,
  page: number,
  employmentTypes: string,
): Promise<{ jobs: NormalizedJob[]; rawCount: number }> {
  const { host, basePath } = PROVIDERS_CONFIG['jsearch']
  const url = new URL(`https://${host}${basePath}`)
  url.searchParams.set('query', query)
  url.searchParams.set('page', String(page))
  url.searchParams.set('num_pages', '1')
  // JSearch's date_posted enum has no hour-level granularity — 'today' is the closest match
  url.searchParams.set('date_posted', datePosted === 'hour' ? 'today' : datePosted)
  if (remoteOnly) url.searchParams.set('remote_jobs_only', 'true')
  if (employmentTypes) url.searchParams.set('employment_types', employmentTypes)
  const countryCode = COUNTRY_MAP[location]
  if (countryCode) url.searchParams.set('country', countryCode)

  console.log(`[JSearch] Fetching: ${url.toString().replace(apiKey, '***')}`)

  const res = await fetch(url.toString(), {
    headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': host },
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`[JSearch] API error ${res.status}:`, errText)
    throw new Error(`JSearch error ${res.status}: ${errText}`)
  }

  const json = await res.json()
  console.log(`[JSearch] status: ${json.status}, data_length: ${json.data?.length}`)

  const rawJobs: any[] = Array.isArray(json.data) ? json.data : []

  const jobs: NormalizedJob[] = rawJobs.map((job: any) => ({
    external_id: job.job_id || `jsearch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    // JSearch reports which board a listing actually came from — use it when present.
    source: (job.job_publisher || 'jsearch').toLowerCase(),
    title: job.job_title || '',
    company: job.employer_name || '',
    location: [job.job_city, job.job_state, job.job_country].filter(Boolean).join(', '),
    apply_url: job.job_apply_link || null,
    description: job.job_description || '',
    modality: job.job_is_remote ? 'remote' : 'onsite',
    posted_at: job.job_posted_at_datetime_utc || new Date().toISOString(),
    salary_min: job.job_min_salary,
    salary_max: job.job_max_salary,
    salary_currency: job.job_salary_currency || 'USD',
    salary_period: job.job_salary_period || 'yearly',
    required_skills:
      job.job_required_skills ||
      extractSkillsFromText(job.job_highlights?.Qualifications),
  }))

  return { jobs, rawCount: rawJobs.length }
}

// ============================================================
// LinkedIn Job Search API provider
// (linkedin-job-search-api.p.rapidapi.com)
// ============================================================
const LINKEDIN_TIME_MAP: Record<string, string> = {
  // No verified 1h-granularity value for this RapidAPI's time_frame param —
  // fall back to the same 24h bucket as 'today' rather than guessing one.
  'hour': '24h',
  'today': '24h',
  '3days': '72h',
  'week': '7d',
  'month': '30d',
  'all': '30d',
}

const LINKEDIN_LOCATION_MAP: Record<string, string> = {
  'Argentina': '"Argentina"',
  'United States': '"United States"',
  'España': '"Spain"',
  'México': '"Mexico"',
  'Colombia': '"Colombia"',
  'Chile': '"Chile"',
  'Uruguay': '"Uruguay"',
  'Brasil': '"Brazil"',
  'Remote': '"United States" OR "United Kingdom"',
}

async function fetchLinkedInApi(
  apiKey: string,
  query: string,
  location: string,
  datePosted: string,
  remoteOnly: boolean,
  page: number,
): Promise<{ jobs: NormalizedJob[]; rawCount: number }> {
  const { host, basePath } = PROVIDERS_CONFIG['linkedin-api']
  const url = new URL(`https://${host}${basePath}`)

  url.searchParams.set('title', query)
  url.searchParams.set('time_frame', LINKEDIN_TIME_MAP[datePosted] || '7d')
  url.searchParams.set('limit', '25')
  url.searchParams.set('offset', String((page - 1) * 25))
  url.searchParams.set('description_format', 'text')

  const locationFilter = LINKEDIN_LOCATION_MAP[location] || `"${location}"`
  url.searchParams.set('location', locationFilter)

  if (remoteOnly || location === 'Remote') {
    url.searchParams.set('location_advanced', 'latam')
  }

  console.log(`[LinkedIn API] Fetching: ${url.toString().replace(apiKey, '***')}`)

  const res = await fetch(url.toString(), {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': host,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`[LinkedIn API] error ${res.status}:`, errText)
    throw new Error(`LinkedIn API error ${res.status}: ${errText}`)
  }

  const json = await res.json()
  // Log first item keys to understand shape
  const rawJobs: any[] = Array.isArray(json) ? json : (json.data || json.results || json.jobs || [])
  console.log(`[LinkedIn API] raw jobs: ${rawJobs.length}`)
  if (rawJobs.length > 0) {
    console.log(`[LinkedIn API] sample keys:`, Object.keys(rawJobs[0]).join(', '))
  }

  const jobs: NormalizedJob[] = rawJobs.map((job: any) => {
    const jobLocation = job.location || job.job_location || ''
    const isRemote =
      jobLocation.toLowerCase().includes('remote') ||
      (job.title || '').toLowerCase().includes('remote')

    return {
      external_id: job.id || job.job_id || `linkedin-api-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source: 'linkedin',
      title: job.title || job.job_title || '',
      company: job.company_name || job.organization || job.company || '',
      location: jobLocation,
      apply_url: job.url || job.linkedin_url || job.apply_url || null,
      description: job.description || job.job_description || '',
      modality: isRemote ? 'remote' : 'onsite',
      posted_at: job.posted_date || job.date_posted || job.created_at || new Date().toISOString(),
      salary_min: job.salary_min || job.min_salary || null,
      salary_max: job.salary_max || job.max_salary || null,
      salary_currency: job.salary_currency || 'USD',
      salary_period: job.salary_period || 'yearly',
      required_skills: extractSkillsFromText(job.description || job.job_description),
    }
  })

  return { jobs, rawCount: rawJobs.length }
}

// ============================================================
// Get on Board provider
// Official public API — GET /api/v0/search/jobs, no auth required
// for public listings. Verified against https://www.getonbrd.com/doc/openapi.yaml
// ============================================================
async function fetchGetOnBoard(
  query: string,
  remoteOnly: boolean,
  page: number,
): Promise<{ jobs: NormalizedJob[]; rawCount: number }> {
  const { host, basePath } = PROVIDERS_CONFIG['getonboard']
  const url = new URL(`https://${host}${basePath}`)
  url.searchParams.set('query', query)
  url.searchParams.set('lang', 'es')
  url.searchParams.set('per_page', '50')
  url.searchParams.set('page', String(page))
  if (remoteOnly) url.searchParams.set('remote', 'true')

  console.log(`[GetOnBoard] Fetching: ${url.toString()}`)

  const res = await fetch(url.toString())

  if (!res.ok) {
    const errText = await res.text()
    console.error(`[GetOnBoard] error ${res.status}:`, errText)
    throw new Error(`GetOnBoard error ${res.status}: ${errText}`)
  }

  const json = await res.json()
  const rawJobs: any[] = Array.isArray(json.data) ? json.data : []
  console.log(`[GetOnBoard] raw jobs: ${rawJobs.length}`)

  const jobs: NormalizedJob[] = rawJobs.map((item: any) => {
    const attrs = item.attributes || {}
    const companyAttrs = attrs.company?.data?.attributes || {}
    const publishedAt = typeof attrs.published_at === 'number'
      ? new Date(attrs.published_at * 1000).toISOString()
      : new Date().toISOString()

    return {
      external_id: `getonboard-${item.id}`,
      source: 'getonboard',
      title: attrs.title || '',
      company: companyAttrs.name || '',
      location: (attrs.countries || []).join(', '),
      apply_url: item.links?.public_url || null,
      description: attrs.description || attrs.description_headline || '',
      modality: attrs.remote ? 'remote' : 'onsite',
      posted_at: publishedAt,
      salary_min: attrs.min_salary ?? null,
      salary_max: attrs.max_salary ?? null,
      salary_currency: 'USD',
      salary_period: 'yearly',
      required_skills: extractSkillsFromText(attrs.description),
    }
  })

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
    const provider: Provider = body.provider || 'jsearch'
    const query: string = body.query || 'frontend developer'
    const location: string = body.location || 'Remote'
    const datePosted: string = body.datePosted || 'all'
    const remoteOnly: boolean = body.remoteOnly ?? false
    const page: number = body.page || 1
    const employmentTypes: string = body.employmentTypes || ''

    // Only jsearch and linkedin-api go through RapidAPI; jobspy/indeed/glassdoor use
    // the self-hosted JobSpy microservice, and getonboard needs no key at all.
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || ''
    if ((provider === 'jsearch' || provider === 'linkedin-api') && !RAPIDAPI_KEY) {
      return NextResponse.json(
        { error: 'Missing RAPIDAPI_KEY in environment.' },
        { status: 500 },
      )
    }

    if (!PROVIDERS_CONFIG[provider]) {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
    }

    // Excluded companies / ignored jobs (needed by jobspy-family providers server-side)
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

    // Fetch from selected provider
    let result: { jobs: NormalizedJob[]; rawCount: number }

    switch (provider) {
      case 'jobspy':
        // JobSpy handles exclusion server-side
        result = await fetchJobSpy(query, location, datePosted, remoteOnly, allExcluded)
        break
      case 'indeed':
        result = await fetchJobSpy(query, location, datePosted, remoteOnly, allExcluded, ['indeed'])
        break
      case 'glassdoor':
        result = await fetchJobSpy(query, location, datePosted, remoteOnly, allExcluded, ['glassdoor'])
        break
      case 'getonboard':
        result = await fetchGetOnBoard(query, remoteOnly, page)
        break
      case 'linkedin-api':
        result = await fetchLinkedInApi(RAPIDAPI_KEY, query, location, datePosted, remoteOnly, page)
        break
      case 'jsearch':
      default:
        result = await fetchJSearch(RAPIDAPI_KEY, query, location, datePosted, remoteOnly, page, employmentTypes)
        break
    }

    // Hard safety net: never persist onsite/hybrid jobs when remote-only was
    // requested, regardless of whether the upstream provider's own filter worked.
    const normalizedJobs = remoteOnly
      ? result.jobs.filter((job) => job.modality === 'remote')
      : result.jobs

    const saveResult = await saveNormalizedJobs(supabase, user.id, provider, normalizedJobs)

    return NextResponse.json({ success: true, count: saveResult.count, message: saveResult.message })
  } catch (error: any) {
    console.error('[JobSearch] error:', error)
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 })
  }
}
