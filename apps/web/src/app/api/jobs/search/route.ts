import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

// ============================================================
// Provider configs
// ============================================================
type Provider = 'jobspy' | 'jsearch' | 'linkedin-api'

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

function extractSkillsFromText(text: string | string[] | undefined): string[] {
  if (!text) return []
  const str = Array.isArray(text) ? text.join(' ') : text
  const lower = str.toLowerCase()
  return KNOWN_SKILLS.filter((skill) => lower.includes(skill))
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
): Promise<{ jobs: NormalizedJob[]; rawCount: number }> {
  const baseUrl = process.env.JOBSPY_API_URL
  if (!baseUrl) {
    throw new Error('JOBSPY_API_URL not configured. Set it in .env.local (e.g. http://localhost:8000)')
  }

  const apiSecret = process.env.JOBSPY_API_SECRET || ''

  const hoursMap: Record<string, number> = {
    'today': 24,
    '3days': 72,
    'week': 168,
    'month': 720,
    'all': 168,
  }

  const body = {
    query,
    sites: ['linkedin', 'indeed', 'glassdoor'],
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
interface NormalizedJob {
  external_id: string
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
  url.searchParams.set('date_posted', datePosted)
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

    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || ''
    if (!RAPIDAPI_KEY) {
      return NextResponse.json(
        { error: 'Missing RAPIDAPI_KEY in environment.' },
        { status: 500 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const provider: Provider = body.provider || 'jsearch'
    const query: string = body.query || 'frontend developer'
    const location: string = body.location || 'Remote'
    const datePosted: string = body.datePosted || 'all'
    const remoteOnly: boolean = body.remoteOnly ?? false
    const page: number = body.page || 1
    const employmentTypes: string = body.employmentTypes || ''

    if (!PROVIDERS_CONFIG[provider]) {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
    }

    // Excluded companies / ignored jobs (needed by all providers)
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

    const excludedCompanies = new Set((recentApps || []).map((a) => a.company?.toLowerCase().trim()))
    const ignoredCompanies = new Set(
      (ignoredJobs || []).map((ij) => ij.company?.toLowerCase().trim()).filter(Boolean),
    )
    const allExcluded = new Set([...excludedCompanies, ...ignoredCompanies])

    // Fetch from selected provider
    let result: { jobs: NormalizedJob[]; rawCount: number }

    switch (provider) {
      case 'jobspy':
        // JobSpy handles exclusion server-side
        result = await fetchJobSpy(query, location, datePosted, remoteOnly, allExcluded)
        break
      case 'linkedin-api':
        result = await fetchLinkedInApi(RAPIDAPI_KEY, query, location, datePosted, remoteOnly, page)
        break
      case 'jsearch':
      default:
        result = await fetchJSearch(RAPIDAPI_KEY, query, location, datePosted, remoteOnly, page, employmentTypes)
        break
    }

    const { jobs: normalizedJobs, rawCount } = result

    if (rawCount === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: `${provider} returned no results. Try a different term, location, or remove date filters.`,
      })
    }

    // Filter excluded companies (JobSpy already does this server-side, but double-check)
    const filtered = normalizedJobs.filter((job) => {
      const companyName = job.company?.toLowerCase().trim()
      if (excludedCompanies.has(companyName)) return false
      if (companyName && ignoredCompanies.has(companyName)) return false
      return true
    })

    // Deduplicate by company
    const seen = new Set<string>()
    const deduped = filtered.filter((job) => {
      const key = job.company?.toLowerCase().trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

    console.log(`[${provider}] after filter: ${filtered.length}, after dedup: ${deduped.length} / ${rawCount}`)

    if (deduped.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: `Found ${rawCount} jobs but all were filtered (applied or blacklisted companies).`,
      })
    }

    const { error: dbError } = await supabase
      .from('job_posts')
      .upsert(
        deduped.map((job) => ({ user_id: user.id, ...job })),
        { onConflict: 'user_id, company' },
      )

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: deduped.length })
  } catch (error: any) {
    console.error('[JobSearch] error:', error)
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 })
  }
}
