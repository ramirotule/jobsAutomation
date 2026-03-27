-- ============================================================
-- Job Hunter Automatizado - Schema inicial
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- RESUMES
-- ============================================================
CREATE TABLE resumes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text     TEXT,
  parsed_data  JSONB, -- { title, seniority, skills, years_experience, languages, ... }
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEARCH PROFILES (criterios de búsqueda derivados del CV)
-- ============================================================
CREATE TABLE search_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT DEFAULT 'default',
  title               TEXT,          -- e.g. "Senior Frontend Developer"
  seniority           TEXT,          -- junior | mid | senior | staff | lead
  primary_skills      TEXT[],        -- ["React.js", "TypeScript", "React Native"]
  secondary_skills    TEXT[],        -- ["Redux Toolkit", "GraphQL", "Material UI"]
  years_experience    INT,
  target_roles        TEXT[],        -- roles aceptados
  preferred_modality  TEXT,          -- remote | hybrid | onsite | any
  location            TEXT,          -- "Santa Rosa, La Pampa, Argentina"
  languages           JSONB,         -- [{"lang": "Spanish", "level": "native"}, {"lang": "English", "level": "B2"}]
  min_salary          INT,           -- en USD/mes o USD/año según salary_period
  salary_currency     TEXT DEFAULT 'USD',
  salary_period       TEXT DEFAULT 'yearly',  -- yearly | monthly | hourly
  contract_types      TEXT[],        -- fulltime | parttime | contract | freelance
  min_score_threshold INT DEFAULT 60, -- score mínimo para guardar match
  alert_score_threshold INT DEFAULT 75, -- score mínimo para disparar alerta
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOB SOURCES
-- ============================================================
CREATE TABLE job_sources (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT UNIQUE NOT NULL,  -- 'remoteok', 'remotive', 'wwr', 'workingnomads'
  display_name            TEXT,
  url                     TEXT,
  type                    TEXT,                  -- api | rss | scraping | manual
  config                  JSONB,                 -- { endpoint, api_key, selectors, ... }
  is_active               BOOLEAN DEFAULT true,
  last_fetched_at         TIMESTAMPTZ,
  fetch_interval_minutes  INT DEFAULT 120,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Fuentes gratuitas del MVP
INSERT INTO job_sources (name, display_name, url, type, config, fetch_interval_minutes) VALUES
  ('remoteok',     'RemoteOK',          'https://remoteok.com/api',                           'api',  '{"tags": "react,react-native,typescript,javascript,frontend"}',  120),
  ('remotive',     'Remotive',          'https://remotive.com/api/remote-jobs',                'api',  '{"category": "software-dev", "tags": "react,frontend,mobile"}',  120),
  ('wwr',          'We Work Remotely',  'https://weworkremotely.com/remote-jobs.rss',          'rss',  '{}',                                                              120),
  ('workingnomads','Working Nomads',    'https://www.workingnomads.com/api/exposed_jobs/',     'api',  '{"category": "development", "tags": "react,frontend"}',           120);

-- ============================================================
-- JOB POSTS (vacantes normalizadas)
-- ============================================================
CREATE TABLE job_posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id         UUID REFERENCES job_sources(id),
  external_id       TEXT,                -- ID original de la fuente
  title             TEXT NOT NULL,
  company           TEXT,
  description       TEXT,
  location          TEXT,
  modality          TEXT,                -- remote | hybrid | onsite | unknown
  seniority         TEXT,                -- junior | mid | senior | staff | lead | unknown
  salary_min        INT,
  salary_max        INT,
  salary_currency   TEXT DEFAULT 'USD',
  salary_period     TEXT DEFAULT 'yearly',
  required_skills   TEXT[],
  nice_to_have_skills TEXT[],
  apply_url         TEXT,
  posted_at         TIMESTAMPTZ,
  raw_data          JSONB,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, external_id)
);

CREATE INDEX idx_job_posts_posted_at ON job_posts(posted_at DESC);
CREATE INDEX idx_job_posts_source_id ON job_posts(source_id);
CREATE INDEX idx_job_posts_modality ON job_posts(modality);

-- ============================================================
-- JOB MATCHES (vacantes puntuadas contra perfil)
-- ============================================================
CREATE TABLE job_matches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id         UUID REFERENCES job_posts(id) ON DELETE CASCADE,
  search_profile_id   UUID REFERENCES search_profiles(id),
  score               INT NOT NULL,           -- 0-100
  score_breakdown     JSONB,                  -- { title, skills, seniority, modality, location, language }
  match_reasons       TEXT[],                 -- ["Matches React.js", "Remote position", ...]
  flags               TEXT[],                 -- ["Salary not specified", "Seniority unclear"]
  status              TEXT DEFAULT 'pending', -- pending | reviewing | applied | discarded | interview | offer
  notes               TEXT,
  is_notified         BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_matches_score ON job_matches(score DESC);
CREATE INDEX idx_job_matches_status ON job_matches(status);
CREATE INDEX idx_job_matches_created_at ON job_matches(created_at DESC);

-- ============================================================
-- APPLICATIONS (seguimiento detallado de postulaciones)
-- ============================================================
CREATE TABLE applications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_match_id     UUID REFERENCES job_matches(id),
  user_id          UUID REFERENCES auth.users(id),
  applied_at       TIMESTAMPTZ DEFAULT NOW(),
  platform         TEXT,          -- donde postulaste
  contact_name     TEXT,
  contact_email    TEXT,
  resume_version   TEXT,
  cover_letter     TEXT,
  status           TEXT DEFAULT 'applied',  -- applied | screening | technical | interview | offer | rejected | ghosted
  next_step        TEXT,
  next_step_date   DATE,
  salary_offered   INT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ALERTS (configuración de notificaciones)
-- ============================================================
CREATE TABLE alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id),
  channel       TEXT NOT NULL,   -- email | telegram | webhook
  config        JSONB NOT NULL,  -- { email } | { chat_id, bot_token } | { url }
  min_score     INT DEFAULT 75,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
CREATE TABLE activity_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID,
  action       TEXT NOT NULL,   -- 'fetch_jobs', 'match_scored', 'status_changed', ...
  entity_type  TEXT,
  entity_id    UUID,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (Row Level Security básico)
-- ============================================================
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their resumes" ON resumes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their profiles" ON search_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see their matches" ON job_matches FOR ALL USING (
  search_profile_id IN (SELECT id FROM search_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Users own their applications" ON applications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their alerts" ON alerts FOR ALL USING (auth.uid() = user_id);

-- job_posts y job_sources son públicas (read-only para users)
ALTER TABLE job_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read job_posts" ON job_posts FOR SELECT USING (true);
CREATE POLICY "Public read job_sources" ON job_sources FOR SELECT USING (true);

-- ============================================================
-- FUNCIONES HELPER
-- ============================================================

-- Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resumes_updated_at BEFORE UPDATE ON resumes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_search_profiles_updated_at BEFORE UPDATE ON search_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_job_matches_updated_at BEFORE UPDATE ON job_matches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Vista: matches con datos completos (para el panel)
CREATE VIEW v_job_matches_full AS
SELECT
  jm.id,
  jm.score,
  jm.score_breakdown,
  jm.match_reasons,
  jm.flags,
  jm.status,
  jm.notes,
  jm.is_notified,
  jm.created_at,
  jp.title,
  jp.company,
  jp.location,
  jp.modality,
  jp.seniority,
  jp.salary_min,
  jp.salary_max,
  jp.salary_currency,
  jp.salary_period,
  jp.required_skills,
  jp.apply_url,
  jp.posted_at,
  js.display_name AS source_name,
  js.name AS source_slug
FROM job_matches jm
JOIN job_posts jp ON jp.id = jm.job_post_id
JOIN job_sources js ON js.id = jp.source_id;
