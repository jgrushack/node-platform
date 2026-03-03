-- Add 'committee' role for application review committee members
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('member', 'committee', 'admin', 'super_admin'));

-- Update RLS on applications to include committee members
DROP POLICY IF EXISTS "Admins can manage applications" ON public.applications;
CREATE POLICY "Committee and admins can manage applications"
  ON public.applications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('committee', 'admin', 'super_admin')
    )
  );

-- Update RLS on application comments to include committee
DROP POLICY IF EXISTS "Admins can manage comments" ON public.application_comments;
CREATE POLICY "Committee and admins can manage comments"
  ON public.application_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('committee', 'admin', 'super_admin')
    )
  );

-- Update storage policy for videos to include committee
DROP POLICY IF EXISTS "Admins can view application videos" ON storage.objects;
CREATE POLICY "Committee and admins can view application videos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-videos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('committee', 'admin', 'super_admin')
    )
  );

-- Update admins-view-all-profiles to include committee
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Committee and admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('committee', 'admin', 'super_admin')
    )
  );
