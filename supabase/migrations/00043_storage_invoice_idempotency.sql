-- Idempotency backstop for the storage-survey invoice (prevents double-charge).
-- Tag storage-survey invoices with a `kind` and enforce one per member/year at
-- the DB level, so even a retry after a committed-but-unacked insert cannot
-- create a second charge (app-layer claim alone can't guarantee this).
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS kind text;

-- Backfill existing storage-survey invoices (identified by their description).
UPDATE public.invoices
  SET kind = 'storage_survey_2026'
  WHERE kind IS NULL AND description LIKE 'Storage 2026:%';

-- One storage-survey invoice per member per camp year.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_storage_survey_invoice
  ON public.invoices (profile_id, camp_year_id)
  WHERE kind = 'storage_survey_2026';
