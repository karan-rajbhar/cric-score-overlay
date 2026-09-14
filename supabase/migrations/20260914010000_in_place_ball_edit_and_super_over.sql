-- ============================================================================
-- IN-PLACE DELIVERY EDITING & SUPER OVER SUPPORT
-- 1. update_ball RPC: allows scorers to correct historical deliveries in place
--    without destructive undos, rerunning deterministic recompute_innings().
-- 2. start_super_over RPC: allows starting a Super Over tiebreaker when
--    match finishes in a tie.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_ball(
  p_match_id UUID,
  p_ball_id UUID,
  p_runs_scored INTEGER DEFAULT 0,
  p_extras INTEGER DEFAULT 0,
  p_extra_type TEXT DEFAULT NULL,
  p_is_wicket BOOLEAN DEFAULT FALSE,
  p_dismissal_type TEXT DEFAULT NULL,
  p_fielder_id UUID DEFAULT NULL,
  p_dismissed_player_id UUID DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ball RECORD;
  v_match RECORD;
  v_state JSONB;
BEGIN
  IF NOT public.is_match_admin(p_match_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ball FROM public.ball_by_ball WHERE id = p_ball_id AND match_id = p_match_id;
  IF v_ball IS NULL THEN
    RAISE EXCEPTION 'ball_not_found' USING ERRCODE = '22000';
  END IF;

  IF p_extra_type IS NOT NULL AND p_extra_type NOT IN ('wide', 'no_ball', 'bye', 'leg_bye', 'penalty') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22000';
  END IF;
  IF p_is_wicket AND p_dismissal_type IS NOT NULL
     AND p_dismissal_type NOT IN ('bowled', 'caught', 'lbw', 'stumped', 'run_out', 'hit_wicket', 'obstructing', 'timed_out', 'handled_ball', 'retired_hurt', 'retired_out') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22000';
  END IF;

  UPDATE public.ball_by_ball
     SET runs_scored = COALESCE(p_runs_scored, 0),
         extras = COALESCE(p_extras, 0),
         extra_type = p_extra_type,
         is_wicket = COALESCE(p_is_wicket, FALSE),
         dismissal_type = CASE WHEN p_is_wicket THEN p_dismissal_type ELSE NULL END,
         fielder_id = CASE WHEN p_is_wicket THEN p_fielder_id ELSE NULL END,
         dismissed_player_id = CASE WHEN p_is_wicket THEN COALESCE(p_dismissed_player_id, v_ball.batsman_id) ELSE NULL END
   WHERE id = p_ball_id;

  PERFORM public.recompute_innings(v_ball.innings_id);

  RETURN public.record_state(p_match_id);
END;
$$;

-- Start Super Over when scores are level in a completed match
CREATE OR REPLACE FUNCTION public.start_super_over(p_match_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_last_innings RECORD;
  v_super_over_inn_no INTEGER;
  v_batting_team UUID;
  v_new_innings UUID;
BEGIN
  IF NOT public.is_match_admin(p_match_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RAISE EXCEPTION 'match_not_found' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_last_innings
  FROM public.innings
  WHERE match_id = p_match_id
  ORDER BY innings_number DESC
  LIMIT 1;

  IF v_last_innings IS NULL THEN
    RAISE EXCEPTION 'no_innings_found' USING ERRCODE = '22000';
  END IF;

  v_super_over_inn_no := v_last_innings.innings_number + 1;

  -- In Super Over, team that batted second in match bats first in Super Over
  SELECT team_id INTO v_batting_team
  FROM public.innings
  WHERE match_id = p_match_id AND innings_number = 2;

  IF v_batting_team IS NULL THEN
    v_batting_team := v_match.team2_id;
  END IF;

  INSERT INTO public.innings (match_id, team_id, innings_number, is_completed)
  VALUES (p_match_id, v_batting_team, v_super_over_inn_no, FALSE)
  RETURNING id INTO v_new_innings;

  UPDATE public.matches
     SET status = 'live',
         current_innings = v_super_over_inn_no,
         current_over = 0,
         current_ball = 0,
         winning_team_id = NULL,
         result_type = NULL,
         result_description = 'Super Over in progress'
   WHERE id = p_match_id;

  RETURN public.record_state(p_match_id);
END;
$$;
