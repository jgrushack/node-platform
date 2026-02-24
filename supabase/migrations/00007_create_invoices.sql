-- Invoices table — tracks payments, supports Stripe and installments
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  camp_year_id uuid not null references public.camp_years(id) on delete cascade,
  -- Amounts
  amount_cents integer not null,
  amount_paid_cents integer not null default 0,
  currency text not null default 'usd',
  -- Status
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled', 'refunded')),
  -- Stripe fields
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  -- Installment support
  installment_plan text check (installment_plan in ('full', '2x', '3x', '4x')),
  installment_number integer default 1,
  total_installments integer default 1,
  -- Dates
  due_date date,
  paid_at timestamptz,
  -- Metadata
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.invoices enable row level security;

create policy "Users can view own invoices"
  on public.invoices for select
  using (auth.uid() = profile_id);

create policy "Admins can manage all invoices"
  on public.invoices for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.handle_updated_at();
