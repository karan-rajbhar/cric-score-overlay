"use client";

/**
 * The overlay gallery (`/overlay/gallery`, dev only): any element of any
 * package, drawn from the demo match at 1920x1080 over a camera-like
 * picture, so a package can be built and screenshotted without Firebase.
 *
 * `?package=<id>&element=<name>&state=<pre|first|live|break|result>`
 * plus `variant` (an element's variant: strap / card / figures / split /
 * career / tournament / team1 / team2 / batting / single / double /
 * baseline), `kind` (a sting: four, six, wicket, fifty, hundred,
 * three_for, five_for, hat_trick, free_hit; a break: drinks, rain_delay,
 * timeout, innings_break, powerplay) and `bg=day|night`. Without
 * `element`, an index of links.
 */

import Link from "next/link";
import {
  DEMO_BREAK_STATE,
  DEMO_CAREER,
  DEMO_FIRST_INNINGS_STATE,
  DEMO_MATCH_DETAILS,
  DEMO_MATCH_STATE,
  DEMO_PRE_STATE,
  DEMO_RESULT_MATCH,
  DEMO_RESULT_STATE,
  DEMO_SNAPSHOTS,
} from "~/app/overlay/[matchId]/demo-data";
import type { Match } from "~/lib/match-types";
import { DEFAULT_CUSTOM_COLOURS } from "../overlay-themes";
import { overlayPhaseOf } from "../score-bug";
import { inningsTeamName } from "../scorecard-cards";
import type {
  ActiveEventSting,
  ActiveLowerThirdStrap,
  LiveMatchState,
} from "../types";
import { OverlayElement } from "./element";
import { PACKAGE_MANIFEST } from "./manifest";
import { OverlayPackageScope } from "./registry";
import {
  OVERLAY_ELEMENTS,
  type BreakKind,
  type ElementBaseProps,
  type OverlayElementId,
  type OverlayElementProps,
  type StingKind,
} from "./types";

export const GALLERY_STATES = [
  "pre",
  "first",
  "live",
  "break",
  "result",
] as const;
export type GalleryState = (typeof GALLERY_STATES)[number];

const STATES: Record<GalleryState, LiveMatchState> = {
  pre: DEMO_PRE_STATE,
  first: DEMO_FIRST_INNINGS_STATE,
  live: DEMO_MATCH_STATE,
  break: DEMO_BREAK_STATE,
  result: DEMO_RESULT_STATE,
};

/** The state an element shows by default (where it has something to say). */
const DEFAULT_STATE: Partial<Record<OverlayElementId, GalleryState>> = {
  toss: "pre",
  matchIntro: "pre",
  playingXi: "pre",
  projectedScore: "first",
  inningsBreak: "break",
  result: "result",
  playerOfTheMatch: "result",
  matchSummary: "result",
};

export function galleryStateOf(
  element: OverlayElementId,
  requested?: string | null,
): GalleryState {
  return (GALLERY_STATES as readonly string[]).includes(requested ?? "")
    ? (requested as GalleryState)
    : (DEFAULT_STATE[element] ?? "live");
}

const STING: Record<StingKind, Omit<ActiveEventSting, "id" | "durationMs">> = {
  four: { type: "four", kind: "four", title: "Four" },
  six: { type: "six", kind: "six", title: "Six" },
  wicket: { type: "wicket", kind: "wicket", title: "Wicket" },
  fifty: { type: "milestone", kind: "fifty", title: "Fifty" },
  hundred: { type: "milestone", kind: "hundred", title: "Hundred" },
  three_for: { type: "milestone", kind: "three_for", title: "Three wickets" },
  five_for: { type: "milestone", kind: "five_for", title: "Five wickets" },
  hat_trick: { type: "milestone", kind: "hat_trick", title: "Hat-trick" },
  free_hit: {
    type: "free_hit",
    kind: "free_hit",
    title: "Free hit",
    subtitle: "No-ball called",
    detail: "Next delivery is a free hit",
  },
  milestone: { type: "milestone", kind: "milestone", title: "Milestone" },
};

const BREAK_KINDS: BreakKind[] = [
  "drinks",
  "rain_delay",
  "timeout",
  "innings_break",
  "powerplay",
];

const strap = (s: Omit<ActiveLowerThirdStrap, "id">): ActiveLowerThirdStrap => ({
  id: `gallery-${s.type}`,
  durationMs: -1,
  ...s,
});

export interface GalleryOptions {
  state: GalleryState;
  variant?: string | null;
  kind?: string | null;
  theme: string;
}

/** An element's props from the demo match. */
export function galleryElementProps<E extends OverlayElementId>(
  element: E,
  options: GalleryOptions,
): OverlayElementProps[E] {
  const state = STATES[options.state];
  const match: Match =
    options.state === "result" ? DEMO_RESULT_MATCH : DEMO_MATCH_DETAILS;
  const base: ElementBaseProps = {
    state,
    match,
    snapshots: DEMO_SNAPSHOTS,
    theme: options.theme,
    customColors: DEFAULT_CUSTOM_COLOURS,
    layout: "bottom",
  };
  const v = options.variant ?? undefined;
  const innings = [...(match.innings ?? [])];
  const current =
    innings.find((i) => i.innings_number === state.innings_number) ??
    innings[innings.length - 1]!;
  const teamName = inningsTeamName(state, current, match.team1_id);
  const fielding =
    teamName === state.team1_name ? state.team2_name : state.team1_name;
  const props: { [K in OverlayElementId]: () => OverlayElementProps[K] } = {
    scoreBug: () => ({
      ...base,
      sponsor: "Northfield Builders",
      marginOffsetPx: 0,
      phase: overlayPhaseOf(state),
    }),
    batterLowerThird: () => ({
      ...base,
      slot: v === "last_out" ? "last_out" : "striker",
      variant: v === "figures" ? "figures" : "strap",
      strap:
        v === "figures"
          ? null
          : strap({ type: v === "last_out" ? "last_wicket" : "batsman", title: "" }),
    }),
    bowlerLowerThird: () => ({
      ...base,
      variant: v === "figures" ? "figures" : "strap",
      strap: v === "figures" ? null : strap({ type: "bowler", title: "" }),
    }),
    newBatter: () => ({
      ...base,
      strap: strap({
        type: "new_batter",
        badge: "New batter",
        title: state.striker_name ?? "New batter",
        subtitle: `In at ${state.total_runs ?? 0}/${state.total_wickets ?? 0}`,
      }),
    }),
    newBowler: () => ({
      ...base,
      strap: strap({
        type: "new_bowler",
        badge: "Bowling",
        title: state.current_bowler_name ?? "Bowler",
        subtitle: "Into the attack",
      }),
    }),
    partnership: () => ({
      ...base,
      variant: v === "card" || v === "split" ? v : "strap",
      strap: strap({ type: "partnership", title: "" }),
    }),
    chase: () => ({ ...base, strap: strap({ type: "target", title: "" }) }),
    thisOver: () => ({
      ...base,
      variant: v === "card" ? "card" : "strap",
      strap: strap({
        type: "over_end",
        badge: `End of over ${state.current_over ?? 0}`,
        title: `${state.this_over_runs ?? 0} runs`,
        subtitle: state.current_bowler_name
          ? `Bowler ${state.current_bowler_name}`
          : undefined,
      }),
    }),
    sting: () => {
      const kind = (options.kind ?? "four") as StingKind;
      const s = STING[kind] ?? STING.four;
      return {
        ...base,
        kind: s.kind ?? "four",
        sting: {
          id: `gallery-${kind}`,
          durationMs: 600_000,
          subtitle: state.striker_name ?? undefined,
          detail: `${state.striker_runs ?? 0} (${state.striker_balls ?? 0})`,
          ...s,
        },
      };
    },
    scorecard: () => ({
      ...base,
      innings: current,
      teamName,
      full: v !== "batting",
    }),
    bowlingCard: () => ({ ...base, innings: current, teamName: fielding ?? "" }),
    fallOfWickets: () => ({ ...base, innings: current, teamName }),
    playingXi: () => ({
      ...base,
      side: v === "team1" ? 1 : v === "team2" ? 2 : null,
    }),
    toss: () => base,
    matchIntro: () => base,
    playerProfile: () => ({
      ...base,
      slot: "striker",
      mode: v === "tournament" ? "tournament" : "career",
      profile: DEMO_CAREER,
    }),
    pointsTable: () => ({ ...base, table: DEMO_SNAPSHOTS.pointsTable! }),
    leaderboard: () => ({ ...base, board: DEMO_SNAPSHOTS.leaderboard! }),
    nextFixture: () => ({ ...base, fixture: DEMO_SNAPSHOTS.nextFixture! }),
    result: () => ({ ...base, innings }),
    matchSummary: () => ({ ...base, innings }),
    inningsBreak: () => ({ ...base, innings }),
    playerOfTheMatch: () => ({ ...base, innings }),
    winPredictor: () => ({
      ...base,
      variant: v === "strap" ? "strap" : "card",
      strap: strap({ type: "win_predictor", title: "" }),
    }),
    projectedScore: () => ({
      ...base,
      variant: v === "strap" ? "strap" : "card",
      strap: strap({ type: "win_predictor", title: "" }),
    }),
    breakStrap: () => {
      const kind = (
        BREAK_KINDS.includes(options.kind as BreakKind) ? options.kind : "drinks"
      ) as BreakKind;
      return {
        ...base,
        kind,
        variant: v === "card" ? "card" : "strap",
        strap: strap({ type: kind, title: "" }),
      };
    },
    message: () => ({
      ...base,
      strap: strap({
        type: "message",
        form:
          v === "single" || v === "baseline" || v === "double" ? v : "double",
        badge: "Notice",
        title: "Play resumes at 3.40pm",
        subtitle: "Lunch is being taken. Both sides return after 40 minutes.",
      }),
    }),
    sponsors: () => ({
      ...base,
      title: state.tournament_name ?? null,
      sponsors: [
        { id: "s1", name: "Northfield Builders", tagline: "Building since 1972" },
      ],
    }),
    ticker: () => ({
      ...base,
      text: "Next match: Hillside Comets v Eastgate Owls, Saturday 9.30am at Hillside Recreation Ground",
    }),
    runsPerOver: () => base,
    worm: () => base,
    runRates: () => base,
    wagonWheel: () => ({ ...base, batterId: state.striker_id ?? null }),
  };
  return props[element]() as OverlayElementProps[E];
}

/** A stand-in camera picture: a day ground or a night one. */
function Backdrop({ night }: { night: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0"
      style={{
        background: night
          ? "radial-gradient(ellipse at 50% 20%, #3a4a3a 0%, #121812 55%, #050805 100%)"
          : "linear-gradient(180deg, #8fa3b8 0%, #b8c4cf 18%, #3d5a2a 18.5%, #4f7a32 30%, transparent 30%), repeating-linear-gradient(90deg, #4c8a2e 0px, #4c8a2e 120px, #5a9a38 120px, #5a9a38 240px)",
      }}
    >
      {!night && (
        <div
          className="absolute left-1/2 top-[38%] h-[46%] w-[12%] -translate-x-1/2"
          style={{ background: "#c9b48a", boxShadow: "0 0 0 2px #e8dcc0 inset" }}
        />
      )}
    </div>
  );
}

function GalleryIndex() {
  return (
    <main className="min-h-screen bg-white p-8 font-sans text-[#11132c]">
      <h1 className="text-2xl font-semibold">Overlay gallery</h1>
      <p className="mt-1 max-w-3xl text-sm text-[#63667e]">
        Every element of every package from the demo match, at 1920×1080.
        Add <code>state</code> (pre, first, live, break, result),{" "}
        <code>variant</code>, <code>kind</code> and <code>bg=night</code> to
        a link.
      </p>
      {PACKAGE_MANIFEST.map((pkg) => (
        <section key={pkg.id} className="mt-6">
          <h2 className="text-lg font-semibold">
            {pkg.label} <span className="font-normal text-[#63667e]">({pkg.id})</span>
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {OVERLAY_ELEMENTS.map((el) => (
              <li key={el}>
                <Link
                  className="rounded border border-[#e2e4ee] px-2 py-1 hover:bg-[#e7e8fd]"
                  href={`/overlay/gallery?package=${pkg.id}&element=${el}`}
                >
                  {el}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

export interface OverlayGalleryProps {
  packageId: string;
  element: string | null;
  state?: string | null;
  variant?: string | null;
  kind?: string | null;
  bg?: string | null;
}

export function OverlayGallery({
  packageId,
  element,
  state,
  variant,
  kind,
  bg,
}: OverlayGalleryProps) {
  if (!element || !(OVERLAY_ELEMENTS as readonly string[]).includes(element)) {
    return <GalleryIndex />;
  }
  const id = element as OverlayElementId;
  const stateName = galleryStateOf(id, state);
  const props = galleryElementProps(id, {
    state: stateName,
    variant,
    kind,
    theme: packageId,
  });
  return (
    <div
      data-gallery-element={id}
      className="fixed inset-0 overflow-hidden"
      style={{ width: 1920, height: 1080 }}
    >
      <Backdrop night={bg === "night"} />
      <OverlayPackageScope
        theme={packageId}
        customColors={DEFAULT_CUSTOM_COLOURS}
        state={props.state ?? STATES[stateName]}
      >
        <OverlayElement id={id} present props={props} />
      </OverlayPackageScope>
    </div>
  );
}
