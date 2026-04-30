-- Track the verified size and content type of the uploaded application video
-- so admins can spot truncated or corrupted uploads without having to play the
-- file. linkApplicationVideo HEADs the storage object before writing video_url
-- and records what the storage layer reports here.

alter table public.applications
  add column video_size_bytes bigint,
  add column video_content_type text;
