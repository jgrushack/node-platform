-- Add hide_from_directory flag to profiles
ALTER TABLE public.profiles ADD COLUMN hide_from_directory boolean NOT NULL DEFAULT false;

-- Policy: authenticated users can see directory-visible profiles
CREATE POLICY "Authenticated users can view directory profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND hide_from_directory = false
  );
