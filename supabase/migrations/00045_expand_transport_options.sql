-- Expand registrations.has_car_pass options for the "Road to 2026" checklist.
-- New canonical vocabulary; the legacy 'yes'/'need_ride' rows are migrated, but
-- both legacy values stay in the CHECK so a not-yet-redeployed client can't 400
-- on write during the rollout window.

ALTER TABLE public.registrations
  ALTER COLUMN has_car_pass DROP DEFAULT;

-- Drop the old CHECK first so the data migration to new values doesn't violate it.
ALTER TABLE public.registrations
  DROP CONSTRAINT IF EXISTS registrations_car_pass_check;

-- Migrate existing data to the new vocabulary.
UPDATE public.registrations
  SET has_car_pass = CASE has_car_pass
    WHEN 'yes' THEN 'car_pass_parking'
    WHEN 'need_ride' THEN 'ride_unsorted'
    ELSE has_car_pass
  END;

ALTER TABLE public.registrations
  ADD CONSTRAINT registrations_car_pass_check
  CHECK (has_car_pass IN (
    'no',                 -- unset / not answered (default; grey in checklist)
    'car_pass_parking',   -- Car Pass + need Parking
    'burner_express',     -- Burner Express
    'ride_sorted',        -- Getting a ride (sorted)
    'ride_unsorted',      -- Need a ride (unsorted) — yellow in checklist
    'other',              -- Other (plane / bike / skydive)
    -- legacy values retained for write-compat with the previously deployed client:
    'yes', 'need_ride'
  ));

ALTER TABLE public.registrations
  ALTER COLUMN has_car_pass SET DEFAULT 'no';
