import { getDashboardStats, getJobPosts } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'

// Force re-render on every request so stats always reflect latest DB data
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabaseServer = createClient(cookieStore)
  
  const [stats, todayJobs] = await Promise.all([
    getDashboardStats(supabaseServer).catch(() => null),
    getJobPosts({ search: undefined }, 0, 5, supabaseServer).catch(() => ({ data: [], total: 0 })),
  ])

  const today    = new Date().toISOString().split('T')[0]
  const newToday = todayJobs.data.filter(j => (j.postedAt ?? j.createdAt ?? '').startsWith(today))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-5 lg:py-10">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Gestión centralizada de tu búsqueda de empleo</p>
        </div>

        {/* Vacantes stats */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Vacantes</p>
        <div className="grid grid-cols-3 gap-3 mb-5">
          <StatCard label="Total"      value={stats?.total    ?? '—'} color="text-gray-900 dark:text-gray-100" />
          <StatCard label="Hoy"        value={stats?.todayNew ?? '—'} color="text-blue-600" />
          <StatCard label="Esta sem."  value={stats?.weekNew  ?? '—'} color="text-indigo-600" />
        </div>

        {/* Postulaciones stats */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Postulaciones</p>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <StatCard label="Postulé"    value={stats?.applied   ?? '—'} color="text-gray-900 dark:text-gray-100" />
          <StatCard label="Revisión"   value={stats?.screening ?? '—'} color="text-yellow-600" />
          <StatCard label="Entrevista" value={stats?.interview ?? '—'} color="text-purple-600" />
          <StatCard label="Oferta"     value={stats?.offer     ?? '—'} color="text-green-600" />
          <StatCard label="Rechazado"  value={stats?.rejected  ?? '—'} color="text-red-500" />
          <StatCard label="Ghosteado"  value={stats?.ghosted   ?? '—'} color="text-gray-400" />
        </div>

        {/* Nuevas hoy */}
        {newToday.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900 rounded-xl p-4 mb-6">
            <h2 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-3">
              Nuevas hoy — {newToday.length} vacante{newToday.length !== 1 ? 's' : ''}
            </h2>
            <div className="flex flex-col gap-2">
              {newToday.map(job => (
                <div key={job.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{job.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{job.company} · {job.location}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/vacantes/${job.id}`} className="text-xs text-blue-600 hover:underline">Ver →</Link>
                    {job.applyUrl && (
                      <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors">
                        Aplicar
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Link href="/vacantes" className="inline-block mt-3 text-sm text-blue-600 hover:underline">
              Ver todas →
            </Link>
          </div>
        )}

        {/* Quick nav */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <NavCard href="/buscar-empleo" title="Buscar"        description="Posts de LinkedIn con Apify"     icon="🔍" cta="Buscar ahora" />
          <NavCard href="/postulaciones" title="Postulaciones" description="Estado de tus postulaciones"     icon="📋" cta="Ver estado" />
          <NavCard href="/perfil"        title="Mi Perfil"     description="CV, skills y criterios"          icon="👤" cta="Editar" />
          <NavCard href="/configuracion" title="Alertas"       description="Notificaciones por email"        icon="🔔" cta="Configurar" />
        </div>

      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 lg:p-5">
      <p className={`text-3xl lg:text-4xl font-bold ${color}`}>{value}</p>
      <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  )
}

function NavCard({ href, title, description, icon, cta }: {
  href: string; title: string; description: string; icon: string; cta: string
}) {
  return (
    <Link href={href} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all group">
      <div className="text-2xl mb-2">{icon}</div>
      <h2 className="font-semibold text-sm text-gray-900 dark:text-gray-100 group-hover:text-blue-600 transition-colors">{title}</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">{description}</p>
      <span className="text-xs text-blue-600 font-medium">{cta} →</span>
    </Link>
  )
}
