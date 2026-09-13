-- Migration: 20260913010000_stumps_complete_features.sql
-- Completes all Stumps-grade features: Player of the Match, Custom Rules, Shot Zone, Points Override & Qualification, Seasons, Hall of Fame, and Social Links.

-- 1. EXTEND MATCHES AND TOURNAMENTS SCHEMA
ALTER TABLE public.matches 
  ADD COLUMN IF NOT EXISTS player_of_the_match_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wickets_per_innings INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS last_man_stands BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS golden_ball BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS season_id UUID;

CREATE INDEX IF NOT EXISTS idx_matches_potm ON public.matches(player_of_the_match_id);
CREATE INDEX IF NOT EXISTS idx_matches_season ON public.matches(season_id);

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS wickets_per_innings INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS last_man_stands BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS golden_ball BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS season_id UUID;

CREATE INDEX IF NOT EXISTS idx_tournaments_season ON public.tournaments(season_id);

-- 2. EXTEND BALL_BY_BALL SCHEMA FOR WAGON WHEEL & SHOT ZONES
ALTER TABLE public.ball_by_ball
  ADD COLUMN IF NOT EXISTS shot_zone TEXT;

-- 3. EXTEND CLUBS SCHEMA FOR SOCIAL LINKS
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;

-- 4. EXTEND TOURNAMENT STANDINGS FOR POINTS OVERRIDE AND QUALIFICATION STATUS
ALTER TABLE public.tournament_standings
  ALTER COLUMN points TYPE NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS points_adjustment NUMERIC(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS adjustment_reason TEXT,
  ADD COLUMN IF NOT EXISTS qualification_status TEXT DEFAULT 'in_contention';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tournament_standings_qualification_status_check'
  ) THEN
    ALTER TABLE public.tournament_standings
      ADD CONSTRAINT tournament_standings_qualification_status_check 
      CHECK (qualification_status IN ('in_contention', 'qualified', 'eliminated'));
  END IF;
END $$;

-- 5. CREATE CLUB_SEASONS TABLE
CREATE TABLE IF NOT EXISTS public.club_seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_seasons_club ON public.club_seasons(club_id);

-- Link foreign keys now that club_seasons exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_season_id_fkey') THEN
    ALTER TABLE public.matches ADD CONSTRAINT matches_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.club_seasons(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_season_id_fkey') THEN
    ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.club_seasons(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. CREATE CLUB_HALL_OF_FAME TABLE
CREATE TABLE IF NOT EXISTS public.club_hall_of_fame (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- e.g. 'legend', 'top_scorer', 'top_wicket_taker', 'champion', 'record'
  title TEXT NOT NULL,
  description TEXT,
  season_or_year TEXT,
  record_metric TEXT, -- e.g. '1,420 Runs @ 54.6'
  inducted_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_club_hall_of_fame_club ON public.club_hall_of_fame(club_id);
CREATE INDEX IF NOT EXISTS idx_club_hall_of_fame_player ON public.club_hall_of_fame(player_id);

-- 7. RLS POLICIES FOR CLUB_SEASONS & CLUB_HALL_OF_FAME
ALTER TABLE public.club_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_hall_of_fame ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view club seasons" ON public.club_seasons;
CREATE POLICY "Anyone can view club seasons" ON public.club_seasons
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Club admins can insert club seasons" ON public.club_seasons;
CREATE POLICY "Club admins can insert club seasons" ON public.club_seasons
  FOR INSERT WITH CHECK (public.is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can update club seasons" ON public.club_seasons;
CREATE POLICY "Club admins can update club seasons" ON public.club_seasons
  FOR UPDATE USING (public.is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can delete club seasons" ON public.club_seasons;
CREATE POLICY "Club admins can delete club seasons" ON public.club_seasons
  FOR DELETE USING (public.is_club_admin(club_id));

DROP POLICY IF EXISTS "Anyone can view club hall of fame" ON public.club_hall_of_fame;
CREATE POLICY "Anyone can view club hall of fame" ON public.club_hall_of_fame
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Club admins can insert club hall of fame" ON public.club_hall_of_fame;
CREATE POLICY "Club admins can insert club hall of fame" ON public.club_hall_of_fame
  FOR INSERT WITH CHECK (public.is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can update club hall of fame" ON public.club_hall_of_fame;
CREATE POLICY "Club admins can update club hall of fame" ON public.club_hall_of_fame
  FOR UPDATE USING (public.is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can delete club hall of fame" ON public.club_hall_of_fame;
CREATE POLICY "Club admins can delete club hall of fame" ON public.club_hall_of_fame
  FOR DELETE USING (public.is_club_admin(club_id));

-- 8. UPDATE RECALCULATE_TOURNAMENT_STANDINGS FUNCTION
-- Preserves points_adjustment and respects custom wickets_per_innings
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

      v_base_points := (v_wins * 2.0) + (v_ties * 1.0) + (v_no_results * 1.0);
      v_final_points := v_base_points + v_current_adj;
      v_runs_scored := 0;
      v_runs_conceded := 0;
      v_overs_faced := 0.0;
      v_overs_bowled := 0.0;

      -- Calculate batting (runs scored & overs faced)
      FOR v_inn IN (
        SELECT i.total_runs, i.total_wickets, i.total_balls, m.overs_per_innings, COALESCE(m.wickets_per_innings, 10) as wickets_cap
        FROM public.innings i
        JOIN public.matches m ON m.id = i.match_id
        WHERE m.tournament_id = p_tournament_id
          AND m.status = 'completed'
          AND i.team_id = v_team.team_id
      ) LOOP
        v_runs_scored := v_runs_scored + COALESCE(v_inn.total_runs, 0);
        -- If all out (>= wickets_cap), count full innings overs quota
        IF COALESCE(v_inn.total_wickets, 0) >= v_inn.wickets_cap THEN
          v_overs_faced := v_overs_faced + COALESCE(v_inn.overs_per_innings, 20)::numeric;
        ELSE
          v_overs_faced := v_overs_faced + (COALESCE(v_inn.total_balls, 0) / 6) + ((COALESCE(v_inn.total_balls, 0) % 6)::numeric / 6.0);
        END IF;
      END LOOP;

      -- Calculate bowling (runs conceded & overs bowled)
      FOR v_inn IN (
        SELECT i.total_runs, i.total_wickets, i.total_balls, m.overs_per_innings, COALESCE(m.wickets_per_innings, 10) as wickets_cap
        FROM public.innings i
        JOIN public.matches m ON m.id = i.match_id
        WHERE m.tournament_id = p_tournament_id
          AND m.status = 'completed'
          AND i.team_id <> v_team.team_id
          AND (m.team1_id = v_team.team_id OR m.team2_id = v_team.team_id)
      ) LOOP
        v_runs_conceded := v_runs_conceded + COALESCE(v_inn.total_runs, 0);
        IF COALESCE(v_inn.total_wickets, 0) >= v_inn.wickets_cap THEN
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

      -- Format overs for display columns
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
        points = (EXCLUDED.wins * 2.0) + (EXCLUDED.ties * 1.0) + (EXCLUDED.no_results * 1.0) + COALESCE(public.tournament_standings.points_adjustment, 0.00),
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
