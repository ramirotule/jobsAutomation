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
    
    // 3. Obtener empresas a las que ya se postuló en la última semana 
    // Y también los empleos/empresas marcados como ignorados
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const [ { data: recentApps }, { data: ignoredJobs } ] = await Promise.all([
      supabase
        .from('applications')
        .select('company')
        .eq('user_id', user.id)
        .gte('applied_at', oneWeekAgo.toISOString()),
      supabase
        .from('ignored_jobs')
        .select('external_id, company')
        .eq('user_id', user.id)
    ]);
    
    const excludedCompanies = new Set((recentApps || []).map(a => a.company?.toLowerCase().trim()));
    const ignoredJobIds = new Set((ignoredJobs || []).map(ij => ij.external_id).filter(Boolean));
    const ignoredCompanies = new Set((ignoredJobs || []).map(ij => ij.company?.toLowerCase().trim()).filter(Boolean));

    // 4. Guardar las vacantes extraídas filtrando las ya postuladas e ignoradas
    if (result.data && result.data.length > 0) {
      const filteredJobs = result.data.filter((job: any) => {
        const companyName = job.company?.toLowerCase().trim();
        const externalId = job.external_id;
        
        // Filtro 1: Ya postulado recientemente
        if (excludedCompanies.has(companyName)) return false;
        
        // Filtro 2: Job ID ignorado específicamente
        if (externalId && ignoredJobIds.has(externalId)) return false;
        
        // Filtro 3: Empresa ignorada completamente
        if (companyName && ignoredCompanies.has(companyName)) return false;

        return true;
      });

      if (filteredJobs.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: "Todas las vacantes encontradas corresponden a empresas donde ya postulaste recientemente." });
      }

      const { error } = await supabase
        .from('job_posts')
        .upsert(filteredJobs.map((job: any) => ({
          user_id: user.id,
          external_id: job.external_id,
          title: job.title,
          company: job.company,
          location: job.location,
          apply_url: job.applyUrl,
          description: job.description,
          posted_at: job.date_posted || new Date().toISOString()
        })), { onConflict: 'user_id, company' })
        
      if (error) {
        console.error("Error al insertar en DB:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ success: true, count: filteredJobs.length })
    }

    return NextResponse.json({ success: true, count: 0 })
  } catch (error: any) {
    console.error("Error al ejecutar script:", error)
    return NextResponse.json({ error: error.message || 'Hubo un error al buscar vacantes' }, { status: 500 })
  }
}
