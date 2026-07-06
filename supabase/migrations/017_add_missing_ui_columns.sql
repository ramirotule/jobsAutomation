-- Migration 017: Add missing columns for UI functionality (Profile, Tokens, Criterios)
-- Idempotent version

DO $$
BEGIN
    -- 1. Add missing columns to search_profiles (for 'Criterios' and 'Tokens' tabs)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_profiles' AND column_name = 'blacklist_terms') THEN
        ALTER TABLE public.search_profiles ADD COLUMN blacklist_terms TEXT[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_profiles' AND column_name = 'blacklist_threshold') THEN
        ALTER TABLE public.search_profiles ADD COLUMN blacklist_threshold INT DEFAULT 2;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_profiles' AND column_name = 'llm_provider') THEN
        ALTER TABLE public.search_profiles ADD COLUMN llm_provider TEXT DEFAULT 'gemini';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_profiles' AND column_name = 'apify_key') THEN
        ALTER TABLE public.search_profiles ADD COLUMN apify_key TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_profiles' AND column_name = 'openai_key') THEN
        ALTER TABLE public.search_profiles ADD COLUMN openai_key TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_profiles' AND column_name = 'anthropic_key') THEN
        ALTER TABLE public.search_profiles ADD COLUMN anthropic_key TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_profiles' AND column_name = 'gemini_key') THEN
        ALTER TABLE public.search_profiles ADD COLUMN gemini_key TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_profiles' AND column_name = 'llm_api_key') THEN
        ALTER TABLE public.search_profiles ADD COLUMN llm_api_key TEXT;
    END IF;

    -- 2. Add missing columns to profiles (for 'Mi Perfil' / Public metadata tab)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'linkedin_url') THEN
        ALTER TABLE public.profiles ADD COLUMN linkedin_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'github_url') THEN
        ALTER TABLE public.profiles ADD COLUMN github_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'portfolio_url') THEN
        ALTER TABLE public.profiles ADD COLUMN portfolio_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'cover_letter_es') THEN
        ALTER TABLE public.profiles ADD COLUMN cover_letter_es TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'cover_letter_en') THEN
        ALTER TABLE public.profiles ADD COLUMN cover_letter_en TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'dm_es') THEN
        ALTER TABLE public.profiles ADD COLUMN dm_es TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'dm_en') THEN
        ALTER TABLE public.profiles ADD COLUMN dm_en TEXT;
    END IF;

END $$;
