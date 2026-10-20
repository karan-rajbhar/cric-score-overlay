/**
 * Type definitions for the live cricket broadcast overlay system.
 */

import type { LiveMatchStateRow } from "~/lib/firebase/types";

/**
 * Fields an overlay may get without: documents written before they existed,
 * and the demo data.
 */
type OptionalLiveFields =
  | "toss_winner_team_id"
  | "toss_decision"
  | "umpire1_name"
  | "umpire2_name"
  | "tournament_name"
  | "team1_logo_url"
  | "team2_logo_url"
  | "last_ball_runs"
  | "last_ball_extras"
  | "last_ball_extra_type"
  | "last_ball_is_wicket"
  | "last_ball_dismissal_type"
  | "last_ball_dismissed_player"
  | "last_ball_fielder"
  | "last_ball_commentary"
  | "last_ball_seq";

/**
 * The live scoreboard as overlays read it (`live_state/{matchId}`): the
 * server's {@link LiveMatchStateRow}, for a known match.
 */
export type LiveMatchState = Omit<
  LiveMatchStateRow,
  "match_id" | OptionalLiveFields
> &
  Partial<Pick<LiveMatchStateRow, OptionalLiveFields>> & { match_id: string };

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
