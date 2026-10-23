/**
 * Type definitions for the live cricket broadcast overlay system.
 */

import type { LiveMatchStateRow } from "~/lib/firebase/types";
import type {
  LEGACY_OVERLAY_THEME_IDS,
  OverlayThemeId,
} from "./overlay-themes";

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
  | "last_ball_seq"
  | "this_over_runs";

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
/**
 * A theme id as URLs, commands and stored settings carry it: one of
 * `OVERLAY_THEMES`, or a legacy id that `resolveOverlayTheme` maps to one.
 */
export type OverlayTheme =
  | OverlayThemeId
  | (typeof LEGACY_OVERLAY_THEME_IDS)[number];

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
  | "custom"
  // Automatic straps (`auto-graphics.ts`) and producer extras.
  | "new_batter"
  | "new_bowler"
  | "over_end"
  | "last_wicket"
  | "win_predictor"
  | "commentary"
  /** A producer message: see `ActiveLowerThirdStrap.form`. */
  | "message";

export interface ActiveLowerThirdStrap {
  id: string;
  type: LowerThirdStrapType;
  title: string;
  subtitle?: string;
  detail?: string;
  badge?: string;
  customText?: string;
  durationMs?: number;
  /**
   * A message's shape (NV Play's three): "single" replaces the score bar
   * with one line, "double" is a title and body card, "baseline" a thin
   * line under the score bar.
   */
  form?: "single" | "double" | "baseline";
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
  | "39" // Out Batsman Series
  | "40" // Wagon wheel (striker)
  | "41" // Run rate
  | "42" // Win predictor
  | "43" // Leaderboard
  | "44"; // Next fixture

export interface ProducerCommand {
  /**
   * Set by the control room. The server stores it as the overlay state's
   * `last_command_id`, which is how the control room sees it went on air.
   */
  id?: string;
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
    | "SET_AUTO"
    | "NEXT_SPONSOR"
    | "PANIC_CLEAR";
  card?: PresentationCardType;
  visible?: boolean;
  /** A theme id (see `~/components/overlay/overlay-themes`). */
  theme?: string;
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
  /** null: back to the score bug. */
  broadcastView?: BroadcastViewId | null;
  /** SET_AUTO: automatic graphics, by rule id. */
  auto?: Record<string, { on: boolean; seconds: number }>;
  timestamp: number;
}

// ---- snapshots the control room sends (no overlay reads) -----------------

/** A points table (`standings-cards.tsx`): the producer's tournament view. */
export interface PointsTableSnapshot {
  /** "Group A", "Points table". */
  title: string;
  rows: Array<{
    team: string;
    short?: string | null;
    played: number;
    won: number;
    lost: number;
    tied?: number | null;
    noResult?: number | null;
    points: number;
    nrr?: number | null;
    /** The teams in this match. */
    highlight?: boolean;
  }>;
}

/** A tournament leaderboard: "Most runs", "Most wickets". */
export interface LeaderboardSnapshot {
  title: string;
  /** Column heading of the value: "Runs", "Wkts". */
  metric: string;
  rows: Array<{
    name: string;
    team?: string | null;
    value: number | string;
    /** "8 inns · SR 141.2". */
    detail?: string | null;
    playerId?: string | null;
  }>;
}

/** The next fixture of the tournament or club. */
export interface FixtureSnapshot {
  title?: string | null;
  team1: string;
  team1Short?: string | null;
  team1Logo?: string | null;
  team2: string;
  team2Short?: string | null;
  team2Logo?: string | null;
  /** ISO start time. */
  startsAt?: string | null;
  venue?: string | null;
  round?: string | null;
}

/** A player's figures in this tournament (the "series" lower thirds). */
export interface SeriesFigures {
  matches: number;
  runs?: number | null;
  highest?: string | null;
  average?: number | null;
  strikeRate?: number | null;
  wickets?: number | null;
  economy?: number | null;
  best?: string | null;
}

/** Everything the control room may hand the overlay for its cards. */
export interface OverlaySnapshots {
  pointsTable?: PointsTableSnapshot | null;
  leaderboard?: LeaderboardSnapshot | null;
  nextFixture?: FixtureSnapshot | null;
  /** Tournament figures by player id. */
  series?: Record<string, SeriesFigures> | null;
}
