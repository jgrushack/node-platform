-- 00050_equipment_rentals.sql
-- "Rent Equipment" with HARD inventory: tent/add-on units decrement across ALL
-- members, sold-out items are blocked, and there is an admin view of who holds
-- what. Payment reuses the generic Stripe invoice flow (kind = 'equipment_2026').

-- ── Catalog ──────────────────────────────────────────────────────────
create table public.equipment_items (
  key             text primary key,            -- 'shiftpod2', 'ac_outlet', …
  label           text not null,
  description     text,
  price_cents     integer not null check (price_cents >= 0),
  total_qty       integer check (total_qty is null or total_qty >= 0), -- NULL = unlimited
  held_qty        integer not null default 0 check (held_qty >= 0),    -- pre-claimed, not bookable
  category        text not null check (category in ('tent', 'addon')),
  sort_order      integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.equipment_items enable row level security;

create policy "Anyone can view equipment items"
  on public.equipment_items for select using (true);

create policy "Admins can manage equipment items"
  on public.equipment_items for all
  using (exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin', 'super_admin')));

create trigger equipment_items_updated_at
  before update on public.equipment_items
  for each row execute function public.handle_updated_at();

-- ── Reservations (the inventory ledger) ──────────────────────────────
create table public.equipment_reservations (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  camp_year_id     uuid not null references public.camp_years(id) on delete cascade,
  item_key         text references public.equipment_items(key), -- NULL for custom/Other
  custom_label     text,                                        -- only when item_key is NULL
  quantity         integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Exactly one of: catalog item, or a custom (label-priced) line.
  constraint reservation_item_or_custom check (
    (item_key is not null and custom_label is null) or
    (item_key is null     and custom_label is not null)
  )
);

alter table public.equipment_reservations enable row level security;

create policy "Users can view own reservations"
  on public.equipment_reservations for select
  using (auth.uid() = profile_id);

create policy "Admins can view all reservations"
  on public.equipment_reservations for select
  using (exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin', 'super_admin')));
-- No user write policy: all writes go through reserve_equipment() (SECURITY
-- DEFINER) or the service-role admin client, exactly like invoices (00007).

create index equip_res_year_item on public.equipment_reservations (camp_year_id, item_key);
create index equip_res_profile   on public.equipment_reservations (profile_id, camp_year_id);

create trigger equipment_reservations_updated_at
  before update on public.equipment_reservations
  for each row execute function public.handle_updated_at();

-- One equipment invoice per member/year (mirror 00043/00047).
create unique index if not exists uniq_equipment_2026_invoice
  on public.invoices (profile_id, camp_year_id)
  where kind = 'equipment_2026';

-- ── Seed catalog ─────────────────────────────────────────────────────
insert into public.equipment_items
  (key, label, description, price_cents, total_qty, held_qty, category, sort_order) values
  ('shiftpod1_asis', 'Shiftpod 1 (as-is)',
     'May have a single broken door or a repaired pole.', 8000, 3, 0, 'tent', 10),
  ('shiftpod1_good', 'Shiftpod 1 (good condition)', null, 12000, 3, 0, 'tent', 20),
  ('shiftpod2',      'Shiftpod 2',      null, 16000, 4, 0, 'tent', 30),
  ('shiftpod3',      'Shiftpod 3',      null, 25000, 2, 0, 'tent', 40),
  ('shiftpod_mini',  'Shiftpod Mini',   null, 10000, 3, 0, 'tent', 50),
  ('kodiak',         'Kodiak Canvas',   null,  7500, 2, 0, 'tent', 60),
  ('fsr',            'FSR',             null, 10000, 3, 1, 'tent', 70),
  ('ac_outlet',      'Dedicated AC Power Outlet',
     'All tents have power; this dedicated outlet can run an AC. Not needed if your AC is already in storage.',
     7500, null, 0, 'addon', 80)
on conflict (key) do nothing;

-- ── Availability (pool-wide; caller's own holds added back in the app) ──
create or replace function public.equipment_availability(p_year integer)
returns table(key text, available integer, sold_out boolean)
language sql
stable
security definer
set search_path = public
as $$
  with reserved as (
    select r.item_key, sum(r.quantity)::int as qty
      from public.equipment_reservations r
      join public.camp_years cy on cy.id = r.camp_year_id
     where cy.year = p_year and r.item_key is not null
     group by r.item_key
  )
  select i.key,
         case when i.total_qty is null then null
              else i.total_qty - i.held_qty - coalesce(rv.qty, 0)
         end as available,
         case when i.total_qty is null then false
              else (i.total_qty - i.held_qty - coalesce(rv.qty, 0)) <= 0
         end as sold_out
    from public.equipment_items i
    left join reserved rv on rv.item_key = i.key
   where i.active;
$$;

revoke all on function public.equipment_availability(integer) from public, anon;
grant execute on function public.equipment_availability(integer) to authenticated, service_role;

-- ── Atomic reserve + invoice upsert ──────────────────────────────────
-- Call via the USER-scoped client so auth.uid() resolves; SECURITY DEFINER
-- grants the privilege to write reservations/invoices despite no user policy.
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
  it jsonb;
  v_key text; v_qty integer; v_label text; v_price integer;
  v_total_qty integer; v_held integer; v_active boolean;
  v_reserved integer; v_avail integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select id into v_year_id from public.camp_years where year = p_year;
  if v_year_id is null then raise exception 'no camp year %', p_year; end if;

  -- MONEY GUARD: never disturb a reservation set that already has a payment.
  select amount_paid_cents into v_paid from public.invoices
   where profile_id = v_uid and camp_year_id = v_year_id and kind = 'equipment_2026';
  if coalesce(v_paid, 0) > 0 then
    raise exception 'equipment already paid';
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
      -- Custom / Other line: label + price come from the (server-validated) client.
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

    -- Catalog item: price is taken from the DB, never trusted from the client.
    select price_cents, total_qty, held_qty, active
      into v_price, v_total_qty, v_held, v_active
      from public.equipment_items where key = v_key;
    if v_price is null then raise exception 'unknown item %', v_key; end if;
    if not v_active then raise exception 'item % is inactive', v_key; end if;

    if v_total_qty is not null then
      -- Our own rows were just deleted, so this sum is everyone else's holds.
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

  -- Upsert the single equipment invoice (read-then-write avoids partial-index
  -- ON CONFLICT inference; the unique index still guards against duplicates).
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
