-- Onboarding: prebuild RSVP + onboarding tracking

-- Add prebuild RSVP to registrations
ALTER TABLE public.registrations
  ADD COLUMN prebuild_rsvp text CHECK (prebuild_rsvp IN ('yes', 'no', 'maybe'));

-- Users need UPDATE on their own registrations (upsert requires it)
CREATE POLICY "Users can update own registrations"
  ON public.registrations FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- Track onboarding completion
ALTER TABLE public.profiles
  ADD COLUMN onboarding_completed_at timestamptz;
