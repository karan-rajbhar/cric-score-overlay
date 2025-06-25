-- Sample data for development
-- This file is run after migrations to populate the database with test data

-- Insert sample clubs
INSERT INTO public.clubs (name, short_name, description, location) VALUES
  ('Mumbai Cricket Club', 'MCC', 'Premier cricket club in Mumbai', 'Mumbai, India'),
  ('Chennai Super Club', 'CSC', 'Leading cricket club in Chennai', 'Chennai, India');

-- Insert sample teams
INSERT INTO public.teams (name, short_name, club_id) VALUES
  ('Mumbai Indians', 'MI', (SELECT id FROM public.clubs WHERE short_name = 'MCC')),
  ('Chennai Super Kings', 'CSK', (SELECT id FROM public.clubs WHERE short_name = 'CSC'));

-- Insert a sample match
INSERT INTO public.matches (title, team1_id, team2_id, venue, start_time, status) VALUES
  ('Mumbai Indians vs Chennai Super Kings', 
   (SELECT id FROM public.teams WHERE short_name = 'MI'),
   (SELECT id FROM public.teams WHERE short_name = 'CSK'),
   'Wankhede Stadium', 
   NOW() + INTERVAL '1 hour', 
   'upcoming'); 