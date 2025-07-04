-- Cricket Club Management App - Complete Database Structure
-- This replaces the existing schema with a comprehensive design

-- Drop existing tables if they exist (development phase)
DROP TABLE IF EXISTS public.user_achievements CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.match_events CASCADE;
DROP TABLE IF EXISTS public.player_career_stats CASCADE;
DROP TABLE IF EXISTS public.match_claims CASCADE;
DROP TABLE IF EXISTS public.fall_of_wickets CASCADE;
DROP TABLE IF EXISTS public.partnerships CASCADE;
DROP TABLE IF EXISTS public.ball_by_ball CASCADE;
DROP TABLE IF EXISTS public.bowling_performances CASCADE;
DROP TABLE IF EXISTS public.batting_performances CASCADE;
DROP TABLE IF EXISTS public.innings CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.tournament_standings CASCADE;
DROP TABLE IF EXISTS public.tournament_registrations CASCADE;
DROP TABLE IF EXISTS public.tournaments CASCADE;
DROP TABLE IF EXISTS public.team_players CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.club_invitations CASCADE;
DROP TABLE IF EXISTS public.club_memberships CASCADE;
DROP TABLE IF EXISTS public.clubs CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. USERS TABLE (All users are players)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  date_of_birth DATE,
  location TEXT,
  
  -- Cricket preferences
  preferred_batting_style TEXT CHECK (preferred_batting_style IN ('right_hand', 'left_hand')),
  preferred_bowling_style TEXT CHECK (preferred_bowling_style IN ('right_arm_fast', 'left_arm_fast', 'right_arm_medium', 'left_arm_medium', 'right_arm_spin', 'left_arm_spin', 'wicket_keeper')),
  preferred_position TEXT CHECK (preferred_position IN ('batsman', 'bowler', 'all_rounder', 'wicket_keeper')),
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT email_or_phone_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- 2. CLUBS TABLE
CREATE TABLE public.clubs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  location TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  
  -- Club settings
  is_public BOOLEAN DEFAULT TRUE,
  club_type TEXT DEFAULT 'community' CHECK (club_type IN ('community', 'corporate', 'school', 'professional')),
  founded_year INTEGER,
  
  -- Ownership
  owner_id UUID REFERENCES public.users(id) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CLUB MEMBERSHIPS (Role management)
CREATE TABLE public.club_memberships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Role system
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'banned')),
  
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(club_id, user_id)
);

-- 4. CLUB INVITATIONS
CREATE TABLE public.club_invitations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Flexible invitation targets
  email TEXT,
  phone TEXT,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT invitation_target_required CHECK (email IS NOT NULL OR phone IS NOT NULL OR user_id IS NOT NULL)
);

-- 5. TEAMS (Club-level and match-level)
CREATE TABLE public.teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  logo_url TEXT,
  
  -- Team organization
  club_id UUID REFERENCES public.clubs(id),
  captain_id UUID REFERENCES public.users(id),
  vice_captain_id UUID REFERENCES public.users(id),
  
  -- Team types
  team_type TEXT DEFAULT 'club' CHECK (team_type IN ('club', 'match', 'tournament')),
  is_template BOOLEAN DEFAULT FALSE,
  
  created_by UUID REFERENCES public.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TEAM PLAYERS (Squad management)
CREATE TABLE public.team_players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Player details
  jersey_number INTEGER,
  batting_order INTEGER,
  is_playing_xi BOOLEAN DEFAULT FALSE,
  role_in_team TEXT CHECK (role_in_team IN ('captain', 'vice_captain', 'wicket_keeper', 'player')),
  
  added_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(team_id, user_id)
);

-- 7. TOURNAMENTS
CREATE TABLE public.tournaments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Tournament format
  tournament_format TEXT DEFAULT 'league' CHECK (tournament_format IN ('league', 'knockout', 'mixed', 'round_robin')),
  match_format TEXT DEFAULT 'T20' CHECK (match_format IN ('T20', 'ODI', 'Custom')),
  custom_overs INTEGER,
  
  -- Tournament details
  start_date DATE,
  end_date DATE,
  registration_deadline DATE,
  max_teams INTEGER,
  entry_fee DECIMAL(10,2),
  prize_pool DECIMAL(10,2),
  venue TEXT,
  rules TEXT,
  
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'registration_open', 'ongoing', 'completed', 'cancelled')),
  
  -- Organization
  club_id UUID REFERENCES public.clubs(id),
  created_by UUID REFERENCES public.users(id) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. TOURNAMENT REGISTRATIONS
CREATE TABLE public.tournament_registrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  registered_by UUID REFERENCES public.users(id) NOT NULL,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'withdrawn')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  registration_fee DECIMAL(10,2),
  
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(tournament_id, team_id)
);

-- 9. TOURNAMENT STANDINGS
CREATE TABLE public.tournament_standings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Match results
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  ties INTEGER DEFAULT 0,
  no_results INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  
  -- Run rate calculation
  runs_scored INTEGER DEFAULT 0,
  runs_conceded INTEGER DEFAULT 0,
  overs_faced DECIMAL(6,1) DEFAULT 0.0,
  overs_bowled DECIMAL(6,1) DEFAULT 0.0,
  net_run_rate DECIMAL(5,2) DEFAULT 0.00,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(tournament_id, team_id)
);

-- 10. MATCHES
CREATE TABLE public.matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  match_format TEXT DEFAULT 'T20' CHECK (match_format IN ('T20', 'ODI', 'Custom')),
  overs_per_innings INTEGER DEFAULT 20,
  
  -- Teams
  team1_id UUID REFERENCES public.teams(id) NOT NULL,
  team2_id UUID REFERENCES public.teams(id) NOT NULL,
  
  -- Scheduling
  venue TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  actual_start_time TIMESTAMP WITH TIME ZONE,
  actual_end_time TIMESTAMP WITH TIME ZONE,
  
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'abandoned', 'cancelled')),
  
  -- Toss details
  toss_winner_team_id UUID REFERENCES public.teams(id),
  toss_decision TEXT CHECK (toss_decision IN ('bat', 'bowl')),
  
  -- Live match state
  current_innings INTEGER DEFAULT 1,
  current_over INTEGER DEFAULT 0,
  current_ball INTEGER DEFAULT 0,
  
  -- Match conditions
  weather_conditions TEXT,
  pitch_conditions TEXT,
  
  -- Result
  result_type TEXT CHECK (result_type IN ('win', 'tie', 'no_result', 'abandoned')),
  winning_team_id UUID REFERENCES public.teams(id),
  win_margin_type TEXT CHECK (win_margin_type IN ('runs', 'wickets', 'balls')),
  win_margin INTEGER,
  result_description TEXT,
  
  -- Officials
  umpire1_name TEXT,
  umpire2_name TEXT,
  third_umpire_name TEXT,
  scorer_name TEXT,
  
  -- Organization
  tournament_id UUID REFERENCES public.tournaments(id),
  club_id UUID REFERENCES public.clubs(id),
  created_by UUID REFERENCES public.users(id) NOT NULL,
  
  -- Match administration
  match_admins UUID[] DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CHECK (team1_id != team2_id),
  CHECK (overs_per_innings > 0 AND overs_per_innings <= 50)
);

-- 11. INNINGS
CREATE TABLE public.innings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) NOT NULL,
  innings_number INTEGER NOT NULL CHECK (innings_number IN (1, 2)),
  
  -- Totals
  total_runs INTEGER DEFAULT 0,
  total_wickets INTEGER DEFAULT 0,
  total_overs DECIMAL(4,1) DEFAULT 0.0,
  total_balls INTEGER DEFAULT 0,
  
  -- Extras breakdown
  extras_total INTEGER DEFAULT 0,
  extras_byes INTEGER DEFAULT 0,
  extras_leg_byes INTEGER DEFAULT 0,
  extras_wides INTEGER DEFAULT 0,
  extras_no_balls INTEGER DEFAULT 0,
  extras_penalties INTEGER DEFAULT 0,
  
  is_completed BOOLEAN DEFAULT FALSE,
  target_runs INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(match_id, innings_number)
);

-- 12. BATTING PERFORMANCES
CREATE TABLE public.batting_performances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  innings_id UUID REFERENCES public.innings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  
  batting_position INTEGER NOT NULL,
  runs_scored INTEGER DEFAULT 0,
  balls_faced INTEGER DEFAULT 0,
  minutes_batted INTEGER DEFAULT 0,
  fours INTEGER DEFAULT 0,
  sixes INTEGER DEFAULT 0,
  
  -- Dismissal details
  is_out BOOLEAN DEFAULT FALSE,
  dismissal_type TEXT CHECK (dismissal_type IN ('bowled', 'caught', 'lbw', 'stumped', 'run_out', 'hit_wicket', 'obstructing', 'timed_out', 'handled_ball', 'retired_hurt', 'retired_out')),
  bowler_id UUID REFERENCES public.users(id),
  fielder_id UUID REFERENCES public.users(id),
  
  -- Current state
  is_current_batsman BOOLEAN DEFAULT FALSE,
  is_striker BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. BOWLING PERFORMANCES
CREATE TABLE public.bowling_performances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  innings_id UUID REFERENCES public.innings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  
  overs_bowled DECIMAL(4,1) DEFAULT 0.0,
  balls_bowled INTEGER DEFAULT 0,
  runs_conceded INTEGER DEFAULT 0,
  wickets_taken INTEGER DEFAULT 0,
  maidens INTEGER DEFAULT 0,
  wides INTEGER DEFAULT 0,
  no_balls INTEGER DEFAULT 0,
  
  is_current_bowler BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. BALL BY BALL SCORING
CREATE TABLE public.ball_by_ball (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  innings_id UUID REFERENCES public.innings(id) ON DELETE CASCADE,
  
  over_number INTEGER NOT NULL,
  ball_number INTEGER NOT NULL CHECK (ball_number BETWEEN 1 AND 6),
  
  -- Players involved
  bowler_id UUID REFERENCES public.users(id) NOT NULL,
  batsman_id UUID REFERENCES public.users(id) NOT NULL,
  non_striker_id UUID REFERENCES public.users(id) NOT NULL,
  
  -- Ball outcome
  runs_scored INTEGER DEFAULT 0,
  extras INTEGER DEFAULT 0,
  extra_type TEXT CHECK (extra_type IN ('wide', 'no_ball', 'bye', 'leg_bye', 'penalty')),
  
  -- Wicket details
  is_wicket BOOLEAN DEFAULT FALSE,
  dismissal_type TEXT CHECK (dismissal_type IN ('bowled', 'caught', 'lbw', 'stumped', 'run_out', 'hit_wicket', 'obstructing', 'timed_out', 'handled_ball')),
  fielder_id UUID REFERENCES public.users(id),
  
  commentary TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. PARTNERSHIPS
CREATE TABLE public.partnerships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  innings_id UUID REFERENCES public.innings(id) ON DELETE CASCADE,
  batsman1_id UUID REFERENCES public.users(id) NOT NULL,
  batsman2_id UUID REFERENCES public.users(id) NOT NULL,
  
  wicket_number INTEGER,
  runs INTEGER DEFAULT 0,
  balls INTEGER DEFAULT 0,
  start_over DECIMAL(4,1),
  end_over DECIMAL(4,1),
  is_current BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. FALL OF WICKETS
CREATE TABLE public.fall_of_wickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  innings_id UUID REFERENCES public.innings(id) ON DELETE CASCADE,
  
  wicket_number INTEGER NOT NULL,
  runs_at_fall INTEGER NOT NULL,
  overs_at_fall DECIMAL(4,1) NOT NULL,
  batsman_out_id UUID REFERENCES public.users(id) NOT NULL,
  dismissal_type TEXT NOT NULL,
  bowler_id UUID REFERENCES public.users(id),
  fielder_id UUID REFERENCES public.users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. MATCH STATISTICS CLAIMING
CREATE TABLE public.match_claims (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  
  -- Match details
  match_title TEXT NOT NULL,
  match_date DATE NOT NULL,
  venue TEXT,
  opponent_team TEXT,
  
  -- Performance claims
  runs_scored INTEGER,
  balls_faced INTEGER,
  fours INTEGER,
  sixes INTEGER,
  wickets_taken INTEGER,
  overs_bowled DECIMAL(4,1),
  runs_conceded INTEGER,
  catches INTEGER,
  stumpings INTEGER,
  run_outs INTEGER,
  additional_notes TEXT,
  
  -- Verification system
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES public.users(id),
  verification_notes TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 18. PLAYER CAREER STATISTICS
CREATE TABLE public.player_career_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Batting statistics
  total_matches INTEGER DEFAULT 0,
  total_innings_batted INTEGER DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  total_balls_faced INTEGER DEFAULT 0,
  total_fours INTEGER DEFAULT 0,
  total_sixes INTEGER DEFAULT 0,
  highest_score INTEGER DEFAULT 0,
  not_outs INTEGER DEFAULT 0,
  centuries INTEGER DEFAULT 0,
  half_centuries INTEGER DEFAULT 0,
  
  -- Bowling statistics
  total_innings_bowled INTEGER DEFAULT 0,
  total_overs_bowled DECIMAL(8,1) DEFAULT 0.0,
  total_balls_bowled INTEGER DEFAULT 0,
  total_runs_conceded INTEGER DEFAULT 0,
  total_wickets INTEGER DEFAULT 0,
  best_bowling_figures TEXT,
  five_wicket_hauls INTEGER DEFAULT 0,
  
  -- Fielding statistics
  total_catches INTEGER DEFAULT 0,
  total_stumpings INTEGER DEFAULT 0,
  total_run_outs INTEGER DEFAULT 0,
  
  -- Calculated averages
  batting_average DECIMAL(5,2),
  strike_rate DECIMAL(5,2),
  bowling_average DECIMAL(5,2),
  economy_rate DECIMAL(4,2),
  
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- 19. MATCH EVENTS (Real-time updates)
CREATE TABLE public.match_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('match_start', 'innings_start', 'innings_end', 'match_end', 'wicket', 'boundary', 'six', 'milestone', 'timeout', 'review')),
  event_data JSONB,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 20. NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('match_reminder', 'tournament_update', 'club_invitation', 'match_result', 'achievement', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 21. USER ACHIEVEMENTS
CREATE TABLE public.user_achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL CHECK (achievement_type IN ('century', 'half_century', 'five_wickets', 'hat_trick', 'duck', 'maiden_over', 'catch', 'stumping', 'run_out')),
  match_id UUID REFERENCES public.matches(id),
  achievement_data JSONB,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PERFORMANCE INDEXES
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_phone ON public.users(phone);
CREATE INDEX idx_users_full_name ON public.users USING GIN (full_name gin_trgm_ops);

CREATE INDEX idx_clubs_name ON public.clubs USING GIN (name gin_trgm_ops);
CREATE INDEX idx_clubs_location ON public.clubs USING GIN (location gin_trgm_ops);
CREATE INDEX idx_clubs_owner ON public.clubs(owner_id);
CREATE INDEX idx_clubs_public ON public.clubs(is_public);

CREATE INDEX idx_club_memberships_user ON public.club_memberships(user_id);
CREATE INDEX idx_club_memberships_club ON public.club_memberships(club_id);
CREATE INDEX idx_club_memberships_role ON public.club_memberships(club_id, role);

CREATE INDEX idx_club_invitations_email ON public.club_invitations(email);
CREATE INDEX idx_club_invitations_phone ON public.club_invitations(phone);
CREATE INDEX idx_club_invitations_user ON public.club_invitations(user_id);
CREATE INDEX idx_club_invitations_status ON public.club_invitations(status);

CREATE INDEX idx_teams_club ON public.teams(club_id);
CREATE INDEX idx_teams_captain ON public.teams(captain_id);
CREATE INDEX idx_teams_type ON public.teams(team_type);
CREATE INDEX idx_teams_template ON public.teams(is_template);

CREATE INDEX idx_team_players_team ON public.team_players(team_id);
CREATE INDEX idx_team_players_user ON public.team_players(user_id);
CREATE INDEX idx_team_players_playing_xi ON public.team_players(team_id, is_playing_xi);

CREATE INDEX idx_tournaments_club ON public.tournaments(club_id);
CREATE INDEX idx_tournaments_status ON public.tournaments(status);
CREATE INDEX idx_tournaments_dates ON public.tournaments(start_date, end_date);

CREATE INDEX idx_tournament_registrations_tournament ON public.tournament_registrations(tournament_id);
CREATE INDEX idx_tournament_registrations_team ON public.tournament_registrations(team_id);
CREATE INDEX idx_tournament_registrations_status ON public.tournament_registrations(status);

CREATE INDEX idx_tournament_standings_tournament ON public.tournament_standings(tournament_id);
CREATE INDEX idx_tournament_standings_points ON public.tournament_standings(tournament_id, points DESC);

CREATE INDEX idx_matches_teams ON public.matches(team1_id, team2_id);
CREATE INDEX idx_matches_tournament ON public.matches(tournament_id);
CREATE INDEX idx_matches_club ON public.matches(club_id);
CREATE INDEX idx_matches_status ON public.matches(status);
CREATE INDEX idx_matches_scheduled ON public.matches(scheduled_at);
CREATE INDEX idx_matches_created_by ON public.matches(created_by);

CREATE INDEX idx_innings_match ON public.innings(match_id);
CREATE INDEX idx_innings_team ON public.innings(team_id);

CREATE INDEX idx_batting_performances_match ON public.batting_performances(match_id);
CREATE INDEX idx_batting_performances_innings ON public.batting_performances(innings_id);
CREATE INDEX idx_batting_performances_user ON public.batting_performances(user_id);
CREATE INDEX idx_batting_performances_current ON public.batting_performances(match_id, is_current_batsman);

CREATE INDEX idx_bowling_performances_match ON public.bowling_performances(match_id);
CREATE INDEX idx_bowling_performances_innings ON public.bowling_performances(innings_id);
CREATE INDEX idx_bowling_performances_user ON public.bowling_performances(user_id);
CREATE INDEX idx_bowling_performances_current ON public.bowling_performances(match_id, is_current_bowler);

CREATE INDEX idx_ball_by_ball_match ON public.ball_by_ball(match_id);
CREATE INDEX idx_ball_by_ball_innings ON public.ball_by_ball(innings_id);
CREATE INDEX idx_ball_by_ball_over ON public.ball_by_ball(match_id, over_number, ball_number);

CREATE INDEX idx_partnerships_match ON public.partnerships(match_id);
CREATE INDEX idx_partnerships_innings ON public.partnerships(innings_id);
CREATE INDEX idx_partnerships_current ON public.partnerships(match_id, is_current);

CREATE INDEX idx_fall_of_wickets_match ON public.fall_of_wickets(match_id);
CREATE INDEX idx_fall_of_wickets_innings ON public.fall_of_wickets(innings_id);

CREATE INDEX idx_match_claims_user ON public.match_claims(user_id);
CREATE INDEX idx_match_claims_status ON public.match_claims(status);
CREATE INDEX idx_match_claims_date ON public.match_claims(match_date);

CREATE INDEX idx_player_career_stats_user ON public.player_career_stats(user_id);

CREATE INDEX idx_match_events_match ON public.match_events(match_id);
CREATE INDEX idx_match_events_type ON public.match_events(event_type);
CREATE INDEX idx_match_events_created_at ON public.match_events(created_at);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_type ON public.notifications(type);

CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX idx_user_achievements_type ON public.user_achievements(achievement_type);
CREATE INDEX idx_user_achievements_match ON public.user_achievements(match_id);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batting_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bowling_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ball_by_ball ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fall_of_wickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_career_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- ROW LEVEL SECURITY POLICIES

-- Users policies
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Clubs policies
CREATE POLICY "Anyone can view public clubs" ON public.clubs FOR SELECT USING (is_public = true);
CREATE POLICY "Club members can view private clubs" ON public.clubs FOR SELECT USING (
  NOT is_public AND EXISTS (
    SELECT 1 FROM public.club_memberships 
    WHERE club_id = clubs.id AND user_id = auth.uid() AND status = 'active'
  )
);
CREATE POLICY "Users can create clubs" ON public.clubs FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Club owners can update clubs" ON public.clubs FOR UPDATE USING (auth.uid() = owner_id);

-- Club memberships policies
CREATE POLICY "Club members can view memberships" ON public.club_memberships FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.club_memberships cm 
    WHERE cm.club_id = club_memberships.club_id AND cm.user_id = auth.uid() AND cm.status = 'active'
  )
);
CREATE POLICY "Club owners/admins can manage memberships" ON public.club_memberships FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.club_memberships cm 
    WHERE cm.club_id = club_memberships.club_id AND cm.user_id = auth.uid() 
    AND cm.role IN ('owner', 'admin') AND cm.status = 'active'
  )
);

-- Matches policies - public read for live scoring
CREATE POLICY "Anyone can view matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Club members can create matches" ON public.matches FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    club_id IS NULL OR EXISTS (
      SELECT 1 FROM public.club_memberships 
      WHERE club_id = matches.club_id AND user_id = auth.uid() AND status = 'active'
    )
  )
);
CREATE POLICY "Match creators and admins can update matches" ON public.matches FOR UPDATE USING (
  auth.uid() = created_by OR auth.uid() = ANY(match_admins) OR EXISTS (
    SELECT 1 FROM public.club_memberships 
    WHERE club_id = matches.club_id AND user_id = auth.uid() 
    AND role IN ('owner', 'admin') AND status = 'active'
  )
);

-- Scoring data policies - public read for live updates
CREATE POLICY "Anyone can view innings" ON public.innings FOR SELECT USING (true);
CREATE POLICY "Anyone can view batting performances" ON public.batting_performances FOR SELECT USING (true);
CREATE POLICY "Anyone can view bowling performances" ON public.bowling_performances FOR SELECT USING (true);
CREATE POLICY "Anyone can view ball by ball" ON public.ball_by_ball FOR SELECT USING (true);
CREATE POLICY "Anyone can view partnerships" ON public.partnerships FOR SELECT USING (true);
CREATE POLICY "Anyone can view fall of wickets" ON public.fall_of_wickets FOR SELECT USING (true);
CREATE POLICY "Anyone can view match events" ON public.match_events FOR SELECT USING (true);

-- Match admins can insert/update scoring data
CREATE POLICY "Match admins can manage scoring" ON public.innings FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.matches m 
    WHERE m.id = innings.match_id AND (
      m.created_by = auth.uid() OR auth.uid() = ANY(m.match_admins)
    )
  )
);

CREATE POLICY "Match admins can manage batting" ON public.batting_performances FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.matches m 
    WHERE m.id = batting_performances.match_id AND (
      m.created_by = auth.uid() OR auth.uid() = ANY(m.match_admins)
    )
  )
);

CREATE POLICY "Match admins can manage bowling" ON public.bowling_performances FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.matches m 
    WHERE m.id = bowling_performances.match_id AND (
      m.created_by = auth.uid() OR auth.uid() = ANY(m.match_admins)
    )
  )
);

CREATE POLICY "Match admins can manage ball by ball" ON public.ball_by_ball FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.matches m 
    WHERE m.id = ball_by_ball.match_id AND (
      m.created_by = auth.uid() OR auth.uid() = ANY(m.match_admins)
    )
  )
);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Match claims policies
CREATE POLICY "Users can view all claims" ON public.match_claims FOR SELECT USING (true);
CREATE POLICY "Users can create own claims" ON public.match_claims FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own claims" ON public.match_claims FOR UPDATE USING (auth.uid() = user_id);

-- Player stats policies
CREATE POLICY "Anyone can view player stats" ON public.player_career_stats FOR SELECT USING (true);

-- User achievements policies
CREATE POLICY "Anyone can view achievements" ON public.user_achievements FOR SELECT USING (true);

-- Tournament policies
CREATE POLICY "Anyone can view tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Anyone can view tournament registrations" ON public.tournament_registrations FOR SELECT USING (true);
CREATE POLICY "Anyone can view tournament standings" ON public.tournament_standings FOR SELECT USING (true);

-- Team policies
CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Anyone can view team players" ON public.team_players FOR SELECT USING (true); 