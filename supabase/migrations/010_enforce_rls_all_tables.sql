-- Migration 010: Security Audit & Comprehensive RLS Enforcement
-- Idempotent version

-- 1. Ensure RLS is enabled on all sensitive tables
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. APPLICATIONS
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Solo los usuarios pueden ver sus propios registros" ON public.applications;
    DROP POLICY IF EXISTS "Solo los usuarios pueden insertar sus propios registros" ON public.applications;
    DROP POLICY IF EXISTS "Solo los usuarios pueden actualizar sus propios registros" ON public.applications;
    DROP POLICY IF EXISTS "Solo los usuarios pueden eliminar sus propios registros" ON public.applications;
    DROP POLICY IF EXISTS "Users own their applications" ON public.applications;
    DROP POLICY IF EXISTS "applications_select_policy" ON public.applications;
    DROP POLICY IF EXISTS "applications_insert_policy" ON public.applications;
    DROP POLICY IF EXISTS "applications_update_policy" ON public.applications;
    DROP POLICY IF EXISTS "applications_delete_policy" ON public.applications;

    CREATE POLICY "applications_select_policy" ON public.applications FOR SELECT TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY "applications_insert_policy" ON public.applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "applications_update_policy" ON public.applications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "applications_delete_policy" ON public.applications FOR DELETE TO authenticated USING (auth.uid() = user_id);
END $$;

-- 3. SEARCH PROFILES
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users own their profiles" ON public.search_profiles;
    DROP POLICY IF EXISTS "search_profiles_all_policy" ON public.search_profiles;
    
    CREATE POLICY "search_profiles_all_policy" ON public.search_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
END $$;

-- 4. JOB MATCHES
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users see their matches" ON public.job_matches;
    DROP POLICY IF EXISTS "job_matches_select_policy" ON public.job_matches;

    CREATE POLICY "job_matches_select_policy" ON public.job_matches FOR SELECT TO authenticated 
      USING (search_profile_id IN (SELECT id FROM public.search_profiles WHERE user_id = auth.uid()));
END $$;

-- 5. RESUMES
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users own their resumes" ON public.resumes;
    DROP POLICY IF EXISTS "resumes_all_policy" ON public.resumes;

    CREATE POLICY "resumes_all_policy" ON public.resumes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
END $$;

-- 6. ALERTS
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users own their alerts" ON public.alerts;
    DROP POLICY IF EXISTS "alerts_all_policy" ON public.alerts;

    CREATE POLICY "alerts_all_policy" ON public.alerts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
END $$;

-- 7. PROFILES
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;

    CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
    CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
    CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
END $$;

-- 8. JOB POSTS & SOURCES
ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public read job_posts" ON public.job_posts;
    DROP POLICY IF EXISTS "Public read job_sources" ON public.job_sources;
    DROP POLICY IF EXISTS "public_read_job_posts" ON public.job_posts;
    DROP POLICY IF EXISTS "public_read_job_sources" ON public.job_sources;

    CREATE POLICY "public_read_job_posts" ON public.job_posts FOR SELECT USING (true);
    CREATE POLICY "public_read_job_sources" ON public.job_sources FOR SELECT USING (true);
END $$;
