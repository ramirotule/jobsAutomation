-- multi-tenant configuration for applications table
-- created on 2026-04-08

-- 1. Add user_id column with reference to auth.users and default to auth.uid()
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);

-- 3. Enable RLS (it might be already enabled, but let's be sure)
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users own their applications" ON public.applications;
DROP POLICY IF EXISTS "Solo los usuarios pueden ver sus propios registros" ON public.applications;
DROP POLICY IF EXISTS "Solo los usuarios pueden insertar sus propios registros" ON public.applications;
DROP POLICY IF EXISTS "Solo los usuarios pueden actualizar sus propios registros" ON public.applications;
DROP POLICY IF EXISTS "Solo los usuarios pueden eliminar sus propios registros" ON public.applications;

-- 5. Create new fine-grained policies

-- [SELECT]
CREATE POLICY "Solo los usuarios pueden ver sus propios registros" 
ON public.applications 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- [INSERT]
CREATE POLICY "Solo los usuarios pueden insertar sus propios registros" 
ON public.applications 
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

-- [UPDATE]
CREATE POLICY "Solo los usuarios pueden actualizar sus propios registros" 
ON public.applications 
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- [DELETE]
CREATE POLICY "Solo los usuarios pueden eliminar sus propios registros" 
ON public.applications 
FOR DELETE 
TO authenticated 
USING (user_id = auth.uid());
