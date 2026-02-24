-- Update applications table: add form fields, drop unused columns
alter table public.applications
  add column favorite_principle text,
  add column principle_reason text,
  add column referred_by text,
  add column video_url text;

alter table public.applications
  drop column why_node,
  drop column contribution,
  drop column dietary_restrictions;

-- Create storage bucket for application videos (private, 100MB limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-videos',
  'application-videos',
  false,
  104857600, -- 100MB
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
);

-- Storage policies: anyone can upload a video
create policy "Anyone can upload application video"
  on storage.objects for insert
  with check (bucket_id = 'application-videos');

-- Admins can view/download videos
create policy "Admins can view application videos"
  on storage.objects for select
  using (
    bucket_id = 'application-videos'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );
