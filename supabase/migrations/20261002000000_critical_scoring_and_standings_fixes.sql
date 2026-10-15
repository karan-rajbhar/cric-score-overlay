-- ============================================================================
-- Migration: Critical scoring, tournament standings, undo, and recompute fixes
-- 1. ball_by_ball: allow nullable bowler_id, batsman_id, non_striker_id for administrative events
-- 2. update_ball: accept 'bonus' and 'penalty' extra_type
-- 3. recompute_innings: robust calculation handling non-delivery events (penalties, retirements)
-- 4. recalculate_tournament_standings: count matches with status IN ('completed', 'abandoned')
-- 5. undo_last_ball: allow undoing match-completing delivery (reverts status to 'live')
-- ============================================================================

-- 1. Allow nullable bowler_id / batsman_id / non_striker_id on ball_by_ball for non-delivery events
ALTER TABLE public.ball_by_ball ALTER COLUMN bowler_id DROP NOT NULL;
ALTER TABLE public.ball_by_ball ALTER COLUMN batsman_id DROP NOT NULL;
ALTER TABLE public.ball_by_ball ALTER COLUMN non_striker_id DROP NOT NULL;

-- 2. Fix update_ball to support 'bonus' and 'penalty' extra_type
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

  IF p_extra_type IS NOT NULL AND p_extra_type NOT IN ('wide', 'no_ball', 'bye', 'leg_bye', 'penalty', 'bonus') THEN
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

-- 3. Update recompute_innings to safely support non-delivery events (penalties, bonuses, retirements)
CREATE OR REPLACE FUNCTION public.recompute_innings(p_innings_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id UUID;
  v_match RECORD;
  v_ball RECORD;
  v_bpo INTEGER := 6;
  v_is_legal BOOLEAN;
  v_team_runs_on_ball INTEGER;
  v_bowler_concedes INTEGER;
  v_legal INTEGER := 0;
  v_total_runs INTEGER := 0;
  v_total_wickets INTEGER := 0;
  v_wicket_no INTEGER := 0;
  v_extras_byes INTEGER := 0;
  v_extras_leg_byes INTEGER := 0;
  v_extras_wides INTEGER := 0;
  v_extras_no_balls INTEGER := 0;
  v_extras_penalties INTEGER := 0;
  v_extras_bonuses INTEGER := 0;
  v_dismissed_id UUID;
  v_strike_swap BOOLEAN;
  v_final_striker UUID := NULL;
  v_final_non_striker UUID := NULL;
  v_last_bowler UUID := NULL;
  v_partnership_id UUID := NULL;
  v_partner_a UUID := NULL;
  v_partner_b UUID := NULL;
  v_partnership_runs INTEGER := 0;
  v_partnership_balls INTEGER := 0;
  v_balls_in_current_over INTEGER := 0;
  v_current_over_num INTEGER := 0;
  v_over_just_ended BOOLEAN := FALSE;
BEGIN
  SELECT match_id INTO v_match_id FROM public.innings WHERE id = p_innings_id;
  IF v_match_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = v_match_id;
  IF v_match IS NOT NULL AND v_match.balls_per_over IS NOT NULL THEN
    v_bpo := v_match.balls_per_over;
  END IF;

  -- Reset batting performances for this innings
  UPDATE public.batting_performances
     SET runs_scored = 0, balls_faced = 0, fours = 0, sixes = 0,
         is_out = FALSE, dismissal_type = NULL, bowler_id = NULL, fielder_id = NULL,
         is_current_batsman = FALSE, is_striker = FALSE
   WHERE innings_id = p_innings_id;

  -- Reset bowling performances for this innings
  UPDATE public.bowling_performances
     SET balls_bowled = 0, runs_conceded = 0, wickets_taken = 0, maidens = 0,
         wides = 0, no_balls = 0, overs_bowled = 0.0, is_current_bowler = FALSE
   WHERE innings_id = p_innings_id;

  DELETE FROM public.fall_of_wickets WHERE innings_id = p_innings_id;
  DELETE FROM public.partnerships WHERE innings_id = p_innings_id;

  FOR v_ball IN
    SELECT * FROM public.ball_by_ball
     WHERE innings_id = p_innings_id
     ORDER BY seq ASC
  LOOP
    v_is_legal := (v_ball.bowler_id IS NOT NULL)
      AND (v_ball.extra_type IS NULL OR v_ball.extra_type NOT IN ('wide', 'no_ball', 'penalty', 'bonus'));
    v_team_runs_on_ball := COALESCE(v_ball.runs_scored, 0) + COALESCE(v_ball.extras, 0);

    -- Bowler concedes: bat runs + extras (byes, leg byes, penalties, and bonuses do not count against bowler)
    v_bowler_concedes := COALESCE(v_ball.runs_scored, 0)
      + CASE WHEN v_ball.extra_type IN ('bye', 'leg_bye', 'penalty', 'bonus') THEN 0 ELSE COALESCE(v_ball.extras, 0) END;

    IF v_ball.bowler_id IS NOT NULL THEN
      v_last_bowler := v_ball.bowler_id;
    END IF;

    -- Track over balls for max_balls_per_over limit
    IF v_ball.over_number <> v_current_over_num THEN
      v_current_over_num := v_ball.over_number;
      v_balls_in_current_over := 1;
    ELSE
      v_balls_in_current_over := v_balls_in_current_over + 1;
    END IF;

    -- Ensure batting performance rows exist
    IF v_ball.batsman_id IS NOT NULL THEN
      INSERT INTO public.batting_performances
        (match_id, innings_id, user_id, batting_position)
      VALUES
        (v_match_id, p_innings_id, v_ball.batsman_id,
         (SELECT COALESCE(MAX(batting_position), 0) + 1 FROM public.batting_performances WHERE innings_id = p_innings_id))
      ON CONFLICT (innings_id, user_id) DO NOTHING;
    END IF;

    IF v_ball.non_striker_id IS NOT NULL THEN
      INSERT INTO public.batting_performances
        (match_id, innings_id, user_id, batting_position)
      VALUES
        (v_match_id, p_innings_id, v_ball.non_striker_id,
         (SELECT COALESCE(MAX(batting_position), 0) + 1 FROM public.batting_performances WHERE innings_id = p_innings_id))
      ON CONFLICT (innings_id, user_id) DO NOTHING;
    END IF;

    -- Ensure bowler performance row exists
    IF v_ball.bowler_id IS NOT NULL THEN
      INSERT INTO public.bowling_performances
        (match_id, innings_id, user_id)
      VALUES
        (v_match_id, p_innings_id, v_ball.bowler_id)
      ON CONFLICT (innings_id, user_id) DO NOTHING;
    END IF;

    -- ---- batting stats ----
    IF v_ball.batsman_id IS NOT NULL THEN
      UPDATE public.batting_performances
         SET runs_scored = runs_scored + COALESCE(v_ball.runs_scored, 0)
               + (CASE WHEN v_ball.extra_type = 'wide' AND COALESCE(v_match.wide_runs_to_batsman, FALSE) THEN COALESCE(v_ball.extras, 0) ELSE 0 END)
               + (CASE WHEN v_ball.extra_type = 'no_ball' AND COALESCE(v_match.noball_extras_to_batsman, FALSE) THEN COALESCE(v_ball.extras, 0) ELSE 0 END),
             balls_faced = balls_faced + (
               CASE WHEN v_is_legal OR (v_ball.extra_type = 'wide' AND COALESCE(v_match.wide_counts_as_ball_faced, FALSE)) THEN 1 ELSE 0 END
             ),
             fours = fours + (CASE WHEN v_ball.runs_scored = 4 THEN 1 ELSE 0 END),
             sixes = sixes + (CASE WHEN v_ball.runs_scored = 6 THEN 1 ELSE 0 END)
       WHERE innings_id = p_innings_id AND user_id = v_ball.batsman_id;
    END IF;

    -- ---- bowling stats ----
    IF v_ball.bowler_id IS NOT NULL THEN
      UPDATE public.bowling_performances
         SET balls_bowled = balls_bowled + (CASE WHEN v_is_legal THEN 1 ELSE 0 END),
             runs_conceded = runs_conceded + v_bowler_concedes,
             wides = wides + (CASE WHEN v_ball.extra_type = 'wide' THEN 1 ELSE 0 END),
             no_balls = no_balls + (CASE WHEN v_ball.extra_type = 'no_ball' THEN 1 ELSE 0 END),
             wickets_taken = wickets_taken + (
               CASE WHEN v_ball.is_wicket
                     AND COALESCE(v_ball.dismissal_type, '') NOT IN ('run_out', 'retired_hurt', 'retired_out', 'obstructing')
                    THEN 1 ELSE 0 END)
       WHERE innings_id = p_innings_id AND user_id = v_ball.bowler_id;
    END IF;

    -- ---- innings totals ----
    v_legal := v_legal + (CASE WHEN v_is_legal THEN 1 ELSE 0 END);
    v_total_runs := v_total_runs + v_team_runs_on_ball;
    v_extras_byes := v_extras_byes + (CASE WHEN v_ball.extra_type = 'bye' THEN COALESCE(v_ball.extras, 0) ELSE 0 END);
    v_extras_leg_byes := v_extras_leg_byes + (CASE WHEN v_ball.extra_type = 'leg_bye' THEN COALESCE(v_ball.extras, 0) ELSE 0 END);
    v_extras_wides := v_extras_wides + (CASE WHEN v_ball.extra_type = 'wide' THEN COALESCE(v_ball.extras, 0) ELSE 0 END);
    v_extras_no_balls := v_extras_no_balls + (CASE WHEN v_ball.extra_type = 'no_ball' THEN COALESCE(v_ball.extras, 0) ELSE 0 END);
    v_extras_penalties := v_extras_penalties + (CASE WHEN v_ball.extra_type = 'penalty' THEN COALESCE(v_ball.extras, 0) ELSE 0 END);
    v_extras_bonuses := v_extras_bonuses + (CASE WHEN v_ball.extra_type = 'bonus' THEN COALESCE(v_ball.extras, 0) ELSE 0 END);

    -- ---- partnerships ----
    IF v_ball.batsman_id IS NOT NULL AND v_ball.non_striker_id IS NOT NULL THEN
      IF v_partner_a IS NULL THEN
        INSERT INTO public.partnerships (match_id, innings_id, batsman1_id, batsman2_id, runs, balls, start_over, is_current)
        VALUES (v_match_id, p_innings_id, v_ball.batsman_id, v_ball.non_striker_id, 0, 0,
                ROUND(FLOOR((v_legal - (CASE WHEN v_is_legal THEN 1 ELSE 0 END)) / v_bpo::numeric)::numeric + (((v_legal - (CASE WHEN v_is_legal THEN 1 ELSE 0 END)) % v_bpo)::numeric / 10), 1), TRUE)
        RETURNING id INTO v_partnership_id;
        v_partner_a := v_ball.batsman_id;
        v_partner_b := v_ball.non_striker_id;
        v_partnership_runs := 0;
        v_partnership_balls := 0;
      ELSIF (v_ball.batsman_id = v_partner_a AND v_ball.non_striker_id = v_partner_b)
         OR (v_ball.batsman_id = v_partner_b AND v_ball.non_striker_id = v_partner_a) THEN
        NULL; -- same pair continues
      ELSE
        UPDATE public.partnerships
           SET runs = v_partnership_runs, balls = v_partnership_balls, is_current = FALSE,
               end_over = ROUND(FLOOR(v_legal / v_bpo::numeric)::numeric + ((v_legal % v_bpo)::numeric / 10), 1)
         WHERE id = v_partnership_id;

        INSERT INTO public.partnerships (match_id, innings_id, batsman1_id, batsman2_id, runs, balls, start_over, is_current)
        VALUES (v_match_id, p_innings_id, v_ball.batsman_id, v_ball.non_striker_id, 0, 0,
                ROUND(FLOOR((v_legal - (CASE WHEN v_is_legal THEN 1 ELSE 0 END)) / v_bpo::numeric)::numeric + (((v_legal - (CASE WHEN v_is_legal THEN 1 ELSE 0 END)) % v_bpo)::numeric / 10), 1), TRUE)
        RETURNING id INTO v_partnership_id;
        v_partner_a := v_ball.batsman_id;
        v_partner_b := v_ball.non_striker_id;
        v_partnership_runs := 0;
        v_partnership_balls := 0;
      END IF;
      v_partnership_runs := v_partnership_runs + v_team_runs_on_ball;
      v_partnership_balls := v_partnership_balls + (CASE WHEN v_is_legal THEN 1 ELSE 0 END);
    END IF;

    -- ---- wickets (MCC Law 25.4 distinction: retired_hurt is NOT OUT and not a wicket) ----
    IF v_ball.is_wicket THEN
      v_dismissed_id := COALESCE(v_ball.dismissed_player_id, v_ball.batsman_id);

      IF COALESCE(v_ball.dismissal_type, '') = 'retired_hurt' THEN
        -- Retired Hurt: NOT OUT, does not increment total_wickets or fall of wickets number
        UPDATE public.batting_performances
           SET is_out = FALSE, dismissal_type = 'retired_hurt',
               bowler_id = v_ball.bowler_id, fielder_id = v_ball.fielder_id,
               is_current_batsman = FALSE, is_striker = FALSE
         WHERE innings_id = p_innings_id AND user_id = v_dismissed_id;
      ELSE
        -- Standard Out or Retired Out: counts as a wicket
        v_wicket_no := v_wicket_no + 1;
        v_total_wickets := v_total_wickets + 1;

        INSERT INTO public.fall_of_wickets
          (match_id, innings_id, wicket_number, runs_at_fall, overs_at_fall,
           batsman_out_id, dismissal_type, bowler_id, fielder_id)
        VALUES
          (v_match_id, p_innings_id, v_wicket_no, v_total_runs,
           ROUND(FLOOR(v_legal / v_bpo::numeric)::numeric + ((v_legal % v_bpo)::numeric / 10), 1), v_dismissed_id,
           COALESCE(v_ball.dismissal_type, 'bowled'), v_ball.bowler_id, v_ball.fielder_id);

        UPDATE public.batting_performances
           SET is_out = TRUE, dismissal_type = v_ball.dismissal_type,
               bowler_id = v_ball.bowler_id, fielder_id = v_ball.fielder_id,
               is_current_batsman = FALSE, is_striker = FALSE
         WHERE innings_id = p_innings_id AND user_id = v_dismissed_id;
      END IF;

      IF v_partnership_id IS NOT NULL THEN
        UPDATE public.partnerships
           SET runs = v_partnership_runs, balls = v_partnership_balls, is_current = FALSE,
               end_over = ROUND(FLOOR(v_legal / v_bpo::numeric)::numeric + ((v_legal % v_bpo)::numeric / 10), 1),
               wicket_number = v_wicket_no
         WHERE id = v_partnership_id;
        v_partnership_id := NULL;
        v_partner_a := NULL;
        v_partner_b := NULL;
      END IF;
    END IF;

    -- ---- strike rotation ----
    v_strike_swap :=
      (COALESCE(v_ball.runs_scored, 0)
       + CASE WHEN v_ball.extra_type IN ('bye', 'leg_bye') THEN COALESCE(v_ball.extras, 0) ELSE 0 END
      ) % 2 = 1;

    IF v_ball.batsman_id IS NOT NULL THEN
      IF v_ball.is_wicket THEN
        IF v_dismissed_id = v_ball.non_striker_id THEN
          IF v_strike_swap THEN
            v_final_striker := NULL;
            v_final_non_striker := v_ball.batsman_id;
          ELSE
            v_final_striker := v_ball.batsman_id;
            v_final_non_striker := NULL;
          END IF;
        ELSE
          IF COALESCE(v_ball.dismissal_type, '') = 'run_out' AND v_strike_swap THEN
            v_final_striker := v_ball.non_striker_id;
            v_final_non_striker := NULL;
          ELSE
            v_final_striker := NULL;
            v_final_non_striker := v_ball.non_striker_id;
          END IF;
        END IF;
      ELSIF v_strike_swap THEN
        v_final_striker := v_ball.non_striker_id;
        v_final_non_striker := v_ball.batsman_id;
      ELSE
        v_final_striker := v_ball.batsman_id;
        v_final_non_striker := v_ball.non_striker_id;
      END IF;
    END IF;

    -- ---- over boundary evaluation ----
    v_over_just_ended := (v_is_legal AND v_legal % v_bpo = 0)
      OR (v_match.max_balls_per_over IS NOT NULL AND v_balls_in_current_over >= v_match.max_balls_per_over);

    IF v_over_just_ended THEN
      DECLARE tmp UUID := v_final_striker;
      BEGIN
        v_final_striker := v_final_non_striker;
        v_final_non_striker := tmp;
      END;
      IF v_ball.bowler_id IS NOT NULL THEN
        UPDATE public.bowling_performances bp
           SET maidens = maidens + 1
         WHERE innings_id = p_innings_id
           AND user_id = v_ball.bowler_id
           AND 0 = (
             SELECT COALESCE(SUM(b.runs_scored + CASE WHEN b.extra_type IN ('bye','leg_bye','penalty','bonus') THEN 0 ELSE COALESCE(b.extras,0) END), 0)
             FROM public.ball_by_ball b
             WHERE b.innings_id = p_innings_id
               AND b.over_number = v_ball.over_number
           );
      END IF;
      v_last_bowler := NULL;
    END IF;
  END LOOP;

  -- Persist innings totals
  UPDATE public.innings
     SET total_runs = v_total_runs,
         total_wickets = v_total_wickets,
         total_balls = v_legal,
         total_overs = ROUND(FLOOR(v_legal / v_bpo::numeric)::numeric + ((v_legal % v_bpo))::numeric / 10, 1),
         extras_total = v_extras_byes + v_extras_leg_byes + v_extras_wides + v_extras_no_balls + v_extras_penalties + v_extras_bonuses,
         extras_byes = v_extras_byes,
         extras_leg_byes = v_extras_leg_byes,
         extras_wides = v_extras_wides,
         extras_no_balls = v_extras_no_balls,
         extras_penalties = v_extras_penalties,
         extras_bonuses = v_extras_bonuses
   WHERE id = p_innings_id;

  IF v_final_striker IS NOT NULL THEN
    UPDATE public.batting_performances
       SET is_current_batsman = TRUE, is_striker = TRUE
     WHERE innings_id = p_innings_id AND user_id = v_final_striker;
  END IF;

  IF v_final_non_striker IS NOT NULL THEN
    UPDATE public.batting_performances
       SET is_current_batsman = TRUE, is_striker = FALSE
     WHERE innings_id = p_innings_id AND user_id = v_final_non_striker;
  END IF;

  UPDATE public.bowling_performances
     SET overs_bowled = ROUND(FLOOR(balls_bowled / v_bpo::numeric)::numeric + ((balls_bowled % v_bpo))::numeric / 10, 1)
   WHERE innings_id = p_innings_id;

  IF v_over_just_ended THEN
    UPDATE public.bowling_performances
       SET is_current_bowler = FALSE
     WHERE innings_id = p_innings_id;
  ELSIF v_last_bowler IS NOT NULL THEN
    UPDATE public.bowling_performances
       SET is_current_bowler = (user_id = v_last_bowler)
     WHERE innings_id = p_innings_id;
  END IF;

  IF v_partnership_id IS NOT NULL THEN
    UPDATE public.partnerships
       SET runs = v_partnership_runs,
           balls = v_partnership_balls
     WHERE id = v_partnership_id;
  END IF;
END;
$$;

-- 4. Fix recalculate_tournament_standings to include abandoned / no_result matches
CREATE OR REPLACE FUNCTION public.recalculate_tournament_standings(p_tournament_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
  v_matches_played INTEGER;
  v_wins INTEGER;
  v_losses INTEGER;
  v_ties INTEGER;
  v_no_results INTEGER;
  v_base_points NUMERIC(6,2);
  v_final_points NUMERIC(6,2);
  v_runs_scored INTEGER;
  v_runs_conceded INTEGER;
  v_overs_faced NUMERIC;
  v_overs_bowled NUMERIC;
  v_nrr NUMERIC;
  v_overs_faced_val NUMERIC;
  v_overs_bowled_val NUMERIC;
  v_current_adj NUMERIC(5,2);
  v_wickets_cap INTEGER;
  v_bpo INTEGER;

  v_inn RECORD;
BEGIN
  -- Iterate through all registered teams and teams who played in this tournament
  FOR v_team IN (
    SELECT DISTINCT team_id FROM public.tournament_registrations WHERE tournament_id = p_tournament_id
    UNION
    SELECT team1_id AS team_id FROM public.matches WHERE tournament_id = p_tournament_id
    UNION
    SELECT team2_id AS team_id FROM public.matches WHERE tournament_id = p_tournament_id
  ) LOOP
    IF v_team.team_id IS NOT NULL THEN
      -- Get existing points adjustment if any
      SELECT COALESCE(points_adjustment, 0.00) INTO v_current_adj
      FROM public.tournament_standings
      WHERE tournament_id = p_tournament_id AND team_id = v_team.team_id;

      IF v_current_adj IS NULL THEN
        v_current_adj := 0.00;
      END IF;

      -- Match stats: include both 'completed' and 'abandoned' matches
      SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE winning_team_id = v_team.team_id),
        COUNT(*) FILTER (WHERE winning_team_id IS NOT NULL AND winning_team_id <> v_team.team_id AND result_type = 'win'),
        COUNT(*) FILTER (WHERE result_type = 'tie'),
        COUNT(*) FILTER (WHERE result_type IN ('no_result', 'abandoned'))
      INTO v_matches_played, v_wins, v_losses, v_ties, v_no_results
      FROM public.matches
      WHERE tournament_id = p_tournament_id
        AND status IN ('completed', 'abandoned')
        AND (team1_id = v_team.team_id OR team2_id = v_team.team_id);

      v_base_points := (v_wins * 2.0) + (v_ties * 1.0) + (v_no_results * 1.0);
      v_final_points := v_base_points + v_current_adj;
      v_runs_scored := 0;
      v_runs_conceded := 0;
      v_overs_faced := 0.0;
      v_overs_bowled := 0.0;

      -- Calculate batting (runs scored & overs faced) from completed innings
      FOR v_inn IN (
        SELECT i.total_runs, i.total_wickets, i.total_balls, m.overs_per_innings,
               COALESCE(m.wickets_per_innings, 10) as wickets_cap,
               COALESCE(m.balls_per_over, 6) as balls_per_over
        FROM public.innings i
        JOIN public.matches m ON m.id = i.match_id
        WHERE m.tournament_id = p_tournament_id
          AND m.status = 'completed'
          AND i.team_id = v_team.team_id
      ) LOOP
        v_bpo := v_inn.balls_per_over;
        v_runs_scored := v_runs_scored + COALESCE(v_inn.total_runs, 0);
        -- If all out (>= wickets_cap), count full innings overs quota
        IF COALESCE(v_inn.total_wickets, 0) >= v_inn.wickets_cap THEN
          v_overs_faced := v_overs_faced + COALESCE(v_inn.overs_per_innings, 20)::numeric;
        ELSE
          v_overs_faced := v_overs_faced + (COALESCE(v_inn.total_balls, 0) / v_bpo) + ((COALESCE(v_inn.total_balls, 0) % v_bpo)::numeric / v_bpo::numeric);
        END IF;
      END LOOP;

      -- Calculate bowling (runs conceded & overs bowled)
      FOR v_inn IN (
        SELECT i.total_runs, i.total_wickets, i.total_balls, m.overs_per_innings,
               COALESCE(m.wickets_per_innings, 10) as wickets_cap,
               COALESCE(m.balls_per_over, 6) as balls_per_over
        FROM public.innings i
        JOIN public.matches m ON m.id = i.match_id
        WHERE m.tournament_id = p_tournament_id
          AND m.status = 'completed'
          AND i.team_id <> v_team.team_id
          AND (m.team1_id = v_team.team_id OR m.team2_id = v_team.team_id)
      ) LOOP
        v_bpo := v_inn.balls_per_over;
        v_runs_conceded := v_runs_conceded + COALESCE(v_inn.total_runs, 0);
        IF COALESCE(v_inn.total_wickets, 0) >= v_inn.wickets_cap THEN
          v_overs_bowled := v_overs_bowled + COALESCE(v_inn.overs_per_innings, 20)::numeric;
        ELSE
          v_overs_bowled := v_overs_bowled + (COALESCE(v_inn.total_balls, 0) / v_bpo) + ((COALESCE(v_inn.total_balls, 0) % v_bpo)::numeric / v_bpo::numeric);
        END IF;
      END LOOP;

      -- Calculate NRR
      IF v_overs_faced > 0 AND v_overs_bowled > 0 THEN
        v_nrr := ROUND(((v_runs_scored::numeric / v_overs_faced) - (v_runs_conceded::numeric / v_overs_bowled)), 2);
      ELSE
        v_nrr := 0.00;
      END IF;

      v_overs_faced_val := ROUND(v_overs_faced, 1);
      v_overs_bowled_val := ROUND(v_overs_bowled, 1);

      -- Upsert standings row
      INSERT INTO public.tournament_standings (
        tournament_id, team_id, matches_played, wins, losses, ties, no_results, points,
        points_adjustment, runs_scored, runs_conceded, overs_faced, overs_bowled, net_run_rate, updated_at
      ) VALUES (
        p_tournament_id, v_team.team_id, v_matches_played, v_wins, v_losses, v_ties, v_no_results, v_final_points,
        v_current_adj, v_runs_scored, v_runs_conceded, v_overs_faced_val, v_overs_bowled_val, v_nrr, NOW()
      )
      ON CONFLICT (tournament_id, team_id) DO UPDATE SET
        matches_played = EXCLUDED.matches_played,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        ties = EXCLUDED.ties,
        no_results = EXCLUDED.no_results,
        points = EXCLUDED.points,
        points_adjustment = EXCLUDED.points_adjustment,
        runs_scored = EXCLUDED.runs_scored,
        runs_conceded = EXCLUDED.runs_conceded,
        overs_faced = EXCLUDED.overs_faced,
        overs_bowled = EXCLUDED.overs_bowled,
        net_run_rate = EXCLUDED.net_run_rate,
        updated_at = NOW();
    END IF;
  END LOOP;
END;
$$;

-- 5. Fix undo_last_ball to allow undoing match-completing deliveries by reverting status to 'live'
CREATE OR REPLACE FUNCTION public.undo_last_ball(p_match_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_last_ball RECORD;
  v_state JSONB;
BEGIN
  IF NOT public.is_match_admin(p_match_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RAISE EXCEPTION 'match_not_found' USING ERRCODE = '22000';
  END IF;

  -- Reopen match if it was marked completed
  IF v_match.status = 'completed' THEN
    UPDATE public.matches
       SET status = 'live',
           actual_end_time = NULL,
           result_type = NULL,
           result_description = NULL,
           winning_team_id = NULL,
           win_margin = NULL,
           win_margin_type = NULL,
           player_of_the_match_id = NULL
     WHERE id = p_match_id;
  END IF;

  SELECT * INTO v_last_ball
  FROM public.ball_by_ball
  WHERE match_id = p_match_id
  ORDER BY seq DESC
  LIMIT 1;

  IF v_last_ball IS NULL THEN
    RAISE EXCEPTION 'nothing_to_undo' USING ERRCODE = '22000';
  END IF;

  DELETE FROM public.ball_by_ball WHERE id = v_last_ball.id;

  -- Undo across an innings boundary: if the deleted ball belonged to a
  -- completed earlier innings while a fresh next innings exists, roll the
  -- match back to that innings.
  IF v_last_ball.innings_id <> (
    SELECT i.id FROM public.innings i
    WHERE i.match_id = p_match_id AND i.innings_number = v_match.current_innings
  ) THEN
    DELETE FROM public.innings
     WHERE match_id = p_match_id AND innings_number = v_match.current_innings;
    UPDATE public.innings
       SET is_completed = FALSE
     WHERE id = v_last_ball.innings_id;
    UPDATE public.matches
       SET current_innings = (
         SELECT innings_number FROM public.innings WHERE id = v_last_ball.innings_id
       )
     WHERE id = p_match_id;
  END IF;

  PERFORM public.recompute_innings(v_last_ball.innings_id);

  SELECT public.record_state(p_match_id) INTO v_state;
  RETURN v_state;
END;
$$;
