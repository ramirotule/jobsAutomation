import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: searchProfile } = await supabase
      .from('search_profiles')
      .select('apify_key')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    const apifyKey = searchProfile?.apify_key
    if (!apifyKey) {
      return NextResponse.json({ configured: false })
    }

    const response = await fetch(`https://api.apify.com/v2/users/me/limits?token=${encodeURIComponent(apifyKey)}`)
    if (!response.ok) {
      return NextResponse.json({ error: `Error de Apify (${response.status})` }, { status: response.status })
    }

    const body = await response.json()
    const usageUsd = body?.data?.current?.monthlyUsageUsd
    const limitUsd = body?.data?.limits?.maxMonthlyUsageUsd

    if (typeof usageUsd !== 'number' || typeof limitUsd !== 'number') {
      return NextResponse.json({ error: 'Respuesta inesperada de Apify' }, { status: 502 })
    }

    return NextResponse.json({ configured: true, usageUsd, limitUsd })
  } catch (error: any) {
    console.error('Error en /api/apify-usage:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
