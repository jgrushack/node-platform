-- Lookup function used by approveApplication to recover the auth user id
-- when createUser returns email_exists. We can't query auth.users via
-- PostgREST because the auth schema isn't exposed, so we wrap it in a
-- SECURITY DEFINER function callable as an RPC.

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$;

-- Only the service role should call this. Revoke from anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;
