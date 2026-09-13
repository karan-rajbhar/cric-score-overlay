-- Cricket Club Management App - Comprehensive Seed Data
-- Fully realistic, production-grade test dataset across all 23 tables

TRUNCATE TABLE public.user_achievements CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.player_career_stats CASCADE;
TRUNCATE TABLE public.match_claims CASCADE;
TRUNCATE TABLE public.match_events CASCADE;
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
TRUNCATE TABLE public.club_hall_of_fame CASCADE;
TRUNCATE TABLE public.club_seasons CASCADE;
TRUNCATE TABLE public.clubs CASCADE;
TRUNCATE TABLE public.users CASCADE;

-- ============================================
-- 1. USERS
-- ============================================
INSERT INTO public.users (id, email, full_name, phone, location, avatar_url, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'john.smith@email.com', 'John Smith', '+1234567890', 'New York, NY', NULL, true),
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
('550e8400-e29b-41d4-a716-446655440021', 'jordan.bell@email.com', 'Jordan Bell', '+1234567910', 'White Plains, NY', NULL, true),
('550e8400-e29b-41d4-a716-446655440022', 'sam.clark@email.com', 'Sam Clark', '+1234567911', 'Hoboken, NJ', NULL, true),
('550e8400-e29b-41d4-a716-446655440023', 'marcus.taylor@email.com', 'Marcus Taylor', '+1234567912', 'Stamford, CT', NULL, true),
('550e8400-e29b-41d4-a716-446655440024', 'nathan.wood@email.com', 'Nathan Wood', '+1234567913', 'Yonkers, NY', NULL, true),
('550e8400-e29b-41d4-a716-446655440029', 'liam.wright@email.com', 'Liam Wright', '+1234567918', 'New York, NY', NULL, true),
('c7e37a47-cb3f-45bf-b5da-9c8ca617d049', 'kran@outlook.com', 'Karan Rajbhar', '+1234567999', 'New York, NY', NULL, true),
('550e8400-e29b-41d4-a716-446655440002', 'sarah.johnson@email.com', 'Sarah Johnson', '+1234567891', 'Los Angeles, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440014', 'dan.harris@email.com', 'Dan Harris', '+1234567803', 'Long Beach, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440009', 'james.anderson@email.com', 'James Anderson', '+1234567898', 'Los Angeles, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440010', 'kevin.taylor@email.com', 'Kevin Taylor', '+1234567899', 'Santa Monica, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440011', 'mark.thomas@email.com', 'Mark Thomas', '+1234567800', 'Beverly Hills, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440012', 'paul.jackson@email.com', 'Paul Jackson', '+1234567801', 'Hollywood, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440013', 'steve.white@email.com', 'Steve White', '+1234567802', 'Pasadena, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440019', 'carlos.rodriguez@email.com', 'Carlos Rodriguez', '+1234567908', 'San Diego, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440020', 'peter.wong@email.com', 'Peter Wong', '+1234567909', 'Irvine, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440025', 'derek.hall@email.com', 'Derek Hall', '+1234567914', 'Anaheim, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440026', 'brian.evans@email.com', 'Brian Evans', '+1234567915', 'Glendale, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440027', 'jason.lee@email.com', 'Jason Lee', '+1234567916', 'Torrance, CA', NULL, true),
('550e8400-e29b-41d4-a716-446655440028', 'aaron.green@email.com', 'Aaron Green', '+1234567917', 'Burbank, CA', NULL, true);

-- ============================================
-- 2. CLUBS
-- ============================================
INSERT INTO public.clubs (id, name, short_name, description, location, contact_email, contact_phone, is_public, logo_url, owner_id, social_links) VALUES
('650e8400-e29b-41d4-a716-446655440001', 'Metropolitan Cricket Club', 'MCC', 'Premier cricket club in New York area with focus on competitive championship cricket and community development.', 'New York, NY', 'info@metrocricket.com', '+1234567890', true, NULL, '550e8400-e29b-41d4-a716-446655440001', '{"twitter": "@MetroCricketNY", "instagram": "@metrocricket", "website": "https://metrocricket.org"}'::jsonb),
('650e8400-e29b-41d4-a716-446655440002', 'Riverside Cricket Association', 'RCA', 'Los Angeles based cricket club promoting high-performance cricket in Southern California.', 'Los Angeles, CA', 'contact@riversidecricket.com', '+1234567891', true, NULL, '550e8400-e29b-41d4-a716-446655440002', '{"twitter": "@RiversideCricket", "instagram": "@riversidecricketca", "website": "https://riversidecricket.com"}'::jsonb);

-- ============================================
-- 3. CLUB SEASONS
-- ============================================
INSERT INTO public.club_seasons (id, club_id, name, start_date, end_date, is_current) VALUES
('650e8400-e29b-41d4-a716-446655440010', '650e8400-e29b-41d4-a716-446655440001', '2024 Championship Season', '2024-04-01', '2024-10-31', true),
('650e8400-e29b-41d4-a716-446655440011', '650e8400-e29b-41d4-a716-446655440001', '2023 Summer League', '2023-04-01', '2023-10-31', false),
('650e8400-e29b-41d4-a716-446655440012', '650e8400-e29b-41d4-a716-446655440002', '2024 Southern California Summer Season', '2024-05-01', '2024-11-30', true);

-- ============================================
-- 4. CLUB HALL OF FAME
-- ============================================
INSERT INTO public.club_hall_of_fame (club_id, player_id, category, title, description, season_or_year, record_metric, created_by) VALUES
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'legend', 'All-Time Club Top Scorer', 'Amassed over 2,500 club runs at an extraordinary average of 48.5 with 4 centuries.', '2021-2024', '2,540 Runs @ 48.5 AVG', '550e8400-e29b-41d4-a716-446655440001'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 'top_scorer', 'Highest Individual Score (134*)', 'Scored an unbeaten 134 in the 2023 East Coast Championship Final to lift the trophy.', '2023 Final', '134* (68 balls, 14x4, 7x6)', '550e8400-e29b-41d4-a716-446655440001'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440015', 'top_wicket_taker', 'Single Season Bowling Record', 'Paced MCC attack with 32 wickets at an incredible economy of 5.8 runs per over in 2023.', '2023 Season', '32 Wickets @ 14.2 AVG', '550e8400-e29b-41d4-a716-446655440001'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', 'legend', 'Founding Captain & Batting Pillar', 'Guided Riverside to 3 regional championships while accumulating 1,890 runs.', '2020-2024', '1,890 Runs & 3 Titles', '550e8400-e29b-41d4-a716-446655440002'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440009', 'top_wicket_taker', 'All-Time Wicket Taker', 'Led the RCA pace attack for four consecutive seasons taking 140 wickets in competitive matches.', '2020-2024', '140 Wickets @ 17.8 AVG', '550e8400-e29b-41d4-a716-446655440002');

-- ============================================
-- 5. CLUB MEMBERSHIPS
-- ============================================
INSERT INTO public.club_memberships (club_id, user_id, role, status) VALUES
-- MCC
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'owner', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'admin', 'active'),
('650e8400-e29b-41d4-a716-446655440001', 'c7e37a47-cb3f-45bf-b5da-9c8ca617d049', 'admin', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440015', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440016', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440017', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440018', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440021', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440022', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440023', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440024', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440029', 'member', 'active'),

-- RCA
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'owner', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', 'admin', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440009', 'admin', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440010', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440011', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440012', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440013', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440019', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440020', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440025', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440026', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440027', 'member', 'active'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440028', 'member', 'active');

-- ============================================
-- 6. TEAMS
-- ============================================
INSERT INTO public.teams (id, name, short_name, description, club_id, captain_id, vice_captain_id, team_type, is_template, created_by) VALUES
('750e8400-e29b-41d4-a716-446655440001', 'Metropolitan Strikers', 'Strikers', 'First XI team of Metropolitan Cricket Club', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440008', 'club', false, '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440002', 'Riverside Warriors', 'Warriors', 'First XI team of Riverside Cricket Association', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440009', 'club', false, '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440003', 'Metropolitan Thunder', 'Thunder', 'Development & B Team of Metropolitan Cricket Club', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440016', 'club', false, '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440004', 'Riverside Titans', 'Titans', 'Development & B Team of Riverside Cricket Association', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440019', '550e8400-e29b-41d4-a716-446655440020', 'club', false, '550e8400-e29b-41d4-a716-446655440002');

-- ============================================
-- 7. TEAM PLAYERS (Full rosters for ALL 4 teams!)
-- ============================================
INSERT INTO public.team_players (team_id, user_id, jersey_number, batting_order, is_playing_xi, role_in_team, added_by) VALUES
-- Metropolitan Strikers (13 players)
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 1, 1, true, 'captain', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 2, 2, true, 'wicket_keeper', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 3, 3, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', 4, 4, true, 'vice_captain', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 5, 5, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 6, 6, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 7, 7, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', 'c7e37a47-cb3f-45bf-b5da-9c8ca617d049', 8, 8, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440015', 9, 9, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440016', 10, 10, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440017', 11, 11, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440018', 12, 12, false, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440029', 13, 13, false, 'player', '550e8400-e29b-41d4-a716-446655440001'),

-- Riverside Warriors (13 players)
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', 1, 1, true, 'captain', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440010', 2, 2, true, 'wicket_keeper', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440013', 3, 3, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440009', 4, 4, true, 'vice_captain', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 5, 5, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440011', 6, 6, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440012', 7, 7, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440019', 8, 8, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440020', 9, 9, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440025', 10, 10, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440026', 11, 11, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440027', 12, 12, false, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440028', 13, 13, false, 'player', '550e8400-e29b-41d4-a716-446655440002'),

-- Metropolitan Thunder (11 players)
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440021', 1, 1, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440022', 2, 2, true, 'wicket_keeper', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440024', 3, 3, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440023', 4, 4, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440015', 5, 5, true, 'captain', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440016', 6, 6, true, 'vice_captain', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440017', 7, 7, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440018', 8, 8, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440029', 9, 9, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440005', 10, 10, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440006', 11, 11, true, 'player', '550e8400-e29b-41d4-a716-446655440001'),

-- Riverside Titans (11 players)
('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440027', 1, 1, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440020', 2, 2, true, 'vice_captain', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440025', 3, 3, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440019', 4, 4, true, 'captain', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440026', 5, 5, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440028', 6, 6, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440010', 7, 7, true, 'wicket_keeper', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440013', 8, 8, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440011', 9, 9, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440012', 10, 10, true, 'player', '550e8400-e29b-41d4-a716-446655440002'),
('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440009', 11, 11, true, 'player', '550e8400-e29b-41d4-a716-446655440002');

-- ============================================
-- 8. TOURNAMENTS
-- ============================================
INSERT INTO public.tournaments (id, name, description, tournament_format, match_format, custom_overs, start_date, end_date, registration_deadline, max_teams, venue, rules, status, club_id, created_by, season_id, wickets_per_innings, last_man_stands, golden_ball) VALUES
('850e8400-e29b-41d4-a716-446655440001', 'East Coast Cricket Championship 2024', 'Premier T20 tournament for cricket clubs across the East Coast. Features the best teams competing for the championship trophy.', 'league', 'T20', NULL, '2024-07-15', '2024-08-30', '2024-07-01', 8, 'Central Park Cricket Ground', 'Standard ICC T20 rules apply. 20 overs per innings, maximum 4 overs per bowler.', 'ongoing', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440010', 10, false, false),
('850e8400-e29b-41d4-a716-446655440003', 'Weekend 10-Over Bash', 'Fast-paced 10-over tournament featuring custom rules including Last Man Stands and Golden Ball tiebreakers.', 'round_robin', 'Custom', 10, '2024-07-27', '2024-08-15', '2024-07-20', 6, 'Brooklyn Cricket Academy', '10 overs per side, 8 wickets per innings, Last Man Stands enabled.', 'ongoing', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440010', 8, true, true),
('850e8400-e29b-41d4-a716-446655440002', 'West Coast ODI Series', 'Premier 50-over One Day International format tournament for Southern California clubs.', 'knockout', 'ODI', 50, '2024-09-01', '2024-09-30', '2024-08-15', 4, 'Rose Bowl Cricket Ground', 'Standard 50-over ODI format with ICC rules and powerplays.', 'upcoming', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440012', 10, false, false);

-- ============================================
-- 9. TOURNAMENT REGISTRATIONS
-- ============================================
INSERT INTO public.tournament_registrations (tournament_id, team_id, registered_by, status, payment_status) VALUES
-- East Coast Championship (4 confirmed teams)
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'confirmed', 'paid'),
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'confirmed', 'paid'),
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'confirmed', 'paid'),
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'confirmed', 'paid'),

-- Weekend 10-Over Bash (4 confirmed teams)
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'confirmed', 'paid'),
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'confirmed', 'paid'),
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'confirmed', 'paid'),
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'confirmed', 'paid'),

-- West Coast ODI Series (3 confirmed teams, 1 pending)
('850e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'confirmed', 'paid'),
('850e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'confirmed', 'paid'),
('850e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'confirmed', 'paid');

-- ============================================
-- 10. MATCHES
-- ============================================
INSERT INTO public.matches (id, title, match_format, overs_per_innings, team1_id, team2_id, venue, scheduled_at, actual_start_time, actual_end_time, status, toss_winner_team_id, toss_decision, current_innings, current_over, current_ball, weather_conditions, pitch_conditions, result_type, winning_team_id, win_margin_type, win_margin, result_description, umpire1_name, umpire2_name, tournament_id, club_id, created_by, match_admins, player_of_the_match_id, wickets_per_innings, last_man_stands, golden_ball, season_id) VALUES

-- MATCH 1: Completed T20 Derby (East Coast Championship)
('950e8400-e29b-41d4-a716-446655440001', 'Strikers vs Warriors - Championship Opener', 'T20', 20, '750e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 'Central Park Cricket Ground', '2024-07-20 14:00:00+00', '2024-07-20 14:15:00+00', '2024-07-20 17:45:00+00', 'completed', '750e8400-e29b-41d4-a716-446655440001', 'bat', 2, 20, 0, 'Sunny, 24°C', 'Hard, true bounce', 'win', '750e8400-e29b-41d4-a716-446655440001', 'runs', 16, 'Metropolitan Strikers won by 16 runs', 'John Roberts', 'Mike Stevens', '850e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', ARRAY['550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid], '550e8400-e29b-41d4-a716-446655440003', 10, false, false, '650e8400-e29b-41d4-a716-446655440010'),

-- MATCH 2: Completed T20 Derby (Thunder upset Warriors)
('950e8400-e29b-41d4-a716-446655440002', 'Thunder vs Warriors - League Match 2', 'T20', 20, '750e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440003', 'Central Park Cricket Ground', '2024-07-22 14:00:00+00', '2024-07-22 14:05:00+00', '2024-07-22 17:30:00+00', 'completed', '750e8400-e29b-41d4-a716-446655440002', 'bat', 2, 18, 3, 'Clear sky, 26°C', 'Slightly slow', 'win', '750e8400-e29b-41d4-a716-446655440003', 'wickets', 6, 'Metropolitan Thunder won by 6 wickets', 'David Clark', 'Peter Mills', '850e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', ARRAY['550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440015'::uuid], '550e8400-e29b-41d4-a716-446655440015', 10, false, false, '650e8400-e29b-41d4-a716-446655440010'),

-- MATCH 3: Live T20 In-Progress (Strikers vs Titans)
('950e8400-e29b-41d4-a716-446655440003', 'Strikers vs Titans - Match 3 (LIVE)', 'T20', 20, '750e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440001', 'Central Park Cricket Ground', '2024-07-24 15:00:00+00', '2024-07-24 15:10:00+00', NULL, 'live', '750e8400-e29b-41d4-a716-446655440004', 'bat', 2, 13, 4, 'Partly cloudy, 22°C', 'Excellent batting wicket', NULL, NULL, NULL, NULL, NULL, 'Tony Brown', 'John Roberts', '850e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', ARRAY['550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid], NULL, 10, false, false, '650e8400-e29b-41d4-a716-446655440010'),

-- MATCH 4: Completed 10-Over Bash (Strikers vs Thunder)
('950e8400-e29b-41d4-a716-446655440004', 'Strikers vs Thunder - 10-Over Bash Match 1', 'Custom', 10, '750e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440003', 'Brooklyn Cricket Academy', '2024-07-27 16:00:00+00', '2024-07-27 16:05:00+00', '2024-07-27 17:35:00+00', 'completed', '750e8400-e29b-41d4-a716-446655440001', 'bat', 2, 10, 0, 'Sunny, 28°C', 'Fast synthetic turf', 'win', '750e8400-e29b-41d4-a716-446655440001', 'runs', 14, 'Metropolitan Strikers won by 14 runs', 'Sam Wilson', 'Paul Davis', '850e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', ARRAY['550e8400-e29b-41d4-a716-446655440001'::uuid], '550e8400-e29b-41d4-a716-446655440008', 8, true, true, '650e8400-e29b-41d4-a716-446655440010'),

-- MATCH 5: Live 10-Over Bash (Warriors vs Titans)
('950e8400-e29b-41d4-a716-446655440005', 'Warriors vs Titans - 10-Over Bash Match 2 (LIVE)', 'Custom', 10, '750e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440004', 'Brooklyn Cricket Academy', '2024-07-28 17:00:00+00', '2024-07-28 17:05:00+00', NULL, 'live', '750e8400-e29b-41d4-a716-446655440002', 'bat', 2, 8, 2, 'Cool breeze, 21°C', 'Fast outfield', NULL, NULL, NULL, NULL, NULL, 'Sam Wilson', 'Paul Davis', '850e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', ARRAY['550e8400-e29b-41d4-a716-446655440002'::uuid], NULL, 8, true, true, '650e8400-e29b-41d4-a716-446655440010'),

-- MATCH 6: Scheduled T20 Semi-Final (East Coast Championship)
('950e8400-e29b-41d4-a716-446655440006', 'Semi-Final 1: Strikers vs Warriors', 'T20', 20, '750e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 'Central Park Cricket Ground', '2024-08-10 14:00:00+00', NULL, NULL, 'scheduled', NULL, NULL, 1, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'John Roberts', 'David Clark', '850e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', ARRAY['550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid], NULL, 10, false, false, '650e8400-e29b-41d4-a716-446655440010'),

-- MATCH 7: Scheduled ODI Series (West Coast ODI)
('950e8400-e29b-41d4-a716-446655440007', 'ODI Match 1: Warriors vs Titans', 'ODI', 50, '750e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440004', 'Rose Bowl Cricket Ground', '2024-09-05 10:00:00+00', NULL, NULL, 'scheduled', NULL, NULL, 1, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Peter Mills', 'Steve Archer', '850e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', ARRAY['550e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440014'::uuid], NULL, 10, false, false, '650e8400-e29b-41d4-a716-446655440012'),

-- MATCH 8: Completed Friendly Classic Tie + Super Over
('950e8400-e29b-41d4-a716-446655440008', 'MCC Derby - Strikers vs Warriors (Classic Tied Match)', 'T20', 20, '750e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 'Central Park Cricket Ground', '2024-06-15 14:00:00+00', '2024-06-15 14:10:00+00', '2024-06-15 18:00:00+00', 'completed', '750e8400-e29b-41d4-a716-446655440002', 'bowl', 2, 20, 0, 'Mild, 20°C', 'Dry pitch', 'tie', NULL, NULL, NULL, 'Match Tied - Strikers won the Super Over 18/0 to 14/1', 'Mike Stevens', 'David Clark', NULL, '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', ARRAY['550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid], '550e8400-e29b-41d4-a716-446655440003', 10, false, false, '650e8400-e29b-41d4-a716-446655440010');

-- ============================================
-- 11. INNINGS
-- ============================================
INSERT INTO public.innings (id, match_id, team_id, innings_number, total_runs, total_wickets, total_overs, total_balls, extras_total, extras_byes, extras_leg_byes, extras_wides, extras_no_balls, extras_penalties, is_completed, target_runs) VALUES
-- Match 1 (Strikers 178/5 vs Warriors 162/8)
('a50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 1, 178, 5, 20.0, 120, 14, 2, 4, 6, 2, 0, true, NULL),
('a50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 2, 162, 8, 20.0, 120, 10, 1, 3, 5, 1, 0, true, 179),

-- Match 2 (Warriors 152/7 vs Thunder 155/4)
('a50e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', 1, 152, 7, 20.0, 120, 12, 1, 2, 7, 2, 0, true, NULL),
('a50e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440003', 2, 155, 4, 18.3, 111, 8, 0, 2, 5, 1, 0, true, 153),

-- Match 3 (Titans 146/9 vs Strikers 108/3 LIVE)
('a50e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440004', 1, 146, 9, 20.0, 120, 15, 3, 2, 8, 2, 0, true, NULL),
('a50e8400-e29b-41d4-a716-446655440006', '950e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440001', 2, 108, 3, 13.4, 82, 6, 1, 1, 3, 1, 0, false, 147),

-- Match 4 (Strikers 102/4 vs Thunder 88/6 in 10-over bash)
('a50e8400-e29b-41d4-a716-446655440007', '950e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440001', 1, 102, 4, 10.0, 60, 8, 1, 1, 5, 1, 0, true, NULL),
('a50e8400-e29b-41d4-a716-446655440008', '950e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440003', 2, 88, 6, 10.0, 60, 6, 0, 2, 3, 1, 0, true, 103),

-- Match 5 (Warriors 94/5 vs Titans 78/4 LIVE in 10-over bash)
('a50e8400-e29b-41d4-a716-446655440009', '950e8400-e29b-41d4-a716-446655440005', '750e8400-e29b-41d4-a716-446655440002', 1, 94, 5, 10.0, 60, 7, 1, 1, 4, 1, 0, true, NULL),
('a50e8400-e29b-41d4-a716-446655440010', '950e8400-e29b-41d4-a716-446655440005', '750e8400-e29b-41d4-a716-446655440004', 2, 78, 4, 8.2, 50, 5, 0, 1, 3, 1, 0, false, 95),

-- Match 8 (Strikers 165/6 vs Warriors 165/8 Tied match)
('a50e8400-e29b-41d4-a716-446655440011', '950e8400-e29b-41d4-a716-446655440008', '750e8400-e29b-41d4-a716-446655440001', 1, 165, 6, 20.0, 120, 11, 1, 3, 5, 2, 0, true, NULL),
('a50e8400-e29b-41d4-a716-446655440012', '950e8400-e29b-41d4-a716-446655440008', '750e8400-e29b-41d4-a716-446655440002', 2, 165, 8, 20.0, 120, 9, 2, 1, 5, 1, 0, true, 166);

-- ============================================
-- 12. BATTING PERFORMANCES (Full scorecards for BOTH innings!)
-- ============================================
INSERT INTO public.batting_performances (match_id, innings_id, user_id, batting_position, runs_scored, balls_faced, minutes_batted, fours, sixes, is_out, dismissal_type, bowler_id, fielder_id, is_current_batsman, is_striker) VALUES
-- Match 1, Innings 1 (Strikers: 178/5)
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 1, 74, 48, 65, 8, 2, true, 'caught', '550e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440013', false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 2, 18, 16, 22, 2, 0, true, 'bowled', '550e8400-e29b-41d4-a716-446655440019', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 3, 36, 25, 35, 4, 1, true, 'lbw', '550e8400-e29b-41d4-a716-446655440011', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', 4, 28, 15, 20, 3, 1, false, NULL, NULL, NULL, false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 5, 12, 9, 14, 1, 0, true, 'run_out', NULL, '550e8400-e29b-41d4-a716-446655440014', false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 6, 4, 4, 6, 0, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440010', false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 7, 6, 3, 5, 1, 0, false, NULL, NULL, NULL, false, false),

-- Match 1, Innings 2 (Warriors: 162/8) - Fully populated chase!
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', 1, 65, 42, 58, 7, 2, true, 'caught', '550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440004', false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440010', 2, 14, 12, 18, 2, 0, true, 'bowled', '550e8400-e29b-41d4-a716-446655440017', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440013', 3, 24, 18, 26, 3, 0, true, 'lbw', '550e8400-e29b-41d4-a716-446655440005', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440009', 4, 8, 10, 14, 1, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440016', '550e8400-e29b-41d4-a716-446655440003', false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 5, 15, 14, 19, 1, 0, true, 'run_out', NULL, '550e8400-e29b-41d4-a716-446655440008', false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440011', 6, 19, 12, 16, 2, 1, true, 'bowled', '550e8400-e29b-41d4-a716-446655440015', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440012', 7, 6, 5, 8, 1, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440007', false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440019', 8, 4, 3, 5, 0, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440004', false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440020', 9, 2, 3, 4, 0, 0, false, NULL, NULL, NULL, false, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440025', 10, 5, 2, 3, 1, 0, false, NULL, NULL, NULL, false, false),

-- Match 2, Innings 1 (Warriors: 152/7)
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440014', 1, 42, 32, 45, 5, 1, true, 'bowled', '550e8400-e29b-41d4-a716-446655440015', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440010', 2, 22, 18, 25, 3, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440017', '550e8400-e29b-41d4-a716-446655440022', false, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440013', 3, 31, 26, 38, 3, 1, true, 'lbw', '550e8400-e29b-41d4-a716-446655440016', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440009', 4, 12, 14, 18, 1, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440018', '550e8400-e29b-41d4-a716-446655440021', false, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440011', 5, 18, 12, 15, 2, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440022', false, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440012', 6, 8, 9, 12, 1, 0, true, 'run_out', NULL, '550e8400-e29b-41d4-a716-446655440005', false, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440019', 7, 7, 6, 8, 1, 0, true, 'bowled', '550e8400-e29b-41d4-a716-446655440015', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440020', 8, 8, 3, 5, 1, 0, false, NULL, NULL, NULL, false, false),

-- Match 2, Innings 2 (Thunder: 155/4)
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440021', 1, 48, 36, 52, 6, 1, true, 'caught', '550e8400-e29b-41d4-a716-446655440019', '550e8400-e29b-41d4-a716-446655440010', false, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440022', 2, 28, 22, 30, 4, 0, true, 'lbw', '550e8400-e29b-41d4-a716-446655440026', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440024', 3, 19, 16, 24, 2, 0, true, 'bowled', '550e8400-e29b-41d4-a716-446655440009', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440023', 4, 30, 24, 34, 3, 1, true, 'caught', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440014', false, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440015', 5, 22, 12, 16, 3, 0, false, NULL, NULL, NULL, false, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440016', 6, 8, 4, 6, 1, 0, false, NULL, NULL, NULL, false, false),

-- Match 3, Innings 1 (Titans: 146/9)
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440027', 1, 34, 28, 40, 4, 1, true, 'bowled', '550e8400-e29b-41d4-a716-446655440015', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440020', 2, 16, 15, 20, 2, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440017', '550e8400-e29b-41d4-a716-446655440004', false, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440025', 3, 28, 22, 32, 3, 0, true, 'lbw', '550e8400-e29b-41d4-a716-446655440016', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440019', 4, 20, 16, 22, 2, 1, true, 'caught', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', false, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440026', 5, 12, 11, 15, 1, 0, true, 'run_out', NULL, '550e8400-e29b-41d4-a716-446655440008', false, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440028', 6, 9, 8, 12, 1, 0, true, 'bowled', '550e8400-e29b-41d4-a716-446655440015', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440013', 7, 7, 9, 14, 0, 0, true, 'caught', 'c7e37a47-cb3f-45bf-b5da-9c8ca617d049', '550e8400-e29b-41d4-a716-446655440007', false, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440011', 8, 4, 5, 8, 0, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440017', '550e8400-e29b-41d4-a716-446655440004', false, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440012', 9, 8, 5, 7, 1, 0, true, 'bowled', '550e8400-e29b-41d4-a716-446655440005', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440009', 10, 3, 2, 3, 0, 0, false, NULL, NULL, NULL, false, false),

-- Match 3, Innings 2 (Strikers: 108/3 LIVE)
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 1, 28, 22, 30, 4, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440019', '550e8400-e29b-41d4-a716-446655440010', false, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440004', 2, 14, 12, 18, 2, 0, true, 'bowled', '550e8400-e29b-41d4-a716-446655440028', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440007', 3, 21, 16, 22, 3, 0, true, 'lbw', '550e8400-e29b-41d4-a716-446655440026', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440008', 4, 38, 24, 32, 5, 1, false, NULL, NULL, NULL, true, true),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440005', 5, 19, 14, 20, 2, 0, false, NULL, NULL, NULL, true, false),

-- Match 4, Innings 1 (Strikers: 102/4 in 10 overs)
('950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', 1, 32, 18, 22, 4, 1, true, 'caught', '550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440022', false, false),
('950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440008', 2, 44, 24, 30, 5, 2, true, 'bowled', '550e8400-e29b-41d4-a716-446655440016', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440007', 3, 14, 10, 14, 2, 0, true, 'run_out', NULL, '550e8400-e29b-41d4-a716-446655440021', false, false),
('950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440004', 4, 8, 6, 8, 1, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440017', '550e8400-e29b-41d4-a716-446655440023', false, false),
('950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440006', 5, 4, 2, 4, 0, 0, false, NULL, NULL, NULL, false, false),

-- Match 4, Innings 2 (Thunder: 88/6 in 10 overs)
('950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440021', 1, 22, 16, 20, 3, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440017', '550e8400-e29b-41d4-a716-446655440004', false, false),
('950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440022', 2, 12, 10, 14, 1, 0, true, 'bowled', '550e8400-e29b-41d4-a716-446655440005', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440024', 3, 18, 14, 18, 2, 1, true, 'lbw', '550e8400-e29b-41d4-a716-446655440008', NULL, false, false),
('950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440023', 4, 15, 11, 15, 2, 0, true, 'caught', 'c7e37a47-cb3f-45bf-b5da-9c8ca617d049', '550e8400-e29b-41d4-a716-446655440003', false, false),
('950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440015', 5, 9, 6, 8, 1, 0, true, 'run_out', NULL, '550e8400-e29b-41d4-a716-446655440007', false, false),
('950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440016', 6, 6, 4, 5, 1, 0, true, 'caught', '550e8400-e29b-41d4-a716-446655440017', '550e8400-e29b-41d4-a716-446655440005', false, false),
('950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440018', 7, 2, 2, 3, 0, 0, false, NULL, NULL, NULL, false, false);

-- ============================================
-- 13. BOWLING PERFORMANCES (Full figures for BOTH innings!)
-- ============================================
INSERT INTO public.bowling_performances (match_id, innings_id, user_id, overs_bowled, balls_bowled, runs_conceded, wickets_taken, maidens, wides, no_balls, is_current_bowler) VALUES
-- Match 1, Innings 1 (Warriors bowling)
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440009', 4.0, 24, 34, 2, 0, 2, 1, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440019', 4.0, 24, 28, 1, 0, 1, 0, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440011', 4.0, 24, 38, 1, 0, 1, 1, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440012', 4.0, 24, 42, 0, 0, 1, 0, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440014', 4.0, 24, 36, 0, 0, 1, 0, false),

-- Match 1, Innings 2 (Strikers bowling)
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440015', 4.0, 24, 26, 3, 1, 1, 0, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440017', 4.0, 24, 38, 1, 0, 2, 1, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440005', 4.0, 24, 30, 2, 0, 1, 0, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440016', 4.0, 24, 34, 1, 0, 1, 0, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440008', 4.0, 24, 34, 0, 0, 0, 0, false),

-- Match 2, Innings 1 (Thunder bowling)
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440015', 4.0, 24, 24, 3, 0, 2, 1, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440017', 4.0, 24, 32, 1, 0, 1, 1, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440016', 4.0, 24, 28, 1, 0, 2, 0, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440018', 4.0, 24, 35, 1, 0, 1, 0, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440005', 4.0, 24, 33, 0, 0, 1, 0, false),

-- Match 2, Innings 2 (Warriors bowling)
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440009', 3.3, 21, 28, 1, 0, 1, 0, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440019', 4.0, 24, 32, 1, 0, 1, 1, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440026', 4.0, 24, 30, 1, 0, 2, 0, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440011', 4.0, 24, 36, 1, 0, 1, 0, false),
('950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440012', 3.0, 18, 29, 0, 0, 0, 0, false),

-- Match 3, Innings 1 (Strikers bowling vs Titans)
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440015', 4.0, 24, 22, 2, 1, 2, 0, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440017', 4.0, 24, 36, 2, 0, 2, 1, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 4.0, 24, 28, 2, 0, 1, 0, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440016', 4.0, 24, 32, 1, 0, 2, 1, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005', 'c7e37a47-cb3f-45bf-b5da-9c8ca617d049', 4.0, 24, 28, 1, 0, 1, 0, false),

-- Match 3, Innings 2 (Titans bowling LIVE vs Strikers)
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440019', 3.0, 18, 24, 1, 0, 1, 0, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440028', 3.0, 18, 26, 1, 0, 1, 1, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440026', 3.4, 22, 28, 1, 0, 1, 0, true),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440025', 2.0, 12, 18, 0, 0, 0, 0, false),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440012', 2.0, 12, 12, 0, 0, 0, 0, false);

-- ============================================
-- 14. FALL OF WICKETS
-- ============================================
INSERT INTO public.fall_of_wickets (match_id, innings_id, wicket_number, runs_at_fall, overs_at_fall, batsman_out_id, dismissal_type, bowler_id, fielder_id) VALUES
-- Match 1, Innings 1
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', 1, 35, 4.1, '550e8400-e29b-41d4-a716-446655440004', 'bowled', '550e8400-e29b-41d4-a716-446655440019', NULL),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', 2, 98, 11.5, '550e8400-e29b-41d4-a716-446655440007', 'lbw', '550e8400-e29b-41d4-a716-446655440011', NULL),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', 3, 142, 16.2, '550e8400-e29b-41d4-a716-446655440003', 'caught', '550e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440013'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', 4, 160, 18.1, '550e8400-e29b-41d4-a716-446655440001', 'run_out', NULL, '550e8400-e29b-41d4-a716-446655440014'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', 5, 168, 19.1, '550e8400-e29b-41d4-a716-446655440005', 'caught', '550e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440010'),

-- Match 1, Innings 2
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', 1, 25, 3.2, '550e8400-e29b-41d4-a716-446655440010', 'bowled', '550e8400-e29b-41d4-a716-446655440017', NULL),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', 2, 68, 8.4, '550e8400-e29b-41d4-a716-446655440013', 'lbw', '550e8400-e29b-41d4-a716-446655440005', NULL),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', 3, 85, 11.1, '550e8400-e29b-41d4-a716-446655440009', 'caught', '550e8400-e29b-41d4-a716-446655440016', '550e8400-e29b-41d4-a716-446655440003'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', 4, 118, 14.5, '550e8400-e29b-41d4-a716-446655440014', 'caught', '550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440004'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', 5, 125, 15.4, '550e8400-e29b-41d4-a716-446655440002', 'run_out', NULL, '550e8400-e29b-41d4-a716-446655440008'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', 6, 148, 18.1, '550e8400-e29b-41d4-a716-446655440011', 'bowled', '550e8400-e29b-41d4-a716-446655440015', NULL),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', 7, 154, 18.5, '550e8400-e29b-41d4-a716-446655440019', 'caught', '550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440004'),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', 8, 158, 19.3, '550e8400-e29b-41d4-a716-446655440012', 'caught', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440007'),

-- Match 3, Innings 2 (Strikers chase in live match)
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', 1, 28, 3.1, '550e8400-e29b-41d4-a716-446655440004', 'bowled', '550e8400-e29b-41d4-a716-446655440028', NULL),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', 2, 54, 6.5, '550e8400-e29b-41d4-a716-446655440003', 'caught', '550e8400-e29b-41d4-a716-446655440019', '550e8400-e29b-41d4-a716-446655440010'),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', 3, 78, 9.4, '550e8400-e29b-41d4-a716-446655440007', 'lbw', '550e8400-e29b-41d4-a716-446655440026', NULL);

-- ============================================
-- 15. PARTNERSHIPS
-- ============================================
INSERT INTO public.partnerships (match_id, innings_id, batsman1_id, batsman2_id, wicket_number, runs, balls, start_over, end_over, is_current) VALUES
-- Match 1, Innings 1
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 1, 35, 25, 0.1, 4.1, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440007', 2, 63, 46, 4.2, 11.5, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440008', 3, 44, 27, 12.0, 16.2, false),
-- Match 1, Innings 2
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440010', 1, 25, 20, 0.1, 3.2, false),
('950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440013', 2, 43, 32, 3.3, 8.4, false),
-- Match 3, Innings 2 (LIVE)
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440005', 4, 30, 24, 9.5, 13.4, true);

-- ============================================
-- 16. BALL BY BALL (With Shot Zones for Wagon Wheel!)
-- ============================================
INSERT INTO public.ball_by_ball (match_id, innings_id, over_number, ball_number, bowler_id, batsman_id, non_striker_id, runs_scored, extras, extra_type, is_wicket, dismissal_type, fielder_id, commentary, shot_zone) VALUES
-- Match 3, Innings 2, Over 12 (Ryan Martinez on fire)
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', 12, 1, '550e8400-e29b-41d4-a716-446655440028', '550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440005', 1, 0, NULL, false, NULL, NULL, 'Back of a length on off, guided down to third man for one.', 'third_man'),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', 12, 2, '550e8400-e29b-41d4-a716-446655440028', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440008', 2, 0, NULL, false, NULL, NULL, 'Worked nicely into the gap at deep mid-wicket, brisk running for two.', 'mid_wicket'),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', 12, 3, '550e8400-e29b-41d4-a716-446655440028', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440008', 0, 0, NULL, false, NULL, NULL, 'Good length angling in, solidly defended to short extra cover.', 'cover'),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', 12, 4, '550e8400-e29b-41d4-a716-446655440028', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440008', 4, 0, NULL, false, NULL, NULL, 'FOUR! Overpitched outside off, creamed through the covers with effortless timing!', 'cover'),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', 12, 5, '550e8400-e29b-41d4-a716-446655440028', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440008', 1, 0, NULL, false, NULL, NULL, 'Pushed toward mid-on for a brisk single.', 'long_on'),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', 12, 6, '550e8400-e29b-41d4-a716-446655440028', '550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440005', 6, 0, NULL, false, NULL, NULL, 'SIX! Short ball punished! Clears the square leg boundary with a commanding pull shot!', 'square_leg'),

-- Match 3, Innings 2, Over 13 (Current over)
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', 13, 1, '550e8400-e29b-41d4-a716-446655440026', '550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440005', 2, 0, NULL, false, NULL, NULL, 'Tossed up leg break, driven cleanly between cover and long-off for two runs.', 'long_off'),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', 13, 2, '550e8400-e29b-41d4-a716-446655440026', '550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440005', 0, 1, 'wide', false, NULL, NULL, 'Wide! Slipped down the leg side, wicketkeeper collects.', NULL),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', 13, 3, '550e8400-e29b-41d4-a716-446655440026', '550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440005', 4, 0, NULL, false, NULL, NULL, 'FOUR! Flat trajectory, slapped past backward point to the fence!', 'point'),
('950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440006', 13, 4, '550e8400-e29b-41d4-a716-446655440026', '550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440005', 1, 0, NULL, false, NULL, NULL, 'Tucked away off the hips behind square for a single.', 'fine_leg');

-- ============================================
-- 17. TOURNAMENT STANDINGS
-- ============================================
INSERT INTO public.tournament_standings (tournament_id, team_id, matches_played, wins, losses, ties, no_results, points, runs_scored, runs_conceded, overs_faced, overs_bowled, net_run_rate, points_adjustment, adjustment_reason, qualification_status) VALUES
-- East Coast Championship
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 2, 2, 0, 0, 0, 4.0, 356, 308, 40.0, 40.0, 1.20, 0.00, NULL, 'qualified'),
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440003', 2, 1, 1, 0, 0, 2.0, 311, 314, 38.3, 40.0, -0.05, 0.00, NULL, 'in_contention'),
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 2, 1, 1, 0, 0, 2.0, 314, 333, 40.0, 38.3, -0.35, 0.00, NULL, 'in_contention'),
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440004', 2, 0, 2, 0, 0, 0.0, 290, 316, 40.0, 40.0, -0.65, 0.00, NULL, 'eliminated'),

-- Weekend 10-Over Bash
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440001', 1, 1, 0, 0, 0, 2.0, 102, 88, 10.0, 10.0, 1.40, 0.00, NULL, 'in_contention'),
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440002', 1, 1, 0, 0, 0, 2.0, 94, 78, 10.0, 10.0, 1.60, 0.00, NULL, 'in_contention'),
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440004', 1, 0, 1, 0, 0, 0.0, 78, 94, 10.0, 10.0, -1.60, 0.00, NULL, 'in_contention'),
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440003', 1, 0, 1, 0, 0, 0.0, 88, 102, 10.0, 10.0, -1.40, 0.00, NULL, 'in_contention')
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  qualification_status = EXCLUDED.qualification_status,
  points_adjustment = EXCLUDED.points_adjustment,
  adjustment_reason = EXCLUDED.adjustment_reason;

-- ============================================
-- 18. PLAYER CAREER STATS (All 30 players populated!)
-- ============================================
INSERT INTO public.player_career_stats (user_id, total_matches, total_innings_batted, total_runs, total_balls_faced, total_fours, total_sixes, highest_score, not_outs, centuries, half_centuries, total_innings_bowled, total_overs_bowled, total_balls_bowled, total_runs_conceded, total_wickets, best_bowling_figures, five_wicket_hauls, total_catches, total_stumpings, total_run_outs, batting_average, strike_rate, bowling_average, economy_rate) VALUES
('550e8400-e29b-41d4-a716-446655440003', 32, 30, 1240, 940, 142, 34, 108, 4, 2, 9, 2, 4.0, 24, 38, 1, '1/18', 0, 18, 0, 3, 47.69, 131.91, 38.00, 9.50),
('550e8400-e29b-41d4-a716-446655440014', 28, 26, 980, 720, 110, 26, 95, 3, 0, 8, 14, 48.0, 288, 380, 18, '3/22', 0, 14, 0, 2, 42.61, 136.11, 21.11, 7.92),
('550e8400-e29b-41d4-a716-446655440015', 26, 18, 290, 210, 32, 6, 42, 6, 0, 0, 26, 98.0, 588, 640, 42, '4/16', 0, 12, 0, 1, 24.17, 138.10, 15.24, 6.53),
('550e8400-e29b-41d4-a716-446655440008', 24, 22, 640, 480, 68, 18, 72, 5, 0, 4, 18, 62.0, 372, 450, 22, '3/18', 0, 10, 0, 2, 37.65, 133.33, 20.45, 7.26),
('550e8400-e29b-41d4-a716-446655440004', 25, 24, 610, 490, 74, 10, 134, 2, 1, 3, 0, 0.0, 0, 0, 0, NULL, 0, 24, 6, 1, 27.73, 124.49, NULL, NULL),
('550e8400-e29b-41d4-a716-446655440009', 29, 15, 180, 140, 18, 3, 32, 4, 0, 0, 29, 110.0, 660, 760, 48, '4/14', 0, 15, 0, 1, 16.36, 128.57, 15.83, 6.91),
('550e8400-e29b-41d4-a716-446655440005', 22, 19, 440, 340, 46, 9, 58, 4, 0, 2, 20, 72.0, 432, 490, 26, '4/22', 0, 8, 0, 1, 29.33, 129.41, 18.85, 6.81),
('550e8400-e29b-41d4-a716-446655440016', 20, 12, 140, 115, 12, 2, 26, 4, 0, 0, 20, 74.0, 444, 520, 28, '3/20', 0, 7, 0, 0, 17.50, 121.74, 18.57, 7.03),
('550e8400-e29b-41d4-a716-446655440017', 21, 10, 85, 70, 8, 1, 18, 5, 0, 0, 21, 78.0, 468, 580, 29, '4/28', 0, 9, 0, 1, 17.00, 121.43, 20.00, 7.44),
('550e8400-e29b-41d4-a716-446655440019', 22, 14, 175, 130, 20, 4, 34, 3, 0, 0, 22, 82.0, 492, 610, 31, '4/25', 0, 11, 0, 2, 15.91, 134.62, 19.68, 7.44),
('550e8400-e29b-41d4-a716-446655440007', 18, 18, 480, 390, 52, 11, 68, 1, 0, 3, 0, 0.0, 0, 0, 0, NULL, 0, 9, 0, 1, 28.24, 123.08, NULL, NULL),
('550e8400-e29b-41d4-a716-446655440010', 19, 18, 390, 330, 42, 6, 52, 2, 0, 1, 0, 0.0, 0, 0, 0, NULL, 0, 16, 4, 1, 24.38, 118.18, NULL, NULL),
('550e8400-e29b-41d4-a716-446655440013', 17, 16, 410, 320, 48, 8, 62, 1, 0, 2, 0, 0.0, 0, 0, 0, NULL, 0, 6, 0, 0, 27.33, 128.13, NULL, NULL),
('550e8400-e29b-41d4-a716-446655440001', 15, 13, 260, 210, 28, 4, 45, 3, 0, 0, 3, 8.0, 48, 68, 2, '1/15', 0, 7, 0, 1, 26.00, 123.81, 34.00, 8.50),
('550e8400-e29b-41d4-a716-446655440011', 19, 15, 280, 220, 30, 5, 41, 3, 0, 0, 18, 64.0, 384, 480, 19, '3/24', 0, 8, 0, 1, 23.33, 127.27, 25.26, 7.50),
('550e8400-e29b-41d4-a716-446655440012', 18, 11, 120, 95, 11, 2, 24, 4, 0, 0, 18, 66.0, 396, 490, 21, '3/19', 0, 5, 0, 0, 17.14, 126.32, 23.33, 7.42),
('550e8400-e29b-41d4-a716-446655440006', 16, 14, 270, 200, 26, 7, 48, 4, 0, 0, 4, 12.0, 72, 96, 4, '2/18', 0, 6, 0, 1, 27.00, 135.00, 24.00, 8.00),
('c7e37a47-cb3f-45bf-b5da-9c8ca617d049', 18, 15, 340, 260, 38, 8, 54, 3, 0, 1, 14, 48.0, 288, 360, 16, '3/21', 0, 9, 0, 2, 28.33, 130.77, 22.50, 7.50),
('550e8400-e29b-41d4-a716-446655440021', 14, 14, 410, 310, 48, 9, 64, 1, 0, 2, 0, 0.0, 0, 0, 0, NULL, 0, 6, 0, 0, 31.54, 132.26, NULL, NULL),
('550e8400-e29b-41d4-a716-446655440022', 14, 13, 310, 250, 36, 4, 52, 2, 0, 1, 0, 0.0, 0, 0, 0, NULL, 0, 11, 3, 1, 28.18, 124.00, NULL, NULL),
('550e8400-e29b-41d4-a716-446655440023', 13, 12, 260, 195, 28, 6, 44, 2, 0, 0, 8, 26.0, 156, 190, 9, '2/16', 0, 5, 0, 0, 26.00, 133.33, 21.11, 7.31),
('550e8400-e29b-41d4-a716-446655440024', 12, 12, 290, 230, 32, 5, 51, 1, 0, 1, 0, 0.0, 0, 0, 0, NULL, 0, 4, 0, 0, 26.36, 126.09, NULL, NULL),
('550e8400-e29b-41d4-a716-446655440020', 15, 14, 280, 225, 30, 4, 46, 2, 0, 0, 0, 0.0, 0, 0, 0, NULL, 0, 7, 0, 0, 23.33, 124.44, NULL, NULL),
('550e8400-e29b-41d4-a716-446655440025', 14, 13, 240, 185, 24, 5, 39, 2, 0, 0, 10, 32.0, 192, 240, 11, '2/18', 0, 5, 0, 0, 21.82, 129.73, 21.82, 7.50),
('550e8400-e29b-41d4-a716-446655440026', 15, 9, 85, 75, 7, 1, 22, 3, 0, 0, 15, 54.0, 324, 390, 19, '3/22', 0, 4, 0, 0, 14.17, 113.33, 20.53, 7.22),
('550e8400-e29b-41d4-a716-446655440028', 12, 6, 45, 38, 4, 1, 14, 2, 0, 0, 12, 44.0, 264, 340, 15, '3/26', 0, 3, 0, 0, 11.25, 118.42, 22.67, 7.73),
('550e8400-e29b-41d4-a716-446655440027', 11, 11, 260, 210, 30, 4, 45, 1, 0, 0, 0, 0.0, 0, 0, 0, NULL, 0, 5, 0, 0, 26.00, 123.81, NULL, NULL),
('550e8400-e29b-41d4-a716-446655440018', 14, 7, 50, 45, 4, 0, 16, 3, 0, 0, 14, 48.0, 288, 340, 16, '3/18', 0, 4, 0, 0, 12.50, 111.11, 21.25, 7.08),
('550e8400-e29b-41d4-a716-446655440029', 10, 8, 120, 95, 12, 2, 28, 2, 0, 0, 6, 18.0, 108, 140, 7, '2/20', 0, 3, 0, 0, 20.00, 126.32, 20.00, 7.78),
('550e8400-e29b-41d4-a716-446655440002', 12, 10, 160, 135, 16, 2, 34, 2, 0, 0, 0, 0.0, 0, 0, 0, NULL, 0, 5, 0, 1, 20.00, 118.52, NULL, NULL);

-- ============================================
-- 19. USER ACHIEVEMENTS
-- ============================================
INSERT INTO public.user_achievements (user_id, achievement_type, match_id, achievement_data) VALUES
('550e8400-e29b-41d4-a716-446655440003', 'century', '950e8400-e29b-41d4-a716-446655440001', '{"runs": 108, "balls": 62, "fours": 12, "sixes": 4, "opponent": "Riverside Warriors"}'::jsonb),
('550e8400-e29b-41d4-a716-446655440003', 'half_century', '950e8400-e29b-41d4-a716-446655440001', '{"runs": 74, "balls": 48, "fours": 8, "sixes": 2, "match_title": "Championship Opener"}'::jsonb),
('550e8400-e29b-41d4-a716-446655440014', 'half_century', '950e8400-e29b-41d4-a716-446655440001', '{"runs": 65, "balls": 42, "fours": 7, "sixes": 2, "match_title": "Championship Opener"}'::jsonb),
('550e8400-e29b-41d4-a716-446655440004', 'century', NULL, '{"runs": 134, "balls": 68, "fours": 14, "sixes": 7, "match_title": "2023 Cup Final"}'::jsonb),
('550e8400-e29b-41d4-a716-446655440009', 'five_wickets', NULL, '{"wickets": 5, "runs": 22, "overs": 4.0, "match_title": "Invitational Trophy"}'::jsonb),
('550e8400-e29b-41d4-a716-446655440015', 'hat_trick', NULL, '{"match_title": "2023 Season Opener", "overs": 3.4, "wickets": 4}'::jsonb),
('550e8400-e29b-41d4-a716-446655440008', 'half_century', '950e8400-e29b-41d4-a716-446655440004', '{"match": "10-Over Bash Match 1", "runs": 44, "balls": 24}'::jsonb),
('c7e37a47-cb3f-45bf-b5da-9c8ca617d049', 'half_century', NULL, '{"runs": 54, "balls": 38, "match_title": "Metro Inter-Club League"}'::jsonb);

-- ============================================
-- 20. MATCH CLAIMS
-- ============================================
INSERT INTO public.match_claims (user_id, match_title, match_date, venue, opponent_team, runs_scored, balls_faced, fours, sixes, wickets_taken, overs_bowled, runs_conceded, catches, stumpings, run_outs, additional_notes, status, verified_by, verification_notes) VALUES
('550e8400-e29b-41d4-a716-446655440003', 'Tri-State Friendly Cup', '2024-06-10', 'Brooklyn Cricket Ground', 'Brooklyn Blazers', 82, 54, 9, 3, NULL, NULL, NULL, 1, 0, 0, 'High scoring run chase in friendly cup tournament', 'verified', '550e8400-e29b-41d4-a716-446655440001', 'Verified by match organizer'),
('550e8400-e29b-41d4-a716-446655440015', 'Weekend Cup Warmup', '2024-06-08', 'Queens Cricket Field', 'Queens Royals', 18, 12, 2, 0, 3, 4.0, 18, 1, 0, 0, 'Took 3 key top-order wickets in the opening spell', 'verified', '550e8400-e29b-41d4-a716-446655440001', 'Official scorecard verified'),
('c7e37a47-cb3f-45bf-b5da-9c8ca617d049', 'Metro Inter-Club League', '2024-06-05', 'Central Park Ground 2', 'Manhattan CC', 45, 32, 5, 1, 2, 3.0, 22, 1, 0, 1, 'Match winning all-round performance', 'verified', '550e8400-e29b-41d4-a716-446655440001', 'Confirmed by club captain'),
('550e8400-e29b-41d4-a716-446655440014', 'SoCal Invitational', '2024-05-28', 'Rose Bowl Ground 2', 'San Diego Stars', 58, 38, 6, 2, 1, 2.0, 16, 2, 0, 0, 'Captained side to victory', 'verified', '550e8400-e29b-41d4-a716-446655440002', 'Score verified by RCA');

-- ============================================
-- 21. NOTIFICATIONS
-- ============================================
INSERT INTO public.notifications (user_id, type, title, message, data, is_read) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'tournament_update', 'East Coast Championship Standings Updated', 'Metropolitan Strikers are at the top of the table with 4 points and +1.20 NRR.', '{"tournament_id": "850e8400-e29b-41d4-a716-446655440001"}'::jsonb, false),
('550e8400-e29b-41d4-a716-446655440003', 'match_reminder', 'Upcoming Semi-Final Scheduled', 'Your next match vs Riverside Warriors is scheduled at Central Park Cricket Ground.', '{"match_id": "950e8400-e29b-41d4-a716-446655440006"}'::jsonb, false),
('550e8400-e29b-41d4-a716-446655440003', 'achievement', 'Player of the Match Award!', 'Congratulations! You were awarded Player of the Match for your 74 (48) in Match 1.', '{"match_id": "950e8400-e29b-41d4-a716-446655440001"}'::jsonb, true),
('550e8400-e29b-41d4-a716-446655440002', 'tournament_update', 'West Coast ODI Series Registration', 'Metropolitan Strikers have registered for the upcoming West Coast ODI Series.', '{"tournament_id": "850e8400-e29b-41d4-a716-446655440002"}'::jsonb, false),
('c7e37a47-cb3f-45bf-b5da-9c8ca617d049', 'match_reminder', 'Live Match In Progress!', 'Metropolitan Strikers are chasing 147 against Riverside Titans in Match 3.', '{"match_id": "950e8400-e29b-41d4-a716-446655440003"}'::jsonb, false);

-- ============================================
-- 22. CLUB INVITATIONS
-- ============================================
INSERT INTO public.club_invitations (club_id, invited_by, email, user_id, status, expires_at) VALUES
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'prospect.batsman@cricket.org', NULL, 'pending', NOW() + INTERVAL '7 days'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'california.pacer@cricket.org', NULL, 'pending', NOW() + INTERVAL '5 days');
