-- Native Nodesgiving RSVPs and a host-curated potluck menu.
create table public.nodesgiving_event (
  id boolean primary key default true check (id),
  title text not null default 'Nodesgiving',
  event_date date not null default '2026-11-21'
);
insert into public.nodesgiving_event (id) values (true);

create table public.nodesgiving_menu (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 150),
  category text not null check (category in ('Mains', 'Sides', 'Salads', 'Desserts', 'Drinks', 'Supplies')),
  description text not null default '' check (length(description) <= 500),
  slots integer not null check (slots between 1 and 100),
  servings integer not null check (servings between 1 and 200)
);
create table public.nodesgiving_rsvps (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  name text not null,
  status text not null check (status in ('going', 'maybe', 'declined')),
  has_guest boolean not null default false,
  guest_name text not null default '' check (length(guest_name) <= 100),
  dietary_notes text not null default '' check (length(dietary_notes) <= 1000),
  updated_at timestamptz not null default now(),
  check (status = 'going' or not has_guest)
);
create table public.nodesgiving_commitments (
  profile_id uuid not null references public.nodesgiving_rsvps(profile_id) on delete cascade,
  item_id uuid not null references public.nodesgiving_menu(id) on delete restrict,
  primary key (profile_id, item_id)
);
create index nodesgiving_commitments_item on public.nodesgiving_commitments(item_id);

-- All access goes through the authenticated RPCs below. No direct writes can
-- bypass the shared event lock, capacity limits, or host authorization.
alter table public.nodesgiving_event enable row level security;
alter table public.nodesgiving_menu enable row level security;
alter table public.nodesgiving_rsvps enable row level security;
alter table public.nodesgiving_commitments enable row level security;
revoke all on public.nodesgiving_event, public.nodesgiving_menu, public.nodesgiving_rsvps, public.nodesgiving_commitments from anon, authenticated;

create function public.get_nodesgiving() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_admin boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select role in ('admin', 'super_admin') into v_admin from public.profiles where id = auth.uid();
  -- One statement provides a consistent snapshot; personal notes and the
  -- attendee roster are only returned to their owner or a host.
  return (
    with people as (
      select r.*, coalesce((select jsonb_agg(c.item_id) from public.nodesgiving_commitments c where c.profile_id = r.profile_id), '[]'::jsonb) as item_ids
      from public.nodesgiving_rsvps r
    )
    select jsonb_build_object(
      'event', (select to_jsonb(e) from public.nodesgiving_event e),
      'isAdmin', coalesce(v_admin, false),
      'menu', coalesce((select jsonb_agg(to_jsonb(m) || jsonb_build_object('claimed', (select count(*) from public.nodesgiving_commitments c where c.item_id = m.id)) order by m.category, m.name) from public.nodesgiving_menu m), '[]'::jsonb),
      'mine', (select to_jsonb(p) from people p where profile_id = auth.uid()),
      'attendees', case when v_admin then coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from people p), '[]'::jsonb) else '[]'::jsonb end,
      'counts', jsonb_build_object(
        'going', (select count(*) from people where status = 'going'),
        'guests', (select count(*) from people where status = 'going' and has_guest),
        'maybe', (select count(*) from people where status = 'maybe'),
        'declined', (select count(*) from people where status = 'declined')
      )
    )
  );
end;
$$;

create function public.save_nodesgiving_rsvp(p_status text, p_has_guest boolean, p_guest_name text, p_dietary_notes text, p_item_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text; v_item record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_status is null or p_status not in ('going', 'maybe', 'declined') or p_has_guest is null
    or p_guest_name is null or length(p_guest_name) > 100 or p_dietary_notes is null or length(p_dietary_notes) > 1000
    or p_item_ids is null or cardinality(p_item_ids) > 100 then raise exception 'Invalid RSVP'; end if;
  if p_status <> 'going' and (p_has_guest or cardinality(p_item_ids) > 0) then raise exception 'Only confirmed attendees can claim dishes'; end if;
  if cardinality(p_item_ids) <> (select count(distinct x) from unnest(p_item_ids) x) then raise exception 'Invalid dish selection'; end if;
  perform 1 from public.nodesgiving_event where id = true for update;
  select coalesce(nullif(trim(concat_ws(' ', first_name, last_name)), ''), 'NODE member') into v_name from public.profiles where id = auth.uid();
  if v_name is null then raise exception 'Profile not found'; end if;
  if (select count(*) from public.nodesgiving_menu where id = any(p_item_ids)) <> cardinality(p_item_ids) then raise exception 'A selected dish is no longer available. Refresh the menu.'; end if;
  for v_item in select * from public.nodesgiving_menu where id = any(p_item_ids) loop
    if (select count(*) from public.nodesgiving_commitments where item_id = v_item.id and profile_id <> auth.uid()) >= v_item.slots then
      raise exception 'A selected dish is full. Refresh the menu and choose another.';
    end if;
  end loop;
  insert into public.nodesgiving_rsvps (profile_id, name, status, has_guest, guest_name, dietary_notes)
  values (auth.uid(), v_name, p_status, p_has_guest, case when p_has_guest then trim(p_guest_name) else '' end, trim(p_dietary_notes))
  on conflict (profile_id) do update set name = excluded.name, status = excluded.status, has_guest = excluded.has_guest, guest_name = excluded.guest_name, dietary_notes = excluded.dietary_notes, updated_at = now();
  delete from public.nodesgiving_commitments where profile_id = auth.uid();
  insert into public.nodesgiving_commitments (profile_id, item_id) select auth.uid(), unnest(p_item_ids);
end;
$$;

create function public.save_nodesgiving_menu(p_id uuid, p_name text, p_category text, p_description text, p_slots integer, p_servings integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')) then raise exception 'Unauthorized'; end if;
  perform 1 from public.nodesgiving_event where id = true for update;
  if p_id is null then
    insert into public.nodesgiving_menu (name, category, description, slots, servings) values (trim(p_name), p_category, trim(p_description), p_slots, p_servings);
  else
    if p_slots < (select count(*) from public.nodesgiving_commitments where item_id = p_id) then raise exception 'Cannot reduce slots below existing commitments.'; end if;
    -- A claimed dish may have its capacity increased, but changing what someone
    -- promised to bring requires releasing that commitment first.
    if exists (select 1 from public.nodesgiving_commitments where item_id = p_id) and exists (
      select 1 from public.nodesgiving_menu where id = p_id and (name, category, description, servings) is distinct from (trim(p_name), p_category, trim(p_description), p_servings)
    ) then raise exception 'This dish has commitments. Only its signup limit can be changed.'; end if;
    update public.nodesgiving_menu set name = trim(p_name), category = p_category, description = trim(p_description), slots = p_slots, servings = p_servings where id = p_id;
    if not found then raise exception 'Dish not found'; end if;
  end if;
end;
$$;
create function public.delete_nodesgiving_menu(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')) then raise exception 'Unauthorized'; end if;
  perform 1 from public.nodesgiving_event where id = true for update;
  if exists (select 1 from public.nodesgiving_commitments where item_id = p_id) then raise exception 'This dish has commitments and cannot be removed.'; end if;
  delete from public.nodesgiving_menu where id = p_id;
  if not found then raise exception 'Dish not found'; end if;
end;
$$;
revoke all on function public.get_nodesgiving() from public, anon;
revoke all on function public.save_nodesgiving_rsvp(text, boolean, text, text, uuid[]) from public, anon;
revoke all on function public.save_nodesgiving_menu(uuid, text, text, text, integer, integer) from public, anon;
revoke all on function public.delete_nodesgiving_menu(uuid) from public, anon;
grant execute on function public.get_nodesgiving() to authenticated;
grant execute on function public.save_nodesgiving_rsvp(text, boolean, text, text, uuid[]) to authenticated;
grant execute on function public.save_nodesgiving_menu(uuid, text, text, text, integer, integer) to authenticated;
grant execute on function public.delete_nodesgiving_menu(uuid) to authenticated;

-- Correct the existing seeded calendar entry without touching other events.
update public.node_events set event_date = '2026-11-21', title = 'Nodesgiving'
where lower(title) in ('nodes giving', 'nodesgiving') and event_date between '2026-01-01' and '2026-12-31';
