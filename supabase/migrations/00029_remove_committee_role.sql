-- Remove 'committee' as a role — committee membership is now solely the is_committee_member flag.

-- Step 1: Reassign any remaining role='committee' users to 'member'
-- (migration 00027 already set is_committee_member=true for these users)
UPDATE public.profiles
  SET role = 'member'
  WHERE role = 'committee';

-- Step 2: Update the role constraint to remove 'committee'
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('member', 'lead', 'admin', 'super_admin'));

-- Step 3: Update is_admin() to use is_committee_member flag instead of committee role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (
      is_committee_member = true
      OR role IN ('admin', 'super_admin')
    )
  );
$$;

-- Step 4: Update RLS policies to use is_committee_member flag

-- Applications policy
DROP POLICY IF EXISTS "Committee and admins can manage applications" ON public.applications;
CREATE POLICY "Committee and admins can manage applications"
  ON public.applications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (is_committee_member = true OR role IN ('admin', 'super_admin'))
    )
  );

-- Application comments policy
DROP POLICY IF EXISTS "Committee and admins can manage comments" ON public.application_comments;
CREATE POLICY "Committee and admins can manage comments"
  ON public.application_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (is_committee_member = true OR role IN ('admin', 'super_admin'))
    )
  );

-- Application videos storage policy
DROP POLICY IF EXISTS "Committee and admins can view application videos" ON storage.objects;
CREATE POLICY "Committee and admins can view application videos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-videos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (is_committee_member = true OR role IN ('admin', 'super_admin'))
    )
  );

-- Profiles view-all policy (uses is_admin() which is already updated above)
-- No change needed — is_admin() already handles it.
