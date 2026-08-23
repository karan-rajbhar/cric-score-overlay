-- ============================================================================
-- SCORING ENGINE MIGRATION
-- 1. Atomic record_ball() RPC: inserts ball + recomputes all projections
--    (innings totals, batting/bowling figures, partnerships, FOW, strike
--    rotation, over progression) in ONE transaction. ball_by_ball is the
--    append-only source of truth; everything else is derived.
-- 2. undo_last_ball(): delete last delivery + deterministic recompute.
-- 3. set_current_batsmen()/set_current_bowler(): persist who is batting/
--    bowling (previously lived only in React state).
-- 4. end_innings(): shared completion logic (create 2nd innings w/ target,
--    or finalize match result).
-- 5. live_match_state view: single denormalized read model for overlays.
-- 6. Realtime publication: expose scoring tables to postgres_changes.
-- 7. Constraint fixes: deliveries per over can exceed 6 (wides/no-balls),
--    innings numbering relaxed beyond 2.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Deterministic delivery ordering
-- created_at uses NOW() (transaction time) so balls recorded in the same
-- transaction can share a timestamp. A monotonic sequence gives replay a
-- stable, gap-free order.
-- ---------------------------------------------------------------------------

CREATE SEQUENCE public.ball_by_ball_seq_seq;

ALTER TABLE public.ball_by_ball
  ADD COLUMN seq BIGINT NOT NULL DEFAULT nextval('public.ball_by_ball_seq_seq');

ALTER SEQUENCE public.ball_by_ball_seq_seq OWNED BY public.ball_by_ball.seq;

-- Backfill existing rows in their original (timestamp, id) order.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.ball_by_ball
)
UPDATE public.ball_by_ball b SET seq = ranked.rn FROM ranked WHERE ranked.id = b.id;

CREATE INDEX idx_ball_by_ball_innings_seq ON public.ball_by_ball (innings_id, seq);

-- ---------------------------------------------------------------------------
-- Constraint fixes
-- ---------------------------------------------------------------------------

-- A wide/no-ball is a delivery but not a legal ball; an over can contain
-- more than 6 deliveries. Allow up to 20 deliveries per over.
ALTER TABLE public.ball_by_ball
  DROP CONSTRAINT IF EXISTS ball_by_ball_ball_number_check;
ALTER TABLE public.ball_by_ball
  ADD CONSTRAINT ball_by_ball_ball_number_check CHECK (ball_number BETWEEN 1 AND 20);

-- Support formats beyond two innings (Super Over, multi-innings fixtures).
ALTER TABLE public.innings
  DROP CONSTRAINT IF EXISTS innings_innings_number_check;
ALTER TABLE public.innings
  ADD CONSTRAINT innings_innings_number_check CHECK (innings_number BETWEEN 1 AND 9);

-- ---------------------------------------------------------------------------
-- updated_at touch triggers
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS moddatetime;

DROP TRIGGER IF EXISTS touches_updated_at ON public.matches;
CREATE TRIGGER touches_updated_at BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

DROP TRIGGER IF EXISTS touches_updated_at ON public.innings;
CREATE TRIGGER touches_updated_at BEFORE UPDATE ON public.innings
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

DROP TRIGGER IF EXISTS touches_updated_at ON public.batting_performances;
CREATE TRIGGER touches_updated_at BEFORE UPDATE ON public.batting_performances
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

DROP TRIGGER IF EXISTS touches_updated_at ON public.bowling_performances;
CREATE TRIGGER touches_updated_at BEFORE UPDATE ON public.bowling_performances
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

DROP TRIGGER IF EXISTS touches_updated_at ON public.partnerships;
CREATE TRIGGER touches_updated_at BEFORE UPDATE ON public.partnerships
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- Replay engine: rebuild every projection of an innings from its ball log
-- ---------------------------------------------------------------------------

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

  -- Reset derived state for this innings (performance ROWS are kept; only
  -- aggregates and flags are rebuilt from the ball log).
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
    UPDATE public.batting_performances
       SET runs_scored = runs_scored + COALESCE(v_ball.runs_scored, 0),
           balls_faced = balls_faced + (CASE WHEN v_is_legal THEN 1 ELSE 0 END),
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
                   AND COALESCE(v_ball.dismissal_type, '') NOT IN ('run_out', 'retired_hurt', 'retired_out')
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
              ROUND((v_legal - (CASE WHEN v_is_legal THEN 1 ELSE 0 END))::numeric / 10, 1), TRUE)
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
             end_over = ROUND(v_legal::numeric / 10, 1)
       WHERE id = v_partnership_id;

      INSERT INTO public.partnerships (match_id, innings_id, batsman1_id, batsman2_id, runs, balls, start_over, is_current)
      VALUES (v_match_id, p_innings_id, v_ball.batsman_id, v_ball.non_striker_id, 0, 0,
              ROUND((v_legal - (CASE WHEN v_is_legal THEN 1 ELSE 0 END))::numeric / 10, 1), TRUE)
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

      INSERT INTO public.fall_of_wickets
        (match_id, innings_id, wicket_number, runs_at_fall, overs_at_fall,
         batsman_out_id, dismissal_type, bowler_id, fielder_id)
      VALUES
        (v_match_id, p_innings_id, v_wicket_no, v_total_runs,
         ROUND(v_legal::numeric / 10, 1), v_ball.batsman_id,
         COALESCE(v_ball.dismissal_type, 'bowled'), v_ball.bowler_id, v_ball.fielder_id);

      IF COALESCE(v_ball.dismissal_type, '') <> 'retired_hurt' THEN
        UPDATE public.batting_performances
           SET is_out = TRUE, dismissal_type = v_ball.dismissal_type,
               bowler_id = v_ball.bowler_id, fielder_id = v_ball.fielder_id,
               is_current_batsman = FALSE, is_striker = FALSE
         WHERE innings_id = p_innings_id AND user_id = v_ball.batsman_id;
      END IF;

      UPDATE public.partnerships
         SET runs = v_partnership_runs, balls = v_partnership_balls, is_current = FALSE,
             end_over = ROUND(v_legal::numeric / 10, 1),
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
      -- Striker is out; survivor stays put. New batsman comes in later via
      -- set_current_batsmen().
      v_final_striker := v_ball.non_striker_id;
      v_final_non_striker := NULL;
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
      -- Over boundary: force a new bowler to be selected before the next
      -- delivery can be recorded.
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

-- ---------------------------------------------------------------------------
-- Innings/match completion transitions (shared by record_ball & end_innings)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._advance_after_innings(p_match_id UUID, p_completed_innings_id UUID)
RETURNS void
LANGUAGE plpgsql
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
      SELECT team1_id INTO v_winner FROM public.matches WHERE id = p_match_id;
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

-- Small helper kept separate so _advance_after_innings can log events even
-- when the events table lacks convenient defaults.
CREATE OR REPLACE FUNCTION public.match_events_insert(
  p_match_id UUID, p_event_type TEXT, p_event_data JSONB DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.match_events (match_id, event_type, event_data)
  VALUES (p_match_id, p_event_type, p_event_data);
$$;

-- ---------------------------------------------------------------------------
-- Current players management
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_current_batsmen(
  p_match_id UUID, p_striker_id UUID, p_non_striker_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_innings_id UUID;
  v_batting_team UUID;
  v_next_pos INTEGER;
BEGIN
  IF NOT public.is_match_admin(p_match_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_striker_id = p_non_striker_id THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22000';
  END IF;

  SELECT i.id, i.team_id INTO v_innings_id, v_batting_team
  FROM public.innings i
  JOIN public.matches m ON m.id = i.match_id
  WHERE i.match_id = p_match_id AND i.innings_number = m.current_innings;

  IF v_innings_id IS NULL THEN
    RAISE EXCEPTION 'no_open_innings' USING ERRCODE = '22000';
  END IF;

  -- Both players must be on the batting team's roster.
  IF NOT EXISTS (
    SELECT 1 FROM public.team_players tp
    WHERE tp.team_id = v_batting_team AND tp.user_id = p_striker_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.team_players tp
    WHERE tp.team_id = v_batting_team AND tp.user_id = p_non_striker_id
  ) THEN
    RAISE EXCEPTION 'player_not_in_batting_team' USING ERRCODE = '22000';
  END IF;

  -- A player cannot return after being dismissed.
  IF EXISTS (
    SELECT 1 FROM public.batting_performances bp
    WHERE bp.innings_id = v_innings_id AND bp.is_out
      AND bp.user_id IN (p_striker_id, p_non_striker_id)
  ) THEN
    RAISE EXCEPTION 'player_already_out' USING ERRCODE = '22000';
  END IF;

  -- At most 11 batsmen may bat.
  IF (
    SELECT COUNT(DISTINCT user_id) FROM public.batting_performances
    WHERE innings_id = v_innings_id
  ) >= 11 AND NOT EXISTS (
    SELECT 1 FROM public.batting_performances
    WHERE innings_id = v_innings_id AND user_id IN (p_striker_id, p_non_striker_id)
  ) THEN
    RAISE EXCEPTION 'too_many_batsmen' USING ERRCODE = '22000';
  END IF;

  SELECT COALESCE(MAX(batting_position), 0) INTO v_next_pos
  FROM public.batting_performances WHERE innings_id = v_innings_id;

  -- Lazily create performance rows for both batsmen, then set flags.
  INSERT INTO public.batting_performances (match_id, innings_id, user_id, batting_position)
  SELECT p_match_id, v_innings_id, u.id, v_next_pos + ROW_NUMBER() OVER (ORDER BY u.id)
  FROM (VALUES (p_striker_id), (p_non_striker_id)) AS u(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.batting_performances bp
    WHERE bp.innings_id = v_innings_id AND bp.user_id = u.id
  );

  -- An out batsman keeps is_out but loses current flags; ensure the new
  -- batsman row is marked not-out.
  UPDATE public.batting_performances
     SET is_current_batsman = FALSE, is_striker = FALSE
   WHERE innings_id = v_innings_id;

  UPDATE public.batting_performances
     SET is_current_batsman = TRUE, is_striker = TRUE
   WHERE innings_id = v_innings_id AND user_id = p_striker_id;

  UPDATE public.batting_performances
     SET is_current_batsman = TRUE, is_striker = FALSE
   WHERE innings_id = v_innings_id AND user_id = p_non_striker_id;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_current_bowler(
  p_match_id UUID, p_bowler_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_innings_id UUID;
  v_balls_already INTEGER;
BEGIN
  IF NOT public.is_match_admin(p_match_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT i.id INTO v_innings_id
  FROM public.innings i
  JOIN public.matches m ON m.id = i.match_id
  WHERE i.match_id = p_match_id AND i.innings_number = m.current_innings;

  IF v_innings_id IS NULL THEN
    RAISE EXCEPTION 'no_open_innings' USING ERRCODE = '22000';
  END IF;

  -- Back-to-back overs are not allowed.
  SELECT COUNT(*) INTO v_balls_already
  FROM public.ball_by_ball
  WHERE innings_id = v_innings_id AND bowler_id = p_bowler_id
    AND over_number = (SELECT MAX(over_number) FROM public.ball_by_ball WHERE innings_id = v_innings_id);
  IF v_balls_already >= 6 THEN
    RAISE EXCEPTION 'same_bowler_next_over' USING ERRCODE = '22000';
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

-- ---------------------------------------------------------------------------
-- Atomic ball recording
-- ---------------------------------------------------------------------------

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
  p_commentary TEXT DEFAULT NULL
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
BEGIN
  IF NOT public.is_match_admin(p_match_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_extra_type IS NOT NULL AND p_extra_type NOT IN ('wide', 'no_ball', 'bye', 'leg_bye', 'penalty') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22000';
  END IF;
  IF p_is_wicket AND p_dismissal_type IS NOT NULL
     AND p_dismissal_type NOT IN ('bowled', 'caught', 'lbw', 'stumped', 'run_out', 'hit_wicket', 'obstructing', 'timed_out', 'handled_ball') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22000';
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
     is_wicket, dismissal_type, fielder_id, commentary)
  VALUES
    (p_match_id, v_innings.id, v_over_no, v_delivery_no,
     p_bowler_id, p_batsman_id, p_non_striker_id,
     COALESCE(p_runs_scored, 0), COALESCE(p_extras, 0), p_extra_type,
     COALESCE(p_is_wicket, FALSE), p_dismissal_type, p_fielder_id, p_commentary);

  PERFORM public.recompute_innings(v_innings.id);

  -- Log notable events for the timeline feed.
  IF p_is_wicket THEN
    PERFORM public.match_events_insert(p_match_id, 'wicket',
      jsonb_build_object('batsman', p_batsman_id, 'dismissal', p_dismissal_type, 'over', v_over_no));
  ELSIF p_runs_scored = 4 THEN
    PERFORM public.match_events_insert(p_match_id, 'boundary',
      jsonb_build_object('batsman', p_batsman_id, 'runs', 4, 'over', v_over_no));
  ELSIF p_runs_scored = 6 THEN
    PERFORM public.match_events_insert(p_match_id, 'six',
      jsonb_build_object('batsman', p_batsman_id, 'runs', 6, 'over', v_over_no));
  END IF;

  -- Re-read post-recompute state and apply automatic transitions.
  SELECT * INTO v_innings FROM public.innings WHERE id = v_innings.id;

  IF v_innings.is_completed = FALSE THEN
    DECLARE
      v_target_reached BOOLEAN := v_innings.target_runs IS NOT NULL AND v_innings.total_runs >= v_innings.target_runs;
      v_all_out BOOLEAN := v_innings.total_wickets >= 10;
      v_overs_done BOOLEAN := v_innings.total_balls >= v_match.overs_per_innings * 6;
    BEGIN
      IF v_target_reached OR v_all_out OR v_overs_done THEN
        PERFORM public._advance_after_innings(p_match_id, v_innings.id);
        IF v_all_out OR v_overs_done THEN
          PERFORM public.match_events_insert(p_match_id, 'innings_end',
            jsonb_build_object('innings', v_innings.innings_number, 'runs', v_innings.total_runs, 'wickets', v_innings.total_wickets));
        END IF;
      END IF;
    END;
  END IF;

  -- Build the response state for the client.
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
    'needs_batsman', (SELECT COUNT(*) FROM public.batting_performances bp WHERE bp.innings_id = i2.id AND bp.is_current_batsman) < 2 AND NOT i2.is_completed AND m.status = 'live',
    'needs_bowler', NOT EXISTS (SELECT 1 FROM public.bowling_performances bp2 WHERE bp2.innings_id = i2.id AND bp2.is_current_bowler) AND NOT i2.is_completed AND m.status = 'live',
    'innings_completed', i2.is_completed,
    'match_completed', m.status = 'completed',
    'result_description', m.result_description,
    'innings_break', v_prev_innings <> m.current_innings
  )
  INTO v_state
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
  WHERE m.id = p_match_id;

  RETURN v_state;
END;
$$;

-- ---------------------------------------------------------------------------
-- Undo: remove the most recent delivery and rebuild projections
-- ---------------------------------------------------------------------------

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
  IF v_match.status = 'completed' THEN
    RAISE EXCEPTION 'match_completed' USING ERRCODE = '22000';
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

-- Read-only snapshot of current state, shared by undo/set operations.
CREATE OR REPLACE FUNCTION public.record_state(p_match_id UUID)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE m.id = p_match_id;
$$;

-- Manual innings completion (declarations / early finishes).
CREATE OR REPLACE FUNCTION public.end_innings(p_match_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_innings RECORD;
BEGIN
  IF NOT public.is_match_admin(p_match_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_innings FROM public.innings
   WHERE match_id = p_match_id
     AND innings_number = (SELECT current_innings FROM public.matches WHERE id = p_match_id);

  IF v_innings IS NULL OR v_innings.is_completed THEN
    RAISE EXCEPTION 'no_open_innings' USING ERRCODE = '22000';
  END IF;

  UPDATE public.innings SET is_completed = TRUE WHERE id = v_innings.id;
  PERFORM public._advance_after_innings(p_match_id, v_innings.id);

  RETURN public.record_state(p_match_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- live_match_state: single denormalized read model for overlays/live pages
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.live_match_state
WITH (security_invoker = true) AS
SELECT
  m.id                                AS match_id,
  m.title,
  m.status,
  m.match_format,
  m.overs_per_innings,
  m.venue,
  m.current_innings,
  m.current_over,
  m.current_ball,
  m.result_type,
  m.result_description,
  t1.name                             AS team1_name,
  t1.short_name                       AS team1_short_name,
  t2.name                             AS team2_name,
  t2.short_name                       AS team2_short_name,
  wt.name                             AS winning_team_name,
  ci.innings_number,
  ci.total_runs,
  ci.total_wickets,
  ci.total_overs,
  ci.total_balls,
  ci.extras_total,
  ci.is_completed                     AS innings_completed,
  ci.target_runs,
  bt.name                             AS batting_team_name,
  bt.short_name                       AS batting_team_short_name,
  bl.name                             AS bowling_team_name,
  bl.short_name                       AS bowling_team_short_name,
  striker.full_name                   AS striker_name,
  striker_stats.runs_scored           AS striker_runs,
  striker_stats.balls_faced           AS striker_balls,
  non_striker.full_name               AS non_striker_name,
  non_striker_stats.runs_scored       AS non_striker_runs,
  non_striker_stats.balls_faced       AS non_striker_balls,
  bowler.full_name                    AS current_bowler_name,
  bowler_stats.balls_bowled           AS bowler_balls,
  bowler_stats.runs_conceded          AS bowler_runs,
  bowler_stats.wickets_taken          AS bowler_wickets,
  p.runs                              AS partnership_runs,
  p.balls                             AS partnership_balls,
  this_over.balls_text                AS this_over_balls,
  CASE WHEN ci.total_balls > 0
       THEN ROUND(ci.total_runs::numeric * 6 / ci.total_balls, 2) END
                                      AS current_run_rate,
  CASE WHEN ci.target_runs IS NOT NULL AND ci.is_completed = FALSE
       THEN ci.target_runs - ci.total_runs END
                                      AS runs_needed,
  CASE WHEN ci.target_runs IS NOT NULL AND ci.is_completed = FALSE
       THEN GREATEST(m.overs_per_innings * 6 - ci.total_balls, 0) END
                                      AS balls_remaining,
  CASE WHEN ci.target_runs IS NOT NULL AND ci.is_completed = FALSE
        AND (m.overs_per_innings * 6 - ci.total_balls) > 0
       THEN ROUND(((ci.target_runs - ci.total_runs)::numeric * 6)
                  / (m.overs_per_innings * 6 - ci.total_balls), 2) END
                                      AS required_run_rate
FROM public.matches m
JOIN public.teams t1 ON t1.id = m.team1_id
JOIN public.teams t2 ON t2.id = m.team2_id
LEFT JOIN public.teams wt ON wt.id = m.winning_team_id
LEFT JOIN LATERAL (
  SELECT i.* FROM public.innings i
  WHERE i.match_id = m.id AND i.innings_number = m.current_innings
) ci ON TRUE
LEFT JOIN public.teams bt ON bt.id = ci.team_id
LEFT JOIN LATERAL (
  SELECT t.id, t.name, t.short_name FROM public.teams t
  WHERE m.status = 'live'
    AND t.id = CASE WHEN ci.team_id = m.team1_id THEN m.team2_id ELSE m.team1_id END
) bl ON TRUE
LEFT JOIN LATERAL (
  SELECT u.full_name FROM public.batting_performances bp
  JOIN public.users u ON u.id = bp.user_id
  WHERE bp.innings_id = ci.id AND bp.is_current_batsman AND bp.is_striker
) striker ON TRUE
LEFT JOIN LATERAL (
  SELECT bp.runs_scored, bp.balls_faced FROM public.batting_performances bp
  WHERE bp.innings_id = ci.id AND bp.is_current_batsman AND bp.is_striker
) striker_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT u.full_name FROM public.batting_performances bp
  JOIN public.users u ON u.id = bp.user_id
  WHERE bp.innings_id = ci.id AND bp.is_current_batsman AND NOT bp.is_striker
) non_striker ON TRUE
LEFT JOIN LATERAL (
  SELECT bp.runs_scored, bp.balls_faced FROM public.batting_performances bp
  WHERE bp.innings_id = ci.id AND bp.is_current_batsman AND NOT bp.is_striker
) non_striker_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT u.full_name FROM public.bowling_performances wp
  JOIN public.users u ON u.id = wp.user_id
  WHERE wp.innings_id = ci.id AND wp.is_current_bowler
) bowler ON TRUE
LEFT JOIN LATERAL (
  SELECT wp.balls_bowled, wp.runs_conceded, wp.wickets_taken
  FROM public.bowling_performances wp
  WHERE wp.innings_id = ci.id AND wp.is_current_bowler
) bowler_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT pa.runs, pa.balls FROM public.partnerships pa
  WHERE pa.innings_id = ci.id AND pa.is_current
) p ON TRUE
LEFT JOIN LATERAL (
  SELECT string_agg(
    CASE
      WHEN b.is_wicket THEN 'W'
      WHEN b.extra_type = 'wide' THEN COALESCE(NULLIF(b.runs_scored, 0)::text || '+wd', 'wd')
      WHEN b.extra_type = 'no_ball' THEN COALESCE(NULLIF(b.runs_scored, 0)::text || '+nb', 'nb')
      ELSE b.runs_scored::text
    END, ' '
    ORDER BY b.created_at, b.id
  ) AS balls_text
  FROM public.ball_by_ball b
  WHERE b.innings_id = ci.id
    AND b.over_number = FLOOR(ci.total_balls / 6.0)
) this_over ON TRUE;

-- ---------------------------------------------------------------------------
-- Realtime publication: let postgres_changes stream these tables
-- ---------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.innings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ball_by_ball;
ALTER PUBLICATION supabase_realtime ADD TABLE public.batting_performances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bowling_performances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.partnerships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fall_of_wickets;

-- ---------------------------------------------------------------------------
-- Privileges: scoring mutations are for authenticated match admins only
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.record_ball(UUID, UUID, UUID, UUID, INTEGER, INTEGER, TEXT, BOOLEAN, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ball(UUID, UUID, UUID, UUID, INTEGER, INTEGER, TEXT, BOOLEAN, TEXT, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.undo_last_ball(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_last_ball(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.end_innings(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_innings(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.set_current_batsmen(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_current_batsmen(UUID, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.set_current_bowler(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_current_bowler(UUID, UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.record_state(UUID) TO authenticated, anon;

GRANT SELECT ON public.live_match_state TO anon, authenticated;

-- The base migration defined public-read RLS policies but never issued the
-- table-level GRANTs PostgREST requires, so every client-side query failed
-- with "permission denied". Mirror the RLS policy intents here.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Client-side writes that are governed by existing RLS policies
-- (createMatch / startMatch / team management). Ball-level scoring goes
-- exclusively through the SECURITY DEFINER functions above.
GRANT INSERT, UPDATE ON public.matches, public.innings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teams, public.team_players, public.clubs, public.club_memberships TO authenticated;
GRANT INSERT, UPDATE ON public.users TO authenticated;
GRANT INSERT ON public.notifications TO authenticated;

-- ---------------------------------------------------------------------------
-- Profile bootstrap
-- The client used to INSERT into users on SIGNED_IN; any RLS/grant slip or
-- event-timing hiccup silently broke every later action for that user
-- (matches.created_by FK). This definer function makes self-provisioning
-- idempotent and independent of client privileges.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_own_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_claim JSONB := COALESCE(
    NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb,
    '{}'::jsonb
  );
  v_meta JSONB := COALESCE(v_claim->'raw_user_meta_data', '{}'::jsonb);
  v_email TEXT := NULLIF(v_claim->>'email', '');
  v_phone TEXT := NULLIF(v_claim->>'phone', '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- The users table requires an email or phone; synthesize a stable
  -- placeholder when neither claim is present (e.g. anonymous-ish tokens).
  IF v_email IS NULL AND v_phone IS NULL THEN
    v_email := 'player-' || left(v_uid::text, 8) || '@players.local';
  END IF;

  INSERT INTO public.users (id, email, phone, full_name, avatar_url)
  VALUES (
    v_uid,
    v_email,
    v_phone,
    COALESCE(NULLIF(v_meta->>'full_name', ''), NULLIF(v_meta->>'name', ''),
             COALESCE(v_email, v_phone, 'Player')),
    NULLIF(v_meta->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('ok', TRUE, 'user_id', v_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_own_profile() TO authenticated;
