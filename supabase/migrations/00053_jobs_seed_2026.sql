-- 00053_jobs_seed_2026.sql
-- Replace the placeholder job catalog (seeded in 00052) with the real NODE 2026
-- schedule from the camp jobs spreadsheet. Generalized, reusable definitions
-- (the shift's date supplies the day); points = difficulty × 30-min blocks,
-- assigned by effort since the sheet left points blank. Admins tune in the
-- Catalog tab. ~89 dated shifts, Aug 30 – Sep 6.

-- Wipe the placeholder catalog (cascades to its shifts/signups — none exist yet).
delete from public.job_definitions
 where camp_year_id = (select id from public.camp_years where year = 2026);

-- ── Reusable job definitions ─────────────────────────────────────────
insert into public.job_definitions
  (camp_year_id, title, category, people_required, duration_min, difficulty, sort_order)
select cy.id, v.title, v.category, v.people, v.dur, v.diff, v.sort
from (values
  ('Brunch Prep',                     'Kitchen',        2,  90, 3,  10),
  ('Serve Coffee',                    'Kitchen',        2, 120, 2,  20),
  ('Brunch Cleanup',                  'Kitchen',        2,  60, 3,  30),
  ('Dinner',                          'Kitchen',        4, 120, 4,  40),
  ('Dinner Cleanup',                  'Kitchen',        3,  90, 3,  50),
  ('Shabbat Dinner',                  'Kitchen',        4, 120, 4,  60),
  ('Ice Fill',                        'Infrastructure', 2,  30, 3,  70),
  ('Recycle Run',                     'Infrastructure', 2,  30, 3,  80),
  ('Bathroom Tidy',                   'Cleaning',       2,  30, 2,  90),
  ('Camp Tidy',                       'Cleaning',       3,  30, 2, 100),
  ('Martini Therapy Setup',           'Bar',            5,  60, 4, 110),
  ('Martini Therapy Bartender',       'Bar',            3,  90, 4, 120),
  ('Martini Therapy Bouncer',         'Bar',            2,  90, 3, 130),
  ('Martini Therapy Bike/Moop Police','Bar',            2,  90, 3, 140),
  ('Martini Therapy Cleanup',         'Bar',            4,  90, 4, 150),
  ('BBQ Setup',                       'BBQ',            8,  60, 5, 160),
  ('BBQ Bartender',                   'BBQ',            3, 120, 4, 170),
  ('BBQ Fluff',                       'BBQ',            2,  60, 2, 180),
  ('BBQ Security',                    'BBQ',            3,  60, 3, 190),
  ('Grilling',                        'BBQ',            4,  60, 5, 200),
  ('BBQ Cleanup',                     'BBQ',            8,  90, 4, 210),
  ('Strike Shift',                    'Strike',         8, 180, 6, 220)
) as v(title, category, people, dur, diff, sort)
join public.camp_years cy on cy.year = 2026;

-- ── Dated shifts (title, date, start, end, capacity, label) ──────────
insert into public.job_shifts
  (camp_year_id, definition_id, shift_date, start_time, end_time, capacity, label)
select cy.id, d.id, v.d::date, v.st::time,
       nullif(v.et, '')::time, v.cap, nullif(v.label, '')
from (values
  -- Sun Aug 30
  ('Brunch Prep',                     '2026-08-30','08:30','',    2,''),
  ('Serve Coffee',                    '2026-08-30','09:00','11:00',2,''),
  ('Brunch Cleanup',                  '2026-08-30','11:00','',    2,''),
  ('Bathroom Tidy',                   '2026-08-30','12:00','',    2,''),
  ('Dinner',                          '2026-08-30','18:00','',    4,''),
  ('Dinner Cleanup',                  '2026-08-30','21:00','',    3,''),
  -- Mon Aug 31 (Martini Therapy)
  ('Brunch Prep',                     '2026-08-31','08:30','',    2,''),
  ('Ice Fill',                        '2026-08-31','11:00','',    2,''),
  ('Brunch Cleanup',                  '2026-08-31','11:00','',    2,''),
  ('Bathroom Tidy',                   '2026-08-31','12:00','',    2,''),
  ('Camp Tidy',                       '2026-08-31','12:00','',    3,''),
  ('Martini Therapy Setup',           '2026-08-31','13:00','',    5,''),
  ('Martini Therapy Bartender',       '2026-08-31','14:00','',    3,''),
  ('Martini Therapy Bike/Moop Police','2026-08-31','14:00','',    2,''),
  ('Martini Therapy Bouncer',         '2026-08-31','14:00','',    2,''),
  ('Martini Therapy Bartender',       '2026-08-31','15:30','',    3,'Shift 2'),
  ('Martini Therapy Bouncer',         '2026-08-31','15:30','',    2,'Shift 2'),
  ('Martini Therapy Cleanup',         '2026-08-31','17:00','',    4,''),
  ('Dinner',                          '2026-08-31','18:00','',    4,''),
  ('Dinner Cleanup',                  '2026-08-31','21:00','',    3,''),
  -- Tue Sep 1
  ('Brunch Prep',                     '2026-09-01','08:30','',    2,''),
  ('Serve Coffee',                    '2026-09-01','09:00','11:00',2,''),
  ('Ice Fill',                        '2026-09-01','11:00','',    2,''),
  ('Recycle Run',                     '2026-09-01','11:00','',    2,''),
  ('Brunch Cleanup',                  '2026-09-01','11:00','',    2,''),
  ('Camp Tidy',                       '2026-09-01','12:00','',    3,''),
  ('Bathroom Tidy',                   '2026-09-01','12:00','',    2,''),
  ('Dinner',                          '2026-09-01','18:00','',    4,''),
  ('Dinner Cleanup',                  '2026-09-01','21:00','',    3,''),
  -- Wed Sep 2 (BBQ)
  ('Brunch Prep',                     '2026-09-02','08:30','',    2,''),
  ('Serve Coffee',                    '2026-09-02','09:00','11:00',2,''),
  ('Brunch Cleanup',                  '2026-09-02','10:30','',    2,''),
  ('Ice Fill',                        '2026-09-02','11:00','',    2,''),
  ('Recycle Run',                     '2026-09-02','11:00','',    2,''),
  ('BBQ Setup',                       '2026-09-02','11:00','',    8,''),
  ('Bathroom Tidy',                   '2026-09-02','12:00','',    2,''),
  ('BBQ Bartender',                   '2026-09-02','12:00','',    3,'Shift 1'),
  ('Camp Tidy',                       '2026-09-02','12:00','',    3,''),
  ('BBQ Fluff',                       '2026-09-02','13:30','',    2,''),
  ('BBQ Security',                    '2026-09-02','14:00','',    3,''),
  ('Grilling',                        '2026-09-02','14:00','',    4,''),
  ('BBQ Bartender',                   '2026-09-02','14:00','',    3,'Shift 2'),
  ('BBQ Fluff',                       '2026-09-02','15:00','',    2,''),
  ('BBQ Security',                    '2026-09-02','15:00','',    3,''),
  ('Grilling',                        '2026-09-02','15:00','',    4,''),
  ('Dinner',                          '2026-09-02','16:00','',    4,'BBQ Night'),
  ('BBQ Security',                    '2026-09-02','16:00','',    3,''),
  ('Grilling',                        '2026-09-02','16:00','',    4,''),
  ('BBQ Bartender',                   '2026-09-02','16:00','',    3,'Shift 3'),
  ('BBQ Fluff',                       '2026-09-02','16:30','',    2,''),
  ('Grilling',                        '2026-09-02','17:00','',    4,''),
  ('BBQ Security',                    '2026-09-02','17:00','',    3,''),
  ('BBQ Cleanup',                     '2026-09-02','19:00','',    8,''),
  ('Dinner Cleanup',                  '2026-09-02','21:00','',    3,''),
  -- Thu Sep 3
  ('Brunch Prep',                     '2026-09-03','08:30','',    2,''),
  ('Serve Coffee',                    '2026-09-03','08:30','',    2,''),
  ('Serve Coffee',                    '2026-09-03','09:00','11:00',2,''),
  ('Ice Fill',                        '2026-09-03','11:00','',    2,''),
  ('Brunch Cleanup',                  '2026-09-03','11:00','',    2,''),
  ('Camp Tidy',                       '2026-09-03','12:00','',    3,''),
  ('Bathroom Tidy',                   '2026-09-03','12:00','',    2,''),
  ('Dinner',                          '2026-09-03','17:30','',    4,''),
  ('Dinner Cleanup',                  '2026-09-03','21:00','',    3,''),
  -- Fri Sep 4 (Shabbat)
  ('Brunch Prep',                     '2026-09-04','10:00','',    2,'Friday Brunch'),
  ('Ice Fill',                        '2026-09-04','11:00','',    2,''),
  ('Recycle Run',                     '2026-09-04','11:00','',    2,''),
  ('Brunch Cleanup',                  '2026-09-04','11:30','',    2,''),
  ('Bathroom Tidy',                   '2026-09-04','12:00','',    2,''),
  ('Camp Tidy',                       '2026-09-04','12:00','',    3,''),
  ('Shabbat Dinner',                  '2026-09-04','18:00','',    4,''),
  ('Dinner Cleanup',                  '2026-09-04','21:00','',    3,''),
  -- Sat Sep 5 (strike begins)
  ('Brunch Prep',                     '2026-09-05','08:30','',    2,''),
  ('Ice Fill',                        '2026-09-05','11:00','',    2,''),
  ('Recycle Run',                     '2026-09-05','11:00','',    2,''),
  ('Brunch Cleanup',                  '2026-09-05','11:00','',    2,''),
  ('Strike Shift',                    '2026-09-05','10:00','',    8,'Time TBD'),
  ('Bathroom Tidy',                   '2026-09-05','12:00','',    2,''),
  ('Camp Tidy',                       '2026-09-05','12:00','',    3,''),
  ('Strike Shift',                    '2026-09-05','13:00','',    8,'Time TBD'),
  ('Strike Shift',                    '2026-09-05','16:00','',    8,'Time TBD'),
  ('Dinner',                          '2026-09-05','16:00','',    4,''),
  ('Dinner Cleanup',                  '2026-09-05','19:00','',    3,''),
  -- Sun Sep 6
  ('Brunch Prep',                     '2026-09-06','08:30','',    2,''),
  ('Brunch Cleanup',                  '2026-09-06','11:00','',    2,''),
  ('Strike Shift',                    '2026-09-06','10:00','',    8,'Time TBD'),
  ('Strike Shift',                    '2026-09-06','13:00','',    8,'Time TBD'),
  ('Strike Shift',                    '2026-09-06','16:00','',    8,'Time TBD'),
  ('Dinner',                          '2026-09-06','16:00','',    4,''),
  ('Dinner Cleanup',                  '2026-09-06','19:00','',    3,'')
) as v(title, d, st, et, cap, label)
join public.camp_years cy on cy.year = 2026
join public.job_definitions d
  on d.camp_year_id = cy.id and d.title = v.title;
