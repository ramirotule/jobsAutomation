// ============================================================
// Application tracking — Supabase
// ============================================================

import { supabase } from '@/lib/supabase'

export type AppStatus =
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'ghosted'

export interface StoredApplication {
  id: string           // UUID from applications table
  jobId?: string       // job_posts.id (optional for manual entries)
  title: string
  company: string
  location?: string
  applyUrl?: string
  appliedAt: string    // ISO timestamp
  status: AppStatus
  salaryExpectation?: number
  salaryOffered?: number
  currency: string
  benefits?: string
  notes?: string
  recruiterName?: string
  recruiterLinkedin?: string
  contactType?: 'self_initiated' | 'recruiter_initiated'
  interviewAt?: string // ISO timestamp
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

function mapRow(row: Record<string, unknown>): StoredApplication {
  return {
    id:                row.id as string,
    jobId:             (row.job_id as string) ?? undefined,
    title:             (row.title as string) ?? '',
    company:           (row.company as string) ?? '',
    location:          (row.location as string) ?? '',
    applyUrl:          (row.apply_url as string) ?? '',
    appliedAt:         (row.applied_at as string) ?? '',
    status:            (row.status as AppStatus) ?? 'applied',
    salaryExpectation: row.salary_expectation as number | undefined,
    salaryOffered:     row.salary_offered as number | undefined,
    currency:          (row.currency as string) ?? 'USD',
    benefits:          row.benefits as string | undefined,
    notes:             row.notes as string | undefined,
    recruiterName:     row.recruiter_name as string | undefined,
    recruiterLinkedin:     row.recruiter_linkedin as string | undefined,
    contactType:       (row.contact_type as 'self_initiated' | 'recruiter_initiated') || undefined,
    interviewAt:       (row.interview_at as string) || undefined,
    updatedAt:         (row.updated_at as string) ?? '',
  }
}

export async function getApplications(): Promise<StoredApplication[]> {
  const { data } = await supabase
    .from('applications')
    .select('*')
    .order('applied_at', { ascending: false })
  return (data ?? []).map(mapRow)
}

export async function getApplication(id: string): Promise<StoredApplication | null> {
  const { data } = await supabase
    .from('applications')
    .select('*')
    .eq('id', id)
    .single()
  return data ? mapRow(data) : null
}

export async function saveApplication(app: Omit<StoredApplication, 'id' | 'updatedAt'>): Promise<StoredApplication | null> {
  const { data } = await supabase
    .from('applications')
    .insert({
      job_id:             app.jobId,
      title:              app.title,
      company:            app.company,
      location:           app.location,
      apply_url:          app.applyUrl,
      applied_at:         app.appliedAt,
      status:             app.status,
      salary_expectation: app.salaryExpectation,
      salary_offered:     app.salaryOffered,
      currency:           app.currency,
      benefits:           app.benefits,
      notes:              app.notes,
      recruiter_name:     app.recruiterName,
      recruiter_linkedin: app.recruiterLinkedin,
      contact_type:       app.contactType,
      interview_at:       app.interviewAt,
    })
    .select()
    .single()
  return data ? mapRow(data) : null
}

export async function updateApplication(id: string, updates: Partial<StoredApplication>): Promise<void> {
  await supabase
    .from('applications')
    .update({
      ...(updates.status            !== undefined && { status:             updates.status }),
      ...(updates.salaryExpectation !== undefined && { salary_expectation: updates.salaryExpectation }),
      ...(updates.salaryOffered     !== undefined && { salary_offered:     updates.salaryOffered }),
      ...(updates.currency          !== undefined && { currency:           updates.currency }),
      ...(updates.benefits          !== undefined && { benefits:           updates.benefits }),
      ...(updates.notes             !== undefined && { notes:              updates.notes }),
      ...(updates.recruiterName     !== undefined && { recruiter_name:     updates.recruiterName }),
      ...(updates.contactType       !== undefined && { contact_type:       updates.contactType }),
      ...(updates.title             !== undefined && { title:              updates.title }),
      ...(updates.company           !== undefined && { company:           updates.company }),
      ...(updates.appliedAt         !== undefined && { applied_at:         updates.appliedAt }),
      ...(updates.applyUrl          !== undefined && { apply_url:          updates.applyUrl }),
      ...(updates.interviewAt       !== undefined && { interview_at:       updates.interviewAt }),
      ...(updates.recruiterLinkedin !== undefined && { recruiter_linkedin: updates.recruiterLinkedin }),
    })
    .eq('id', id)
}

export async function deleteApplication(id: string): Promise<void> {
  await supabase.from('applications').delete().eq('id', id)
}
