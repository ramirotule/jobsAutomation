import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

const execAsync = promisify(exec)

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // 0. Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}));
    const site = body.site || 'linkedin';
    const searchTerm = body.searchTerm || 'frontend developer';
    const hoursOld = body.hoursOld || 24;

    // 1. Ejecutar el script desde node.js
    const scriptPath = path.resolve(process.cwd(), '../../scripts/linkedin_scraper.py')
    const { stdout } = await execAsync(`python3 "${scriptPath}" "${site}" "${searchTerm}" "${hoursOld}"`)
    
    // 2. Leer la respuesta JSON que imprimió Python
    const resultString = stdout.substring(stdout.indexOf('{'))
    const result = JSON.parse(resultString)
    
    // 3. Guardar las vacantes extraídas en la DB asociadas al usuario (evitando duplicados)
    if (result.data && result.data.length > 0) {
      const { error } = await supabase
        .from('job_posts')
        .upsert(result.data.map((job: any) => ({
          user_id: user.id,
          external_id: job.external_id,
          title: job.title,
          company: job.company,
          location: job.location,
          apply_url: job.applyUrl,
          description: job.description,
          posted_at: new Date().toISOString()
        })), { onConflict: 'user_id, company' })
        
      if (error) {
        console.error("Error al insertar en DB:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, count: result.count })
  } catch (error: any) {
    console.error("Error al ejecutar script:", error)
    return NextResponse.json({ error: error.message || 'Hubo un error al buscar vacantes' }, { status: 500 })
  }
}
