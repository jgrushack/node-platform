-- 00051_equipment_reserve_lock.sql
-- Harden reserve_equipment against a money-guard TOCTOU: lock the equipment
-- invoice row so the guard read + the amount_cents/status rewrite serialize
-- against the webhook's payment credit (apply_invoice_payment), and refuse to
-- edit while an ACH payment is mid-flight ('processing'). Without the lock, a
-- member re-submitting an emptied cart in the window between Stripe capture and
-- the webhook commit could orphan the credit and release paid-for inventory.

create or replace function public.reserve_equipment(p_year integer, p_items jsonb)
returns table(total_cents integer, invoice_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_year_id uuid;
  v_total integer := 0;
  v_inv_id uuid;
  v_paid integer;
  v_status text;
  it jsonb;
  v_key text; v_qty integer; v_label text; v_price integer;
  v_total_qty integer; v_held integer; v_active boolean;
  v_reserved integer; v_avail integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select id into v_year_id from public.camp_years where year = p_year;
  if v_year_id is null then raise exception 'no camp year %', p_year; end if;

  -- MONEY GUARD: lock the invoice row so this serializes against the webhook's
  -- payment credit, and reject if a payment exists or is mid-flight (ACH).
  select amount_paid_cents, status into v_paid, v_status from public.invoices
   where profile_id = v_uid and camp_year_id = v_year_id and kind = 'equipment_2026'
   for update;
  if coalesce(v_paid, 0) > 0 then
    raise exception 'equipment already paid';
  end if;
  if v_status = 'processing' then
    raise exception 'equipment payment processing';
  end if;

  -- Serialize concurrent last-unit claims by locking the catalog rows in play.
  perform 1 from public.equipment_items
   where key in (
     select x->>'key' from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
      where x->>'key' is not null
   )
   for update;

  -- Re-claim semantics: drop this member's prior holds, then re-insert.
  delete from public.equipment_reservations
   where profile_id = v_uid and camp_year_id = v_year_id;

  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_qty := (it->>'quantity')::int;
    if v_qty is null or v_qty <= 0 then continue; end if;
    v_key := it->>'key';

    if v_key is null then
      v_label := nullif(trim(it->>'custom_label'), '');
      v_price := (it->>'unit_price_cents')::int;
      if v_label is null or v_price is null or v_price < 0 then
        raise exception 'invalid custom item';
      end if;
      insert into public.equipment_reservations
        (profile_id, camp_year_id, item_key, custom_label, quantity, unit_price_cents)
        values (v_uid, v_year_id, null, v_label, v_qty, v_price);
      v_total := v_total + v_qty * v_price;
      continue;
    end if;

    select price_cents, total_qty, held_qty, active
      into v_price, v_total_qty, v_held, v_active
      from public.equipment_items where key = v_key;
    if v_price is null then raise exception 'unknown item %', v_key; end if;
    if not v_active then raise exception 'item % is inactive', v_key; end if;

    if v_total_qty is not null then
      select coalesce(sum(quantity), 0) into v_reserved
        from public.equipment_reservations
       where item_key = v_key and camp_year_id = v_year_id;
      v_avail := v_total_qty - v_held - v_reserved;
      if v_qty > v_avail then
        raise exception 'sold out: % (requested %, available %)', v_key, v_qty, v_avail;
      end if;
    end if;

    insert into public.equipment_reservations
      (profile_id, camp_year_id, item_key, quantity, unit_price_cents)
      values (v_uid, v_year_id, v_key, v_qty, v_price);
    v_total := v_total + v_qty * v_price;
  end loop;

  -- Upsert the single equipment invoice. The row is already locked above (or
  -- absent), so this rewrite can't interleave with the payment credit.
  select id into v_inv_id from public.invoices
   where profile_id = v_uid and camp_year_id = v_year_id and kind = 'equipment_2026';
  if v_inv_id is null then
    insert into public.invoices
      (profile_id, camp_year_id, kind, currency, amount_cents, amount_paid_cents,
       status, description)
      values (v_uid, v_year_id, 'equipment_2026', 'usd', v_total, 0,
              case when v_total = 0 then 'cancelled' else 'sent' end,
              'NODE 2026 equipment rental')
      returning id into v_inv_id;
  else
    update public.invoices
       set amount_cents = v_total,
           status = case when v_total = 0 then 'cancelled' else 'sent' end,
           description = 'NODE 2026 equipment rental',
           updated_at = now()
     where id = v_inv_id;
  end if;

  return query select v_total, v_inv_id;
end;
$$;

revoke all on function public.reserve_equipment(integer, jsonb) from public, anon;
grant execute on function public.reserve_equipment(integer, jsonb) to authenticated, service_role;
