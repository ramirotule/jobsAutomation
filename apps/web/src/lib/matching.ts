/**
 * ============================================================
 * Algoritmo de Matching: Vacante vs Perfil
 * ============================================================
 *
 * Score total: 0–100 pts
 *
 * │ Dimensión   │ Pts │ Lógica                                │
 * │─────────────│─────│───────────────────────────────────────│
 * │ Título      │  20 │ Coincidencia con target roles          │
 * │ Skills      │  35 │ % skills requeridas que matchean       │
 * │ Seniority   │  15 │ Exacto/cercano/lejano                  │
 * │ Modalidad   │  15 │ Remote > Hybrid > Onsite               │
 * │ Ubicación   │  10 │ Solo aplica si no es remote            │
 * │ Idioma      │   5 │ Inglés requerido + nivel adecuado      │
 * ──────────────────────────────────────────────────────────────
 */

import type { JobPost, SearchProfile, MatchResult, ScoreBreakdown, Seniority } from '@/types'

// ============================================================
// Constantes de scoring
// ============================================================
const MAX = {
  title:    20,
  skills:   35,
  seniority: 15,
  modality:  15,
  location:  10,
  language:   5,
} as const

const SENIORITY_ORDER: Record<Seniority, number> = {
  junior:  1,
  mid:     2,
  senior:  3,
  staff:   4,
  lead:    5,
  unknown: 0,
}

// Skills normalizadas: aliases y variantes comunes
const SKILL_ALIASES: Record<string, string[]> = {
  'react.js':        ['react', 'reactjs', 'react js', 'react.js'],
  'react native':    ['react-native', 'reactnative', 'rn'],
  'typescript':      ['ts', 'typescript'],
  'javascript':      ['js', 'javascript', 'es6', 'es2015+'],
  'redux toolkit':   ['redux', 'redux toolkit', '@reduxjs/toolkit'],
  'graphql':         ['graphql', 'gql', 'apollo'],
  'material ui':     ['material ui', 'mui', 'material-ui'],
  'tailwind css':    ['tailwind', 'tailwindcss', 'tailwind css'],
  'styled components': ['styled-components', 'styled components'],
  'next.js':         ['next', 'nextjs', 'next.js'],
  'node.js':         ['node', 'nodejs', 'node.js'],
}

// ============================================================
// Normalizar skill string para comparación
// ============================================================
function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim().replace(/[^a-z0-9 .]/g, '')
}

// Chequear si dos skills matchean (considerando aliases)
function skillsMatch(jobSkill: string, profileSkill: string): boolean {
  const j = normalizeSkill(jobSkill)
  const p = normalizeSkill(profileSkill)

  if (j === p) return true
  if (j.includes(p) || p.includes(j)) return true

  // Buscar en aliases
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    const inJob     = aliases.includes(j) || normalizeSkill(canonical) === j
    const inProfile = aliases.includes(p) || normalizeSkill(canonical) === p
    if (inJob && inProfile) return true
  }
  return false
}

// ============================================================
// 1. Title match (0–20)
// ============================================================
function scoreTitleMatch(jobTitle: string, targetRoles: string[]): number {
  const jt = normalizeSkill(jobTitle)

  // Coincidencia exacta
  for (const role of targetRoles) {
    const r = normalizeSkill(role)
    if (jt === r) return MAX.title // 20
  }

  // Coincidencia parcial fuerte (contiene el rol o viceversa)
  for (const role of targetRoles) {
    const r = normalizeSkill(role)
    if (jt.includes(r) || r.includes(jt)) return Math.round(MAX.title * 0.75) // 15
  }

  // Palabras clave compartidas
  const jobWords     = new Set(jt.split(/\s+/))
  const keywordScore = targetRoles.reduce((best, role) => {
    const roleWords = normalizeSkill(role).split(/\s+/)
    const overlap   = roleWords.filter(w => jobWords.has(w) && w.length > 2).length
    const ratio     = overlap / Math.max(roleWords.length, 1)
    return Math.max(best, ratio)
  }, 0)

  if (keywordScore >= 0.5) return Math.round(MAX.title * 0.5) // 10
  if (keywordScore >  0)   return Math.round(MAX.title * 0.25) // 5
  return 0
}

// ============================================================
// 2. Skills match (0–35)
// ============================================================
function scoreSkillsMatch(
  requiredSkills: string[],
  profilePrimary: string[],
  profileSecondary: string[],
): { score: number; matched: string[]; missing: string[] } {
  if (requiredSkills.length === 0) {
    return { score: Math.round(MAX.skills * 0.5), matched: [], missing: [] }
  }

  const allProfileSkills = [...profilePrimary, ...profileSecondary]
  const matched: string[] = []
  const missing: string[] = []

  for (const reqSkill of requiredSkills) {
    const found = allProfileSkills.some(ps => skillsMatch(reqSkill, ps))
    if (found) matched.push(reqSkill)
    else missing.push(reqSkill)
  }

  const matchRatio = matched.length / requiredSkills.length

  // Bonus si los skills primarios (React, TS) están en la lista de requeridos
  const primaryBonus = requiredSkills.some(rs =>
    profilePrimary.some(ps => skillsMatch(rs, ps))
  ) ? 5 : 0

  const rawScore = Math.round(MAX.skills * matchRatio) + primaryBonus
  return {
    score:   Math.min(rawScore, MAX.skills),
    matched,
    missing,
  }
}

// ============================================================
// 3. Seniority match (0–15)
// ============================================================
function scoreSeniorityMatch(jobSeniority: Seniority, profileSeniority: Seniority): number {
  if (jobSeniority === 'unknown') return Math.round(MAX.seniority * 0.6) // 9 — no claro

  const jLevel = SENIORITY_ORDER[jobSeniority]
  const pLevel = SENIORITY_ORDER[profileSeniority]
  const diff   = Math.abs(jLevel - pLevel)

  if (diff === 0) return MAX.seniority       // 15 exacto
  if (diff === 1) return Math.round(MAX.seniority * 0.6) // 9 cercano
  if (diff === 2) return Math.round(MAX.seniority * 0.2) // 3 lejano
  return 0
}

// ============================================================
// 4. Modality match (0–15)
// ============================================================
function scoreModalityMatch(jobModality: string, profileModality: string): number {
  const j = jobModality.toLowerCase()
  const p = profileModality.toLowerCase()

  if (j === 'remote')  return MAX.modality  // 15 — siempre bien para Ramiro
  if (j === 'hybrid')  return p === 'remote' ? Math.round(MAX.modality * 0.7) : MAX.modality // 10 o 15
  if (j === 'onsite')  return p === 'onsite' ? MAX.modality : 0 // 0 si prefiere remote
  return Math.round(MAX.modality * 0.5) // unknown: 7
}

// ============================================================
// 5. Location match (0–10)
// ============================================================
function scoreLocationMatch(jobLocation: string, profileLocation: string, jobModality: string): number {
  if (jobModality.toLowerCase() === 'remote') return MAX.location // siempre 10 si es remote

  const jl = jobLocation.toLowerCase()
  const pl = profileLocation.toLowerCase()

  if (jl.includes('argentina') || pl.split(',').some(p => jl.includes(p.trim().toLowerCase()))) {
    return MAX.location
  }
  if (jl.includes('latam') || jl.includes('latin america') || jl.includes('latinoam')) {
    return Math.round(MAX.location * 0.7) // 7
  }
  return 0 // no aplica
}

// ============================================================
// 6. Language match (0–5)
// ============================================================
const LANGUAGE_LEVEL_ORDER: Record<string, number> = {
  native: 6, C2: 5, C1: 4, B2: 3, B1: 2, A2: 1, A1: 0,
}

function scoreLanguageMatch(
  jobDescription: string,
  profileLanguages: SearchProfile['languages'],
): number {
  const desc = jobDescription.toLowerCase()
  const requiresEnglish = /english|inglés|inglés|english required/.test(desc)

  if (!requiresEnglish) return MAX.language // si no requiere, no penaliza

  const englishEntry = profileLanguages.find(l => l.lang.toLowerCase() === 'english')
  if (!englishEntry) return 0

  const level = LANGUAGE_LEVEL_ORDER[englishEntry.level] ?? 0
  if (level >= 3) return MAX.language       // B2+ → 5
  if (level === 2) return Math.round(MAX.language * 0.6) // B1 → 3
  return 0
}

// ============================================================
// Inferir seniority desde texto si no está explícito
// ============================================================
export function inferSeniority(text: string): Seniority {
  const t = text.toLowerCase()
  if (/\b(staff|principal|distinguished)\b/.test(t)) return 'staff'
  if (/\b(lead|tech lead|team lead)\b/.test(t))       return 'lead'
  if (/\b(senior|sr\.?)\b/.test(t))                   return 'senior'
  if (/\b(mid|middle|mid-level|pleno)\b/.test(t))     return 'mid'
  if (/\b(junior|jr\.?|entry)\b/.test(t))             return 'junior'
  return 'unknown'
}

// ============================================================
// Extraer skills mencionadas en el texto de la vacante
// ============================================================
const KNOWN_SKILLS = [
  'react', 'react.js', 'react native', 'typescript', 'javascript', 'next.js',
  'redux', 'redux toolkit', 'graphql', 'apollo', 'tailwind', 'material ui',
  'styled components', 'css', 'html', 'node.js', 'express', 'vue', 'angular',
  'jest', 'testing library', 'webpack', 'vite', 'docker', 'git', 'figma',
  'firebase', 'supabase', 'postgresql', 'mongodb', 'aws', 'gcp', 'azure',
]

export function extractSkillsFromText(text: string): string[] {
  const t = text.toLowerCase()
  return KNOWN_SKILLS.filter(skill => t.includes(skill.toLowerCase()))
}

// ============================================================
// FUNCIÓN PRINCIPAL: calculateMatch
// ============================================================
export function calculateMatch(job: JobPost, profile: SearchProfile): MatchResult {
  const jobSeniority = job.seniority !== 'unknown'
    ? job.seniority
    : inferSeniority(`${job.title} ${job.description}`)

  const requiredSkills = job.requiredSkills.length > 0
    ? job.requiredSkills
    : extractSkillsFromText(job.description)

  // Calcular cada dimensión
  const titleScore    = scoreTitleMatch(job.title, profile.targetRoles)
  const skillsResult  = scoreSkillsMatch(requiredSkills, profile.primarySkills, profile.secondarySkills)
  const seniorityScore = scoreSeniorityMatch(jobSeniority, profile.seniority)
  const modalityScore = scoreModalityMatch(job.modality, profile.preferredModality)
  const locationScore = scoreLocationMatch(job.location, profile.location, job.modality)
  const languageScore = scoreLanguageMatch(job.description, profile.languages)

  const total = titleScore + skillsResult.score + seniorityScore + modalityScore + locationScore + languageScore

  const breakdown: ScoreBreakdown = {
    title:    titleScore,
    skills:   skillsResult.score,
    seniority: seniorityScore,
    modality: modalityScore,
    location: locationScore,
    language: languageScore,
  }

  // Generar razones legibles
  const reasons: string[] = []
  if (titleScore >= 15)          reasons.push(`Título coincide con tu perfil`)
  if (skillsResult.matched.length > 0) {
    reasons.push(`Skills: ${skillsResult.matched.slice(0, 4).join(', ')}`)
  }
  if (seniorityScore === MAX.seniority) reasons.push(`Seniority exacto (${jobSeniority})`)
  if (modalityScore === MAX.modality)   reasons.push(`Modalidad remota`)
  if (locationScore > 0)               reasons.push(`Ubicación compatible`)
  if (languageScore === MAX.language)  reasons.push(`Inglés aceptado (B2+)`)

  // Flags / advertencias
  const flags: string[] = []
  if (!job.salaryMin && !job.salaryMax)    flags.push('Salario no especificado')
  if (job.seniority === 'unknown')         flags.push('Seniority no claro en la vacante')
  if (skillsResult.missing.length > 2)    flags.push(`Skills faltantes: ${skillsResult.missing.slice(0, 3).join(', ')}`)
  if (job.modality === 'onsite')           flags.push('Posición presencial — requiere relocalización')
  if (modalityScore === 0)                 flags.push('Modalidad no compatible')

  return { score: total, breakdown, matchReasons: reasons, flags }
}

// ============================================================
// Ejemplo de uso / test rápido
// ============================================================
if (process.env.NODE_ENV === 'development') {
  // $ npx tsx src/lib/matching.ts
  const testJob: Partial<JobPost> = {
    title:          'Senior React Developer',
    description:    'We need a senior React.js engineer with TypeScript and GraphQL experience. English required. Remote position.',
    seniority:      'unknown',
    modality:       'remote',
    location:       'Worldwide',
    requiredSkills: ['React.js', 'TypeScript', 'GraphQL'],
    niceToHaveSkills: ['Next.js', 'Redux'],
  }

  const testProfile: Partial<SearchProfile> = {
    seniority:         'senior',
    targetRoles:       ['Senior Frontend Developer', 'React Developer', 'Frontend Developer'],
    primarySkills:     ['React.js', 'React Native', 'TypeScript', 'JavaScript'],
    secondarySkills:   ['Redux Toolkit', 'GraphQL', 'Material UI', 'Firebase'],
    preferredModality: 'remote',
    location:          'Santa Rosa, La Pampa, Argentina',
    languages:         [{ lang: 'Spanish', level: 'native' }, { lang: 'English', level: 'B2' }],
  }

  const result = calculateMatch(testJob as JobPost, testProfile as SearchProfile)
  console.log('Match result:', JSON.stringify(result, null, 2))
}
