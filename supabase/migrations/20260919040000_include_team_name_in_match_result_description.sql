-- Migration: Include winning team name in match result description
-- Fixes issue where matches only displayed "Won by 9 wickets" without indicating who won.

CREATE OR REPLACE FUNCTION public.complete_innings(
  p_match_id UUID,
  p_completed_innings_id UUID
)
RETURNS VOID
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
  v_winner_name TEXT;
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
      SELECT name INTO v_winner_name FROM public.teams WHERE id = v_winner;
      v_description := format('%s won by %s %s', COALESCE(v_winner_name, 'Team'), v_margin, CASE WHEN v_margin = 1 THEN 'wicket' ELSE 'wickets' END);
    ELSIF v_i1_runs > v_innings_runs THEN
      -- Team batting in 1st innings defended their score
      SELECT team_id INTO v_winner FROM public.innings
       WHERE match_id = p_match_id AND innings_number = 1;
      v_margin_type := 'runs';
      v_margin := v_i1_runs - v_innings_runs;
      SELECT name INTO v_winner_name FROM public.teams WHERE id = v_winner;
      v_description := format('%s won by %s %s', COALESCE(v_winner_name, 'Team'), v_margin, CASE WHEN v_margin = 1 THEN 'run' ELSE 'runs' END);
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

-- Retroactively fix any existing matches where result_description lacks team name
UPDATE public.matches m
SET result_description = format('%s %s', t.name, lower(m.result_description))
FROM public.teams t
WHERE m.winning_team_id = t.id
  AND m.result_description ILIKE 'Won by %';
