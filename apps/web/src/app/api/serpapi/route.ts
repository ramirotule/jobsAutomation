import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

const SERPAPI_KEY = process.env.SERPAPI_KEY || ''

export async function POST(request: Request) {
  try {
    if (!SERPAPI_KEY) {
      return NextResponse.json({ error: 'Falta configurar SERPAPI_KEY en .env.local' }, { status: 500 })
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const query: string = body.query || 'frontend developer'
    const location: string = body.location || 'Argentina'
    const datePosted: string = body.datePosted || '' // 'today', 'week', 'month' or ''

    const GL_MAP: Record<string, string> = {
      'Argentina': 'ar',
      'United States': 'us',
      'España': 'es',
      'México': 'mx',
      'Remote': 'us',
    }

    const url = new URL('https://serpapi.com/search')
    url.searchParams.set('engine', 'google_jobs')
    url.searchParams.set('q', query)
    url.searchParams.set('location', location)
    url.searchParams.set('gl', GL_MAP[location] || 'ar')
    url.searchParams.set('hl', 'es')
    url.searchParams.set('api_key', SERPAPI_KEY)
    if (datePosted) url.searchParams.set('chips', `date_posted:${datePosted}`)

    const res = await fetch(url.toString())

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `SerpAPI error ${res.status}: ${errText}` }, { status: 502 })
    }

    const json = await res.json()

    if (json.error) {
      // "no results" is not a real error
      if (json.error.toLowerCase().includes('no results') || json.error.toLowerCase().includes("hasn't returned")) {
        return NextResponse.json({ success: true, count: 0, message: 'Google Jobs no encontró resultados para esta búsqueda. Probá con otro término o sin filtro de fecha.' })
      }
      return NextResponse.json({ error: json.error }, { status: 502 })
    }

    const rawJobs: any[] = Array.isArray(json.jobs_results) ? json.jobs_results : []
    console.log(`[SerpAPI] raw jobs: ${rawJobs.length}`)

    // Excluded companies / ignored jobs
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

    // Normalize to job_posts schema
    const normalized = rawJobs
      .map((job: any) => {
        const applyLink =
          job.apply_options?.[0]?.link ||
          job.related_links?.[0]?.link ||
          null

        const isRemote =
          job.detected_extensions?.work_from_home === true ||
          (job.location || '').toLowerCase().includes('remoto') ||
          (job.location || '').toLowerCase().includes('remote')

        return {
          external_id: job.job_id || `serpapi-${Date.now()}-${Math.random()}`,
          title: job.title,
          company: job.company_name,
          location: job.location || location,
          apply_url: applyLink,
          description: job.description,
          modality: isRemote ? 'remote' : 'onsite',
          posted_at: job.detected_extensions?.posted_at
            ? parseSerpDate(job.detected_extensions.posted_at)
            : new Date().toISOString(),
        }
      })
      .filter((job) => {
        const companyName = job.company?.toLowerCase().trim()
        if (excludedCompanies.has(companyName)) return false
        if (companyName && ignoredCompanies.has(companyName)) return false
        return true
      })

    // Deduplicate by company (upsert conflict key)
    const seen = new Set<string>()
    const deduped = normalized.filter((job) => {
      const key = job.company?.toLowerCase().trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

    console.log(`[SerpAPI] after filter: ${normalized.length}, after dedup: ${deduped.length} / ${rawJobs.length}`)

    if (rawJobs.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'SerpAPI no devolvió resultados para esta búsqueda.' })
    }

    if (deduped.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: `Se encontraron ${rawJobs.length} vacantes pero todas fueron filtradas (empresas postuladas o en lista negra).`,
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
    console.error('[SerpAPI] error:', error)
    return NextResponse.json({ error: error.message || 'Error inesperado' }, { status: 500 })
  }
}

// SerpAPI devuelve "3 days ago", "1 week ago", etc.
function parseSerpDate(str: string): string {
  const now = new Date()
  const match = str.match(/(\d+)\s+(minute|hour|day|week|month)/)
  if (!match) return now.toISOString()
  const n = parseInt(match[1])
  const unit = match[2]
  if (unit === 'minute') now.setMinutes(now.getMinutes() - n)
  else if (unit === 'hour') now.setHours(now.getHours() - n)
  else if (unit === 'day') now.setDate(now.getDate() - n)
  else if (unit === 'week') now.setDate(now.getDate() - n * 7)
  else if (unit === 'month') now.setMonth(now.getMonth() - n)
  return now.toISOString()
}
