-- Stripe dues-payment integration.

-- Reusable Stripe customer per member (avoid creating duplicate customers).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profiles_stripe_customer
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Link an installment-plan dues invoice to its Stripe subscription (for the
-- cap-on-Nth-success cancel + reconciling invoice.paid events).
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Exactly one dues invoice per member/camp-year (idempotency backstop; mirrors
-- the storage-survey unique index in 00043).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dues_2026_invoice
  ON public.invoices (profile_id, camp_year_id)
  WHERE kind = 'dues_2026';

-- ACH settles asynchronously: allow a 'processing' status so a pending bank
-- debit is shown honestly without crediting amount_paid_cents early.
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN (
    'draft','sent','partial','paid','overdue','cancelled','refunded','processing'
  ));

-- Webhook idempotency ledger: claim each Stripe event id once. RLS enabled with
-- NO policies => only the service-role (webhook/admin client) can read/write it.
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id text PRIMARY KEY,             -- Stripe event id (evt_...)
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
