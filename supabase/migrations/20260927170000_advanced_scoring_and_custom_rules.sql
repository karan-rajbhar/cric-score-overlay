-- Migration: 20260927170000_advanced_scoring_and_custom_rules.sql
-- Description: Supports custom balls per over, max balls per over with extras,
-- batsman extras crediting (wides/no-balls), bonus runs, retired hurt accuracy, and team penalties.

-- 1. Extend matches table with custom cricket format rules
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS balls_per_over INTEGER DEFAULT 6,
  ADD COLUMN IF NOT EXISTS max_balls_per_over INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wide_counts_as_ball_faced BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wide_runs_to_batsman BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS noball_extras_to_batsman BOOLEAN DEFAULT FALSE;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_balls_per_over_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_balls_per_over_check CHECK (balls_per_over >= 2 AND balls_per_over <= 12);

-- 2. Extend ball_by_ball extra_type CHECK to support 'bonus'
ALTER TABLE public.ball_by_ball
  DROP CONSTRAINT IF EXISTS ball_by_ball_extra_type_check;

ALTER TABLE public.ball_by_ball
  ADD CONSTRAINT ball_by_ball_extra_type_check
    CHECK (extra_type = ANY (ARRAY['wide'::text, 'no_ball'::text, 'bye'::text, 'leg_bye'::text, 'penalty'::text, 'bonus'::text]));

-- 3. Extend innings table with extras_bonuses
ALTER TABLE public.innings
  ADD COLUMN IF NOT EXISTS extras_bonuses INTEGER DEFAULT 0;

-- 4. Recompute innings function with custom rules support
CREATE OR REPLACE FUNCTION public.recompute_innings(p_innings_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    v_is_legal := v_ball.extra_type IS NULL OR v_ball.extra_type NOT IN ('wide', 'no_ball', 'bonus');
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

    -- ---- batting stats ----
    UPDATE public.batting_performances
       SET runs_scored = runs_scored + COALESCE(v_ball.runs_scored, 0)
             + (CASE WHEN v_ball.extra_type = 'wide' AND COALESCE(v_match.wide_runs_to_batsman, FALSE) THEN COALESCE(v_ball.extras, 0) ELSE 0 END)
             + (CASE WHEN v_ball.extra_type = 'no_ball' AND COALESCE(v_match.noball_extras_to_batsman, FALSE) THEN COALESCE(v_ball.extras, 0) ELSE 0 END),
           balls_faced = balls_faced + (
             CASE WHEN v_ball.extra_type IS NULL OR v_ball.extra_type <> 'wide' OR COALESCE(v_match.wide_counts_as_ball_faced, FALSE) THEN 1 ELSE 0 END
           ),
           fours = fours + (CASE WHEN v_ball.runs_scored = 4 THEN 1 ELSE 0 END),
           sixes = sixes + (CASE WHEN v_ball.runs_scored = 6 THEN 1 ELSE 0 END)
     WHERE innings_id = p_innings_id AND user_id = v_ball.batsman_id;

    -- ---- bowling stats ----
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
    v_extras_bonuses := v_extras_bonuses + (CASE WHEN v_ball.extra_type = 'bonus' THEN COALESCE(v_ball.extras, 0) ELSE 0 END);

    -- ---- partnerships ----
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

      UPDATE public.partnerships
         SET runs = v_partnership_runs, balls = v_partnership_balls, is_current = FALSE,
             end_over = ROUND(FLOOR(v_legal / v_bpo::numeric)::numeric + ((v_legal % v_bpo)::numeric / 10), 1),
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

    -- ---- over boundary evaluation ----
    v_over_just_ended := (v_is_legal AND v_legal % v_bpo = 0)
      OR (v_match.max_balls_per_over IS NOT NULL AND v_balls_in_current_over >= v_match.max_balls_per_over);

    IF v_over_just_ended THEN
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
           SELECT COALESCE(SUM(b.runs_scored + CASE WHEN b.extra_type IN ('bye','leg_bye','penalty','bonus') THEN 0 ELSE COALESCE(b.extras,0) END), 0)
           FROM public.ball_by_ball b
           WHERE b.innings_id = p_innings_id
             AND b.over_number = v_ball.over_number
         );
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

  UPDATE public.matches
     SET current_over = FLOOR(v_legal / v_bpo::numeric),
         current_ball = v_legal % v_bpo
   WHERE id = v_match_id;
END;
$function$;

-- 5. Update record_ball to support balls_per_over and bonus extra_type
DROP FUNCTION IF EXISTS public.record_ball(uuid, uuid, uuid, uuid, integer, integer, text, boolean, text, uuid, text, uuid, text);

CREATE OR REPLACE FUNCTION public.record_ball(
  p_match_id uuid,
  p_bowler_id uuid,
  p_batsman_id uuid,
  p_non_striker_id uuid,
  p_runs_scored integer DEFAULT 0,
  p_extras integer DEFAULT 0,
  p_extra_type text DEFAULT NULL::text,
  p_is_wicket boolean DEFAULT false,
  p_dismissal_type text DEFAULT NULL::text,
  p_fielder_id uuid DEFAULT NULL::uuid,
  p_commentary text DEFAULT NULL::text,
  p_dismissed_player_id uuid DEFAULT NULL::uuid,
  p_shot_zone text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match RECORD;
  v_innings RECORD;
  v_bpo INTEGER := 6;
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

  IF p_extra_type IS NOT NULL AND p_extra_type NOT IN ('wide', 'no_ball', 'bye', 'leg_bye', 'penalty', 'bonus') THEN
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

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;

  IF v_match IS NULL THEN
    RAISE EXCEPTION 'match_not_found' USING ERRCODE = '22000';
  END IF;
  IF v_match.status <> 'live' THEN
    RAISE EXCEPTION 'match_not_live' USING ERRCODE = '22000';
  END IF;

  IF v_match.balls_per_over IS NOT NULL THEN
    v_bpo := v_match.balls_per_over;
  END IF;

  v_prev_innings := v_match.current_innings;

  SELECT * INTO v_innings FROM public.innings
   WHERE match_id = p_match_id AND innings_number = v_match.current_innings;

  IF v_innings IS NULL OR v_innings.is_completed THEN
    RAISE EXCEPTION 'no_open_innings' USING ERRCODE = '22000';
  END IF;

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

  v_is_legal := p_extra_type IS NULL OR p_extra_type NOT IN ('wide', 'no_ball', 'bonus');

  v_over_no := FLOOR(v_innings.total_balls / v_bpo::numeric);
  v_delivery_no := (v_innings.total_balls % v_bpo) + 1;

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

  SELECT * INTO v_innings FROM public.innings WHERE id = v_innings.id;

  -- Auto-completion checks
  IF v_innings.innings_number = 2 AND v_innings.target_runs IS NOT NULL
     AND v_innings.total_runs >= v_innings.target_runs THEN
    PERFORM public._advance_after_innings(p_match_id, v_innings.id);
  ELSIF v_innings.total_wickets >= COALESCE(v_match.wickets_per_innings, 10) THEN
    PERFORM public._advance_after_innings(p_match_id, v_innings.id);
  ELSIF v_innings.total_balls >= v_match.overs_per_innings * v_bpo THEN
    PERFORM public._advance_after_innings(p_match_id, v_innings.id);
  END IF;

  v_state := public.record_state(p_match_id);

  IF (v_state->>'current_innings')::int <> v_prev_innings THEN
    v_state := jsonb_set(v_state, '{innings_break}', 'true'::jsonb);
  END IF;

  RETURN v_state;
END;
$function$;

-- 6. Update record_state to support balls_per_over
CREATE OR REPLACE FUNCTION public.record_state(p_match_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'ok', TRUE,
    'status', m.status,
    'current_innings', m.current_innings,
    'current_over', m.current_over,
    'current_ball', m.current_ball,
    'total_runs', i2.total_runs,
    'total_wickets', i2.total_wickets,
    'total_balls', i2.total_balls,
    'target_runs', i2.target_runs,
    'is_completed', i2.is_completed,
    'striker_id', s.user_id,
    'non_striker_id', ns.user_id,
    'striker_name', s.u_name,
    'non_striker_name', ns.u_name,
    'striker_runs', s.runs_scored,
    'striker_balls', s.balls_faced,
    'non_striker_runs', ns.runs_scored,
    'non_striker_balls', ns.balls_faced,
    'bowler_id', b.user_id,
    'bowler_name', b.u_name,
    'bowler_overs', b.overs_bowled,
    'bowler_maidens', b.maidens,
    'bowler_runs', b.runs_conceded,
    'bowler_wickets', b.wickets_taken,
    'last_bowler_id', last_b.bowler_id,
    'last_bowler_name', last_b.u_name,
    'last_bowler_overs', last_b.overs_bowled,
    'last_bowler_maidens', last_b.maidens,
    'last_bowler_runs', last_b.runs_conceded,
    'last_bowler_wickets', last_b.wickets_taken,
    'over_completed', (i2.total_balls > 0 AND i2.total_balls % COALESCE(m.balls_per_over, 6) = 0 AND NOT i2.is_completed AND m.status = 'live'),
    'last_over_bowler_id', CASE
      WHEN i2.total_balls > 0 AND i2.total_balls % COALESCE(m.balls_per_over, 6) = 0 THEN last_b.bowler_id
      WHEN FLOOR(i2.total_balls / COALESCE(m.balls_per_over, 6)::numeric) > 0 THEN (
        SELECT bbb2.bowler_id
        FROM public.ball_by_ball bbb2
        WHERE bbb2.innings_id = i2.id
          AND bbb2.over_number = FLOOR((i2.total_balls - 1) / COALESCE(m.balls_per_over, 6)::numeric) - 1
        ORDER BY bbb2.seq DESC
        LIMIT 1
      )
      ELSE NULL
    END,
    'needs_batsman', (SELECT COUNT(*) FROM public.batting_performances bp WHERE bp.innings_id = i2.id AND bp.is_current_batsman) < 2 AND NOT i2.is_completed AND m.status = 'live',
    'needs_bowler', NOT EXISTS (SELECT 1 FROM public.bowling_performances bp2 WHERE bp2.innings_id = i2.id AND bp2.is_current_bowler) AND NOT i2.is_completed AND m.status = 'live',
    'innings_completed', i2.is_completed,
    'match_completed', m.status = 'completed',
    'result_description', m.result_description
  )
  FROM public.matches m
  JOIN public.innings i2 ON i2.match_id = m.id AND i2.innings_number = m.current_innings
  LEFT JOIN LATERAL (
    SELECT bp.user_id, bp.runs_scored, bp.balls_faced, u.full_name AS u_name
    FROM public.batting_performances bp JOIN public.users u ON u.id = bp.user_id
    WHERE bp.innings_id = i2.id AND bp.is_current_batsman AND bp.is_striker
  ) s ON TRUE
  LEFT JOIN LATERAL (
    SELECT bp.user_id, bp.runs_scored, bp.balls_faced, u.full_name AS u_name
    FROM public.batting_performances bp JOIN public.users u ON u.id = bp.user_id
    WHERE bp.innings_id = i2.id AND bp.is_current_batsman AND NOT bp.is_striker
  ) ns ON TRUE
  LEFT JOIN LATERAL (
    SELECT bp.user_id, bp.overs_bowled, bp.maidens, bp.runs_conceded, bp.wickets_taken, u.full_name AS u_name
    FROM public.bowling_performances bp JOIN public.users u ON u.id = bp.user_id
    WHERE bp.innings_id = i2.id AND bp.is_current_bowler
  ) b ON TRUE
  LEFT JOIN LATERAL (
    SELECT bbb.bowler_id, bp.overs_bowled, bp.maidens, bp.runs_conceded, bp.wickets_taken, u.full_name AS u_name
    FROM public.ball_by_ball bbb
    JOIN public.bowling_performances bp ON bp.innings_id = i2.id AND bp.user_id = bbb.bowler_id
    JOIN public.users u ON u.id = bbb.bowler_id
    WHERE bbb.innings_id = i2.id
    ORDER BY bbb.seq DESC
    LIMIT 1
  ) last_b ON TRUE
  WHERE m.id = p_match_id;
$function$;
