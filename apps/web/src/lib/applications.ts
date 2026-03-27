// ============================================================
// Application tracking — localStorage (no auth required)
// ============================================================

export type AppStatus =
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'ghosted'

export interface StoredApplication {
  id: string           // same as job_post id
  jobId: string
  title: string
  company: string
  location: string
  applyUrl: string
  appliedAt: string    // ISO timestamp
  status: AppStatus
  salaryExpectation?: number
  salaryOffered?: number
  currency: string     // 'USD' | 'ARS'
  benefits?: string
  notes?: string
  updatedAt: string
}

export const STATUS_LABELS: Record<AppStatus, string> = {
  applied:   'Postulado',
  screening: 'En revisión',
  interview: 'Entrevista',
  offer:     'Oferta',
  rejected:  'Rechazado',
  ghosted:   'Ghosteado',
}

export const STATUS_COLORS: Record<AppStatus, string> = {
  applied:   'bg-blue-100 text-blue-700',
  screening: 'bg-yellow-100 text-yellow-700',
  interview: 'bg-purple-100 text-purple-700',
  offer:     'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  ghosted:   'bg-gray-100 text-gray-600',
}

const KEY = 'job_hunter_applications'

export function getApplications(): StoredApplication[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch { return [] }
}

export function getApplication(id: string): StoredApplication | null {
  return getApplications().find(a => a.id === id) ?? null
}

export function saveApplication(app: StoredApplication): void {
  const apps = getApplications().filter(a => a.id !== app.id)
  localStorage.setItem(KEY, JSON.stringify([app, ...apps]))
}

export function updateApplication(id: string, updates: Partial<StoredApplication>): void {
  const apps = getApplications()
  const idx = apps.findIndex(a => a.id === id)
  if (idx === -1) return
  apps[idx] = { ...apps[idx], ...updates, updatedAt: new Date().toISOString() }
  localStorage.setItem(KEY, JSON.stringify(apps))
}

export function deleteApplication(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(getApplications().filter(a => a.id !== id)))
}
