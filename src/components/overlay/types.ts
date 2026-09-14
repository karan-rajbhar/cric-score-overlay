/**
 * Type definitions for the live cricket broadcast overlay system.
 */

export interface LiveMatchState {
  match_id: string;
  title: string | null;
  status: string | null;
  match_format: string | null;
  overs_per_innings: number | null;
  venue: string | null;
  current_innings: number | null;
  current_over: number | null;
  current_ball: number | null;
  result_type: string | null;
  result_description: string | null;
  toss_winner_team_id?: string | null;
  toss_decision?: string | null;
  umpire1_name?: string | null;
  umpire2_name?: string | null;
  tournament_name?: string | null;
  team1_name: string | null;
  team1_short_name: string | null;
  team1_logo_url?: string | null;
  team2_name: string | null;
  team2_short_name: string | null;
  team2_logo_url?: string | null;
  winning_team_name: string | null;
  innings_number: number | null;
  total_runs: number | null;
  total_wickets: number | null;
  total_overs: number | null;
  total_balls: number | null;
  extras_total: number | null;
  innings_completed: boolean | null;
  target_runs: number | null;
  batting_team_name: string | null;
  batting_team_short_name: string | null;
  bowling_team_name: string | null;
  bowling_team_short_name: string | null;
  striker_name: string | null;
  striker_runs: number | null;
  striker_balls: number | null;
  non_striker_name: string | null;
  non_striker_runs: number | null;
  non_striker_balls: number | null;
  current_bowler_name: string | null;
  bowler_balls: number | null;
  bowler_runs: number | null;
  bowler_wickets: number | null;
  partnership_runs: number | null;
  partnership_balls: number | null;
  this_over_balls: string | null;
  current_run_rate: number | null;
  runs_needed: number | null;
  balls_remaining: number | null;
  required_run_rate: number | null;
  last_ball_runs?: number | null;
  last_ball_extras?: number | null;
  last_ball_extra_type?: string | null;
  last_ball_is_wicket?: boolean | null;
  last_ball_dismissal_type?: string | null;
  last_ball_dismissed_player?: string | null;
  last_ball_fielder?: string | null;
  last_ball_commentary?: string | null;
  last_ball_seq?: number | null;
}

export type LayoutMode = "bottom" | "top" | "compact" | "broadcast";
export type OverlayTheme =
  | "starsports"
  | "sonysports"
  | "foxcricket"
  | "skysports"
  | "thehundred"
  | "apex"
  | "volt"
  | "agni"
  | "dharma"
  | "thunder"
  | "nakshatra"
  | "broadcast"
  | "dark"
  | "emerald"
  | "minimal"
  | "custom";

export interface CustomThemeColors {
  primary: string; // e.g. "#1e3a8a"
  accent: string; // e.g. "#f59e0b"
}

export type PresentationCardType =
  | "none"
  | "toss"
  | "playing_xi"
  | "scorecard"
  | "partnership"
  | "result"
  | "over_summary";

export interface ActiveEventSting {
  id: string;
  type: "four" | "six" | "wicket" | "milestone" | "free_hit";
  title: string;
  subtitle?: string;
  detail?: string;
  accentColor?: string;
  durationMs: number;
}

export type LowerThirdStrapType =
  | "none"
  | "batsman"
  | "bowler"
  | "partnership"
  | "target"
  | "powerplay"
  | "drinks"
  | "timeout"
  | "rain_delay"
  | "innings_break"
  | "custom";

export interface ActiveLowerThirdStrap {
  id: string;
  type: LowerThirdStrapType;
  title: string;
  subtitle?: string;
  detail?: string;
  badge?: string;
  customText?: string;
  durationMs?: number;
}

export interface SponsorItem {
  id: string;
  name: string;
  tagline?: string;
  logoUrl?: string;
}

export type BroadcastViewId =
  | "1" // Scorebar
  | "2" // Batting Team 1(I1)
  | "3" // Bowling Team 1(I1)
  | "4" // Batting Team 2(I1)
  | "5" // Bowling Team 2(I1)
  | "6" // Squad Team 1
  | "7" // Squad Team 2
  | "8" // Summary
  | "13" // Intro
  | "14" // Innings Break
  | "15" // Drinks Break
  | "16" // Batsman Stats
  | "17" // Runner Stats
  | "18" // Bowler Stats
  | "19" // Out Batsman
  | "20" // Points Table
  | "21" // Over by Over
  | "22" // Worm
  | "23" // Partnership
  | "24" // Batsman Career
  | "25" // Runner Career
  | "26" // Bowler Career
  | "27" // Out Batsman Career
  | "28" // Rain Delay
  | "29" // Player of the Match
  | "36" // Batsman Series
  | "37" // Runner Series
  | "38" // Bowler Series
  | "39"; // Out Batsman Series

export interface ProducerCommand {
  type:
    | "SHOW_CARD"
    | "HIDE_CARD"
    | "TOGGLE_BUG"
    | "SET_THEME"
    | "SET_LAYOUT"
    | "TRIGGER_STING"
    | "SET_SPONSOR"
    | "SHOW_STRAP"
    | "HIDE_STRAP"
    | "TOGGLE_TICKER"
    | "SET_TICKER_TEXT"
    | "SET_SPONSORS"
    | "SET_CUSTOM_COLORS"
    | "SET_MARGIN_OFFSET"
    | "TOGGLE_AUDIO"
    | "SET_BROADCAST_VIEW"
    | "PANIC_CLEAR";
  card?: PresentationCardType;
  visible?: boolean;
  theme?: OverlayTheme;
  customColors?: CustomThemeColors;
  layout?: LayoutMode;
  stingType?: "four" | "six" | "wicket" | "milestone" | "free_hit";
  sponsorText?: string;
  durationMs?: number;
  strap?: ActiveLowerThirdStrap;
  tickerText?: string;
  sponsors?: SponsorItem[];
  rotationIntervalSecs?: number;
  marginOffsetPx?: number;
  audioEnabled?: boolean;
  audioVolume?: number;
  broadcastView?: BroadcastViewId;
  timestamp: number;
}
