'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getApplications, deleteApplication, STATUS_LABELS, STATUS_COLORS } from '@/lib/applications'
import { ConfirmModal } from '@/components/Modal'
import type { StoredApplication, AppStatus } from '@/lib/applications'

const STATUS_ORDER: AppStatus[] = ['applied', 'screening', 'interview', 'offer', 'rejected', 'ghosted']

export default function PostulacionesPage() {
  const [apps, setApps]             = useState<StoredApplication[]>([])
  const [filter, setFilter]         = useState<AppStatus | 'all'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => { getApplications().then(setApps) }, [])

  const visible = filter === 'all' ? apps : apps.filter(a => a.status === filter)

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = apps.filter(a => a.status === s).length
    return acc
  }, {} as Record<AppStatus, number>)

  const handleDelete = (id: string) => setDeletingId(id)

  const doDelete = async () => {
    if (!deletingId) return
    await deleteApplication(deletingId)
    setApps(await getApplications())
    setDeletingId(null)
  }

  return (
    <>
    <ConfirmModal
      open={!!deletingId}
      title="¿Eliminar postulación?"
      message="Se eliminará el registro de esta postulación y todas sus notas. Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      variant="danger"
      onConfirm={doDelete}
      onCancel={() => setDeletingId(null)}
    />
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Postulaciones</h1>
            <p className="text-sm text-gray-500 mt-1">{apps.length} postulación{apps.length !== 1 ? 'es' : ''} registrada{apps.length !== 1 ? 's' : ''}</p>
          </div>
          <Link
            href="/vacantes"
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ver vacantes
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Todas ({apps.length})
          </button>
          {STATUS_ORDER.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                filter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {STATUS_LABELS[s]} ({counts[s]})
            </button>
          ))}
        </div>

        {apps.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg font-medium">Sin postulaciones todavía</p>
            <p className="text-sm mt-2">Hacé click en "Aplicar" en una vacante para registrarla acá.</p>
            <Link href="/vacantes" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
              Ver vacantes →
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <p className="text-center py-12 text-gray-400">No hay postulaciones con este estado.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map(app => (
              <AppCard key={app.id} app={app} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  )
}

function AppCard({ app, onDelete }: { app: StoredApplication; onDelete: (id: string) => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-sm">{app.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[app.status]}`}>
              {STATUS_LABELS[app.status]}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{app.company}{app.location ? ` · ${app.location}` : ''}</p>

          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
            <span>Postulado: {new Date(app.appliedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            {app.salaryExpectation && (
              <span className="text-blue-600 font-medium">
                Pretensión: {app.currency} {app.salaryExpectation.toLocaleString()}
              </span>
            )}
            {app.salaryOffered && (
              <span className="text-green-600 font-medium">
                Oferta: {app.currency} {app.salaryOffered.toLocaleString()}
              </span>
            )}
          </div>

          {app.notes && (
            <p className="mt-2 text-xs text-gray-600 line-clamp-2 bg-gray-50 rounded-lg px-3 py-2">
              {app.notes}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/postulaciones/${app.id}`}
            className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Ver detalle
          </Link>
          {app.applyUrl && (
            <a
              href={app.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Oferta ↗
            </a>
          )}
          <button
            onClick={() => onDelete(app.id)}
            className="text-gray-300 hover:text-red-500 transition-colors p-1"
            title="Eliminar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
