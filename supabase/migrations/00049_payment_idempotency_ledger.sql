-- Exactly-once money mutations. The webhook's event-claim row can be deleted on
-- a post-credit error (to let Stripe retry), which could otherwise re-run a
-- credit. Key every credit/refund on the Stripe charge reference so re-applying
-- the same charge is a no-op even across retries / redelivery.

create table if not exists public.stripe_payments (
  ref text primary key,            -- Stripe PaymentIntent / Invoice / Refund id
  invoice_id uuid not null,
  amount_cents integer not null,   -- negative for refunds
  created_at timestamptz not null default now()
);
alter table public.stripe_payments enable row level security; -- service-role only

-- Signatures change (added p_ref), so drop the old ones first.
drop function if exists public.apply_invoice_payment(uuid, integer, text);
drop function if exists public.apply_invoice_refund(uuid, integer);

create or replace function public.apply_invoice_payment(
  p_invoice_id uuid,
  p_delta_cents integer,
  p_ref text,
  p_pi text default null
) returns table(installment_number integer, total_installments integer, status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.stripe_payments(ref, invoice_id, amount_cents)
    values (p_ref, p_invoice_id, p_delta_cents)
    on conflict (ref) do nothing;
  if not found then
    -- This charge was already applied — return current state, do not re-credit.
    return query
      select i.installment_number, i.total_installments, i.status
        from public.invoices i where i.id = p_invoice_id;
    return;
  end if;

  return query
  update public.invoices i
     set amount_paid_cents = least(i.amount_cents, i.amount_paid_cents + p_delta_cents),
         installment_number = i.installment_number + 1,
         stripe_payment_intent_id = coalesce(p_pi, i.stripe_payment_intent_id),
         status = case when least(i.amount_cents, i.amount_paid_cents + p_delta_cents) >= i.amount_cents
                       then 'paid' else 'partial' end,
         paid_at = case when least(i.amount_cents, i.amount_paid_cents + p_delta_cents) >= i.amount_cents
                        then now() else i.paid_at end,
         updated_at = now()
   where i.id = p_invoice_id
  returning i.installment_number, i.total_installments, i.status;
end;
$$;

create or replace function public.apply_invoice_refund(
  p_invoice_id uuid,
  p_delta_cents integer,
  p_ref text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.stripe_payments(ref, invoice_id, amount_cents)
    values (p_ref, p_invoice_id, -p_delta_cents)
    on conflict (ref) do nothing;
  if not found then return; end if; -- refund already applied

  update public.invoices i
     set amount_paid_cents = greatest(0, i.amount_paid_cents - p_delta_cents),
         status = case when greatest(0, i.amount_paid_cents - p_delta_cents) = 0
                       then 'refunded' else i.status end,
         updated_at = now()
   where i.id = p_invoice_id;
end;
$$;

revoke all on function public.apply_invoice_payment(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.apply_invoice_refund(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.apply_invoice_payment(uuid, integer, text, text) to service_role;
grant execute on function public.apply_invoice_refund(uuid, integer, text) to service_role;
