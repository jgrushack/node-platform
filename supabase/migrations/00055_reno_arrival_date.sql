-- Reno arrival date: when a camper lands in Reno (optional; null = driving
-- straight in or not answered). Shown on the Road to 2026 dates checklist.
alter table registrations
  add column if not exists reno_arrival_date date;
