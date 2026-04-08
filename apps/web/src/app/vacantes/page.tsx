'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getJobPosts, deleteJobPost, deleteAllJobPosts } from '@/lib/supabase'
import { saveApplication, getApplications } from '@/lib/applications'
import { AlertModal, ConfirmModal } from '@/components/Modal'
import type { JobPost, JobFilters } from '@/types'

const TODAY = new Date().toISOString().split('T')[0]

type SortOption = 'newest' | 'oldest'
const SORT_LABELS: Record<SortOption, string> = {
  'newest':      'Más reciente',
  'oldest':      'Más antiguo',
}

export default function VacantesPage() {
  const router = useRouter()
  const [jobs, setJobs]             = useState<JobPost[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [filters, setFilters]       = useState<JobFilters>({})
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(0)
  const [sort, setSort]             = useState<SortOption>('newest')
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)
  const [isScraping, setIsScraping] = useState<string | null>(null)
  const [alertMsg, setAlertMsg]     = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const PAGE_SIZE = 25

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getJobPosts(
        { ...filters, search: search || undefined },
        page,
        PAGE_SIZE,
      )
      setJobs(result.data)
      setTotal(result.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar vacantes')
    } finally {
      setLoading(false)
    }
  }, [filters, search, page])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const setFilter = (key: keyof JobFilters, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(0)
  }

  const handleApply = async (job: JobPost, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (job.applyUrl) window.open(job.applyUrl, '_blank', 'noopener,noreferrer')
    await saveApplication({
      jobId:    job.id,
      title:    job.title,
      company:  job.company,
      location: job.location ?? '',
      applyUrl: job.applyUrl ?? '',
      appliedAt: new Date().toISOString(),
      status:   'applied',
      currency: 'USD',
    })
    router.push('/postulaciones')
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDeleting(id)
    try {
      await deleteJobPost(id)
      setJobs(prev => prev.filter(j => j.id !== id))
      setTotal(prev => prev - 1)
    } catch (err) {
      setAlertMsg('Error al borrar: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setDeleting(null)
    }
  }

  const handleClearAll = () => setConfirmClear(true)

  const doClearAll = async () => {
    setConfirmClear(false)
    setClearingAll(true)
    try {
      await deleteAllJobPosts()
      setJobs([])
      setTotal(0)
    } catch (err) {
      setAlertMsg('Error al vaciar: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setClearingAll(false)
    }
  }

  const handleBuscarVacantes = async (site: string) => {
    setIsScraping(site)
    try {
      const res = await fetch('/api/scrape', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site })
      })
      const data = await res.json()
      
      if (res.ok && data.success) {
         await fetchJobs()
         setAlertMsg(`¡Búsqueda finalizada! Se agregaron ${data.count} empleos desde ${site}.`)
      } else {
         throw new Error(data.error || 'Error desconocido')
      }
    } catch(err: any) {
      console.error(err)
      setAlertMsg("Error al intentar buscar vacantes (asegurate de tener python3): " + err.message)
    } finally {
      setIsScraping(null)
    }
  }

  return (
    <>
    <AlertModal
      open={!!alertMsg}
      title="Aviso"
      message={alertMsg ?? ''}
      onClose={() => setAlertMsg(null)}
    />
    <ConfirmModal
      open={confirmClear}
      title="¿Vaciar todas las vacantes?"
      message={`Se eliminarán las ${total} vacantes de la base de datos. Esta acción no se puede deshacer.`}
      confirmLabel="Sí, vaciar todo"
      variant="danger"
      onConfirm={doClearAll}
      onCancel={() => setConfirmClear(false)}
    />
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vacantes</h1>
            <p className="text-gray-500 text-sm mt-1">{total} oportunidades pendientes</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleClearAll}
              disabled={clearingAll || loading}
              className="text-sm border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {clearingAll ? 'Vaciando...' : 'Vaciar todo'}
            </button>
            <button
              onClick={() => handleBuscarVacantes('linkedin')}
              disabled={isScraping !== null || loading}
              className="flex items-center justify-center min-w-[140px] gap-2 text-sm bg-[#0077b5] text-white px-4 py-2 rounded-lg hover:bg-[#005e93] transition-colors disabled:opacity-75 disabled:cursor-not-allowed shadow-sm font-semibold"
            >
              {isScraping === 'linkedin' ? 'Buscando...' : 'in LinkedIn'}
            </button>
            <button
              onClick={() => handleBuscarVacantes('glassdoor')}
              disabled={isScraping !== null || loading}
              className="flex items-center justify-center min-w-[140px] gap-2 text-sm bg-[#0caa41] text-white px-4 py-2 rounded-lg hover:bg-[#0a8834] transition-colors disabled:opacity-75 disabled:cursor-not-allowed shadow-sm font-semibold"
            >
              {isScraping === 'glassdoor' ? 'Buscando...' : '🟢 Glassdoor'}
            </button>
            <button
              onClick={() => handleBuscarVacantes('indeed')}
              disabled={isScraping !== null || loading}
              className="flex items-center justify-center min-w-[140px] gap-2 text-sm bg-[#003a9b] text-white px-4 py-2 rounded-lg hover:bg-[#002d78] transition-colors disabled:opacity-75 disabled:cursor-not-allowed shadow-sm font-semibold"
            >
              {isScraping === 'indeed' ? 'Buscando...' : '🔵 Indeed'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex flex-wrap gap-3 shadow-sm">
          <input
            type="text"
            placeholder="Buscar por título o empresa..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="flex-1 min-w-48 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {(Object.keys(SORT_LABELS) as SortOption[]).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  sort === s
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {SORT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-8 bg-gray-100 rounded w-1/3 mt-4" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg font-medium">No hay vacantes pendientes</p>
            <p className="text-sm mt-2">Nuevas oportunidades aparecerán aquí tras realizar un scrape.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...jobs].sort((a, b) => {
                const dateA = new Date(a.postedAt || a.createdAt || 0).getTime()
                const dateB = new Date(b.postedAt || b.createdAt || 0).getTime()
                if (sort === 'oldest') return dateA - dateB
                return dateB - dateA // newest (default)
              }).map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  isNew={(job.postedAt ?? job.createdAt ?? '').startsWith(TODAY)}
                  deleting={deleting === job.id}
                  onApply={handleApply}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {total > PAGE_SIZE && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="text-sm px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Anterior
                </button>
                <span className="text-sm text-gray-500 px-4 py-2">
                  Pág {page + 1} / {Math.ceil(total / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  className="text-sm px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </>
  )
}

function JobCard({
  job, isNew, deleting, onApply, onDelete,
}: {
  job: JobPost
  isNew: boolean
  deleting: boolean
  onApply: (job: JobPost, e: React.MouseEvent) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}) {
  return (
    <div className="relative group">
      <Link
        href={`/vacantes/${job.id}`}
        className="border border-gray-200 rounded-xl p-5 bg-white hover:border-blue-200 hover:shadow-md transition-all flex flex-col gap-3 block h-full"
      >
        {/* Header */}
        <div className="pr-7">
          <div className="flex items-start gap-2">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-blue-600 transition-colors flex-1">
              {job.title}
            </h3>
            {isNew && (
              <span className="shrink-0 text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full shadow-sm">
                Hoy
              </span>
            )}
          </div>
          <p className="text-gray-500 text-xs mt-1 font-medium">{job.company}</p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {job.modality && job.modality !== 'unknown' && (
            <Tag variant={job.modality === 'remote' ? 'green' : 'blue'}>{job.modality}</Tag>
          )}
          {job.seniority && job.seniority !== 'unknown' && (
            <Tag variant="purple">{job.seniority}</Tag>
          )}
          {job.location && (
            <Tag variant="gray">{job.location}</Tag>
          )}
        </div>

        {/* Skills */}
        {job.requiredSkills && job.requiredSkills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {job.requiredSkills.slice(0, 4).map(skill => (
              <span key={skill} className="text-xs bg-gray-50 text-gray-600 rounded px-2 py-0.5 border border-gray-100">
                {skill}
              </span>
            ))}
            {job.requiredSkills.length > 4 && (
              <span className="text-xs text-gray-400">+{job.requiredSkills.length - 4}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-3 border-t border-gray-100">

          {/* Company + date */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400">
              {job.postedAt
                ? new Date(job.postedAt).toLocaleDateString('es-AR')
                : job.createdAt
                ? new Date(job.createdAt).toLocaleDateString('es-AR')
                : '—'}
            </span>
            {job.applyUrl && (
              <span className="text-xs text-gray-400 truncate max-w-32">
                {new URL(job.applyUrl).hostname.replace('www.', '')}
              </span>
            )}
          </div>

          {/* Apply button */}
          <button
            onClick={e => onApply(job, e)}
            className="w-full text-sm font-bold py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm active:scale-95"
          >
            Postular →
          </button>
        </div>
      </Link>

      {/* Delete button */}
      <button
        onClick={e => onDelete(job.id, e)}
        disabled={deleting}
        title="Borrar vacante"
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {deleting ? (
          <span className="text-xs">...</span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
          </svg>
        )}
      </button>
    </div>
  )
}

type TagVariant = 'gray' | 'green' | 'blue' | 'purple'
const TAG_STYLES: Record<TagVariant, string> = {
  gray:   'bg-gray-100 text-gray-600',
  green:  'bg-green-100 text-green-700',
  blue:   'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
}
function Tag({ children, variant }: { children: React.ReactNode; variant: TagVariant }) {
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${TAG_STYLES[variant]}`}>
      {children}
    </span>
  )
}
