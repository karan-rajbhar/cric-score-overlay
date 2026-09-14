/**
 * Shared form and scoring types — single source for all match actions.
 * Extracted from the 679-line God file to satisfy SRP.
 */
export interface MatchFormData {
  title: string;
  matchFormat: "T20" | "ODI" | "Custom";
  oversPerInnings: number;
  team1Id: string;
  team2Id: string;
  venue?: string;
  scheduledAt?: string;
  umpire1Name?: string;
  umpire2Name?: string;
  clubId?: string;
  tournamentId?: string;
  seasonId?: string;
  wicketsPerInnings?: number;
  lastManStands?: boolean;
  goldenBall?: boolean;
}

export type ExtraType = "wide" | "no_ball" | "bye" | "leg_bye" | "penalty";

export interface BallEvent {
  runsScored?: number;
  extras?: number;
  extraType?: ExtraType;
  isWicket?: boolean;
  dismissalType?: string;
  fielderId?: string | null;
  dismissedPlayerId?: string | null;
  commentary?: string;
  shotZone?: string | null;
}

export interface ScoringState {
  ok: boolean;
  status: string;
  current_innings: number;
  current_over: number;
  current_ball: number;
  total_runs: number;
  total_wickets: number;
  total_balls: number;
  target_runs: number | null;
  is_completed: boolean;
  striker_id: string | null;
  non_striker_id: string | null;
  striker_name: string | null;
  non_striker_name: string | null;
  striker_runs: number | null;
  striker_balls: number | null;
  non_striker_runs: number | null;
  non_striker_balls: number | null;
  needs_batsman: boolean;
  needs_bowler: boolean;
  innings_completed: boolean;
  match_completed: boolean;
  result_description: string | null;
  innings_break?: boolean;
}
