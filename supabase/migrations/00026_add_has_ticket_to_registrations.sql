-- Add has_ticket and has_car_pass columns to registrations to track BM ticket purchase status
ALTER TABLE registrations ADD COLUMN has_ticket boolean DEFAULT false;
ALTER TABLE registrations ADD COLUMN has_car_pass boolean DEFAULT false;
