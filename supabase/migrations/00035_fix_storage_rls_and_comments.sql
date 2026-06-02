-- Fix storage and RLS security gaps found in audit

-- 1. Require authentication for video uploads (was open to anonymous)
DROP POLICY IF EXISTS "Anyone can upload application video" ON storage.objects;
CREATE POLICY "Authenticated users can upload application videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'application-videos'
    AND auth.uid() IS NOT NULL
  );

-- 2. Add DELETE policy for application-videos (was missing)
CREATE POLICY "Admins can delete application videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'application-videos'
    AND public.is_admin()
  );

-- 3. Add explicit SELECT policy on application_comments
-- (worked via FOR ALL but should be explicit)
DROP POLICY IF EXISTS "Committee and admins can manage comments" ON public.application_comments;

CREATE POLICY "Committee and admins can view comments"
  ON public.application_comments FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Committee and admins can insert comments"
  ON public.application_comments FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Committee and admins can update comments"
  ON public.application_comments FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Committee and admins can delete comments"
  ON public.application_comments FOR DELETE
  USING (public.is_admin());
