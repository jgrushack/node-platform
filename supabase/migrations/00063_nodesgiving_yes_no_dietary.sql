-- Yes/no RSVPs, profile-sourced member dietary needs, separate guest notes.
-- Keep prior combined notes intact: their author may have meant either person.
alter table public.nodesgiving_rsvps add column guest_dietary_notes text not null default '' check (length(guest_dietary_notes) <= 1000);
alter table public.nodesgiving_rsvps drop constraint nodesgiving_rsvps_status_check;
update public.nodesgiving_rsvps set status = 'needs_response' where status = 'maybe';
alter table public.nodesgiving_rsvps add constraint nodesgiving_rsvps_status_check check (status in ('going', 'declined', 'needs_response'));
alter table public.nodesgiving_rsvps add constraint nodesgiving_guest_notes_check check (has_guest or guest_dietary_notes = '');

create or replace function public.get_nodesgiving() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_admin boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select role in ('admin', 'super_admin') into v_admin from public.profiles where id = auth.uid();
  -- One statement provides a consistent snapshot; personal notes and the
  -- attendee roster are only returned to their owner or a host.
  return (
    with people as (
      select r.*, coalesce(p.dietary_restrictions, '') as profile_dietary_notes, coalesce((select jsonb_agg(c.item_id) from public.nodesgiving_commitments c where c.profile_id = r.profile_id), '[]'::jsonb) as item_ids
      from public.nodesgiving_rsvps r join public.profiles p on p.id = r.profile_id
    )
    select jsonb_build_object(
      'event', (select to_jsonb(e) from public.nodesgiving_event e),
      'isAdmin', coalesce(v_admin, false),
      'menu', coalesce((select jsonb_agg(to_jsonb(m) || jsonb_build_object('claimed', (select count(*) from public.nodesgiving_commitments c where c.item_id = m.id)) order by m.category, m.name) from public.nodesgiving_menu m), '[]'::jsonb),
      'profileDietaryNotes', coalesce((select dietary_restrictions from public.profiles where id = auth.uid()), ''),
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

create function public.save_nodesgiving_rsvp_v2(p_status text, p_has_guest boolean, p_guest_name text, p_guest_dietary_notes text, p_item_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text; v_item record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_status is null or p_status not in ('going', 'declined') or p_has_guest is null
    or (not p_has_guest and coalesce(p_guest_dietary_notes, '') <> '')
    or p_guest_name is null or length(p_guest_name) > 100 or p_guest_dietary_notes is null or length(p_guest_dietary_notes) > 1000
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
  insert into public.nodesgiving_rsvps (profile_id, name, status, has_guest, guest_name, guest_dietary_notes)
  values (auth.uid(), v_name, p_status, p_has_guest, case when p_has_guest then trim(p_guest_name) else '' end, trim(p_guest_dietary_notes))
  on conflict (profile_id) do update set name = excluded.name, status = excluded.status, has_guest = excluded.has_guest, guest_name = excluded.guest_name, guest_dietary_notes = excluded.guest_dietary_notes, updated_at = now();
  delete from public.nodesgiving_commitments where profile_id = auth.uid();
  insert into public.nodesgiving_commitments (profile_id, item_id) select auth.uid(), unnest(p_item_ids);
end;
$$;


-- Stale clients must reload instead of writing ambiguous member/guest notes.
create or replace function public.save_nodesgiving_rsvp(p_status text, p_has_guest boolean, p_guest_name text, p_dietary_notes text, p_item_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Please refresh Nodesgiving. RSVPs are now yes or no, and your dietary needs come from your NODE profile.';
end;
$$;
revoke all on function public.save_nodesgiving_rsvp_v2(text, boolean, text, text, uuid[]) from public, anon;
grant execute on function public.save_nodesgiving_rsvp_v2(text, boolean, text, text, uuid[]) to authenticated;
