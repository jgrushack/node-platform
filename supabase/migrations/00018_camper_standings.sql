-- Camper standings — private, only visible to super_admins
CREATE TABLE public.camper_standings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  standing text NOT NULL DEFAULT 'good_standing'
    CHECK (standing IN ('good_standing', 'limited_referrals', 'reapply', 'not_invited_back')),
  notes text,
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.camper_standings ENABLE ROW LEVEL SECURITY;

-- Only super_admins can see standings
CREATE POLICY "Super admins can view standings"
  ON public.camper_standings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Only super_admins can insert standings
CREATE POLICY "Super admins can insert standings"
  ON public.camper_standings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Only super_admins can update standings
CREATE POLICY "Super admins can update standings"
  ON public.camper_standings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Only super_admins can delete standings
CREATE POLICY "Super admins can delete standings"
  ON public.camper_standings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE TRIGGER camper_standings_updated_at
  BEFORE UPDATE ON public.camper_standings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed default standing for all existing profiles
INSERT INTO public.camper_standings (profile_id, standing)
SELECT id, 'good_standing' FROM public.profiles
ON CONFLICT DO NOTHING;
