-- Enable anonymous resumable (tus) uploads for application videos.
-- The apply form is anonymous, so the legacy signed-URL flow had to go through
-- the service-role admin client. Switching to the tus protocol against the
-- public storage endpoint lets the browser pause/resume chunked uploads over
-- flaky connections. The bucket stays private — reviewers still fetch via
-- server-side signed URLs generated with the admin client — and size + mime
-- type limits are enforced at the bucket layer so anon writers can't abuse it.

update storage.buckets
   set file_size_limit   = 209715200,  -- 200 MB
       allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
 where id = 'application-videos';

drop policy if exists "Authenticated users can upload application videos" on storage.objects;
drop policy if exists "Anon can upload application videos" on storage.objects;
drop policy if exists "Anon can update application videos" on storage.objects;

create policy "Anon can upload application videos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'application-videos');

create policy "Anon can update application videos"
  on storage.objects for update
  to anon
  using (bucket_id = 'application-videos')
  with check (bucket_id = 'application-videos');
