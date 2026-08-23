-- Inline player creation while scoring.
--
-- team_players.user_id references public.users, and the base RLS only lets
-- team captains / club admins manage a squad. A match scorer (creator or
-- match_admin) often isn't the captain, so scoring would dead-end with no way
-- to add players. This SECURITY DEFINER RPC centralizes the permission check
-- (captain OR club owner OR match admin) and creates the placeholder identity
-- row that unregistered players need.

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
  -- v_club_id may be NULL for standalone teams; skip the club-owner check then.

  -- Team captain
  SELECT EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = p_team_id AND t.captain_id = v_caller
  ) INTO v_allowed;

  -- Club owner/admin (only applicable to club-affiliated teams)
  IF NOT v_allowed AND v_club_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM clubs c
      WHERE c.id = v_club_id AND c.owner_id = v_caller
    ) INTO v_allowed;
  END IF;

  -- Admin of any match involving this team
  IF NOT v_allowed THEN
    SELECT EXISTS (
      SELECT 1 FROM matches m
      WHERE (m.team1_id = p_team_id OR m.team2_id = p_team_id)
        AND (
          m.created_by = v_caller
          OR v_caller = ANY(m.match_admins)
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
  -- Synthetic email satisfies CHECK(email IS NOT NULL OR phone IS NOT NULL).
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

  INSERT INTO team_players (team_id, user_id, added_by, jersey_number)
  VALUES (p_team_id, v_user_id, v_caller, p_jersey_number);

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
