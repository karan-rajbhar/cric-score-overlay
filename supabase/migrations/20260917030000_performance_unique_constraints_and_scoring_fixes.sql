-- ============================================================================
-- PERFORMANCE UNIQUE CONSTRAINTS & SCORING ENGINE INTEGRITY FIXES
-- 1. Ensure UNIQUE(innings_id, user_id) on batting_performances & bowling_performances
--    to support ON CONFLICT (innings_id, user_id) DO NOTHING in recompute_innings().
-- 2. Fix recompute_innings() inserting invalid bowling_position column into bowling_performances.
-- 3. Update match_events CHECK constraint to include 'boundary_four' and 'boundary_six'.
-- 4. Update ball_by_ball CHECK constraint to allow 'retired_hurt' and 'retired_out'.
-- 5. Drop obsolete 11-parameter record_ball() overload to avoid signature ambiguity.
-- 6. Fix _advance_after_innings() to credit first-innings team rather than static team1_id.
-- ============================================================================

-- Deduplicate any existing duplicate performance rows before adding unique constraints
DELETE FROM public.batting_performances a
USING public.batting_performances b
WHERE a.id < b.id
  AND a.innings_id = b.innings_id
  AND a.user_id = b.user_id;

DELETE FROM public.bowling_performances a
USING public.bowling_performances b
WHERE a.id < b.id
  AND a.innings_id = b.innings_id
  AND a.user_id = b.user_id;

-- 1. Unique constraints for ON CONFLICT (innings_id, user_id)
ALTER TABLE public.batting_performances
  DROP CONSTRAINT IF EXISTS batting_performances_innings_user_unique,
  ADD CONSTRAINT batting_performances_innings_user_unique UNIQUE (innings_id, user_id);

ALTER TABLE public.bowling_performances
  DROP CONSTRAINT IF EXISTS bowling_performances_innings_user_unique,
  ADD CONSTRAINT bowling_performances_innings_user_unique UNIQUE (innings_id, user_id);

-- 2. Update match_events CHECK constraint to support boundary events
ALTER TABLE public.match_events
  DROP CONSTRAINT IF EXISTS match_events_event_type_check,
  ADD CONSTRAINT match_events_event_type_check
  CHECK (event_type IN (
    'match_start', 'innings_start', 'innings_end', 'match_end',
    'wicket', 'boundary', 'boundary_four', 'boundary_six', 'six',
    'milestone', 'timeout', 'review'
  ));

-- 3. Update ball_by_ball CHECK constraint to include retired dismissals
ALTER TABLE public.ball_by_ball
  DROP CONSTRAINT IF EXISTS ball_by_ball_dismissal_type_check,
  ADD CONSTRAINT ball_by_ball_dismissal_type_check
  CHECK (dismissal_type IS NULL OR dismissal_type IN (
    'bowled', 'caught', 'lbw', 'stumped', 'run_out', 'hit_wicket',
    'obstructing', 'timed_out', 'handled_ball', 'retired_hurt', 'retired_out'
  ));

-- 4. Drop obsolete 11-parameter record_ball overload
DROP FUNCTION IF EXISTS public.record_ball(UUID, UUID, UUID, UUID, INTEGER, INTEGER, TEXT, BOOLEAN, TEXT, UUID, TEXT);

-- 5. Fix recompute_innings: remove bowling_position from bowling_performances insert
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

    -- Ensure bowler performance row exists (bowling_performances has no bowling_position column)
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
      -- Open the first partnership of the innings.
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
      -- A new batsman joined: close current partnership, open a new one.
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

      -- Use dismissed_player_id if specified (e.g. non-striker run out), fallback to striker
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

  UPDATE public.matches
     SET current_over = FLOOR(v_legal / 6.0),
         current_ball = v_legal % 6
   WHERE id = v_match_id;
END;
$$;

-- 6. Fix _advance_after_innings winner selection when innings 1 runs > innings 2 runs
CREATE OR REPLACE FUNCTION public._advance_after_innings(
  p_match_id UUID,
  p_completed_innings_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_innings_number INTEGER;
  v_innings_team UUID;
  v_innings_runs INTEGER;
  v_innings_wickets INTEGER;
  v_other_team UUID;
  v_second UUID;
  v_i1_runs INTEGER;
  v_result TEXT DEFAULT 'win';
  v_winner UUID;
  v_margin_type TEXT;
  v_margin INTEGER;
  v_description TEXT;
BEGIN
  SELECT innings_number, team_id, total_runs, total_wickets
    INTO v_innings_number, v_innings_team, v_innings_runs, v_innings_wickets
  FROM public.innings WHERE id = p_completed_innings_id;

  UPDATE public.innings SET is_completed = TRUE WHERE id = p_completed_innings_id;

  IF v_innings_number = 1 THEN
    SELECT CASE WHEN v_innings_team = team1_id THEN team2_id ELSE team1_id END
      INTO v_other_team
    FROM public.matches WHERE id = p_match_id;

    INSERT INTO public.innings (match_id, team_id, innings_number, target_runs)
    VALUES (p_match_id, v_other_team, 2, v_innings_runs + 1)
    RETURNING id INTO v_second;

    UPDATE public.matches
       SET current_innings = 2, current_over = 0, current_ball = 0
     WHERE id = p_match_id;
  ELSE
    SELECT total_runs INTO v_i1_runs FROM public.innings
     WHERE match_id = p_match_id AND innings_number = 1;

    IF v_innings_runs > v_i1_runs THEN
      v_winner := v_innings_team;
      v_margin_type := 'wickets';
      v_margin := 10 - v_innings_wickets;
      v_description := format('Won by %s wickets', v_margin);
    ELSIF v_i1_runs > v_innings_runs THEN
      -- Team batting in 1st innings defended their score
      SELECT team_id INTO v_winner FROM public.innings
       WHERE match_id = p_match_id AND innings_number = 1;
      v_margin_type := 'runs';
      v_margin := v_i1_runs - v_innings_runs;
      v_description := format('Won by %s runs', v_margin);
    ELSE
      v_result := 'tie';
      v_winner := NULL;
      v_margin_type := NULL;
      v_margin := NULL;
      v_description := 'Match tied';
    END IF;

    UPDATE public.matches
       SET status = 'completed',
           actual_end_time = NOW(),
           result_type = v_result,
           winning_team_id = v_winner,
           win_margin_type = v_margin_type,
           win_margin = v_margin,
           result_description = v_description
     WHERE id = p_match_id;

    PERFORM public.match_events_insert(
      p_match_id, 'match_end',
      jsonb_build_object('result', v_result, 'description', v_description)
    );
  END IF;
END;
$$;
