-- Remove the auto-profile-on-signup trigger.
-- Profiles should only be created when an application is approved,
-- not on every auth.users signup (which allows bot spam).

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create a function to provision a profile from an approved application.
-- Called from the application layer (server action) when status → approved.
CREATE OR REPLACE FUNCTION public.create_profile_from_application(
  p_user_id uuid,
  p_email text,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_playa_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_skills text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, playa_name, phone, skills)
  VALUES (
    p_user_id,
    p_email,
    p_first_name,
    p_last_name,
    p_playa_name,
    p_phone,
    CASE WHEN p_skills IS NOT NULL THEN string_to_array(p_skills, ',') ELSE '{}'::text[] END
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;
