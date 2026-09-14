-- ============================================================================
-- SCORING ENGINE FIXES & MCC LAWS ALIGNMENT
-- 1. Add dismissed_player_id to ball_by_ball to support non-striker run-outs.
-- 2. Batter balls_faced now increments on No-Balls (per MCC / ICC standard).
-- 3. Strike rotation on wickets adheres to MCC Law 18.11 (2022 Code).
-- 4. record_ball accepts p_dismissed_player_id.
-- ============================================================================

ALTER TABLE public.ball_by_ball
  ADD COLUMN IF NOT EXISTS dismissed_player_id UUID REFERENCES public.users(id);

-- Replay engine updated for dismissed_player_id, balls_faced on no-balls, and 2022 strike rules
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
     SET overs_bowled = 0, balls_bowled = 0, runs_conceded = 0, wickets_taken = 0,
         maidens = 0, wides = 0, no_balls = 0, is_current_bowler = FALSE
   WHERE innings_id = p_innings_id;

  DELETE FROM public.partnerships WHERE innings_id = p_innings_id;
  DELETE FROM public.fall_of_wickets WHERE innings_id = p_innings_id;

  FOR v_ball IN
    SELECT * FROM public.ball_by_ball
     WHERE innings_id = p_innings_id
     ORDER BY seq
  LOOP
    v_is_legal := v_ball.extra_type IS NULL
                  OR v_ball.extra_type NOT IN ('wide', 'no_ball');
    v_team_runs_on_ball := COALESCE(v_ball.runs_scored, 0) + COALESCE(v_ball.extras, 0);
    -- Byes/leg-byes/penalties are not charged to the bowler.
    v_bowler_concedes := CASE
      WHEN v_ball.extra_type IN ('bye', 'leg_bye', 'penalty')
        THEN 0
      ELSE COALESCE(v_ball.runs_scored, 0) + COALESCE(v_ball.extras, 0)
    END;

    -- ---- batting ----
    -- Balls faced: batter faces all balls EXCEPT wides (MCC / ICC rule).
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
      -- Who survived?
      IF v_dismissed_id = v_ball.non_striker_id THEN
        -- Non-striker was out; striker survived!
        IF v_strike_swap THEN
          -- Batsmen swapped ends on completed runs before the run out
          v_final_striker := NULL;
          v_final_non_striker := v_ball.batsman_id;
        ELSE
          v_final_striker := v_ball.batsman_id;
          v_final_non_striker := NULL;
        END IF;
      ELSE
        -- Striker was out; non-striker survived!
        -- Under MCC Law 18.11 (2022 Code): for caught, bowled, lbw, stumped, hit wicket,
        -- the incoming new batter always takes strike (striker end), so survivor stays non-striker.
        -- For run out of striker with odd runs completed, survivor crossed to striker end.
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

    -- Track the bowler BEFORE any over-boundary clearing below.
    v_last_bowler := v_ball.bowler_id;

    -- End of over: rotate strike between the two batsmen.
    IF v_is_legal AND v_legal % 6 = 0
       AND v_final_striker IS NOT NULL AND v_final_non_striker IS NOT NULL THEN
      DECLARE tmp UUID := v_final_striker;
      BEGIN
        v_final_striker := v_final_non_striker;
        v_final_non_striker := tmp;
      END;
      -- Maiden detection for the over that just finished.
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
      -- Over boundary: force a new bowler to be selected before the next delivery can be recorded.
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

  -- Set current-player flags from the final replayed state.
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
  IF v_last_bowler IS NOT NULL THEN
    UPDATE public.bowling_performances
       SET is_current_bowler = TRUE
     WHERE innings_id = p_innings_id AND user_id = v_last_bowler;
  END IF;

  -- Mirror progress onto the match row.
  UPDATE public.matches
     SET current_over = FLOOR(v_legal / 6.0),
         current_ball = v_legal % 6
   WHERE id = v_match_id;
END;
$$;

-- Updated record_ball accepting p_dismissed_player_id
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
  p_dismissed_player_id UUID DEFAULT NULL
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
     dismissed_player_id)
  VALUES
    (p_match_id, v_innings.id, v_over_no, v_delivery_no,
     p_bowler_id, p_batsman_id, p_non_striker_id,
     COALESCE(p_runs_scored, 0), COALESCE(p_extras, 0), p_extra_type,
     COALESCE(p_is_wicket, FALSE), p_dismissal_type, p_fielder_id, p_commentary,
     v_actual_dismissed);

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
