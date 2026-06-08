-- Atomic, monotonic money mutations for Stripe webhook settlement. Doing the
-- increment in SQL (not read-modify-write in JS) means two concurrent webhook
-- events on the same invoice can never lose an increment, and LEAST/GREATEST
-- clamp so we never over-credit or go negative.

create or replace function public.apply_invoice_payment(
  p_invoice_id uuid,
  p_delta_cents integer,
  p_pi text default null
) returns table(installment_number integer, total_installments integer, status text)
language plpgsql
security definer
set search_path = public
as $$
begin
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
  p_delta_cents integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invoices i
     set amount_paid_cents = greatest(0, i.amount_paid_cents - p_delta_cents),
         status = case when greatest(0, i.amount_paid_cents - p_delta_cents) = 0
                       then 'refunded' else i.status end,
         updated_at = now()
   where i.id = p_invoice_id;
end;
$$;

revoke all on function public.apply_invoice_payment(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.apply_invoice_refund(uuid, integer) from public, anon, authenticated;
grant execute on function public.apply_invoice_payment(uuid, integer, text) to service_role;
grant execute on function public.apply_invoice_refund(uuid, integer) to service_role;
