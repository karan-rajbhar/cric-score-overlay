-- Migration: 20260914020000_overlay_graphics_support.sql
-- Description: Expand live_match_state view with team logos, tournament metadata, toss, officials, and real-time last-ball event payload for broadcast overlay stings and graphics.

DROP VIEW IF EXISTS public.live_match_state CASCADE;

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
  m.toss_winner_team_id,
  m.toss_decision,
  m.umpire1_name,
  m.umpire2_name,
  tourn.name                          AS tournament_name,
  t1.name                             AS team1_name,
  t1.short_name                       AS team1_short_name,
  t1.logo_url                         AS team1_logo_url,
  t2.name                             AS team2_name,
  t2.short_name                       AS team2_short_name,
  t2.logo_url                         AS team2_logo_url,
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
                                      AS required_run_rate,
  last_ball.runs_scored               AS last_ball_runs,
  last_ball.extras                    AS last_ball_extras,
  last_ball.extra_type                AS last_ball_extra_type,
  last_ball.is_wicket                 AS last_ball_is_wicket,
  last_ball.dismissal_type            AS last_ball_dismissal_type,
  last_ball.dismissed_player_name     AS last_ball_dismissed_player,
  last_ball.fielder_name              AS last_ball_fielder,
  last_ball.commentary                AS last_ball_commentary,
  last_ball.seq                       AS last_ball_seq
FROM public.matches m
JOIN public.teams t1 ON t1.id = m.team1_id
JOIN public.teams t2 ON t2.id = m.team2_id
LEFT JOIN public.tournaments tourn ON tourn.id = m.tournament_id
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
) this_over ON TRUE
LEFT JOIN LATERAL (
  SELECT
    b.id,
    b.runs_scored,
    b.extras,
    b.extra_type,
    b.is_wicket,
    b.dismissal_type,
    b.commentary,
    b.seq,
    u_dismissed.full_name AS dismissed_player_name,
    u_fielder.full_name AS fielder_name
  FROM public.ball_by_ball b
  LEFT JOIN public.users u_dismissed ON u_dismissed.id = COALESCE(b.dismissed_player_id, b.batsman_id)
  LEFT JOIN public.users u_fielder ON u_fielder.id = b.fielder_id
  WHERE b.innings_id = ci.id
  ORDER BY b.seq DESC NULLS LAST, b.created_at DESC
  LIMIT 1
) last_ball ON TRUE;

GRANT SELECT ON public.live_match_state TO anon, authenticated, service_role;
