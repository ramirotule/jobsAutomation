import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import { supabase } from '@/lib/supabase'

const execAsync = promisify(exec)

export async function POST() {
  try {
    // 1. Ejecutar el script desde node.js
    // process.cwd() en Next.js apunta a la raíz de Next (en tu caso 'apps/web'). 
    // Por eso subimos 2 niveles para llegar a 'scripts'
    const scriptPath = path.resolve(process.cwd(), '../../scripts/linkedin_scraper.py')
    const { stdout, stderr } = await execAsync(`python3 "${scriptPath}"`)
    
    // 2. Leer la respuesta JSON que imprimió Python
    // Buscamos sacar cualquier warning innecesario de python que arruine el parse
    const resultString = stdout.substring(stdout.indexOf('{'))
    const result = JSON.parse(resultString)
    
    // 3. Guardar las vacantes extraídas en la DB
    if (result.data && result.data.length > 0) {
      const { error } = await supabase
        .from('job_posts')
        .insert(result.data.map((job: any) => ({
          title: job.title,
          company: job.company,
          location: job.location,
          apply_url: job.applyUrl,
          description: job.description,  // Guardamos la descripcion
          posted_at: new Date().toISOString()
        })))
        
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
