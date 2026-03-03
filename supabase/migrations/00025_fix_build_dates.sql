-- Fix build dates: Wed Aug 26 through Sun Aug 30
DO $$
DECLARE
  v_camp_year_id uuid;
  v_creator_id uuid;
BEGIN
  SELECT id INTO v_camp_year_id FROM public.camp_years WHERE year = 2026 LIMIT 1;
  SELECT id INTO v_creator_id FROM public.profiles WHERE role = 'super_admin' LIMIT 1;

  IF v_camp_year_id IS NULL OR v_creator_id IS NULL THEN
    RETURN;
  END IF;

  -- Remove old build events
  DELETE FROM public.node_events
  WHERE camp_year_id = v_camp_year_id
    AND title LIKE 'Build%';

  -- Insert corrected build week: Wed Aug 26 – Sun Aug 30
  INSERT INTO public.node_events (camp_year_id, title, description, event_type, event_date, created_by) VALUES
    (v_camp_year_id, 'Build Begins (Wednesday)', 'Early arrival crew hits the playa to start building NODE.', 'event', '2026-08-26', v_creator_id),
    (v_camp_year_id, 'Build (Thursday)', NULL, 'event', '2026-08-27', v_creator_id),
    (v_camp_year_id, 'Build (Friday)', NULL, 'event', '2026-08-28', v_creator_id),
    (v_camp_year_id, 'Build (Saturday)', NULL, 'event', '2026-08-29', v_creator_id),
    (v_camp_year_id, 'Build (Sunday)', 'Final build day — gates open today.', 'event', '2026-08-30', v_creator_id);
END $$;
