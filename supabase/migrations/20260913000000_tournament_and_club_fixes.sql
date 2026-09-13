-- Migration: 20260913000000_tournament_and_club_fixes.sql
-- Fixes RLS for tournaments, registrations, standings, clubs, and memberships.
-- Implements automated tournament standings recalculation with ICC Net Run Rate rules.

-- 1. FIX is_club_admin TO RECOGNIZE CLUB CREATOR / OWNER
CREATE OR REPLACE FUNCTION public.is_club_admin(p_club_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = p_club_id AND owner_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = p_club_id 
    AND user_id = p_user_id 
    AND role IN ('owner', 'admin')
    AND status = 'active'
  );
$$;

-- 2. RLS POLICIES FOR TOURNAMENTS
DROP POLICY IF EXISTS "Anyone can view tournaments" ON public.tournaments;
CREATE POLICY "Anyone can view tournaments" ON public.tournaments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create tournaments" ON public.tournaments;
CREATE POLICY "Authenticated users can create tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = created_by
);

DROP POLICY IF EXISTS "Tournament creators and club admins can update tournaments" ON public.tournaments;
CREATE POLICY "Tournament creators and club admins can update tournaments" ON public.tournaments FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR (club_id IS NOT NULL AND public.is_club_admin(club_id))
);

DROP POLICY IF EXISTS "Tournament creators can delete tournaments" ON public.tournaments;
CREATE POLICY "Tournament creators can delete tournaments" ON public.tournaments FOR DELETE TO authenticated USING (
  created_by = auth.uid()
);

-- 3. RLS POLICIES FOR TOURNAMENT REGISTRATIONS
DROP POLICY IF EXISTS "Anyone can view tournament registrations" ON public.tournament_registrations;
CREATE POLICY "Anyone can view tournament registrations" ON public.tournament_registrations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can register teams to tournaments" ON public.tournament_registrations;
CREATE POLICY "Users can register teams to tournaments" ON public.tournament_registrations FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = registered_by
);

DROP POLICY IF EXISTS "Tournament creators and team contacts can update registrations" ON public.tournament_registrations;
CREATE POLICY "Tournament creators and team contacts can update registrations" ON public.tournament_registrations FOR UPDATE TO authenticated USING (
  registered_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND (t.created_by = auth.uid() OR (t.club_id IS NOT NULL AND public.is_club_admin(t.club_id))))
);

DROP POLICY IF EXISTS "Tournament creators and team contacts can delete registrations" ON public.tournament_registrations;
CREATE POLICY "Tournament creators and team contacts can delete registrations" ON public.tournament_registrations FOR DELETE TO authenticated USING (
  registered_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND (t.created_by = auth.uid() OR (t.club_id IS NOT NULL AND public.is_club_admin(t.club_id))))
);

-- 4. RLS POLICIES FOR TOURNAMENT STANDINGS
DROP POLICY IF EXISTS "Anyone can view tournament standings" ON public.tournament_standings;
CREATE POLICY "Anyone can view tournament standings" ON public.tournament_standings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert tournament standings" ON public.tournament_standings;
CREATE POLICY "Authenticated users can insert tournament standings" ON public.tournament_standings FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update tournament standings" ON public.tournament_standings;
CREATE POLICY "Authenticated users can update tournament standings" ON public.tournament_standings FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete tournament standings" ON public.tournament_standings;
CREATE POLICY "Authenticated users can delete tournament standings" ON public.tournament_standings FOR DELETE TO authenticated USING (true);

-- 5. RLS POLICIES FOR CLUB MEMBERSHIPS
DROP POLICY IF EXISTS "Club admins can manage memberships" ON public.club_memberships;
CREATE POLICY "Club admins can manage memberships" ON public.club_memberships FOR INSERT TO authenticated WITH CHECK (
  public.is_club_admin(club_id)
);

-- 6. AUTOMATED STANDINGS RECALCULATION FUNCTION
CREATE OR REPLACE FUNCTION public.recalculate_tournament_standings(p_tournament_id UUID)
RETURNS void
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
  v_points INTEGER;
  v_runs_scored INTEGER;
  v_runs_conceded INTEGER;
  v_overs_faced NUMERIC;
  v_overs_bowled NUMERIC;
  v_nrr NUMERIC;
  v_overs_faced_val NUMERIC;
  v_overs_bowled_val NUMERIC;

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
      -- Match stats
      SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE winning_team_id = v_team.team_id),
        COUNT(*) FILTER (WHERE winning_team_id IS NOT NULL AND winning_team_id <> v_team.team_id AND result_type = 'win'),
        COUNT(*) FILTER (WHERE result_type = 'tie'),
        COUNT(*) FILTER (WHERE result_type IN ('no_result', 'abandoned'))
      INTO v_matches_played, v_wins, v_losses, v_ties, v_no_results
      FROM public.matches
      WHERE tournament_id = p_tournament_id
        AND status = 'completed'
        AND (team1_id = v_team.team_id OR team2_id = v_team.team_id);

      v_points := (v_wins * 2) + (v_ties * 1) + (v_no_results * 1);
      v_runs_scored := 0;
      v_runs_conceded := 0;
      v_overs_faced := 0.0;
      v_overs_bowled := 0.0;

      -- Calculate batting (runs scored & overs faced)
      FOR v_inn IN (
        SELECT i.total_runs, i.total_wickets, i.total_balls, m.overs_per_innings
        FROM public.innings i
        JOIN public.matches m ON m.id = i.match_id
        WHERE m.tournament_id = p_tournament_id
          AND m.status = 'completed'
          AND i.team_id = v_team.team_id
      ) LOOP
        v_runs_scored := v_runs_scored + COALESCE(v_inn.total_runs, 0);
        -- If all out (>= 10 wickets), count full innings overs quota
        IF COALESCE(v_inn.total_wickets, 0) >= 10 THEN
          v_overs_faced := v_overs_faced + COALESCE(v_inn.overs_per_innings, 20)::numeric;
        ELSE
          v_overs_faced := v_overs_faced + (COALESCE(v_inn.total_balls, 0) / 6) + ((COALESCE(v_inn.total_balls, 0) % 6)::numeric / 6.0);
        END IF;
      END LOOP;

      -- Calculate bowling (runs conceded & overs bowled)
      FOR v_inn IN (
        SELECT i.total_runs, i.total_wickets, i.total_balls, m.overs_per_innings
        FROM public.innings i
        JOIN public.matches m ON m.id = i.match_id
        WHERE m.tournament_id = p_tournament_id
          AND m.status = 'completed'
          AND i.team_id <> v_team.team_id
          AND (m.team1_id = v_team.team_id OR m.team2_id = v_team.team_id)
      ) LOOP
        v_runs_conceded := v_runs_conceded + COALESCE(v_inn.total_runs, 0);
        IF COALESCE(v_inn.total_wickets, 0) >= 10 THEN
          v_overs_bowled := v_overs_bowled + COALESCE(v_inn.overs_per_innings, 20)::numeric;
        ELSE
          v_overs_bowled := v_overs_bowled + (COALESCE(v_inn.total_balls, 0) / 6) + ((COALESCE(v_inn.total_balls, 0) % 6)::numeric / 6.0);
        END IF;
      END LOOP;

      -- Calculate NRR
      IF v_overs_faced > 0 AND v_overs_bowled > 0 THEN
        v_nrr := ROUND(((v_runs_scored::numeric / v_overs_faced) - (v_runs_conceded::numeric / v_overs_bowled)), 2);
      ELSE
        v_nrr := 0.00;
      END IF;

      -- Format overs for display columns (e.g. 19.4 overs)
      v_overs_faced_val := ROUND(v_overs_faced, 1);
      v_overs_bowled_val := ROUND(v_overs_bowled, 1);

      -- Upsert standings row
      INSERT INTO public.tournament_standings (
        tournament_id, team_id, matches_played, wins, losses, ties, no_results, points,
        runs_scored, runs_conceded, overs_faced, overs_bowled, net_run_rate, updated_at
      ) VALUES (
        p_tournament_id, v_team.team_id, v_matches_played, v_wins, v_losses, v_ties, v_no_results, v_points,
        v_runs_scored, v_runs_conceded, v_overs_faced_val, v_overs_bowled_val, v_nrr, NOW()
      )
      ON CONFLICT (tournament_id, team_id) DO UPDATE SET
        matches_played = EXCLUDED.matches_played,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        ties = EXCLUDED.ties,
        no_results = EXCLUDED.no_results,
        points = EXCLUDED.points,
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

-- 7. TRIGGER ON MATCHES TO AUTO-RECALCULATE STANDINGS ON COMPLETION
CREATE OR REPLACE FUNCTION public.trigger_recalculate_tournament_standings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tournament_id IS NOT NULL AND (NEW.status = 'completed' OR (OLD IS NOT NULL AND OLD.status = 'completed')) THEN
    PERFORM public.recalculate_tournament_standings(NEW.tournament_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matches_recalc_standings ON public.matches;
CREATE TRIGGER trg_matches_recalc_standings
AFTER INSERT OR UPDATE OF status, winning_team_id, result_type ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalculate_tournament_standings();

-- Recalculate standings for any existing ongoing tournaments with completed matches
DO $$
DECLARE
  v_tourn RECORD;
BEGIN
  FOR v_tourn IN SELECT id FROM public.tournaments LOOP
    PERFORM public.recalculate_tournament_standings(v_tourn.id);
  END LOOP;
END;
$$;
