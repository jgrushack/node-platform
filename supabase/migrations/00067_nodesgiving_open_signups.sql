-- Signup counts are planning suggestions, not hard limits.
-- Preserve auth, revision checks, duplicate recipe checks, and existing commitments.

create or replace function public.save_nodesgiving_rsvp_v3(p_status text, p_has_guest boolean, p_guest_name text, p_guest_dietary_notes text, p_revision integer, p_contributions jsonb) returns void
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

create or replace function public.review_nodesgiving_suggestion(p_id uuid,p_decision text,p_item_id uuid,p_host_note text) returns void
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
    if exists(select 1 from public.nodesgiving_commitments where public.nodesgiving_dish_key(dish_name)=public.nodesgiving_dish_key(s.dish_name)) then raise exception 'That dish is already on the menu. Ask for a different suggestion.'; end if;
    insert into public.nodesgiving_commitments(profile_id,item_id,dish_name,servings,co_cooks) values(s.profile_id,p_item_id,s.dish_name,s.servings,s.co_cooks);
    update public.nodesgiving_rsvps set revision=revision+1,updated_at=now() where profile_id=s.profile_id;
  end if;
  update public.nodesgiving_suggestions set status=p_decision,host_note=trim(p_host_note) where id=p_id;
end;
$$;

create or replace function public.save_nodesgiving_menu(p_id uuid, p_name text, p_category text, p_description text, p_slots integer, p_servings integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')) then raise exception 'Unauthorized'; end if;
  perform 1 from public.nodesgiving_event where id = true for update;
  if p_id is null then
    insert into public.nodesgiving_menu (name, category, description, slots, servings) values (trim(p_name), p_category, trim(p_description), p_slots, p_servings);
  else
    -- A claimed dish may have its suggested signup count changed, but changing what someone
    -- promised to bring requires releasing that commitment first.
    if exists (select 1 from public.nodesgiving_commitments where item_id = p_id) and exists (
      select 1 from public.nodesgiving_menu where id = p_id and (name, category, description, servings) is distinct from (trim(p_name), p_category, trim(p_description), p_servings)
    ) then raise exception 'This dish has commitments. Only its suggested signup count can be changed.'; end if;
    update public.nodesgiving_menu set name = trim(p_name), category = p_category, description = trim(p_description), slots = p_slots, servings = p_servings where id = p_id;
    if not found then raise exception 'Dish not found'; end if;
  end if;
end;
$$;
