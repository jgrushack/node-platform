-- Seed NODE 2026 events
-- Uses a super_admin as created_by (first super_admin found)
DO $$
DECLARE
  v_camp_year_id uuid;
  v_creator_id uuid;
BEGIN
  SELECT id INTO v_camp_year_id FROM public.camp_years WHERE year = 2026 LIMIT 1;
  SELECT id INTO v_creator_id FROM public.profiles WHERE role = 'super_admin' LIMIT 1;

  IF v_camp_year_id IS NULL OR v_creator_id IS NULL THEN
    RAISE NOTICE 'Skipping seed: camp_year or super_admin not found';
    RETURN;
  END IF;

  -- Clear existing seeded events to avoid duplicates on re-run
  DELETE FROM public.node_events WHERE camp_year_id = v_camp_year_id;

  INSERT INTO public.node_events (camp_year_id, title, description, event_type, event_date, created_by) VALUES
    -- Dues & Finance
    (v_camp_year_id, 'Dues Open', 'Camp dues are now open for NODE 2026.', 'deadline', '2026-04-15', v_creator_id),
    (v_camp_year_id, 'Dues Increase', 'Dues increase after this date — pay early to save!', 'deadline', '2026-06-15', v_creator_id),

    -- Prebuild
    (v_camp_year_id, 'NODE Prebuild in Reno', '3-day prebuild weekend in Reno to prep infrastructure.', 'event', '2026-05-15', v_creator_id),
    (v_camp_year_id, 'NODE Prebuild in Reno (Day 2)', NULL, 'event', '2026-05-16', v_creator_id),
    (v_camp_year_id, 'NODE Prebuild in Reno (Day 3)', NULL, 'event', '2026-05-17', v_creator_id),

    -- Build Week & Burning Man
    (v_camp_year_id, 'Build Begins', 'Early arrival crew hits the playa to start building NODE.', 'event', '2026-08-25', v_creator_id),
    (v_camp_year_id, 'Build (Day 2)', NULL, 'event', '2026-08-26', v_creator_id),
    (v_camp_year_id, 'Burning Man Begins', 'Gates open — Black Rock City comes alive.', 'event', '2026-08-30', v_creator_id),
    (v_camp_year_id, '4th Annual Hip Hop BBQ', 'NODE''s legendary Hip Hop BBQ — year four!', 'event', '2026-08-30', v_creator_id),
    (v_camp_year_id, 'Man Burns', 'The Man burns.', 'event', '2026-09-05', v_creator_id),
    (v_camp_year_id, 'Temple Burns', 'Temple burn — the emotional close.', 'event', '2026-09-06', v_creator_id),
    (v_camp_year_id, 'Exodus — The Burn is Over', 'Pack it up, the burn is over. Time to leave no trace.', 'event', '2026-09-07', v_creator_id),

    -- Post-Playa
    (v_camp_year_id, 'Node Upstate Retreat', 'Post-burn gathering upstate — details TBD.', 'event', '2026-10-15', v_creator_id),
    (v_camp_year_id, 'Nodes Giving', 'NODE''s annual Thanksgiving gathering.', 'event', '2026-11-14', v_creator_id),
    (v_camp_year_id, 'Secret Santa Starts', 'NODE Secret Santa gift exchange kicks off!', 'event', '2026-12-15', v_creator_id);
END $$;
