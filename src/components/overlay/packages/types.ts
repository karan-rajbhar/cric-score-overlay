/**
 * Broadcast packages: a complete look for the overlay (score bug, lower
 * thirds, stings, cards, charts...), chosen by the scene's theme id.
 *
 * A package supplies components for any of the {@link OVERLAY_ELEMENTS};
 * the stage falls back to the Standard component for each one it leaves
 * out. It also supplies its palette (the `--ov-*` variables every
 * component reads, plus any of its own), its typography and its motion
 * (enter / exit / update per element). The four plain packages (Standard,
 * Light, Team colours, Custom) share the Standard components and differ in
 * palette only.
 *
 * Element components are pure: they draw what their props say, positioned
 * on the 1920x1080 canvas themselves (`fixed`; the stage's canvas). The
 * stage decides when an element is on air, keeps it mounted while its exit
 * plays and passes the latest live row.
 */

import type { ComponentType, CSSProperties } from "react";
import type { Innings, Match } from "~/lib/match-types";
import type { CustomColours, OverlayPalette } from "../overlay-themes";
import type { PlayerProfile } from "../overlay-data";
import type { PlayerSlot } from "../profile-card";
import type { OverlayPhase } from "../score-bug";
import type {
  ActiveEventSting,
  ActiveLowerThirdStrap,
  FixtureSnapshot,
  LayoutMode,
  LeaderboardSnapshot,
  LiveMatchState,
  OverlaySnapshots,
  PointsTableSnapshot,
  SponsorItem,
} from "../types";

/** Every element a package can draw, in the gallery's order. */
export const OVERLAY_ELEMENTS = [
  "scoreBug",
  "batterLowerThird",
  "bowlerLowerThird",
  "newBatter",
  "newBowler",
  "partnership",
  "chase",
  "thisOver",
  "sting",
  "scorecard",
  "bowlingCard",
  "fallOfWickets",
  "playingXi",
  "toss",
  "matchIntro",
  "playerProfile",
  "pointsTable",
  "leaderboard",
  "nextFixture",
  "result",
  "matchSummary",
  "inningsBreak",
  "playerOfTheMatch",
  "winPredictor",
  "projectedScore",
  "breakStrap",
  "message",
  "sponsors",
  "ticker",
  "runsPerOver",
  "worm",
  "runRates",
  "wagonWheel",
] as const;

export type OverlayElementId = (typeof OVERLAY_ELEMENTS)[number];

/** What every element gets. */
export interface ElementBaseProps {
  /** The live row (held while the producer holds the overlay). */
  state: LiveMatchState;
  /** The page's match, its innings kept current while a card shows them. */
  match: Match | null;
  /** Standings, leaders, next match, tournament figures (control room). */
  snapshots: OverlaySnapshots | null;
  /** The scene's theme id (this package's, or a plain one). */
  theme: string;
  customColors: CustomColours | null;
  /** Where the score bug sits (lower thirds keep clear of it). */
  layout: LayoutMode;
}

/** Event cards, by what happened. */
export type StingKind =
  | "four"
  | "six"
  | "wicket"
  | "fifty"
  | "hundred"
  | "three_for"
  | "five_for"
  | "hat_trick"
  | "free_hit"
  | "milestone";

/** A stoppage or phase strap. */
export type BreakKind =
  | "drinks"
  | "rain_delay"
  | "timeout"
  | "innings_break"
  | "powerplay";

type StrapOrCard = "strap" | "card";

/** Each element's props. */
export interface OverlayElementProps {
  scoreBug: ElementBaseProps & {
    sponsor: string | null;
    marginOffsetPx: number;
    phase: OverlayPhase;
  };
  /** Strap: the producer's lower third; figures: the suite's figures card. */
  batterLowerThird: ElementBaseProps & {
    slot: Exclude<PlayerSlot, "bowler">;
    variant: "strap" | "figures";
    strap: ActiveLowerThirdStrap | null;
  };
  bowlerLowerThird: ElementBaseProps & {
    variant: "strap" | "figures";
    strap: ActiveLowerThirdStrap | null;
  };
  newBatter: ElementBaseProps & { strap: ActiveLowerThirdStrap };
  newBowler: ElementBaseProps & { strap: ActiveLowerThirdStrap };
  /** Strap, full card, or the suite's split of runs between the batters. */
  partnership: ElementBaseProps & {
    variant: "strap" | "card" | "split";
    strap: ActiveLowerThirdStrap | null;
  };
  /** Target, runs needed from balls, rates. */
  chase: ElementBaseProps & { strap: ActiveLowerThirdStrap | null };
  /** Strap at the end of an over, or the full "this over" card. */
  thisOver: ElementBaseProps & {
    variant: StrapOrCard;
    strap: ActiveLowerThirdStrap | null;
  };
  /** The live row may be missing (a producer's card before any score). */
  sting: Omit<ElementBaseProps, "state"> & {
    state: LiveMatchState | null;
    sting: ActiveEventSting;
    kind: StingKind;
  };
  /** A batting card; `full` adds the bowling card beside it. */
  scorecard: ElementBaseProps & {
    innings: Innings;
    teamName: string;
    full: boolean;
  };
  bowlingCard: ElementBaseProps & { innings: Innings; teamName: string };
  fallOfWickets: ElementBaseProps & { innings: Innings; teamName: string };
  /** One side (1 / 2) or both (null). */
  playingXi: ElementBaseProps & { side: 1 | 2 | null };
  toss: ElementBaseProps;
  matchIntro: ElementBaseProps;
  playerProfile: ElementBaseProps & {
    slot: PlayerSlot;
    mode: "career" | "tournament";
    /** Career figures already at hand (the gallery); else read when shown. */
    profile?: PlayerProfile | null;
  };
  pointsTable: ElementBaseProps & { table: PointsTableSnapshot };
  leaderboard: ElementBaseProps & { board: LeaderboardSnapshot };
  nextFixture: ElementBaseProps & { fixture: FixtureSnapshot };
  result: ElementBaseProps & { innings: Innings[] };
  matchSummary: ElementBaseProps & { innings: Innings[] };
  inningsBreak: ElementBaseProps & { innings: Innings[] };
  playerOfTheMatch: ElementBaseProps & { innings: Innings[] };
  winPredictor: ElementBaseProps & {
    variant: StrapOrCard;
    strap: ActiveLowerThirdStrap | null;
  };
  projectedScore: ElementBaseProps & {
    variant: StrapOrCard;
    strap: ActiveLowerThirdStrap | null;
  };
  breakStrap: ElementBaseProps & {
    kind: BreakKind;
    variant: StrapOrCard;
    strap: ActiveLowerThirdStrap | null;
  };
  /** The producer's notice: custom, message (single / double / baseline), commentary. */
  message: ElementBaseProps & { strap: ActiveLowerThirdStrap };
  sponsors: ElementBaseProps & {
    sponsors: SponsorItem[];
    title: string | null;
  };
  ticker: ElementBaseProps & { text: string };
  runsPerOver: ElementBaseProps;
  worm: ElementBaseProps;
  runRates: ElementBaseProps;
  wagonWheel: ElementBaseProps & { batterId: string | null };
}

export type ElementComponent<E extends OverlayElementId> = ComponentType<
  OverlayElementProps[E]
>;

export type PackageElements = {
  [E in OverlayElementId]: ElementComponent<E>;
};

/** One transition: WAAPI keyframes and timing. */
export interface MotionSpec {
  keyframes: Keyframe[];
  durationMs: number;
  easing?: string;
  delayMs?: number;
}

/**
 * An element's motion. `enter` plays on mount, `exit` before unmount (the
 * stage keeps the element mounted until it ends), `update` whenever the
 * element's `motionKey` changes while on air (a new score, a new strap).
 */
export interface ElementMotion {
  enter?: MotionSpec;
  exit?: MotionSpec;
  update?: MotionSpec;
}

/** What a package's palette and variables are computed from. */
export interface PaletteContext {
  state: LiveMatchState | null;
  theme: string;
  customColors: CustomColours | null;
}

/** A package's typography. Google Fonts only (`next/font/google`). */
export interface PackageFonts {
  /**
   * Class names that define the fonts' CSS variables (`next/font`
   * `.variable`s, with `preload: false` so only overlays fetch them);
   * the stage puts them on its root.
   */
  className?: string;
  /** font-family values for the package's own components. */
  display?: string;
  text?: string;
  figures?: string;
}

export interface BroadcastPackage {
  /** The theme id that selects it (`packages/manifest.ts`). */
  id: string;
  /**
   * Plain packages follow the app's quiet rules (no decorative motion,
   * sentence case); broadcast packages may use motion, gradients,
   * condensed caps and bold type the way TV graphics do.
   */
  kind: "plain" | "broadcast";
  /** The `--ov-*` palette the Standard components (and fallbacks) read. */
  palette: (ctx: PaletteContext) => OverlayPalette;
  /** Extra CSS variables for the package's own components. */
  vars?: (ctx: PaletteContext) => Record<string, string>;
  fonts?: PackageFonts;
  /** Motion per element; none: the element appears and goes at once. */
  motion?: Partial<Record<OverlayElementId, ElementMotion>>;
  /** The package's own components; missing ones fall back to Standard. */
  elements: Partial<PackageElements>;
}

/** The stage root's style for a package (palette, variables, fonts). */
export type PackageRootStyle = CSSProperties;
