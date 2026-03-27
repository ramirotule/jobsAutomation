import { getDashboardStats, getJobPosts } from '@/lib/supabase'
import Link from 'next/link'

// Force re-render on every request so stats always reflect latest DB data
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [stats, todayJobs] = await Promise.all([
    getDashboardStats().catch(() => null),
    getJobPosts({ search: undefined }, 0, 5).catch(() => ({ data: [], total: 0 })),
  ])

  const today    = new Date().toISOString().split('T')[0]
  const newToday = todayJobs.data.filter(j => (j.createdAt ?? '').startsWith(today))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Job Hunter</h1>
          <p className="text-gray-500 mt-1">Automatizador de búsqueda de empleo · Ramiro Toulemonde</p>
        </div>

        {/* Vacantes stats */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Vacantes</p>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Total vacantes"  value={stats?.total    ?? '—'} color="text-gray-900" />
          <StatCard label="Nuevas hoy"      value={stats?.todayNew ?? '—'} color="text-blue-600" />
          <StatCard label="Esta semana"     value={stats?.weekNew  ?? '—'} color="text-indigo-600" />
        </div>

        {/* Postulaciones stats */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Postulaciones</p>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          <StatCard label="Postulaste en"  value={stats?.applied   ?? '—'} color="text-gray-900" />
          <StatCard label="En revisión"    value={stats?.screening ?? '—'} color="text-yellow-600" />
          <StatCard label="Entrevista"     value={stats?.interview ?? '—'} color="text-purple-600" />
          <StatCard label="Oferta"         value={stats?.offer     ?? '—'} color="text-green-600" />
          <StatCard label="Rechazado"      value={stats?.rejected  ?? '—'} color="text-red-500" />
          <StatCard label="Ghosteado"      value={stats?.ghosted   ?? '—'} color="text-gray-400" />
        </div>

        {/* Nuevas hoy */}
        {newToday.length > 0 && (
          <div className="bg-white border border-blue-100 rounded-xl p-5 mb-8">
            <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-4">
              Nuevas hoy — {newToday.length} vacante{newToday.length !== 1 ? 's' : ''}
            </h2>
            <div className="flex flex-col gap-3">
              {newToday.map(job => (
                <div key={job.id} className="flex items-center justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{job.title}</p>
                    <p className="text-xs text-gray-500">{job.company} · {job.location}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/vacantes/${job.id}`} className="text-xs text-blue-600 hover:underline">
                      Ver →
                    </Link>
                    {job.applyUrl && (
                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Aplicar
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Link href="/vacantes" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
              Ver todas las vacantes →
            </Link>
          </div>
        )}

        {/* Quick nav */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <NavCard href="/vacantes"      title="Vacantes"      description="Ver todas las oportunidades encontradas por n8n"   icon="💼" cta="Ver vacantes" />
          <NavCard href="/postulaciones" title="Postulaciones" description="Trackear el estado de tus postulaciones activas"   icon="📋" cta="Ver postulaciones" />
          <NavCard href="/perfil"        title="Mi Perfil"     description="Editar CV, skills y criterios de búsqueda"         icon="👤" cta="Editar perfil" />
          <NavCard href="/configuracion" title="Alertas"       description="Configurar notificaciones por email"               icon="🔔" cta="Configurar" />
        </div>

      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className={`text-4xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function NavCard({ href, title, description, icon, cta }: {
  href: string; title: string; description: string; icon: string; cta: string
}) {
  return (
    <Link href={href} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all group">
      <div className="text-3xl mb-3">{icon}</div>
      <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{title}</h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">{description}</p>
      <span className="text-sm text-blue-600 font-medium">{cta} →</span>
    </Link>
  )
}
