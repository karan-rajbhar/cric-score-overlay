-- Migration: 20260919030000_enforce_team_segregation_in_bowling.sql
-- Enforce strict team segregation and prevent bowler/batsman role crossover.

CREATE OR REPLACE FUNCTION public.set_current_bowler(
  p_match_id UUID, p_bowler_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_innings_id UUID;
  v_batting_team UUID;
  v_curr_over INTEGER;
  v_curr_ball INTEGER;
BEGIN
  IF NOT public.is_match_admin(p_match_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT i.id, i.team_id INTO v_innings_id, v_batting_team
  FROM public.innings i
  JOIN public.matches m ON m.id = i.match_id
  WHERE i.match_id = p_match_id AND i.innings_number = m.current_innings;

  IF v_innings_id IS NULL THEN
    RAISE EXCEPTION 'no_open_innings' USING ERRCODE = '22000';
  END IF;

  -- The bowler cannot be a currently active batsman at the crease
  IF EXISTS (
    SELECT 1 FROM public.batting_performances bp
    WHERE bp.innings_id = v_innings_id AND bp.is_current_batsman AND bp.user_id = p_bowler_id
  ) THEN
    RAISE EXCEPTION 'bowler_is_current_batsman' USING ERRCODE = '22000';
  END IF;

  -- The bowler cannot belong to the batting team
  IF EXISTS (
    SELECT 1 FROM public.team_players tp
    WHERE tp.team_id = v_batting_team AND tp.user_id = p_bowler_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.team_players tp ON tp.user_id = p_bowler_id AND (
      (m.team1_id = v_batting_team AND tp.team_id = m.team2_id) OR
      (m.team2_id = v_batting_team AND tp.team_id = m.team1_id)
    )
    WHERE m.id = p_match_id
  ) THEN
    RAISE EXCEPTION 'bowler_in_batting_team' USING ERRCODE = '22000';
  END IF;

  SELECT m.current_over, m.current_ball INTO v_curr_over, v_curr_ball
  FROM public.matches m WHERE m.id = p_match_id;

  -- Back-to-back overs are not allowed.
  IF v_curr_over > 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.ball_by_ball
      WHERE innings_id = v_innings_id
        AND bowler_id = p_bowler_id
        AND over_number = (v_curr_over - 1)
    ) THEN
      RAISE EXCEPTION 'same_bowler_next_over' USING ERRCODE = '22000';
    END IF;
  END IF;

  INSERT INTO public.bowling_performances (match_id, innings_id, user_id)
  SELECT p_match_id, v_innings_id, p_bowler_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.bowling_performances bp
    WHERE bp.innings_id = v_innings_id AND bp.user_id = p_bowler_id
  );

  UPDATE public.bowling_performances
     SET is_current_bowler = FALSE
   WHERE innings_id = v_innings_id;

  UPDATE public.bowling_performances
     SET is_current_bowler = TRUE
   WHERE innings_id = v_innings_id AND user_id = p_bowler_id;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.set_current_bowler(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_current_bowler(UUID, UUID) TO authenticated;
