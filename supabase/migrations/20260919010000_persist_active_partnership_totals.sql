-- 20260919010000_persist_active_partnership_totals.sql
-- Fix: Persist active partnership runs and balls in recompute_innings so stats tabs,
-- scorecards, presentation cards, and overlays reflect live partnerships accurately.

CREATE OR REPLACE FUNCTION public.recompute_innings(p_innings_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_match_id UUID;
  v_team_id UUID;
  v_innings_number INTEGER;
  v_overs_limit INTEGER := 50;
  v_ball RECORD;
  v_legal INTEGER := 0;
  v_total_runs INTEGER := 0;
  v_total_wickets INTEGER := 0;
  v_extras_byes INTEGER := 0;
  v_extras_leg_byes INTEGER := 0;
  v_extras_wides INTEGER := 0;
  v_extras_no_balls INTEGER := 0;
  v_extras_penalties INTEGER := 0;
  v_is_legal BOOLEAN;
  v_team_runs_on_ball INTEGER;
  v_bowler_concedes INTEGER;
  v_strike_swap BOOLEAN;
  v_partner_a UUID;
  v_partner_b UUID;
  v_partnership_id UUID;
  v_partnership_runs INTEGER := 0;
  v_partnership_balls INTEGER := 0;
  v_wicket_no INTEGER := 0;
  v_dismissed_id UUID;
  v_final_striker UUID;
  v_final_non_striker UUID;
  v_last_bowler UUID;
BEGIN
  SELECT match_id, team_id, innings_number INTO v_match_id, v_team_id, v_innings_number
  FROM public.innings WHERE id = p_innings_id;

  IF v_match_id IS NULL THEN
    RETURN;
  END IF;

  SELECT overs_per_innings INTO v_overs_limit
  FROM public.matches WHERE id = v_match_id;

  -- Reset derived state for this innings
  UPDATE public.batting_performances
     SET runs_scored = 0, balls_faced = 0, fours = 0, sixes = 0,
         is_out = FALSE, dismissal_type = NULL, bowler_id = NULL, fielder_id = NULL,
         is_current_batsman = FALSE, is_striker = FALSE
   WHERE innings_id = p_innings_id;

  UPDATE public.bowling_performances
     SET overs_bowled = 0, balls_bowled = 0, maidens = 0, runs_conceded = 0,
         wickets_taken = 0, wides = 0, no_balls = 0
   WHERE innings_id = p_innings_id;

  DELETE FROM public.fall_of_wickets WHERE innings_id = p_innings_id;
  DELETE FROM public.partnerships WHERE innings_id = p_innings_id;

  FOR v_ball IN
    SELECT *
    FROM public.ball_by_ball
    WHERE innings_id = p_innings_id
    ORDER BY over_number ASC, ball_number ASC, created_at ASC
  LOOP
    v_is_legal := v_ball.extra_type IS NULL OR v_ball.extra_type NOT IN ('wide', 'no_ball');

    -- Team runs off this delivery
    v_team_runs_on_ball := COALESCE(v_ball.runs_scored, 0) + COALESCE(v_ball.extras, 0);

    -- Runs charged to bowler: byes, leg-byes, and penalty runs are NOT bowler runs
    v_bowler_concedes := COALESCE(v_ball.runs_scored, 0)
      + CASE WHEN v_ball.extra_type IN ('bye', 'leg_bye', 'penalty') THEN 0
             ELSE COALESCE(v_ball.extras, 0) END;

    -- Update last bowler seen
    IF v_ball.bowler_id IS NOT NULL THEN
      v_last_bowler := v_ball.bowler_id;
    END IF;

    -- Ensure batting performance rows exist
    BEGIN
      INSERT INTO public.batting_performances
        (match_id, innings_id, user_id, batting_position)
      VALUES
        (v_match_id, p_innings_id, v_ball.batsman_id,
         (SELECT COALESCE(MAX(batting_position), 0) + 1 FROM public.batting_performances WHERE innings_id = p_innings_id))
      ON CONFLICT (innings_id, user_id) DO NOTHING;

      IF v_ball.non_striker_id IS NOT NULL THEN
        INSERT INTO public.batting_performances
          (match_id, innings_id, user_id, batting_position)
        VALUES
          (v_match_id, p_innings_id, v_ball.non_striker_id,
           (SELECT COALESCE(MAX(batting_position), 0) + 1 FROM public.batting_performances WHERE innings_id = p_innings_id))
        ON CONFLICT (innings_id, user_id) DO NOTHING;
      END IF;
    END;

    -- Ensure bowler performance row exists
    BEGIN
      IF v_ball.bowler_id IS NOT NULL THEN
        INSERT INTO public.bowling_performances
          (match_id, innings_id, user_id)
        VALUES
          (v_match_id, p_innings_id, v_ball.bowler_id)
        ON CONFLICT (innings_id, user_id) DO NOTHING;
      END IF;
    END;

    -- ---- batting ----
    UPDATE public.batting_performances
       SET runs_scored = runs_scored + COALESCE(v_ball.runs_scored, 0),
           balls_faced = balls_faced + (CASE WHEN v_ball.extra_type IS NULL OR v_ball.extra_type <> 'wide' THEN 1 ELSE 0 END),
           fours = fours + (CASE WHEN v_ball.runs_scored = 4 THEN 1 ELSE 0 END),
           sixes = sixes + (CASE WHEN v_ball.runs_scored = 6 THEN 1 ELSE 0 END)
     WHERE innings_id = p_innings_id AND user_id = v_ball.batsman_id;

    -- ---- bowling ----
    UPDATE public.bowling_performances
       SET balls_bowled = balls_bowled + (CASE WHEN v_is_legal THEN 1 ELSE 0 END),
           runs_conceded = runs_conceded + v_bowler_concedes,
           wides = wides + (CASE WHEN v_ball.extra_type = 'wide' THEN 1 ELSE 0 END),
           no_balls = no_balls + (CASE WHEN v_ball.extra_type = 'no_ball' THEN 1 ELSE 0 END),
           wickets_taken = wickets_taken + (
             CASE WHEN v_ball.is_wicket
                   AND COALESCE(v_ball.dismissal_type, '') NOT IN ('run_out', 'retired_hurt', 'retired_out', 'obstructing')
                   AND v_ball.bowler_id IS NOT NULL
                  THEN 1 ELSE 0 END)
     WHERE innings_id = p_innings_id AND user_id = v_ball.bowler_id;

    -- ---- innings totals ----
    v_legal := v_legal + (CASE WHEN v_is_legal THEN 1 ELSE 0 END);
    v_total_runs := v_total_runs + v_team_runs_on_ball;
    v_extras_byes := v_extras_byes + (CASE WHEN v_ball.extra_type = 'bye' THEN COALESCE(v_ball.extras, 0) ELSE 0 END);
    v_extras_leg_byes := v_extras_leg_byes + (CASE WHEN v_ball.extra_type = 'leg_bye' THEN COALESCE(v_ball.extras, 0) ELSE 0 END);
    v_extras_wides := v_extras_wides + (CASE WHEN v_ball.extra_type = 'wide' THEN COALESCE(v_ball.extras, 0) ELSE 0 END);
    v_extras_no_balls := v_extras_no_balls + (CASE WHEN v_ball.extra_type = 'no_ball' THEN COALESCE(v_ball.extras, 0) ELSE 0 END);
    v_extras_penalties := v_extras_penalties + (CASE WHEN v_ball.extra_type = 'penalty' THEN COALESCE(v_ball.extras, 0) ELSE 0 END);

    -- ---- partnerships ----
    IF v_partner_a IS NULL THEN
      INSERT INTO public.partnerships (match_id, innings_id, batsman1_id, batsman2_id, runs, balls, start_over, is_current)
      VALUES (v_match_id, p_innings_id, v_ball.batsman_id, v_ball.non_striker_id, 0, 0,
              ROUND(FLOOR((v_legal - (CASE WHEN v_is_legal THEN 1 ELSE 0 END)) / 6.0)::numeric + (((v_legal - (CASE WHEN v_is_legal THEN 1 ELSE 0 END)) % 6)::numeric / 10), 1), TRUE)
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
             end_over = ROUND(FLOOR(v_legal / 6.0)::numeric + ((v_legal % 6)::numeric / 10), 1)
       WHERE id = v_partnership_id;

      INSERT INTO public.partnerships (match_id, innings_id, batsman1_id, batsman2_id, runs, balls, start_over, is_current)
      VALUES (v_match_id, p_innings_id, v_ball.batsman_id, v_ball.non_striker_id, 0, 0,
              ROUND(FLOOR((v_legal - (CASE WHEN v_is_legal THEN 1 ELSE 0 END)) / 6.0)::numeric + (((v_legal - (CASE WHEN v_is_legal THEN 1 ELSE 0 END)) % 6)::numeric / 10), 1), TRUE)
      RETURNING id INTO v_partnership_id;
      v_partner_a := v_ball.batsman_id;
      v_partner_b := v_ball.non_striker_id;
      v_partnership_runs := 0;
      v_partnership_balls := 0;
    END IF;
    v_partnership_runs := v_partnership_runs + v_team_runs_on_ball;
    v_partnership_balls := v_partnership_balls + (CASE WHEN v_is_legal THEN 1 ELSE 0 END);

    -- ---- wickets ----
    IF v_ball.is_wicket THEN
      v_wicket_no := v_wicket_no + 1;
      v_total_wickets := v_total_wickets + 1;

      v_dismissed_id := COALESCE(v_ball.dismissed_player_id, v_ball.batsman_id);

      INSERT INTO public.fall_of_wickets
        (match_id, innings_id, wicket_number, runs_at_fall, overs_at_fall,
         batsman_out_id, dismissal_type, bowler_id, fielder_id)
      VALUES
        (v_match_id, p_innings_id, v_wicket_no, v_total_runs,
         ROUND(FLOOR(v_legal / 6.0)::numeric + ((v_legal % 6)::numeric / 10), 1), v_dismissed_id,
         COALESCE(v_ball.dismissal_type, 'bowled'), v_ball.bowler_id, v_ball.fielder_id);

      IF COALESCE(v_ball.dismissal_type, '') <> 'retired_hurt' THEN
        UPDATE public.batting_performances
           SET is_out = TRUE, dismissal_type = v_ball.dismissal_type,
               bowler_id = v_ball.bowler_id, fielder_id = v_ball.fielder_id,
               is_current_batsman = FALSE, is_striker = FALSE
         WHERE innings_id = p_innings_id AND user_id = v_dismissed_id;
      END IF;

      UPDATE public.partnerships
         SET runs = v_partnership_runs, balls = v_partnership_balls, is_current = FALSE,
             end_over = ROUND(FLOOR(v_legal / 6.0)::numeric + ((v_legal % 6)::numeric / 10), 1),
             wicket_number = v_wicket_no
       WHERE id = v_partnership_id;
      v_partnership_id := NULL;
      v_partner_a := NULL;
      v_partner_b := NULL;
    END IF;

    -- ---- strike rotation ----
    v_strike_swap :=
      (COALESCE(v_ball.runs_scored, 0)
       + CASE WHEN v_ball.extra_type IN ('bye', 'leg_bye') THEN COALESCE(v_ball.extras, 0) ELSE 0 END
      ) % 2 = 1;

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

    -- ---- over boundaries ----
    IF v_is_legal AND v_legal % 6 = 0 THEN
      DECLARE tmp UUID := v_final_striker;
      BEGIN
        v_final_striker := v_final_non_striker;
        v_final_non_striker := tmp;
      END;
      UPDATE public.bowling_performances bp
         SET maidens = maidens + 1
       WHERE innings_id = p_innings_id
         AND user_id = v_ball.bowler_id
         AND 0 = (
           SELECT COALESCE(SUM(b.runs_scored + CASE WHEN b.extra_type IN ('bye','leg_bye','penalty') THEN 0 ELSE COALESCE(b.extras,0) END), 0)
           FROM public.ball_by_ball b
           WHERE b.innings_id = p_innings_id
             AND b.over_number = v_ball.over_number
         );
      v_last_bowler := NULL;
    END IF;
  END LOOP;

  -- Persist innings totals.
  UPDATE public.innings
     SET total_runs = v_total_runs,
         total_wickets = v_total_wickets,
         total_balls = v_legal,
         total_overs = ROUND(FLOOR(v_legal / 6.0)::numeric + ((v_legal % 6))::numeric / 10, 1),
         extras_total = v_extras_byes + v_extras_leg_byes + v_extras_wides + v_extras_no_balls + v_extras_penalties,
         extras_byes = v_extras_byes,
         extras_leg_byes = v_extras_leg_byes,
         extras_wides = v_extras_wides,
         extras_no_balls = v_extras_no_balls,
         extras_penalties = v_extras_penalties
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
     SET overs_bowled = ROUND(FLOOR(balls_bowled / 6.0)::numeric + ((balls_bowled % 6))::numeric / 10, 1)
   WHERE innings_id = p_innings_id;

  -- If over just completed, reset is_current_bowler so the scoring engine knows a new bowler must be chosen.
  -- Otherwise, if over is in progress, ensure the active bowler has is_current_bowler = true.
  IF v_legal > 0 AND v_legal % 6 = 0 THEN
    UPDATE public.bowling_performances
       SET is_current_bowler = FALSE
     WHERE innings_id = p_innings_id;
  ELSIF v_last_bowler IS NOT NULL THEN
    UPDATE public.bowling_performances
       SET is_current_bowler = (user_id = v_last_bowler)
     WHERE innings_id = p_innings_id;
  END IF;

  -- Persist current active partnership runs & balls so stats tabs, overlays, and scorecards update
  IF v_partnership_id IS NOT NULL THEN
    UPDATE public.partnerships
       SET runs = v_partnership_runs,
           balls = v_partnership_balls
     WHERE id = v_partnership_id;
  END IF;

  UPDATE public.matches
     SET current_over = FLOOR(v_legal / 6.0),
         current_ball = v_legal % 6
   WHERE id = v_match_id;
END;
$$;
