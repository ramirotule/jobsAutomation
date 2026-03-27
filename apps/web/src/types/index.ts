// ============================================================
// Types centrales del Job Hunter
// ============================================================

export type Seniority = 'junior' | 'mid' | 'senior' | 'staff' | 'lead' | 'unknown'
export type Modality = 'remote' | 'hybrid' | 'onsite' | 'unknown'
export type JobStatus = 'pending' | 'reviewing' | 'applied' | 'discarded' | 'interview' | 'offer'
export type ApplicationStatus = 'applied' | 'screening' | 'technical' | 'interview' | 'offer' | 'rejected' | 'ghosted'
export type AlertChannel = 'email' | 'telegram' | 'webhook'
export type SourceType = 'api' | 'rss' | 'scraping' | 'manual'

// ============================================================
// CV / Resume
// ============================================================
export interface ParsedResume {
  title: string
  seniority: Seniority
  primarySkills: string[]
  secondarySkills: string[]
  yearsExperience: number
  location: string
  languages: LanguageEntry[]
  industries: string[]
  internationalExperience: boolean
}

export interface LanguageEntry {
  lang: string
  level: 'native' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
}

// ============================================================
// Search Profile
// ============================================================
export interface SearchProfile {
  id: string
  userId: string
  name: string
  title: string
  seniority: Seniority
  primarySkills: string[]
  secondarySkills: string[]
  yearsExperience: number
  targetRoles: string[]
  preferredModality: Modality
  location: string
  languages: LanguageEntry[]
  minSalary?: number
  salaryCurrency: string
  salaryPeriod: 'yearly' | 'monthly' | 'hourly'
  contractTypes: string[]
  minScoreThreshold: number
  alertScoreThreshold: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ============================================================
// Job Sources
// ============================================================
export interface JobSource {
  id: string
  name: string
  displayName: string
  url: string
  type: SourceType
  config: Record<string, unknown>
  isActive: boolean
  lastFetchedAt?: string
  fetchIntervalMinutes: number
}

// ============================================================
// Job Posts (vacantes normalizadas)
// ============================================================
export interface JobPost {
  id: string
  sourceId: string
  externalId: string
  title: string
  company: string
  description: string
  location: string
  modality: Modality
  seniority: Seniority
  salaryMin?: number
  salaryMax?: number
  salaryCurrency: string
  salaryPeriod: string
  requiredSkills: string[]
  niceToHaveSkills: string[]
  applyUrl: string
  postedAt: string
  isActive: boolean
  createdAt: string
  // joined
  sourceName?: string
  sourceSlug?: string
}

// ============================================================
// Matching
// ============================================================
export interface ScoreBreakdown {
  title: number      // max 20
  skills: number     // max 35
  seniority: number  // max 15
  modality: number   // max 15
  location: number   // max 10
  language: number   // max 5
}

export interface MatchResult {
  score: number
  breakdown: ScoreBreakdown
  matchReasons: string[]
  flags: string[]
}

// ============================================================
// Job Matches
// ============================================================
export interface JobMatch {
  id: string
  jobPostId: string
  searchProfileId: string
  score: number
  scoreBreakdown: ScoreBreakdown
  matchReasons: string[]
  flags: string[]
  status: JobStatus
  notes?: string
  isNotified: boolean
  createdAt: string
  updatedAt: string
  // joined (v_job_matches_full)
  title?: string
  company?: string
  location?: string
  modality?: Modality
  seniority?: Seniority
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  salaryPeriod?: string
  requiredSkills?: string[]
  applyUrl?: string
  postedAt?: string
  sourceName?: string
  sourceSlug?: string
}

// ============================================================
// Applications
// ============================================================
export interface Application {
  id: string
  jobMatchId: string
  userId: string
  appliedAt: string
  platform?: string
  contactName?: string
  contactEmail?: string
  resumeVersion?: string
  coverLetter?: string
  status: ApplicationStatus
  nextStep?: string
  nextStepDate?: string
  salaryOffered?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

// ============================================================
// Alerts
// ============================================================
export interface Alert {
  id: string
  userId: string
  channel: AlertChannel
  config: EmailAlertConfig | TelegramAlertConfig | WebhookAlertConfig
  minScore: number
  isActive: boolean
  createdAt: string
}

export interface EmailAlertConfig { email: string }
export interface TelegramAlertConfig { chatId: string; botToken: string }
export interface WebhookAlertConfig { url: string }

// ============================================================
// UI helpers
// ============================================================
export interface JobFilters {
  status?: JobStatus[]
  minScore?: number
  modality?: Modality[]
  seniority?: Seniority[]
  sourceSlug?: string[]
  search?: string
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  pending:   'Pendiente',
  reviewing: 'Revisando',
  applied:   'Postulado',
  discarded: 'Descartado',
  interview: 'Entrevista',
  offer:     'Oferta',
}

export const STATUS_COLORS: Record<JobStatus, string> = {
  pending:   'bg-gray-100 text-gray-700',
  reviewing: 'bg-blue-100 text-blue-700',
  applied:   'bg-purple-100 text-purple-700',
  discarded: 'bg-red-100 text-red-700',
  interview: 'bg-yellow-100 text-yellow-700',
  offer:     'bg-green-100 text-green-700',
}

export const SCORE_COLOR = (score: number): string => {
  if (score >= 80) return 'text-green-600'
  if (score >= 65) return 'text-yellow-600'
  return 'text-red-500'
}
