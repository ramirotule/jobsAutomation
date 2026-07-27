import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

// ============================================================
// Test route for the "Dr_Linkedln_Scrappy" Apify actor (id ImEoHosy5szOFhKQ6),
// a LinkedIn Jobs scraper. Kept separate from /api/linkedin-test, which talks
// to a different actor (harvestapi/linkedin-post-search — LinkedIn posts,
// not job listings).
// ============================================================
const ACTOR_ID = 'ImEoHosy5szOFhKQ6'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { action, token, runId, datasetId } = body

    const activeToken = token || process.env.APIFY_API_TOKEN
    if (!activeToken) {
      return NextResponse.json({ error: 'apify_key_missing' }, { status: 402 })
    }

    // --- ACCIÓN: START ---
    if (action === 'start') {
      const {
        jobTitle,
        location,
        workSchedule = 'Any',
        maxJobs = 50,
        companyNames = [],
        experienceLevel = 'Any',
        jobType = 'Any',
        jobPostingTime = 'Any Time',
        searchAfterJobs = 0,
      } = body

      if (!jobTitle) {
        return NextResponse.json({ error: 'Falta el título de búsqueda (jobTitle)' }, { status: 400 })
      }

      const limit = Math.min(Math.max(1, Number(maxJobs) || 50), 100)
      const apifyStartUrl = `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${encodeURIComponent(activeToken)}`

      const response = await fetch(apifyStartUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle,
          location: location || 'Argentina',
          workSchedule,
          maxJobs: limit,
          companyNames,
          experienceLevel,
          jobType,
          jobPostingTime,
          searchAfterJobs,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[linkedin-jobs-test] Error al iniciar run:', errorText)
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

    // --- ACCIÓN: STATUS ---
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

        const items = await itemsResponse.json()
        return NextResponse.json({ success: true, status: currentStatus, data: items })
      }

      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(currentStatus)) {
        return NextResponse.json({ success: true, status: currentStatus, error: `El run de Apify terminó con estado: ${currentStatus}` })
      }

      return NextResponse.json({ success: true, status: currentStatus })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    console.error('Error en /api/linkedin-jobs-test:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
