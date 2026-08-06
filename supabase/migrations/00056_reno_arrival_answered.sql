-- Track whether the camper has been asked the Reno question at all —
-- a null reno_arrival_date can mean "driving in" (answered) or "never asked".
-- Campers who saved dates before the Reno step existed get re-prompted.
alter table registrations
  add column if not exists reno_arrival_answered boolean not null default false;

update registrations
  set reno_arrival_answered = true
  where reno_arrival_date is not null;
