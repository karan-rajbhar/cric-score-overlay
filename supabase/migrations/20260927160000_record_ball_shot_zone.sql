-- Migration: Add p_shot_zone to record_ball RPC function
-- Allows direct storage of wagon-wheel shot zone on ball insertion without extra SELECT + UPDATE round-trips.

CREATE OR REPLACE FUNCTION public.record_ball(
  p_match_id UUID,
  p_bowler_id UUID,
  p_batsman_id UUID,
  p_non_striker_id UUID,
  p_runs_scored INTEGER DEFAULT 0,
  p_extras INTEGER DEFAULT 0,
  p_extra_type TEXT DEFAULT NULL,
  p_is_wicket BOOLEAN DEFAULT FALSE,
  p_dismissal_type TEXT DEFAULT NULL,
  p_fielder_id UUID DEFAULT NULL,
  p_commentary TEXT DEFAULT NULL,
  p_dismissed_player_id UUID DEFAULT NULL,
  p_shot_zone TEXT DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_innings RECORD;
  v_is_legal BOOLEAN;
  v_delivery_no INTEGER;
  v_over_no INTEGER;
  v_state JSONB;
  v_prev_innings INTEGER;
  v_actual_dismissed UUID;
BEGIN
  IF NOT public.is_match_admin(p_match_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_extra_type IS NOT NULL AND p_extra_type NOT IN ('wide', 'no_ball', 'bye', 'leg_bye', 'penalty') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22000';
  END IF;
  IF p_is_wicket AND p_dismissal_type IS NOT NULL
     AND p_dismissal_type NOT IN ('bowled', 'caught', 'lbw', 'stumped', 'run_out', 'hit_wicket', 'obstructing', 'timed_out', 'handled_ball', 'retired_hurt', 'retired_out') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22000';
  END IF;

  -- Validate dismissed player is at the crease
  IF p_is_wicket THEN
    v_actual_dismissed := COALESCE(p_dismissed_player_id, p_batsman_id);
    IF v_actual_dismissed NOT IN (p_batsman_id, p_non_striker_id) THEN
      RAISE EXCEPTION 'dismissed_player_not_at_crease' USING ERRCODE = '22000';
    END IF;
  ELSE
    v_actual_dismissed := NULL;
  END IF;

  -- Serialize concurrent scorers on the match row.
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;

  v_prev_innings := v_match.current_innings;

  IF v_match IS NULL THEN
    RAISE EXCEPTION 'match_not_found' USING ERRCODE = '22000';
  END IF;
  IF v_match.status <> 'live' THEN
    RAISE EXCEPTION 'match_not_live' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_innings FROM public.innings
   WHERE match_id = p_match_id AND innings_number = v_match.current_innings;

  IF v_innings IS NULL OR v_innings.is_completed THEN
    RAISE EXCEPTION 'no_open_innings' USING ERRCODE = '22000';
  END IF;

  -- A wicket leaves one seat empty until set_current_batsmen() fills it.
  IF (SELECT COUNT(*) FROM public.batting_performances
      WHERE innings_id = v_innings.id AND is_current_batsman) < 2 THEN
    RAISE EXCEPTION 'awaiting_new_batsman' USING ERRCODE = '22000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bowling_performances
                 WHERE innings_id = v_innings.id AND is_current_bowler AND user_id = p_bowler_id) THEN
    RAISE EXCEPTION 'bowler_not_set' USING ERRCODE = '22000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.batting_performances
                 WHERE innings_id = v_innings.id AND is_current_batsman AND user_id = p_batsman_id AND is_striker) THEN
    RAISE EXCEPTION 'striker_mismatch' USING ERRCODE = '22000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.batting_performances
                 WHERE innings_id = v_innings.id AND is_current_batsman AND user_id = p_non_striker_id AND NOT is_striker) THEN
    RAISE EXCEPTION 'non_striker_mismatch' USING ERRCODE = '22000';
  END IF;

  v_is_legal := p_extra_type IS NULL OR p_extra_type NOT IN ('wide', 'no_ball');

  -- Over/delivery numbering is derived server-side from legal-ball count.
  v_over_no := FLOOR(v_innings.total_balls / 6.0);
  v_delivery_no := (v_innings.total_balls % 6) + 1;

  INSERT INTO public.ball_by_ball
    (match_id, innings_id, over_number, ball_number,
     bowler_id, batsman_id, non_striker_id,
     runs_scored, extras, extra_type,
     is_wicket, dismissal_type, fielder_id, commentary,
     dismissed_player_id, shot_zone)
  VALUES
    (p_match_id, v_innings.id, v_over_no, v_delivery_no,
     p_bowler_id, p_batsman_id, p_non_striker_id,
     COALESCE(p_runs_scored, 0), COALESCE(p_extras, 0), p_extra_type,
     COALESCE(p_is_wicket, FALSE), p_dismissal_type, p_fielder_id, p_commentary,
     v_actual_dismissed, p_shot_zone);

  PERFORM public.recompute_innings(v_innings.id);

  -- Log notable events for the timeline feed.
  IF p_is_wicket THEN
    PERFORM public.match_events_insert(p_match_id, 'wicket',
      jsonb_build_object('batsman', v_actual_dismissed, 'dismissal', p_dismissal_type, 'over', v_over_no));
  ELSIF p_runs_scored = 4 THEN
    PERFORM public.match_events_insert(p_match_id, 'boundary_four',
      jsonb_build_object('batsman', p_batsman_id, 'over', v_over_no));
  ELSIF p_runs_scored = 6 THEN
    PERFORM public.match_events_insert(p_match_id, 'boundary_six',
      jsonb_build_object('batsman', p_batsman_id, 'over', v_over_no));
  END IF;

  -- Refresh in-memory innings after recompute.
  SELECT * INTO v_innings FROM public.innings WHERE id = v_innings.id;

  -- Auto-completion checks.
  -- 2nd innings chase achieved:
  IF v_innings.innings_number = 2 AND v_innings.target_runs IS NOT NULL
     AND v_innings.total_runs >= v_innings.target_runs THEN
    PERFORM public._advance_after_innings(p_match_id, v_innings.id);
  -- All out (10 wickets down):
  ELSIF v_innings.total_wickets >= 10 THEN
    PERFORM public._advance_after_innings(p_match_id, v_innings.id);
  -- Overs expired:
  ELSIF v_innings.total_balls >= v_match.overs_per_innings * 6 THEN
    PERFORM public._advance_after_innings(p_match_id, v_innings.id);
  END IF;

  v_state := public.record_state(p_match_id);

  -- Flag innings break transition for client toast / dialog triggers.
  IF (v_state->>'current_innings')::int <> v_prev_innings THEN
    v_state := jsonb_set(v_state, '{innings_break}', 'true'::jsonb);
  END IF;

  RETURN v_state;
END;
$$;
