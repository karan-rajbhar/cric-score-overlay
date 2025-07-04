-- Cricket Club Management App - Sample Data
-- This seeds the database with realistic test data

-- Clear existing data
TRUNCATE TABLE public.user_achievements CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.match_events CASCADE;
TRUNCATE TABLE public.player_career_stats CASCADE;
TRUNCATE TABLE public.match_claims CASCADE;
TRUNCATE TABLE public.fall_of_wickets CASCADE;
TRUNCATE TABLE public.partnerships CASCADE;
TRUNCATE TABLE public.ball_by_ball CASCADE;
TRUNCATE TABLE public.bowling_performances CASCADE;
TRUNCATE TABLE public.batting_performances CASCADE;
TRUNCATE TABLE public.innings CASCADE;
TRUNCATE TABLE public.matches CASCADE;
TRUNCATE TABLE public.tournament_standings CASCADE;
TRUNCATE TABLE public.tournament_registrations CASCADE;
TRUNCATE TABLE public.tournaments CASCADE;
TRUNCATE TABLE public.team_players CASCADE;
TRUNCATE TABLE public.teams CASCADE;
TRUNCATE TABLE public.club_invitations CASCADE;
TRUNCATE TABLE public.club_memberships CASCADE;
TRUNCATE TABLE public.clubs CASCADE;
TRUNCATE TABLE public.users CASCADE;

-- Insert sample users (all are players)
INSERT INTO public.users (id, email, full_name, phone, bio, date_of_birth, location, preferred_batting_style, preferred_bowling_style, preferred_position) VALUES
-- Club Owners
('550e8400-e29b-41d4-a716-446655440001', 'john.smith@email.com', 'John Smith', '+1234567890', 'Experienced cricket player and club organizer', '1985-03-15', 'New York, NY', 'right_hand', 'right_arm_medium', 'all_rounder'),
('550e8400-e29b-41d4-a716-446655440002', 'sarah.johnson@email.com', 'Sarah Johnson', '+1234567891', 'Former state-level cricketer, now coaching and organizing', '1988-07-22', 'Los Angeles, CA', 'right_hand', 'right_arm_spin', 'all_rounder'),

-- Players for Club 1 (Metropolitan Cricket Club)
('550e8400-e29b-41d4-a716-446655440003', 'mike.wilson@email.com', 'Mike Wilson', '+1234567892', 'Opening batsman with aggressive style', '1992-11-08', 'New York, NY', 'right_hand', 'right_arm_fast', 'batsman'),
('550e8400-e29b-41d4-a716-446655440004', 'david.brown@email.com', 'David Brown', '+1234567893', 'Wicket-keeper batsman', '1990-05-12', 'Brooklyn, NY', 'left_hand', 'wicket_keeper', 'wicket_keeper'),
('550e8400-e29b-41d4-a716-446655440005', 'alex.davis@email.com', 'Alex Davis', '+1234567894', 'Fast bowler with good pace', '1994-09-03', 'Queens, NY', 'right_hand', 'right_arm_fast', 'bowler'),
('550e8400-e29b-41d4-a716-446655440006', 'chris.miller@email.com', 'Chris Miller', '+1234567895', 'Spin bowler and lower-order batsman', '1991-12-18', 'Manhattan, NY', 'left_hand', 'left_arm_spin', 'bowler'),
('550e8400-e29b-41d4-a716-446655440007', 'tom.garcia@email.com', 'Tom Garcia', '+1234567896', 'Middle-order batsman', '1993-04-25', 'Bronx, NY', 'right_hand', 'right_arm_medium', 'batsman'),
('550e8400-e29b-41d4-a716-446655440008', 'ryan.martinez@email.com', 'Ryan Martinez', '+1234567897', 'All-rounder with good fielding', '1989-08-14', 'Staten Island, NY', 'right_hand', 'right_arm_medium', 'all_rounder'),

-- Players for Club 2 (Riverside Cricket Association)
('550e8400-e29b-41d4-a716-446655440009', 'james.anderson@email.com', 'James Anderson', '+1234567898', 'Experienced opening batsman', '1987-02-28', 'Los Angeles, CA', 'left_hand', 'left_arm_medium', 'batsman'),
('550e8400-e29b-41d4-a716-446655440010', 'kevin.taylor@email.com', 'Kevin Taylor', '+1234567899', 'Wicket-keeper with good reflexes', '1991-10-07', 'Santa Monica, CA', 'right_hand', 'wicket_keeper', 'wicket_keeper'),
('550e8400-e29b-41d4-a716-446655440011', 'mark.thomas@email.com', 'Mark Thomas', '+1234567800', 'Medium-pace bowler', '1992-06-19', 'Beverly Hills, CA', 'right_hand', 'right_arm_medium', 'bowler'),
('550e8400-e29b-41d4-a716-446655440012', 'paul.jackson@email.com', 'Paul Jackson', '+1234567801', 'Leg-spin bowler', '1990-01-11', 'Hollywood, CA', 'right_hand', 'right_arm_spin', 'bowler'),
('550e8400-e29b-41d4-a716-446655440013', 'steve.white@email.com', 'Steve White', '+1234567802', 'Solid middle-order batsman', '1988-09-30', 'Pasadena, CA', 'left_hand', 'left_arm_medium', 'batsman'),
('550e8400-e29b-41d4-a716-446655440014', 'dan.harris@email.com', 'Dan Harris', '+1234567803', 'All-rounder and team captain', '1985-12-05', 'Long Beach, CA', 'right_hand', 'right_arm_fast', 'all_rounder');

-- Insert clubs
INSERT INTO public.clubs (id, name, short_name, description, location, contact_email, contact_phone, is_public, club_type, founded_year, owner_id) VALUES
('650e8400-e29b-41d4-a716-446655440001', 'Metropolitan Cricket Club', 'MCC', 'Premier cricket club in New York area with focus on competitive cricket and community development', 'New York, NY', 'info@metrocricket.com', '+1234567890', true, 'community', 2018, '550e8400-e29b-41d4-a716-446655440001'),
('650e8400-e29b-41d4-a716-446655440002', 'Riverside Cricket Association', 'RCA', 'Los Angeles based cricket club promoting cricket in Southern California', 'Los Angeles, CA', 'contact@riversidecricket.com', '+1234567891', true, 'community', 2020, '550e8400-e29b-41d4-a716-446655440002');

-- Insert club memberships
INSERT INTO public.club_memberships (club_id, user_id, role, status) VALUES
-- Metropolitan Cricket Club
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'owner', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'admin', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', 'member', 'active'),

-- Riverside Cricket Association
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'owner', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440009', 'admin', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440010', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440011', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440012', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440013', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', 'member', 'active');

-- Insert teams
INSERT INTO public.teams (id, name, short_name, description, club_id, captain_id, vice_captain_id, team_type, created_by) VALUES
('750e8400-e29b-41d4-a716-446655440001', 'Metropolitan Strikers', 'Strikers', 'First team of Metropolitan Cricket Club', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 'club', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440002', 'Riverside Warriors', 'Warriors', 'First team of Riverside Cricket Association', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440009', 'club', '550e8400-e29b-41d4-a716-446655440002');

-- Insert team players
INSERT INTO public.team_players (team_id, user_id, jersey_number, batting_order, is_playing_xi, role_in_team, added_by) VALUES
-- Metropolitan Strikers
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 1, 1, true, 'captain', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 2, 2, true, 'wicket_keeper', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 3, 3, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', 4, 4, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 5, 5, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 6, 6, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 7, 7, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),

-- Riverside Warriors
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', 1, 1, true, 'captain', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440009', 2, 2, true, 'vice_captain', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440010', 3, 3, true, 'wicket_keeper', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440013', 4, 4, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 5, 5, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440011', 6, 6, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440012', 7, 7, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', 8, 8, true, 'player', '550e8400-e29b-41d4-a716-446655440002');

-- Insert a tournament
INSERT INTO public.tournaments (id, name, description, tournament_format, match_format, start_date, end_date, registration_deadline, max_teams, entry_fee, prize_pool, venue, status, created_by) VALUES
('850e8400-e29b-41d4-a716-446655440001', 'East Coast Cricket Championship 2024', 'Premier T20 tournament for cricket clubs across the East Coast', 'league', 'T20', '2024-07-15', '2024-08-15', '2024-07-01', 8, 500.00, 5000.00, 'Central Park Cricket Ground', 'ongoing', '550e8400-e29b-41d4-a716-446655440001');

-- Insert tournament registrations
INSERT INTO public.tournament_registrations (tournament_id, team_id, registered_by, status, payment_status, registration_fee) VALUES
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'confirmed', 'paid', 500.00),
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'confirmed', 'paid', 500.00);

-- Insert tournament standings
INSERT INTO public.tournament_standings (tournament_id, team_id, matches_played, wins, losses, points, runs_scored, runs_conceded, overs_faced, overs_bowled, net_run_rate) VALUES
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 1, 1, 0, 2, 165, 142, 20.0, 20.0, 1.15),
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 1, 0, 1, 0, 142, 165, 20.0, 20.0, -1.15);

-- Insert a sample match
INSERT INTO public.matches (id, title, match_format, overs_per_innings, team1_id, team2_id, venue, scheduled_at, actual_start_time, status, toss_winner_team_id, toss_decision, current_innings, current_over, current_ball, result_type, winning_team_id, win_margin_type, win_margin, result_description, tournament_id, created_by, match_admins) VALUES
('950e8400-e29b-41d4-a716-446655440001', 'Strikers vs Warriors - Championship Match', 'T20', 20, '750e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 'Central Park Cricket Ground', '2024-07-20 14:00:00+00', '2024-07-20 14:15:00+00', 'completed', '750e8400-e29b-41d4-a716-446655440001', 'bat', 2, 20, 6, 'win', '750e8400-e29b-41d4-a716-446655440001', 'runs', 23, 'Metropolitan Strikers won by 23 runs', '850e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', ARRAY['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002']);

-- Insert innings
INSERT INTO public.innings (id, match_id, team_id, innings_number, total_runs, total_wickets, total_overs, total_balls, extras_total, extras_byes, extras_leg_byes, extras_wides, extras_no_balls, is_completed, target_runs) VALUES
('a50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 1, 165, 6, 20.0, 120, 12, 2, 3, 5, 2, true, NULL),
('a50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 2, 142, 8, 20.0, 120, 8, 1, 2, 4, 1, true, 166);

-- Insert batting performances for first innings
INSERT INTO public.batting_performances (match_id, innings_id, user_id, batting_position, runs_scored, balls_faced, fours, sixes, is_out, dismissal_type, bowler_id) VALUES
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 1, 45, 32, 6, 1, true, 'caught', '550e8400-e29b-41d4-a716-446655440011'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 2, 28, 24, 3, 0, true, 'bowled', '550e8400-e29b-41d4-a716-446655440012'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 3, 35, 28, 4, 1, true, 'lbw', '550e8400-e29b-41d4-a716-446655440011'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', 4, 22, 18, 2, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440012'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 5, 15, 12, 1, 0, true, 'run_out', NULL),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 6, 8, 6, 1, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440014'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 7, 12, 8, 0, 1, false, NULL, NULL);

-- Insert batting performances for second innings
INSERT INTO public.batting_performances (match_id, innings_id, user_id, batting_position, runs_scored, balls_faced, fours, sixes, is_out, dismissal_type, bowler_id) VALUES
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', 1, 38, 29, 5, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440005'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440009', 2, 25, 22, 3, 0, true, 'bowled', '550e8400-e29b-41d4-a716-446655440006'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440010', 3, 18, 16, 2, 0, true, 'stumped', '550e8400-e29b-41d4-a716-446655440006'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440013', 4, 31, 26, 3, 1, true, 'caught', '550e8400-e29b-41d4-a716-446655440005'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 5, 12, 14, 1, 0, true, 'lbw', '550e8400-e29b-41d4-a716-446655440008'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440011', 6, 8, 7, 0, 0, true, 'bowled', '550e8400-e29b-41d4-a716-446655440005'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440012', 7, 6, 6, 0, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440008'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', 8, 4, 4, 0, 0, true, 'run_out', NULL);

-- Insert bowling performances
INSERT INTO public.bowling_performances (match_id, innings_id, user_id, overs_bowled, balls_bowled, runs_conceded, wickets_taken, maidens, wides, no_balls) VALUES
-- First innings bowling (Warriors bowling to Strikers)
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440011', 4.0, 24, 32, 2, 0, 2, 1),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440012', 4.0, 24, 28, 2, 0, 1, 0),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440014', 4.0, 24, 35, 1, 0, 1, 1),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440009', 4.0, 24, 38, 0, 0, 1, 0),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440013', 4.0, 24, 32, 1, 0, 0, 0),

-- Second innings bowling (Strikers bowling to Warriors)
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440005', 4.0, 24, 26, 3, 0, 2, 0),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440006', 4.0, 24, 22, 2, 0, 1, 1),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440008', 4.0, 24, 28, 2, 0, 1, 0),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 4.0, 24, 32, 0, 0, 0, 0),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440007', 4.0, 24, 34, 1, 0, 0, 0);

-- Insert some sample match events
INSERT INTO public.match_events (match_id, event_type, event_data, created_by) VALUES
('950e8400-e29b-41d4-a716-446655440001', 'match_start', '{"message": "Match started between Strikers and Warriors"}', '550e8400-e29b-41d4-a716-446655440001'),
('950e8400-e29b-41d4-a716-446655440001', 'innings_start', '{"innings": 1, "batting_team": "Metropolitan Strikers"}', '550e8400-e29b-41d4-a716-446655440001'),
('950e8400-e29b-41d4-a716-446655440001', 'boundary', '{"batsman": "Mike Wilson", "runs": 4, "over": 3, "ball": 2}', '550e8400-e29b-41d4-a716-446655440001'),
('950e8400-e29b-41d4-a716-446655440001', 'six', '{"batsman": "Tom Garcia", "runs": 6, "over": 8, "ball": 4}', '550e8400-e29b-41d4-a716-446655440001'),
('950e8400-e29b-41d4-a716-446655440001', 'wicket', '{"batsman": "Mike Wilson", "bowler": "Mark Thomas", "dismissal": "caught", "runs": 45}', '550e8400-e29b-41d4-a716-446655440001'),
('950e8400-e29b-41d4-a716-446655440001', 'innings_end', '{"innings": 1, "total": "165/6", "overs": 20}', '550e8400-e29b-41d4-a716-446655440001'),
('950e8400-e29b-41d4-a716-446655440001', 'innings_start', '{"innings": 2, "batting_team": "Riverside Warriors", "target": 166}', '550e8400-e29b-41d4-a716-446655440001'),
('950e8400-e29b-41d4-a716-446655440001', 'match_end', '{"result": "Metropolitan Strikers won by 23 runs"}', '550e8400-e29b-41d4-a716-446655440001');

-- Insert some sample match claims
INSERT INTO public.match_claims (user_id, match_title, match_date, venue, opponent_team, runs_scored, balls_faced, fours, sixes, wickets_taken, overs_bowled, runs_conceded, catches, status) VALUES
('550e8400-e29b-41d4-a716-446655440003', 'Local League Match', '2024-06-15', 'Brooklyn Cricket Ground', 'Brooklyn Blazers', 67, 45, 8, 2, NULL, NULL, NULL, 1, 'pending'),
('550e8400-e29b-41d4-a716-446655440005', 'Weekend Tournament', '2024-06-10', 'Queens Cricket Field', 'Queens Royals', 12, 8, 1, 0, 3, 4.0, 28, 0, 'verified'),
('550e8400-e29b-41d4-a716-446655440014', 'Friendly Match', '2024-06-05', 'Santa Monica Beach Ground', 'Venice Vikings', 89, 62, 10, 3, NULL, NULL, NULL, 2, 'pending');

-- Insert sample notifications
INSERT INTO public.notifications (user_id, type, title, message, data) VALUES
('550e8400-e29b-41d4-a716-446655440003', 'match_reminder', 'Upcoming Match Reminder', 'You have a match scheduled tomorrow at 2:00 PM against Warriors', '{"match_id": "950e8400-e29b-41d4-a716-446655440001"}'),
('550e8400-e29b-41d4-a716-446655440014', 'match_result', 'Match Result', 'Your team lost by 23 runs against Metropolitan Strikers', '{"match_id": "950e8400-e29b-41d4-a716-446655440001", "result": "loss"}'),
('550e8400-e29b-41d4-a716-446655440005', 'achievement', 'New Achievement Unlocked!', 'Congratulations! You have taken your first 3-wicket haul', '{"achievement": "three_wickets", "match_id": "950e8400-e29b-41d4-a716-446655440001"}');

-- Insert sample user achievements
INSERT INTO public.user_achievements (user_id, achievement_type, match_id, achievement_data) VALUES
('550e8400-e29b-41d4-a716-446655440003', 'half_century', '950e8400-e29b-41d4-a716-446655440001', '{"runs": 45, "balls": 32, "match_title": "Strikers vs Warriors"}'),
('550e8400-e29b-41d4-a716-446655440005', 'five_wickets', NULL, '{"wickets": 5, "match_title": "Previous Match", "figures": "5/28"}'),
('550e8400-e29b-41d4-a716-446655440014', 'half_century', '950e8400-e29b-41d4-a716-446655440001', '{"runs": 38, "balls": 29, "match_title": "Strikers vs Warriors"}');

-- Insert sample player career stats
INSERT INTO public.player_career_stats (user_id, total_matches, total_innings_batted, total_runs, total_balls_faced, total_fours, total_sixes, highest_score, not_outs, centuries, half_centuries, total_innings_bowled, total_overs_bowled, total_balls_bowled, total_runs_conceded, total_wickets, best_bowling_figures, five_wicket_hauls, total_catches, total_stumpings, total_run_outs, batting_average, strike_rate, bowling_average, economy_rate) VALUES
('550e8400-e29b-41d4-a716-446655440003', 15, 15, 567, 445, 68, 12, 89, 2, 0, 4, 0, 0.0, 0, 0, 0, NULL, 0, 8, 0, 0, 43.62, 127.42, NULL, NULL),
('550e8400-e29b-41d4-a716-446655440005', 12, 8, 156, 98, 18, 3, 45, 1, 0, 1, 12, 42.0, 252, 298, 18, '4/22', 0, 5, 0, 0, 22.29, 159.18, 16.56, 7.10),
('550e8400-e29b-41d4-a716-446655440014', 18, 17, 678, 512, 78, 15, 112, 3, 1, 5, 8, 28.0, 168, 245, 12, '3/18', 0, 12, 0, 2, 48.43, 132.42, 20.42, 8.75);

-- Create some sample club invitations
INSERT INTO public.club_invitations (club_id, invited_by, email, status, expires_at) VALUES
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'newplayer@email.com', 'pending', NOW() + INTERVAL '5 days'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'cricketfan@email.com', 'pending', NOW() + INTERVAL '3 days'); 