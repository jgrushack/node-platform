-- Keep residential event details and the flyer out of the public source tree.
alter table public.nodesgiving_event add column location text;

create table public.nodesgiving_flyer (
  id boolean primary key default true check (id = true),
  image_base64 text not null check (length(image_base64) between 1 and 2000000)
);
alter table public.nodesgiving_flyer enable row level security;
revoke all on public.nodesgiving_flyer from public, anon, authenticated;

create function public.get_nodesgiving_flyer() returns text
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return (select image_base64 from public.nodesgiving_flyer where id = true);
end;
$$;
revoke all on function public.get_nodesgiving_flyer() from public, anon;
grant execute on function public.get_nodesgiving_flyer() to authenticated;
-- Populate location and flyer through a private deployment step, not this file.
