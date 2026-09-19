-- Migration: 20260919020000_audit_and_fix_create_team_player.sql
-- Fix authorization in create_team_player to allow club admins, match admins, and tournament organizers
-- to add inline squad players without 'not_authorized' failures.

CREATE OR REPLACE FUNCTION public.create_team_player(
  p_team_id uuid,
  p_full_name text,
  p_jersey_number integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_allowed boolean := false;
  v_club_id uuid;
  v_user_id uuid;
  v_slug text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT club_id INTO v_club_id FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team_not_found';
  END IF;

  -- 1. Team creator, captain, or vice-captain
  SELECT EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = p_team_id AND (
      t.captain_id = v_caller
      OR t.created_by = v_caller
      OR t.vice_captain_id = v_caller
    )
  ) INTO v_allowed;

  -- 2. Club owner/admin (applicable to club-affiliated teams)
  IF NOT v_allowed AND v_club_id IS NOT NULL THEN
    v_allowed := public.is_club_admin(v_club_id, v_caller);
  END IF;

  -- 3. Match admin of ANY match involving this team
  IF NOT v_allowed THEN
    SELECT EXISTS (
      SELECT 1 FROM matches m
      WHERE (m.team1_id = p_team_id OR m.team2_id = p_team_id)
        AND public.is_match_admin(m.id, v_caller)
    ) INTO v_allowed;
  END IF;

  -- 4. Tournament organizer of any tournament this team is registered in
  IF NOT v_allowed THEN
    SELECT EXISTS (
      SELECT 1 FROM tournament_registrations tr
      JOIN tournaments t ON t.id = tr.tournament_id
      WHERE tr.team_id = p_team_id
        AND (
          t.created_by = v_caller
          OR (t.club_id IS NOT NULL AND public.is_club_admin(t.club_id, v_caller))
        )
    ) INTO v_allowed;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  p_full_name := btrim(coalesce(p_full_name, ''));
  IF p_full_name = '' THEN
    RAISE EXCEPTION 'name_required';
  END IF;

  -- Unregistered players still need a users row (FK + UNIQUE(team,user)).
  v_slug := lower(regexp_replace(p_full_name, '[^a-zA-Z0-9]', '', 'g'));
  IF v_slug = '' THEN
    v_slug := 'player';
  END IF;

  INSERT INTO users (email, full_name)
  VALUES (
    'player.' || v_slug || '.' || substr(md5(random()::text || clock_timestamp()::text), 1, 8) || '@players.local',
    p_full_name
  )
  RETURNING id INTO v_user_id;

  INSERT INTO team_players (team_id, user_id, added_by, jersey_number, is_playing_xi)
  VALUES (p_team_id, v_user_id, v_caller, p_jersey_number, true);

  RETURN json_build_object(
    'user_id', v_user_id,
    'full_name', p_full_name,
    'jersey_number', p_jersey_number
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_team_player(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_team_player(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_team_player(uuid, text, integer) TO authenticated;
