-- Change has_car_pass from boolean to text to support more options
-- Options: yes, no, need_ride, burner_express
ALTER TABLE public.registrations
  ALTER COLUMN has_car_pass DROP DEFAULT,
  ALTER COLUMN has_car_pass TYPE text USING CASE WHEN has_car_pass THEN 'yes' ELSE 'no' END,
  ALTER COLUMN has_car_pass SET DEFAULT 'no';

ALTER TABLE public.registrations
  ADD CONSTRAINT registrations_car_pass_check
  CHECK (has_car_pass IN ('yes', 'no', 'need_ride', 'burner_express'));
