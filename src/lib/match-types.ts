/**
 * Canonical match-domain types — the single source of truth for DB-shaped
 * match data shared across pages and components.
 *
 * These mirror the public schema (snake_case) plus the relation joins used
 * by `getMatch` / `getMatches`. Every component should consume these instead
 * of redeclaring its own interfaces — drifted copies of these types are what
 * caused the is_out/is_not_out and runs_at_fall/runs_at_wicket bugs.
 */

export interface UserRef {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

export interface Team {
  id: string;
  name: string;
  short_name?: string | null;
  description?: string | null;
  logo_url?: string | null;
  club_id?: string | null;
  captain_id?: string | null;
  vice_captain_id?: string | null;
  team_type?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface MatchTeam extends Team {
  /** Joined when the query asks for it. */
  captain?: UserRef | null;
  /** Squad join used by the match info tab. */
  team_players?: TeamPlayer[];
}

export interface BattingPerformance {
  id: string;
  match_id: string;
  innings_id: string;
  user_id: string;
  batting_position?: number | null;
  runs_scored: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  is_out: boolean;
  dismissal_type?: string | null;
  is_current_batsman?: boolean | null;
  is_striker?: boolean | null;
  user?: UserRef | null;
}

export interface BowlingPerformance {
  id: string;
  match_id: string;
  innings_id: string;
  user_id: string;
  overs_bowled: number;
  balls_bowled: number;
  runs_conceded: number;
  wickets_taken: number;
  maidens: number;
  wides: number;
  no_balls: number;
  is_current_bowler?: boolean | null;
  user?: UserRef | null;
}

export interface FallOfWicket {
  id: string;
  match_id: string;
  innings_id: string;
  wicket_number: number;
  runs_at_fall: number;
  overs_at_fall: number;
  batsman_out_id: string;
  dismissal_type?: string | null;
  bowler_id?: string | null;
  fielder_id?: string | null;
  batsman?: UserRef | null;
  bowler?: UserRef | null;
  fielder?: UserRef | null;
}

export interface BallEvent {
  id: string;
  batsman?: UserRef | null;
  bowler?: UserRef | null;
  innings?: { innings_number: number; team_id: string } | null;
  match_id: string;
  innings_id: string;
  over_number: number;
  ball_number: number;
  batsman_id: string;
  non_striker_id?: string | null;
  bowler_id?: string | null;
  runs_scored: number;
  extras: number;
  extra_type?: string | null;
  is_wicket: boolean;
  dismissal_type?: string | null;
  commentary?: string | null;
  shot_zone?: string | null;
}

export interface Innings {
  id: string;
  match_id: string;
  innings_number: number;
  team_id: string;
  total_runs: number;
  total_wickets: number;
  total_balls: number;
  total_overs: number;
  is_completed: boolean;
  target_runs?: number | null;
  extras_total: number;
  extras_byes: number;
  extras_leg_byes: number;
  extras_wides: number;
  extras_no_balls: number;
  extras_penalties: number;
  batting_performances?: BattingPerformance[];
  bowling_performances?: BowlingPerformance[];
  ball_by_ball?: BallEvent[];
  fall_of_wickets?: FallOfWicket[];
}

export interface Match {
  id: string;
  title: string;
  match_format: string;
  overs_per_innings: number;
  status: string;
  current_innings: number;
  current_over: number;
  current_ball: number;
  venue?: string | null;
  scheduled_at?: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  toss_winner_team_id?: string | null;
  toss_decision?: string | null;
  result_description?: string | null;
  winning_team_id?: string | null;
  weather_conditions?: string | null;
  pitch_conditions?: string | null;
  ball_type?: string | null;
  umpire1_name?: string | null;
  umpire2_name?: string | null;
  team1_id: string;
  team2_id: string;
  created_by?: string | null;
  match_admins?: string[] | null;
  player_of_the_match_id?: string | null;
  player_of_the_match?: UserRef | null;
  wickets_per_innings?: number | null;
  last_man_stands?: boolean | null;
  golden_ball?: boolean | null;
  season_id?: string | null;
  team1: MatchTeam;
  team2: MatchTeam;
  innings?: Innings[];
  tournament?: { id: string; name: string } | null;
  club?: { id: string; name: string } | null;
}

export interface TeamPlayer {
  id: string;
  team_id: string;
  user_id: string;
  jersey_number?: number | null;
  batting_order?: number | null;
  is_playing_xi?: boolean | null;
  role_in_team?: string | null;
  user?: UserRef | null;
}
