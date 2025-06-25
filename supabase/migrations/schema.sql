-- Cricket Platform Database Schema
-- This migration sets up the complete database structure for the cricket platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'scorer', 'manager')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clubs table
CREATE TABLE public.clubs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  logo_url TEXT,
  location TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournaments table
CREATE TABLE public.tournaments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  tournament_type TEXT DEFAULT 'league' CHECK (tournament_type IN ('league', 'knockout', 'round_robin')),
  start_date DATE,
  end_date DATE,
  club_id UUID REFERENCES public.clubs(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table
CREATE TABLE public.teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  club_id UUID REFERENCES public.clubs(id),
  captain_id UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table
CREATE TABLE public.players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id),
  team_id UUID REFERENCES public.teams(id),
  jersey_number INTEGER,
  position TEXT DEFAULT 'player' CHECK (position IN ('player', 'captain', 'vice_captain', 'wicket_keeper')),
  batting_style TEXT CHECK (batting_style IN ('right_hand', 'left_hand')),
  bowling_style TEXT CHECK (bowling_style IN ('right_arm_fast', 'left_arm_fast', 'right_arm_medium', 'left_arm_medium', 'right_arm_spin', 'left_arm_spin', 'wicket_keeper')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, jersey_number)
);

-- Matches table
CREATE TABLE public.matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  match_type TEXT DEFAULT 'T20' CHECK (match_type IN ('T20', 'ODI', 'TEST', 'T10')),
  team1_id UUID REFERENCES public.teams(id) NOT NULL,
  team2_id UUID REFERENCES public.teams(id) NOT NULL,
  venue TEXT,
  start_time TIMESTAMP WITH TIME ZONE,
  overs_limit INTEGER DEFAULT 20,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed', 'abandoned')),
  toss_winner_team_id UUID REFERENCES public.teams(id),
  toss_decision TEXT CHECK (toss_decision IN ('bat', 'bowl')),
  current_innings INTEGER DEFAULT 1,
  target_score INTEGER,
  result TEXT,
  club_id UUID REFERENCES public.clubs(id),
  tournament_id UUID REFERENCES public.tournaments(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (team1_id != team2_id)
);

-- Innings table
CREATE TABLE public.innings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id),
  innings_number INTEGER NOT NULL,
  total_runs INTEGER DEFAULT 0,
  total_wickets INTEGER DEFAULT 0,
  total_overs DECIMAL(4,1) DEFAULT 0.0,
  extras_wides INTEGER DEFAULT 0,
  extras_no_balls INTEGER DEFAULT 0,
  extras_byes INTEGER DEFAULT 0,
  extras_leg_byes INTEGER DEFAULT 0,
  extras_penalties INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, innings_number)
);

-- Batting performances table
CREATE TABLE public.batting_performances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  innings_id UUID REFERENCES public.innings(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id),
  runs_scored INTEGER DEFAULT 0,
  balls_faced INTEGER DEFAULT 0,
  fours INTEGER DEFAULT 0,
  sixes INTEGER DEFAULT 0,
  is_out BOOLEAN DEFAULT FALSE,
  dismissal_type TEXT CHECK (dismissal_type IN ('bowled', 'caught', 'lbw', 'stumped', 'run_out', 'hit_wicket', 'obstructing', 'timed_out', 'handled_ball')),
  bowler_id UUID REFERENCES public.players(id),
  fielder_id UUID REFERENCES public.players(id),
  batting_position INTEGER,
  is_striker BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bowling performances table
CREATE TABLE public.bowling_performances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  innings_id UUID REFERENCES public.innings(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id),
  overs_bowled DECIMAL(4,1) DEFAULT 0.0,
  runs_conceded INTEGER DEFAULT 0,
  wickets_taken INTEGER DEFAULT 0,
  maidens INTEGER DEFAULT 0,
  wides INTEGER DEFAULT 0,
  no_balls INTEGER DEFAULT 0,
  is_current_bowler BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ball by ball scoring table
CREATE TABLE public.ball_by_ball (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  innings_id UUID REFERENCES public.innings(id) ON DELETE CASCADE,
  over_number INTEGER NOT NULL,
  ball_number INTEGER NOT NULL,
  bowler_id UUID REFERENCES public.players(id),
  batsman_id UUID REFERENCES public.players(id),
  non_striker_id UUID REFERENCES public.players(id),
  runs_scored INTEGER DEFAULT 0,
  extras INTEGER DEFAULT 0,
  extra_type TEXT CHECK (extra_type IN ('wide', 'no_ball', 'bye', 'leg_bye', 'penalty')),
  is_wicket BOOLEAN DEFAULT FALSE,
  dismissal_type TEXT CHECK (dismissal_type IN ('bowled', 'caught', 'lbw', 'stumped', 'run_out', 'hit_wicket', 'obstructing', 'timed_out', 'handled_ball')),
  fielder_id UUID REFERENCES public.players(id),
  commentary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batting_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bowling_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ball_by_ball ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (for overlay/streaming)
CREATE POLICY "Public matches read" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Public innings read" ON public.innings FOR SELECT USING (true);
CREATE POLICY "Public batting performances read" ON public.batting_performances FOR SELECT USING (true);
CREATE POLICY "Public bowling performances read" ON public.bowling_performances FOR SELECT USING (true);
CREATE POLICY "Public ball by ball read" ON public.ball_by_ball FOR SELECT USING (true);
CREATE POLICY "Public teams read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Public players read" ON public.players FOR SELECT USING (true);
CREATE POLICY "Public clubs read" ON public.clubs FOR SELECT USING (true);
CREATE POLICY "Public tournaments read" ON public.tournaments FOR SELECT USING (true);

-- Policies for authenticated users
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create indexes for better performance
CREATE INDEX idx_matches_status ON public.matches(status);
CREATE INDEX idx_matches_start_time ON public.matches(start_time);
CREATE INDEX idx_ball_by_ball_match ON public.ball_by_ball(match_id);
CREATE INDEX idx_ball_by_ball_innings ON public.ball_by_ball(innings_id);
CREATE INDEX idx_innings_match ON public.innings(match_id);
CREATE INDEX idx_batting_performances_innings ON public.batting_performances(innings_id);
CREATE INDEX idx_bowling_performances_innings ON public.bowling_performances(innings_id);
