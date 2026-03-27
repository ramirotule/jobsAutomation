/**
 * Seed del perfil de Ramiro en Supabase
 * Ejecutar desde apps/web/: npx tsx ../../scripts/seed-profile.ts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Carga el .env.local de apps/web/ (donde se corre el script)
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const RAMIRO_PROFILE = {
  name: 'default',
  title: 'Senior Frontend Developer',
  seniority: 'senior',
  primary_skills: [
    'React.js', 'React Native', 'TypeScript', 'JavaScript',
  ],
  secondary_skills: [
    'Redux Toolkit', 'MobX State Tree', 'GraphQL', 'Firebase',
    'Material UI', 'Tailwind CSS', 'Styled Components',
    'Jest', 'React Testing Library', 'Next.js',
  ],
  years_experience: 5,
  target_roles: [
    'Frontend Developer',
    'Senior Frontend Developer',
    'React Developer',
    'Senior React Developer',
    'React Native Developer',
    'JavaScript Developer',
    'TypeScript Developer',
    'Full Stack Developer',
    'Mobile Developer',
  ],
  preferred_modality: 'remote',
  location: 'Santa Rosa, La Pampa, Argentina',
  languages: [
    { lang: 'Spanish', level: 'native' },
    { lang: 'English', level: 'B2' },
  ],
  salary_currency: 'USD',
  salary_period: 'yearly',
  contract_types: ['fulltime', 'contract', 'freelance'],
  min_score_threshold: 60,
  alert_score_threshold: 75,
  is_active: true,
}

async function seed() {
  console.log('Seeding search profile...')

  const { data, error } = await supabase
    .from('search_profiles')
    .insert(RAMIRO_PROFILE)
    .select()
    .single()

  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  console.log('Profile created:', data.id)
  console.log('Add this to .env: NEXT_PUBLIC_DEFAULT_PROFILE_ID=' + data.id)
}

seed()
