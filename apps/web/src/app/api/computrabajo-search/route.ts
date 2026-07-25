import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { extractSkillsFromText, saveNormalizedJobs, type NormalizedJob } from '@/lib/jobSearch'

// ============================================================
// Computrabajo provider — Apify actor (async), no official API exists.
// Actor: memo23/computrabajo-scraper (verified input/output schema at
// https://apify.com/memo23/computrabajo-scraper/api). Uses startUrls
// pointed at ar.computrabajo.com so results stay in Argentina — the
// documented `searchQueries` shortcut defaults to the Mexico portal.
// ============================================================

function slugifyQuery(query: string): string {
  return query
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeComputrabajoItem(item: any): NormalizedJob {
  return {
    external_id: `computrabajo-${item.jobUrl || item.title}-${item.company}`,
    source: 'computrabajo',
    title: item.title || '',
    company: item.company || '',
    location: item.location || '',
    apply_url: item.jobUrl || null,
    description: item.description || '',
    // Computrabajo doesn't expose a reliable remote flag in this actor's output —
    // best-effort text match, review results manually until this is confirmed.
    modality: /remoto|remote|home ?office/i.test(`${item.title} ${item.description || ''}`) ? 'remote' : 'onsite',
    posted_at: new Date().toISOString(),
    salary_min: item.salaryValue || null,
    salary_max: item.salaryValue || null,
    salary_currency: item.salaryCurrency || 'ARS',
    salary_period: item.salaryUnit || 'monthly',
    required_skills: item.skills || extractSkillsFromText(item.description),
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { action, token, searchQuery, maxResults, runId, datasetId, remoteOnly } = body

    const activeToken = token || process.env.APIFY_API_TOKEN
    if (!activeToken) {
      return NextResponse.json({ error: 'apify_key_missing' }, { status: 402 })
    }

    // --- ACTION: start ---
    if (action === 'start') {
      if (!searchQuery) {
        return NextResponse.json({ error: 'Falta el término de búsqueda (searchQuery)' }, { status: 400 })
      }

      const limit = Math.min(Math.max(1, Number(maxResults) || 30), 200)
      const searchUrl = `https://ar.computrabajo.com/trabajo-de-${slugifyQuery(searchQuery)}`
      const apifyStartUrl = `https://api.apify.com/v2/actors/memo23~computrabajo-scraper/runs?token=${encodeURIComponent(activeToken)}`

      const response = await fetch(apifyStartUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: searchUrl }],
          scrapeDetails: false,
          maxItems: limit,
          maxItemsPerSearch: limit,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Computrabajo] Error al iniciar run de Apify:', errorText)
        return NextResponse.json(
          { error: `Error de Apify (${response.status}): ${errorText || response.statusText}` },
          { status: response.status },
        )
      }

      const runInfo = await response.json()
      return NextResponse.json({
        success: true,
        runId: runInfo.data.id,
        datasetId: runInfo.data.defaultDatasetId,
        status: runInfo.data.status,
      })
    }

    // --- ACTION: status ---
    if (action === 'status') {
      if (!runId || !datasetId) {
        return NextResponse.json({ error: 'Faltan los IDs del run o dataset' }, { status: 400 })
      }

      const apifyStatusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(activeToken)}`
      const statusResponse = await fetch(apifyStatusUrl)

      if (!statusResponse.ok) {
        const errText = await statusResponse.text()
        return NextResponse.json({ error: `Error obteniendo estado: ${errText}` }, { status: statusResponse.status })
      }

      const runStatusInfo = await statusResponse.json()
      const currentStatus = runStatusInfo.data.status

      if (currentStatus === 'SUCCEEDED') {
        const apifyItemsUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(activeToken)}`
        const itemsResponse = await fetch(apifyItemsUrl)

        if (!itemsResponse.ok) {
          const errText = await itemsResponse.text()
          return NextResponse.json({ error: `Error obteniendo resultados: ${errText}` }, { status: itemsResponse.status })
        }

        const items: any[] = await itemsResponse.json()
        const allJobs = items.map(normalizeComputrabajoItem)
        // Same hard safety net as api/jobs/search: this actor has no structured
        // remote flag, only the title/description text heuristic set above.
        const normalizedJobs = remoteOnly ? allJobs.filter((job) => job.modality === 'remote') : allJobs
        const saveResult = await saveNormalizedJobs(supabase, user.id, 'computrabajo', normalizedJobs)

        return NextResponse.json({ success: true, status: currentStatus, count: saveResult.count, message: saveResult.message })
      }

      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(currentStatus)) {
        return NextResponse.json({ success: true, status: currentStatus, error: `El run de Apify terminó con estado: ${currentStatus}` })
      }

      return NextResponse.json({ success: true, status: currentStatus })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    console.error('[Computrabajo] error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
