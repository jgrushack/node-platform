-- Setup Access Passes: one PDF per early-arriving camper, stored in a
-- private bucket; path + ticket id live on the 2026 registration.
alter table registrations
  add column if not exists sap_path text,
  add column if not exists sap_ticket_id text,
  add column if not exists sap_valid_from date;

-- Private bucket for the pass PDFs (signed URLs only — passes are
-- credential-like; leaking them can get the whole camp's SAPs revoked).
insert into storage.buckets (id, name, public)
values ('saps', 'saps', false)
on conflict (id) do nothing;

-- Campers may read only their own pass file: path is '<profile_id>.pdf'.
create policy "Users read own SAP" on storage.objects
  for select to authenticated
  using (bucket_id = 'saps' and name = auth.uid()::text || '.pdf');
