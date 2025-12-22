-- Cricket Club Management App - Seed Data
-- Updated for simplified schema (December 2024)
-- This seeds the database with realistic test data

-- Clear existing data (in reverse order of dependencies)
TRUNCATE TABLE public.user_achievements CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
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

-- ============================================
-- 1. USERS (All users are players)
-- ============================================
INSERT INTO public.users (id, email, full_name, phone, location, avatar_url, is_active) VALUES
-- Club Owners
('550e8400-e29b-41d4-a716-446655440001', 'john.smith@email.com', 'John Smith', '+1234567890', 'New York, NY', NULL, true),
('550e8400-e29b-41d4-a716-446655440002', 'sarah.johnson@email.com', 'Sarah Johnson', '+1234567891', 'Los Angeles, CA', NULL, true),

-- Metropolitan Cricket Club Players
('550e8400-e29b-41d4-a716-446655440003', 'mike.wilson@email.com', 'Mike Wilson', '+1234567892', 'New York, NY', NULL, true),
('550e8400-e29b-41d4-a716-446655440004', 'david.brown@email.com', 'David Brown', '+1234567893', 'Brooklyn, NY', NULL, true),
('550e8400-e29b-41d4-a716-446655440005', 'alex.davis@email.com', 'Alex Davis', '+1234567894', 'Queens, NY', NULL, true),
('550e8400-e29b-41d4-a716-446655440006', 'chris.miller@email.com', 'Chris Miller', '+1234567895', 'Manhattan, NY', NULL, true),
('550e8400-e29b-41d4-a716-446655440007', 'tom.garcia@email.com', 'Tom Garcia', '+1234567896', 'Bronx, NY', NULL, true),
('550e8400-e29b-41d4-a716-446655440008', 'ryan.martinez@email.com', 'Ryan Martinez', '+1234567897', 'Staten Island, NY', NULL, true),
('550e8400-e29b-41d4-a716-446655440015', 'lisa.chen@email.com', 'Lisa Chen', '+1234567904', 'New York, NY', NULL, true),
('550e8400-e29b-41d4-a716-446655440016', 'amit.patel@email.com', 'Amit Patel', '+1234567905', 'Jersey City, NJ', NULL, true),
('550e8400-e29b-41d4-a716-446655440017', 'raj.kumar@email.com', 'Raj Kumar', '+1234567906', 'Edison, NJ', NULL, true),
('550e8400-e29b-41d4-a716-446655440018', 'bobby.singh@email.com', 'Bobby Singh', '+1234567907', 'Jackson Heights, NY', NULL, true),

-- Riverside Cricket Association Players
('550e8400-e29b-41d4-a716-446655440009', 'james.anderson@email.com', 'James Anderson', '+1234567898', 'Los Angeles, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440010', 'kevin.taylor@email.com', 'Kevin Taylor', '+1234567899', 'Santa Monica, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440011', 'mark.thomas@email.com', 'Mark Thomas', '+1234567800', 'Beverly Hills, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440012', 'paul.jackson@email.com', 'Paul Jackson', '+1234567801', 'Hollywood, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440013', 'steve.white@email.com', 'Steve White', '+1234567802', 'Pasadena, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440014', 'dan.harris@email.com', 'Dan Harris', '+1234567803', 'Long Beach, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440019', 'carlos.rodriguez@email.com', 'Carlos Rodriguez', '+1234567908', 'San Diego, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440020', 'peter.wong@email.com', 'Peter Wong', '+1234567909', 'Irvine, CA', NULL, true);

-- ============================================
-- 2. CLUBS
-- ============================================
INSERT INTO public.clubs (id, name, short_name, description, location, contact_email, contact_phone, is_public, logo_url, owner_id) VALUES
('650e8400-e29b-41d4-a716-446655440001', 'Metropolitan Cricket Club', 'MCC', 'Premier cricket club in New York area with focus on competitive cricket and community development', 'New York, NY', 'info@metrocricket.com', '+1234567890', true, NULL, '550e8400-e29b-41d4-a716-446655440001'),
('650e8400-e29b-41d4-a716-446655440002', 'Riverside Cricket Association', 'RCA', 'Los Angeles based cricket club promoting cricket in Southern California', 'Los Angeles, CA', 'contact@riversidecricket.com', '+1234567891', true, NULL, '550e8400-e29b-41d4-a716-446655440002');

-- ============================================
-- 3. CLUB MEMBERSHIPS
-- ============================================
INSERT INTO public.club_memberships (club_id, user_id, role, status) VALUES
-- Metropolitan Cricket Club
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'owner', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'admin', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440015', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440016', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440017', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440018', 'member', 'active'),

-- Riverside Cricket Association
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'owner', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440009', 'admin', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440010', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440011', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440012', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440013', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440019', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440020', 'member', 'active');

-- ============================================
-- 4. TEAMS
-- ============================================
INSERT INTO public.teams (id, name, short_name, description, club_id, captain_id, vice_captain_id, team_type, is_template, created_by) VALUES
('750e8400-e29b-41d4-a716-446655440001', 'Metropolitan Strikers', 'Strikers', 'First team of Metropolitan Cricket Club', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 'club', false, '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440002', 'Riverside Warriors', 'Warriors', 'First team of Riverside Cricket Association', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440009', 'club', false, '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440003', 'Metropolitan Thunder', 'Thunder', 'B Team of Metropolitan Cricket Club', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440016', 'club', false, '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440004', 'Riverside Titans', 'Titans', 'B Team of Riverside Cricket Association', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440019', '550e8400-e29b-41d4-a716-446655440020', 'club', false, '550e8400-e29b-41d4-a716-446655440002');

-- ============================================
-- 5. TEAM PLAYERS
-- ============================================
INSERT INTO public.team_players (team_id, user_id, jersey_number, batting_order, is_playing_xi, role_in_team, added_by) VALUES
-- Metropolitan Strikers (11 players)
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 1, 1, true, 'captain', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 2, 2, true, 'wicket_keeper', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 3, 3, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', 4, 4, true, 'vice_captain', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 5, 5, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 6, 6, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 7, 7, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440015', 8, 8, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440016', 9, 9, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440017', 10, 10, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440018', 11, 11, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),

-- Riverside Warriors (11 players)
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', 1, 1, true, 'captain', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440009', 2, 2, true, 'vice_captain', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440010', 3, 3, true, 'wicket_keeper', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440013', 4, 4, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 5, 5, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440011', 6, 6, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440012', 7, 7, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440019', 8, 8, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440020', 9, 9, true, 'player', '550e8400-e29b-41d4-a716-446655440002');

-- ============================================
-- 6. TOURNAMENTS
-- ============================================
INSERT INTO public.tournaments (id, name, description, tournament_format, match_format, custom_overs, start_date, end_date, registration_deadline, max_teams, venue, rules, status, club_id, created_by) VALUES
('850e8400-e29b-41d4-a716-446655440001', 'East Coast Cricket Championship 2024', 'Premier T20 tournament for cricket clubs across the East Coast. Features the best teams competing for the championship trophy.', 'league', 'T20', NULL, '2024-07-15', '2024-08-15', '2024-07-01', 8, 'Central Park Cricket Ground', 'Standard T20 rules apply. Teams must have minimum 11 players registered.', 'ongoing', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001'),
('850e8400-e29b-41d4-a716-446655440002', 'West Coast ODI Series', 'One Day International format tournament for Southern California teams.', 'knockout', 'ODI', NULL, '2024-09-01', '2024-09-30', '2024-08-15', 4, 'Rose Bowl Cricket Ground', 'ODI format with standard ICC rules.', 'upcoming', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002'),
('850e8400-e29b-41d4-a716-446655440003', 'Weekend 10-Over Bash', 'Quick format 10-over tournament for weekend cricket fun.', 'round_robin', 'Custom', 10, '2024-07-27', '2024-07-28', '2024-07-20', 6, 'Brooklyn Cricket Academy', '10 overs per side, 5 bowlers maximum.', 'registration_open', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001');

-- ============================================
-- 7. TOURNAMENT REGISTRATIONS
-- ============================================
INSERT INTO public.tournament_registrations (tournament_id, team_id, registered_by, status, payment_status) VALUES
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'confirmed', 'paid'),
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'confirmed', 'paid'),
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'pending', 'pending'),
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'pending', 'pending');

-- ============================================
-- 8. TOURNAMENT STANDINGS
-- ============================================
INSERT INTO public.tournament_standings (tournament_id, team_id, matches_played, wins, losses, ties, no_results, points, runs_scored, runs_conceded, overs_faced, overs_bowled, net_run_rate) VALUES
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 2, 2, 0, 0, 0, 4, 330, 285, 40.0, 40.0, 1.13),
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 2, 1, 1, 0, 0, 2, 295, 310, 40.0, 40.0, -0.38);

-- ============================================
-- 9. MATCHES (Multiple configurations)
-- ============================================
INSERT INTO public.matches (id, title, match_format, overs_per_innings, team1_id, team2_id, venue, scheduled_at, actual_start_time, actual_end_time, status, toss_winner_team_id, toss_decision, current_innings, current_over, current_ball, weather_conditions, pitch_conditions, result_type, winning_team_id, win_margin_type, win_margin, result_description, umpire1_name, umpire2_name, tournament_id, club_id, created_by, match_admins) VALUES

-- MATCH 1: Completed T20 Match (Tournament)
('950e8400-e29b-41d4-a716-446655440001', 'Strikers vs Warriors - Championship Match', 'T20', 20, '750e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 'Central Park Cricket Ground', '2024-07-20 14:00:00+00', '2024-07-20 14:15:00+00', '2024-07-20 18:30:00+00', 'completed', '750e8400-e29b-41d4-a716-446655440001', 'bat', 2, 20, 6, 'Sunny', 'Good batting wicket', 'win', '750e8400-e29b-41d4-a716-446655440001', 'runs', 23, 'Metropolitan Strikers won by 23 runs', 'John Roberts', 'Mike Stevens', '850e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', ARRAY['550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440002'::uuid]),

-- MATCH 2: Live T20 Match (Direct - no tournament)
('950e8400-e29b-41d4-a716-446655440002', 'Warriors vs Strikers - Rematch', 'T20', 20, '750e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440001', 'Rose Bowl Cricket Ground', '2024-07-25 15:00:00+00', '2024-07-25 15:10:00+00', NULL, 'live', '750e8400-e29b-41d4-a716-446655440002', 'bowl', 1, 8, 3, 'Partly cloudy', 'Slightly damp', NULL, NULL, NULL, NULL, NULL, 'David Clark', 'Peter Mills', NULL, '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', ARRAY['550e8400-e29b-41d4-a716-446655440002'::uuid]),

-- MATCH 3: Scheduled ODI Match
('950e8400-e29b-41d4-a716-446655440003', 'ODI Series - Match 1', 'ODI', 50, '750e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 'Central Park Cricket Ground', '2024-09-05 10:00:00+00', NULL, NULL, 'scheduled', NULL, NULL, 1, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '850e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', ARRAY['550e8400-e29b-41d4-a716-446655440001'::uuid]),

-- MATCH 4: Custom 10-over match (completed)
('950e8400-e29b-41d4-a716-446655440004', 'Quick 10-Over Friendly', 'Custom', 10, '750e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440004', 'Brooklyn Cricket Academy', '2024-07-22 16:00:00+00', '2024-07-22 16:05:00+00', '2024-07-22 18:00:00+00', 'completed', '750e8400-e29b-41d4-a716-446655440003', 'bat', 2, 10, 6, 'Evening', 'Fast outfield', 'win', '750e8400-e29b-41d4-a716-446655440003', 'wickets', 4, 'Metropolitan Thunder won by 4 wickets', 'Tony Brown', NULL, NULL, '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', ARRAY['550e8400-e29b-41d4-a716-446655440001'::uuid]),

-- MATCH 5: T20 Match (abandoned)
('950e8400-e29b-41d4-a716-446655440005', 'T20 League - Abandoned Match', 'T20', 20, '750e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440004', 'Central Park Cricket Ground', '2024-07-18 14:00:00+00', '2024-07-18 14:10:00+00', '2024-07-18 15:00:00+00', 'abandoned', '750e8400-e29b-41d4-a716-446655440001', 'bat', 1, 5, 2, 'Heavy rain', 'Wet', 'abandoned', NULL, NULL, NULL, 'Match abandoned due to rain', 'John Roberts', 'Mike Stevens', '850e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', ARRAY['550e8400-e29b-41d4-a716-446655440001'::uuid]);

-- ============================================
-- 10. INNINGS
-- ============================================
INSERT INTO public.innings (id, match_id, team_id, innings_number, total_runs, total_wickets, total_overs, total_balls, extras_total, extras_byes, extras_leg_byes, extras_wides, extras_no_balls, extras_penalties, is_completed, target_runs) VALUES
-- Match 1 Innings
('a50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 1, 165, 6, 20.0, 120, 12, 2, 3, 5, 2, 0, true, NULL),
('a50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 2, 142, 8, 20.0, 120, 8, 1, 2, 4, 1, 0, true, 166),

-- Match 2 Innings (Live match - first innings in progress)
('a50e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440001', 1, 72, 2, 8.3, 51, 5, 1, 1, 2, 1, 0, false, NULL),

-- Match 4 Innings (10-over match)
('a50e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440003', 1, 95, 4, 10.0, 60, 6, 1, 2, 2, 1, 0, true, NULL),
('a50e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440004', 2, 96, 6, 9.2, 56, 4, 0, 1, 2, 1, 0, true, 96);

-- ============================================
-- 11. BATTING PERFORMANCES (Sample for Match 1)
-- ============================================
INSERT INTO public.batting_performances (match_id, innings_id, user_id, batting_position, runs_scored, balls_faced, minutes_batted, fours, sixes, is_out, dismissal_type, bowler_id, fielder_id, is_current_batsman, is_striker) VALUES
-- Match 1, Innings 1 (Strikers batting)
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 1, 45, 32, 45, 6, 1, true, 'caught', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440013', false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 2, 28, 24, 35, 3, 0, true, 'bowled', '550e8400-e29b-41d4-a716-446655440012', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 3, 35, 28, 38, 4, 1, true, 'lbw', '550e8400-e29b-41d4-a716-446655440011', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', 4, 22, 18, 25, 2, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440010', false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 5, 15, 12, 18, 1, 0, true, 'run_out', NULL, '550e8400-e29b-41d4-a716-446655440014', false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 6, 8, 6, 10, 1, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440009', false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 7, 12, 8, 12, 0, 1, false, NULL, NULL, NULL, false, false),

-- Match 2, Innings 1 (Live match - current batsmen)
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 1, 38, 28, 40, 5, 1, false, NULL, NULL, NULL, true, true),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 2, 12, 10, 15, 1, 0, true, 'bowled', '550e8400-e29b-41d4-a716-446655440011', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440007', 3, 22, 13, 18, 3, 0, false, NULL, NULL, NULL, true, false);

-- ============================================
-- 12. BOWLING PERFORMANCES (Sample for Match 1)
-- ============================================
INSERT INTO public.bowling_performances (match_id, innings_id, user_id, overs_bowled, balls_bowled, runs_conceded, wickets_taken, maidens, wides, no_balls, is_current_bowler) VALUES
-- Match 1, Innings 1 (Warriors bowling)
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440011', 4.0, 24, 32, 2, 0, 2, 1, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440012', 4.0, 24, 28, 2, 0, 1, 0, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440014', 4.0, 24, 35, 1, 0, 1, 1, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440009', 4.0, 24, 38, 0, 0, 1, 0, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440013', 4.0, 24, 32, 1, 0, 0, 0, false),

-- Match 2, Innings 1 (Live - current bowler)
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440011', 2.0, 12, 15, 1, 0, 0, 0, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440012', 1.5, 11, 22, 1, 0, 1, 1, true);

-- ============================================
-- 13. BALL BY BALL (Sample current over for live match)
-- ============================================
INSERT INTO public.ball_by_ball (match_id, innings_id, over_number, ball_number, bowler_id, batsman_id, non_striker_id, runs_scored, extras, extra_type, is_wicket, dismissal_type, fielder_id, commentary) VALUES
-- Over 0
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 0, 1, '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 0, 0, NULL, false, NULL, NULL, 'Good length delivery, blocked.'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 0, 2, '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 4, 0, NULL, false, NULL, NULL, 'FOUR! Driven beautifully through covers'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 0, 3, '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 1, 0, NULL, false, NULL, NULL, 'Single to mid-on'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 0, 4, '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', 4, 0, NULL, false, NULL, NULL, 'FOUR! Short ball pulled away'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 0, 5, '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', 0, 0, NULL, false, NULL, NULL, 'Beaten outside off'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 0, 6, '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', 1, 0, NULL, false, NULL, NULL, 'Quick single to end the over'),

-- Over 1 (Wicket falls)
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 1, 1, '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 6, 0, NULL, false, NULL, NULL, 'SIX! Huge hit over long on'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 1, 2, '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 1, 0, NULL, false, NULL, NULL, 'Single taken'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 1, 3, '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', 0, 0, NULL, true, 'bowled', NULL, 'BOWLED HIM! Cleaned up the stumps'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 1, 4, '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', 0, 0, NULL, false, NULL, NULL, 'New batsman defends first ball'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 1, 5, '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', 1, 0, NULL, false, NULL, NULL, 'Off the mark with a single'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 1, 6, '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440007', 4, 0, NULL, false, NULL, NULL, 'Flicked nicely for four'),

-- Over 2 (Current over)
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 2, 1, '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', 2, 0, NULL, false, NULL, NULL, 'Driven through the covers for two'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 2, 2, '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', 0, 0, NULL, false, NULL, NULL, 'Missed out on a loose delivery'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 2, 3, '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', 1, 0, NULL, false, NULL, NULL, 'Pushed for a single to rotates strike'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 2, 4, '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440007', 0, 1, 'wide', false, NULL, NULL, 'Wide ball down leg side'),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 2, 5, '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440007', 4, 0, NULL, false, NULL, NULL, 'Pulled away for four!');

-- ============================================
-- 15. FALL OF WICKETS
-- ============================================
INSERT INTO public.fall_of_wickets (match_id, innings_id, wicket_number, runs_at_fall, overs_at_fall, batsman_out_id, dismissal_type, bowler_id, fielder_id) VALUES
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', 1, 52, 6.2, '550e8400-e29b-41d4-a716-446655440003', 'caught', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440013'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', 2, 78, 10.1, '550e8400-e29b-41d4-a716-446655440004', 'bowled', '550e8400-e29b-41d4-a716-446655440012', NULL),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', 1, 25, 3.4, '550e8400-e29b-41d4-a716-446655440004', 'bowled', '550e8400-e29b-41d4-a716-446655440011', NULL);

-- ============================================
-- 16. CLUB INVITATIONS
-- ============================================
INSERT INTO public.club_invitations (club_id, invited_by, email, user_id, status, expires_at) VALUES
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'newplayer@email.com', NULL, 'pending', NOW() + INTERVAL '5 days'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'cricketfan@email.com', NULL, 'pending', NOW() + INTERVAL '3 days');

-- ============================================
-- 17. PLAYER CAREER STATS
-- ============================================
INSERT INTO public.player_career_stats (user_id, total_matches, total_innings_batted, total_runs, total_balls_faced, total_fours, total_sixes, highest_score, not_outs, centuries, half_centuries, total_innings_bowled, total_overs_bowled, total_balls_bowled, total_runs_conceded, total_wickets, best_bowling_figures, five_wicket_hauls, total_catches, total_stumpings, total_run_outs, batting_average, strike_rate, bowling_average, economy_rate) VALUES
('550e8400-e29b-41d4-a716-446655440003', 15, 15, 567, 445, 68, 12, 89, 2, 0, 4, 0, 0.0, 0, 0, 0, NULL, 0, 8, 0, 0, 43.62, 127.42, NULL, NULL),
('550e8400-e29b-41d4-a716-446655440005', 12, 8, 156, 98, 18, 3, 45, 1, 0, 1, 12, 42.0, 252, 298, 18, '4/22', 0, 5, 0, 0, 22.29, 159.18, 16.56, 7.10),
('550e8400-e29b-41d4-a716-446655440014', 18, 17, 678, 512, 78, 15, 112, 3, 1, 5, 8, 28.0, 168, 245, 12, '3/18', 0, 12, 0, 2, 48.43, 132.42, 20.42, 8.75);

-- ============================================
-- 18. MATCH CLAIMS
-- ============================================
INSERT INTO public.match_claims (user_id, match_title, match_date, venue, opponent_team, runs_scored, balls_faced, fours, sixes, wickets_taken, overs_bowled, runs_conceded, catches, stumpings, run_outs, additional_notes, status, verified_by, verification_notes) VALUES
('550e8400-e29b-41d4-a716-446655440003', 'Local League Match', '2024-06-15', 'Brooklyn Cricket Ground', 'Brooklyn Blazers', 67, 45, 8, 2, NULL, NULL, NULL, 1, 0, 0, 'Scored 67 runs in the quarter-final match', 'pending', NULL, NULL),
('550e8400-e29b-41d4-a716-446655440005', 'Weekend Tournament', '2024-06-10', 'Queens Cricket Field', 'Queens Royals', 12, 8, 1, 0, 3, 4.0, 28, 0, 0, 0, 'Took 3 wickets in a crucial spell', 'verified', '550e8400-e29b-41d4-a716-446655440001', 'Verified by match organizer');

-- ============================================
-- 19. NOTIFICATIONS
-- ============================================
INSERT INTO public.notifications (user_id, type, title, message, data, is_read) VALUES
('550e8400-e29b-41d4-a716-446655440003', 'match_reminder', 'Match Tomorrow!', 'You have a match scheduled tomorrow at 2:00 PM', '{"match_id": "950e8400-e29b-41d4-a716-446655440003"}', false),
('550e8400-e29b-41d4-a716-446655440014', 'match_result', 'Match Result', 'Your team lost by 23 runs. Better luck next time!', '{"match_id": "950e8400-e29b-41d4-a716-446655440001"}', true),
('550e8400-e29b-41d4-a716-446655440001', 'tournament_update', 'Tournament Update', 'East Coast Championship standings have been updated', '{"tournament_id": "850e8400-e29b-41d4-a716-446655440001"}', false),
('550e8400-e29b-41d4-a716-446655440005', 'achievement', 'New Achievement!', 'Congratulations! You took your first 3-wicket haul', '{"type": "three_wickets"}', false);

-- ============================================
-- 20. USER ACHIEVEMENTS
-- ============================================
INSERT INTO public.user_achievements (user_id, achievement_type, match_id, achievement_data) VALUES
('550e8400-e29b-41d4-a716-446655440003', 'half_century', '950e8400-e29b-41d4-a716-446655440001', '{"runs": 45, "balls": 32, "fours": 6, "sixes": 1}'),
('550e8400-e29b-41d4-a716-446655440014', 'century', NULL, '{"runs": 112, "balls": 78, "match_title": "Previous Match"}'),
('550e8400-e29b-41d4-a716-446655440005', 'five_wickets', NULL, '{"wickets": 5, "runs": 28, "overs": 8}');

-- ============================================
-- Grant test user access (for local development only)
-- ============================================
-- Note: In production, users are created through Supabase Auth.
-- For local testing, you can create auth users and link them to these profiles.
