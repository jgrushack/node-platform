-- Named, shareable contributions within capped menu slots.
alter table public.nodesgiving_rsvps add column revision integer not null default 0;
alter table public.nodesgiving_commitments
  add column dish_name text,
  add column servings integer,
  add column co_cooks text not null default '' check (length(co_cooks) <= 150);
update public.nodesgiving_commitments c set dish_name = m.name, servings = m.servings from public.nodesgiving_menu m where m.id = c.item_id;
alter table public.nodesgiving_commitments
  alter column dish_name set not null, alter column servings set not null,
  add constraint nodesgiving_dish_name_check check (length(trim(dish_name)) between 1 and 150 and dish_name ~ '[[:alnum:]]'),
  add constraint nodesgiving_servings_check check (servings between 1 and 200);

create function public.nodesgiving_dish_key(p_name text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(lower(trim(p_name)), '[^[:alnum:]]', '', 'g');
$$;
-- Existing commitments are preserved even if their old generic slot names repeat.
-- Every new/changed signup is checked under the event lock by the RPCs below.
create index nodesgiving_dish_key_idx on public.nodesgiving_commitments(public.nodesgiving_dish_key(dish_name));

create table public.nodesgiving_suggestions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  dish_name text not null check (length(trim(dish_name)) between 1 and 150 and dish_name ~ '[[:alnum:]]'),
  category text not null check (category in ('Mains','Sides','Salads','Desserts','Drinks','Supplies')),
  servings integer not null check (servings between 1 and 200),
  co_cooks text not null default '' check (length(co_cooks) <= 150),
  notes text not null default '' check (length(notes) <= 500),
  status text not null default 'pending' check (status in ('pending','approved','declined','withdrawn')),
  host_note text not null default '' check (length(host_note) <= 500),
  created_at timestamptz not null default now()
);
create unique index nodesgiving_one_pending_suggestion on public.nodesgiving_suggestions(profile_id) where status = 'pending';
alter table public.nodesgiving_suggestions enable row level security;
revoke all on public.nodesgiving_suggestions from anon, authenticated;

create function public.save_nodesgiving_rsvp_v3(p_status text, p_has_guest boolean, p_guest_name text, p_guest_dietary_notes text, p_revision integer, p_contributions jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text; v_item record; v_claim record; v_count integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_status is null or p_status not in ('going','declined') or p_has_guest is null or p_revision is null or p_revision < 0
    or p_guest_name is null or length(p_guest_name) > 100 or p_guest_dietary_notes is null or length(p_guest_dietary_notes) > 1000
    or (not p_has_guest and p_guest_dietary_notes <> '') then raise exception 'Invalid RSVP'; end if;
  if p_contributions is null or jsonb_typeof(p_contributions) <> 'array' then raise exception 'Invalid contributions'; end if;
  v_count := jsonb_array_length(p_contributions);
  if v_count > 100 then raise exception 'Too many contributions'; end if;
  if p_status <> 'going' and (p_has_guest or v_count > 0) then raise exception 'Only confirmed attendees can claim dishes'; end if;
  perform 1 from public.nodesgiving_event where id = true for update;
  if coalesce((select revision from public.nodesgiving_rsvps where profile_id = auth.uid()), 0) <> p_revision then
    raise exception 'Your RSVP changed elsewhere. Refresh and review your latest commitments before saving.';
  end if;
  select coalesce(nullif(trim(concat_ws(' ', first_name,last_name)), ''),'NODE member') into v_name from public.profiles where id = auth.uid();
  if v_name is null then raise exception 'Profile not found'; end if;
  if v_count <> (select count(distinct item_id) from jsonb_to_recordset(p_contributions) as c(item_id uuid)) then raise exception 'Choose each slot only once'; end if;
  if v_count <> (select count(distinct public.nodesgiving_dish_key(dish_name)) from jsonb_to_recordset(p_contributions) as c(dish_name text)) then raise exception 'Choose different dishes for each slot'; end if;
  for v_claim in select * from jsonb_to_recordset(p_contributions) as c(item_id uuid, dish_name text, servings integer, co_cooks text) loop
    if v_claim.dish_name is null or length(trim(v_claim.dish_name)) not between 1 and 150 or v_claim.dish_name !~ '[[:alnum:]]'
      or v_claim.servings is null or v_claim.servings not between 1 and 200 or v_claim.co_cooks is null or length(v_claim.co_cooks) > 150 then raise exception 'Name each dish and enter its serving quantity'; end if;
    select * into v_item from public.nodesgiving_menu where id = v_claim.item_id;
    if not found then raise exception 'A selected slot is no longer available. Refresh the menu.'; end if;
    if (select count(*) from public.nodesgiving_commitments where item_id = v_item.id and profile_id <> auth.uid()) >= v_item.slots then raise exception 'A selected slot is full. Refresh the menu and choose another.'; end if;
    if exists(select 1 from public.nodesgiving_commitments where profile_id <> auth.uid() and public.nodesgiving_dish_key(dish_name) = public.nodesgiving_dish_key(v_claim.dish_name)) then
      raise exception 'That dish is already on the menu. Check the shared list and choose something different.';
    end if;
  end loop;
  insert into public.nodesgiving_rsvps(profile_id,name,status,has_guest,guest_name,guest_dietary_notes,revision)
  values(auth.uid(),v_name,p_status,p_has_guest,case when p_has_guest then trim(p_guest_name) else '' end,trim(p_guest_dietary_notes),1)
  on conflict(profile_id) do update set name=excluded.name,status=excluded.status,has_guest=excluded.has_guest,guest_name=excluded.guest_name,guest_dietary_notes=excluded.guest_dietary_notes,revision=nodesgiving_rsvps.revision+1,updated_at=now();
  delete from public.nodesgiving_commitments where profile_id=auth.uid();
  insert into public.nodesgiving_commitments(profile_id,item_id,dish_name,servings,co_cooks)
  select auth.uid(),item_id,trim(dish_name),servings,trim(co_cooks) from jsonb_to_recordset(p_contributions) as c(item_id uuid,dish_name text,servings integer,co_cooks text);
  if p_status = 'declined' then update public.nodesgiving_suggestions set status='withdrawn' where profile_id=auth.uid() and status='pending'; end if;
end;
$$;

create function public.suggest_nodesgiving_dish(p_dish_name text,p_category text,p_servings integer,p_co_cooks text,p_notes text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform 1 from public.nodesgiving_event where id=true for update;
  if not exists(select 1 from public.nodesgiving_rsvps where profile_id=auth.uid() and status='going') then raise exception 'Save a yes RSVP before suggesting a dish.'; end if;
  if exists(select 1 from public.nodesgiving_suggestions where profile_id=auth.uid() and status='pending') then raise exception 'You already have a pending suggestion. Withdraw it before proposing another.'; end if;
  if exists(select 1 from public.nodesgiving_commitments where public.nodesgiving_dish_key(dish_name)=public.nodesgiving_dish_key(p_dish_name)) then raise exception 'That dish is already on the menu. Suggest something different.'; end if;
  insert into public.nodesgiving_suggestions(profile_id,dish_name,category,servings,co_cooks,notes) values(auth.uid(),trim(p_dish_name),p_category,p_servings,trim(p_co_cooks),trim(p_notes));
end;
$$;

create function public.withdraw_nodesgiving_suggestion(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform 1 from public.nodesgiving_event where id=true for update;
  update public.nodesgiving_suggestions set status='withdrawn' where id=p_id and profile_id=auth.uid() and status='pending';
  if not found then raise exception 'Pending suggestion not found.'; end if;
end;
$$;

create function public.review_nodesgiving_suggestion(p_id uuid,p_decision text,p_item_id uuid,p_host_note text) returns void
language plpgsql security definer set search_path=public as $$
declare s record; m record;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','super_admin')) then raise exception 'Unauthorized'; end if;
  if p_decision is null or p_decision not in ('approved','declined') or p_host_note is null or length(p_host_note)>500 then raise exception 'Invalid review'; end if;
  perform 1 from public.nodesgiving_event where id=true for update;
  select * into s from public.nodesgiving_suggestions where id=p_id and status='pending';
  if not found then raise exception 'This suggestion is no longer pending. Refresh the list.'; end if;
  if p_decision='approved' then
    if not exists(select 1 from public.nodesgiving_rsvps where profile_id=s.profile_id and status='going') then raise exception 'This member is no longer attending.'; end if;
    select * into m from public.nodesgiving_menu where id=p_item_id;
    if not found or m.category<>s.category then raise exception 'Choose a slot in the suggested category.'; end if;
    if exists(select 1 from public.nodesgiving_commitments where profile_id=s.profile_id and item_id=p_item_id) then raise exception 'This member already has this slot. Ask them to edit their existing dish.'; end if;
    if (select count(*) from public.nodesgiving_commitments where item_id=p_item_id)>=m.slots then raise exception 'This slot is full. Choose another or adjust its limit first.'; end if;
    if exists(select 1 from public.nodesgiving_commitments where public.nodesgiving_dish_key(dish_name)=public.nodesgiving_dish_key(s.dish_name)) then raise exception 'That dish is already on the menu. Ask for a different suggestion.'; end if;
    insert into public.nodesgiving_commitments(profile_id,item_id,dish_name,servings,co_cooks) values(s.profile_id,p_item_id,s.dish_name,s.servings,s.co_cooks);
    update public.nodesgiving_rsvps set revision=revision+1,updated_at=now() where profile_id=s.profile_id;
  end if;
  update public.nodesgiving_suggestions set status=p_decision,host_note=trim(p_host_note) where id=p_id;
end;
$$;

-- Prevent older clients from replacing named dishes with anonymous selections.
create or replace function public.save_nodesgiving_rsvp_v2(p_status text,p_has_guest boolean,p_guest_name text,p_guest_dietary_notes text,p_item_ids uuid[]) returns void
language plpgsql security definer set search_path=public as $$
begin
  raise exception 'Please refresh Nodesgiving to name your dishes and choose serving quantities.';
end;
$$;

create or replace function public.get_nodesgiving() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_admin boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select role in ('admin', 'super_admin') into v_admin from public.profiles where id = auth.uid();
  -- One statement provides a consistent snapshot; personal notes and the
  -- attendee roster are only returned to their owner or a host.
  return (
    with public_commitments as (
      select c.profile_id, jsonb_build_object('item_id',c.item_id,'dish_name',c.dish_name,'servings',c.servings,'co_cooks',c.co_cooks,'member_name',r.name,'is_mine',c.profile_id=auth.uid()) as entry
      from public.nodesgiving_commitments c join public.nodesgiving_rsvps r on r.profile_id=c.profile_id
    ), people as (
      select r.*, coalesce(p.dietary_restrictions, '') as profile_dietary_notes, coalesce((select jsonb_agg(c.item_id) from public.nodesgiving_commitments c where c.profile_id = r.profile_id), '[]'::jsonb) as item_ids, coalesce((select jsonb_agg(pc.entry) from public_commitments pc where pc.profile_id=r.profile_id),'[]'::jsonb) as contributions
      from public.nodesgiving_rsvps r join public.profiles p on p.id = r.profile_id
    )
    select jsonb_build_object(
      'event', (select to_jsonb(e) from public.nodesgiving_event e),
      'isAdmin', coalesce(v_admin, false),
      'menu', coalesce((select jsonb_agg(to_jsonb(m) || jsonb_build_object('claimed', (select count(*) from public.nodesgiving_commitments c where c.item_id = m.id)) order by m.category, m.name) from public.nodesgiving_menu m), '[]'::jsonb),
      'profileDietaryNotes', coalesce((select dietary_restrictions from public.profiles where id = auth.uid()), ''),
      'commitments', coalesce((select jsonb_agg(entry order by entry->>'dish_name') from public_commitments),'[]'::jsonb),
      'suggestions', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'member_name',concat_ws(' ',p.first_name,p.last_name),'dish_name',s.dish_name,'category',s.category,'servings',s.servings,'co_cooks',s.co_cooks,'notes',s.notes,'status',s.status,'host_note',s.host_note,'is_mine',s.profile_id=auth.uid()) order by s.created_at desc)
        from public.nodesgiving_suggestions s join public.profiles p on p.id=s.profile_id where s.profile_id=auth.uid() or v_admin),'[]'::jsonb),
      'mine', (select to_jsonb(p) from people p where profile_id = auth.uid()),
      'attendees', case when v_admin then coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from people p), '[]'::jsonb) else '[]'::jsonb end,
      'counts', jsonb_build_object(
        'going', (select count(*) from people where status = 'going'),
        'guests', (select count(*) from people where status = 'going' and has_guest),
        'needs_response', (select count(*) from people where status = 'needs_response'),
        'declined', (select count(*) from people where status = 'declined')
      )
    )
  );
end;
$$;


revoke all on function public.save_nodesgiving_rsvp_v3(text,boolean,text,text,integer,jsonb) from public, anon;
grant execute on function public.save_nodesgiving_rsvp_v3(text,boolean,text,text,integer,jsonb) to authenticated;

revoke all on function public.suggest_nodesgiving_dish(text,text,integer,text,text) from public, anon;
grant execute on function public.suggest_nodesgiving_dish(text,text,integer,text,text) to authenticated;

revoke all on function public.withdraw_nodesgiving_suggestion(uuid) from public, anon;
grant execute on function public.withdraw_nodesgiving_suggestion(uuid) to authenticated;

revoke all on function public.review_nodesgiving_suggestion(uuid,text,uuid,text) from public, anon;
grant execute on function public.review_nodesgiving_suggestion(uuid,text,uuid,text) to authenticated;

-- Start from the agreed 11 food contributions, including two different salads.
-- Do not replace a menu that hosts have already started building.
do $$
begin
  if not exists(select 1 from public.nodesgiving_menu) then
    insert into public.nodesgiving_menu(name,category,description,slots,servings) values
      ('Potatoes','Sides','Mashed, gratin, or roasted. Team up if you like; make enough for the table.',1,20),
      ('Stuffing','Sides','Your favorite stuffing or dressing recipe.',1,12),
      ('Comfort side','Sides','Mac and cheese, corn pudding, or a savory casserole.',1,12),
      ('Vegetables','Sides','Two different vegetable dishes. Check what others are making first.',2,10),
      ('Salads','Salads','Two different salads. Name yours and keep dressing on the side.',2,10),
      ('Bread','Sides','Rolls, biscuits, or cornbread, with butter or a spread.',1,20),
      ('Cranberry accompaniment','Sides','Sauce, relish, or chutney for the table.',1,20),
      ('Desserts','Desserts','Two different desserts, about 10 portions each.',2,10);
  end if;
end;
$$;
