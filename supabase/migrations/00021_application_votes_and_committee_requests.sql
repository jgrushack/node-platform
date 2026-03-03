-- Application votes — committee members vote on applications
CREATE TABLE public.application_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES public.profiles(id),
  vote text NOT NULL CHECK (vote IN ('yes', 'no', 'waitlist')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, voter_id)
);

ALTER TABLE public.application_votes ENABLE ROW LEVEL SECURITY;

-- Committee/admin can read all votes (transparent)
CREATE POLICY "Committee and admins can view votes"
  ON public.application_votes FOR SELECT
  USING (public.is_admin());

-- Committee/admin can insert own vote
CREATE POLICY "Committee and admins can insert own vote"
  ON public.application_votes FOR INSERT
  WITH CHECK (
    public.is_admin()
    AND voter_id = auth.uid()
  );

-- Committee/admin can update own vote
CREATE POLICY "Committee and admins can update own vote"
  ON public.application_votes FOR UPDATE
  USING (
    public.is_admin()
    AND voter_id = auth.uid()
  );

CREATE TRIGGER application_votes_updated_at
  BEFORE UPDATE ON public.application_votes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Committee requests — users can ask to join the membership committee
CREATE TABLE public.committee_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.committee_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own request
CREATE POLICY "Users can view own committee request"
  ON public.committee_requests FOR SELECT
  USING (profile_id = auth.uid());

-- Authenticated users can create their own request
CREATE POLICY "Users can create own committee request"
  ON public.committee_requests FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Admins can manage all requests
CREATE POLICY "Admins can manage committee requests"
  ON public.committee_requests FOR ALL
  USING (public.is_admin());

CREATE TRIGGER committee_requests_updated_at
  BEFORE UPDATE ON public.committee_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Set max_members for 2026
UPDATE public.camp_years SET max_members = 60 WHERE year = 2026;
