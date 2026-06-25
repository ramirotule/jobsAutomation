import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // 1. Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Parsear body
    const body = await request.json().catch(() => ({}))
    const { action, token, searchQuery, maxResults, runId, datasetId } = body

    // 3. Fallback al token de entorno (.env.local)
    const activeToken = token || process.env.APIFY_API_TOKEN

    if (!activeToken) {
      return NextResponse.json(
        { error: 'Falta el token de Apify. Configurá APIFY_API_TOKEN en el archivo .env.local o ingresalo en el campo de la interfaz.' },
        { status: 400 }
      )
    }

    // --- ACCIÓN: START ---
    if (action === 'start') {
      if (!searchQuery) {
        return NextResponse.json({ error: 'Falta el término de búsqueda (searchQuery)' }, { status: 400 })
      }

      const limit = Math.min(Math.max(1, Number(maxResults) || 10), 50)
      const apifyStartUrl = `https://api.apify.com/v2/actors/harvestapi~linkedin-post-search/runs?token=${encodeURIComponent(activeToken)}`

      const response = await fetch(apifyStartUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchQuery,
          sortBy: 'date',
          maxResults: limit,
          excludeReposts: false,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error al iniciar run de Apify:', errorText)
        return NextResponse.json(
          { error: `Error de Apify (${response.status}): ${errorText || response.statusText}` },
          { status: response.status }
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

      // Consultamos el estado actual del run
      const apifyStatusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(activeToken)}`
      const statusResponse = await fetch(apifyStatusUrl)

      if (!statusResponse.ok) {
        const errText = await statusResponse.text()
        return NextResponse.json({ error: `Error obteniendo estado: ${errText}` }, { status: statusResponse.status })
      }

      const runStatusInfo = await statusResponse.json()
      const currentStatus = runStatusInfo.data.status

      if (currentStatus === 'SUCCEEDED') {
        // Obtenemos los items del dataset
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

      // Si sigue corriendo (RUNNING, READY, etc)
      return NextResponse.json({ success: true, status: currentStatus })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    console.error('Error en /api/linkedin-test:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
