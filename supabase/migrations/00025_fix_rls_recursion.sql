-- Fix RLS policies that directly query profiles (causes recursion risk).
-- Replace with is_admin() SECURITY DEFINER function from migration 00016.

-- camp_years
DROP POLICY IF EXISTS "Admins can manage camp years" ON public.camp_years;
CREATE POLICY "Admins can manage camp years"
  ON public.camp_years FOR ALL
  USING (public.is_admin());

-- groups
DROP POLICY IF EXISTS "Admins can manage groups" ON public.groups;
CREATE POLICY "Admins can manage groups"
  ON public.groups FOR ALL
  USING (public.is_admin());

-- registrations
DROP POLICY IF EXISTS "Admins can manage all registrations" ON public.registrations;
CREATE POLICY "Admins can manage all registrations"
  ON public.registrations FOR ALL
  USING (public.is_admin());

-- jobs
DROP POLICY IF EXISTS "Admins can manage jobs" ON public.jobs;
CREATE POLICY "Admins can manage jobs"
  ON public.jobs FOR ALL
  USING (public.is_admin());

-- job_signups
DROP POLICY IF EXISTS "Admins can manage all signups" ON public.job_signups;
CREATE POLICY "Admins can manage all signups"
  ON public.job_signups FOR ALL
  USING (public.is_admin());

-- invoices
DROP POLICY IF EXISTS "Admins can manage all invoices" ON public.invoices;
CREATE POLICY "Admins can manage all invoices"
  ON public.invoices FOR ALL
  USING (public.is_admin());

-- node_events
DROP POLICY IF EXISTS "Admins can manage events" ON public.node_events;
CREATE POLICY "Admins can manage events"
  ON public.node_events FOR ALL
  USING (public.is_admin());

-- profiles: add admin update policy so super_admins can update other profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());
