"use client";

/**
 * The broadcast graphics suite: one view at a time, picked by the producer
 * (`SET_BROADCAST_VIEW`, or an automatic rule). View ids are kept from the
 * earlier suite so saved commands still work; each view is drawn by a
 * package element (`packages/`), Standard's where the package has none.
 *
 * Nothing is invented: a view whose data does not exist renders nothing,
 * and {@link broadcastViewAvailable} tells the control room which views it
 * can offer. Data comes from the `live_state` row, the match's innings
 * (kept current while a scorecard is on air), career documents and the
 * ball log (read when shown) and the control room's snapshots.
 */

import type { Innings, Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { winPredictorFromLive } from "~/lib/win-predictor";
import { chartAvailable } from "./charts-card";
import { useScorecardInnings } from "./overlay-data";
import type { OverlayThemeProps } from "./overlay-kit";
import { OverlayElement } from "./packages/element";
import type {
  ElementBaseProps,
  OverlayElementId,
  OverlayElementProps,
} from "./packages/types";
import { playingXi, presentationCardAvailable } from "./presentation-cards";
import { playerInSlot, type PlayerSlot } from "./profile-card";
import { overlayPhaseOf } from "./score-bug";
import { inningsTeamName } from "./scorecard-cards";
import type {
  BroadcastViewId,
  LiveMatchState,
  OverlaySnapshots,
} from "./types";
import { wagonWheelAvailable } from "./wagon-wheel-card";
import { winPredictorAvailable } from "./win-predictor-card";

export interface BroadcastSuiteOverlayProps extends OverlayThemeProps {
  state: LiveMatchState;
  match?: Match | null;
  activeView: BroadcastViewId;
  onSelectView?: (view: BroadcastViewId) => void;
  /** The view bar (for the overlay page's own controls; never on air). */
  showControls?: boolean;
  /** Kept for callers; views have no on-air close button. */
  onCloseCard?: () => void;
  /** Standings, leaderboards, fixtures and tournament figures. */
  snapshots?: OverlaySnapshots | null;
  /** A sponsor line on the score bar. */
  sponsor?: string | null;
}

export const BROADCAST_VIEW_OPTIONS: Array<{
  id: BroadcastViewId;
  label: string;
}> = [
  { id: "1", label: "Score bar" },
  { id: "2", label: "Batting card, 1st innings" },
  { id: "3", label: "Bowling card, 1st innings" },
  { id: "4", label: "Batting card, 2nd innings" },
  { id: "5", label: "Bowling card, 2nd innings" },
  { id: "45", label: "Fall of wickets" },
  { id: "6", label: "Playing XI, team 1" },
  { id: "7", label: "Playing XI, team 2" },
  { id: "13", label: "Match intro" },
  { id: "14", label: "Innings break" },
  { id: "15", label: "Drinks break" },
  { id: "28", label: "Rain delay" },
  { id: "16", label: "Striker figures" },
  { id: "17", label: "Non-striker figures" },
  { id: "18", label: "Bowler figures" },
  { id: "19", label: "Last out figures" },
  { id: "24", label: "Striker career" },
  { id: "25", label: "Non-striker career" },
  { id: "26", label: "Bowler career" },
  { id: "27", label: "Last out career" },
  { id: "36", label: "Striker this tournament" },
  { id: "37", label: "Non-striker this tournament" },
  { id: "38", label: "Bowler this tournament" },
  { id: "39", label: "Last out this tournament" },
  { id: "23", label: "Partnership split" },
  { id: "40", label: "Wagon wheel" },
  { id: "8", label: "Match summary" },
  { id: "21", label: "Runs per over" },
  { id: "22", label: "Worm" },
  { id: "41", label: "Run rates" },
  { id: "42", label: "Win predictor card" },
  { id: "20", label: "Points table" },
  { id: "43", label: "Leaderboard" },
  { id: "44", label: "Next match" },
  { id: "29", label: "Player of the match" },
];

const SLOT: Partial<Record<BroadcastViewId, PlayerSlot>> = {
  "16": "striker",
  "17": "non_striker",
  "18": "bowler",
  "19": "last_out",
  "24": "striker",
  "25": "non_striker",
  "26": "bowler",
  "27": "last_out",
  "36": "striker",
  "37": "non_striker",
  "38": "bowler",
  "39": "last_out",
};

/** Views drawn as a lower third over the score bar. */
const LOWER_THIRD = new Set<BroadcastViewId>([
  "15",
  "16",
  "17",
  "18",
  "19",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "36",
  "37",
  "38",
  "39",
]);

export interface BroadcastViewData {
  state: LiveMatchState;
  match?: Match | null;
  snapshots?: OverlaySnapshots | null;
}

/** Whether a view has the data it shows (the control room disables it otherwise). */
export function broadcastViewAvailable(
  view: BroadcastViewId,
  { state, match, snapshots }: BroadcastViewData,
): boolean {
  const innings = state.innings_number ?? 0;
  const slot = SLOT[view];
  switch (view) {
    case "1":
    case "15":
    case "28":
      return true;
    case "2":
    case "3":
    case "8":
      return innings >= 1;
    case "4":
    case "5":
      return innings >= 2;
    case "45":
      return (state.total_wickets ?? 0) > 0;
    case "6":
      return playingXi(match?.team1?.team_players).length > 0;
    case "7":
      return playingXi(match?.team2?.team_players).length > 0;
    case "13":
      return !!state.team1_name && !!state.team2_name;
    case "14":
      return innings >= 2 || !!state.innings_completed;
    case "16":
    case "17":
    case "18":
    case "19":
      return !!playerInSlot(state, slot!).name;
    case "24":
    case "25":
    case "26":
    case "27":
      return !!playerInSlot(state, slot!).id;
    case "36":
    case "37":
    case "38":
    case "39": {
      const id = playerInSlot(state, slot!).id;
      return !!id && !!snapshots?.series?.[id];
    }
    case "20":
      return !!snapshots?.pointsTable?.rows.length;
    case "21":
      return chartAvailable("manhattan", state);
    case "22":
      return chartAvailable("worm", state);
    case "41":
      return chartAvailable("run_rate", state);
    case "23":
      return presentationCardAvailable("partnership", state, match);
    case "29":
      return !!match?.player_of_the_match?.full_name;
    case "40":
      return wagonWheelAvailable(state);
    case "42":
      return winPredictorAvailable(state);
    case "43":
      return !!snapshots?.leaderboard?.rows.length;
    case "44":
      return !!snapshots?.nextFixture;
  }
}

function inningsNo(innings: Innings[], n: number): Innings | undefined {
  return innings.find((i) => i.innings_number === n);
}

/** One view: the element that draws it and its props. */
interface ViewEntry {
  view: BroadcastViewId;
  element: OverlayElementId;
  props: OverlayElementProps[OverlayElementId];
}

const CAREER: BroadcastViewId[] = ["24", "25", "26", "27"];
const SERIES: BroadcastViewId[] = ["36", "37", "38", "39"];

/** Every view that can be drawn now, with its element. */
function viewEntries(
  base: ElementBaseProps,
  innings: Innings[],
): ViewEntry[] {
  const { state, match, snapshots } = base;
  const out: ViewEntry[] = [];
  const add = <E extends OverlayElementId>(
    view: BroadcastViewId,
    element: E,
    props: OverlayElementProps[E],
  ) => out.push({ view, element, props: props as never });
  const side = (n: number) => {
    const inn = inningsNo(innings, n);
    if (!inn) return null;
    const batting = inningsTeamName(state, inn, match?.team1_id);
    const fielding =
      batting === state.team1_name ? (state.team2_name ?? "") : (state.team1_name ?? "");
    return { inn, batting, fielding };
  };
  for (const [n, bat, bowl] of [
    [1, "2", "3"],
    [2, "4", "5"],
  ] as const) {
    const s = side(n);
    if (!s) continue;
    add(bat, "scorecard", { ...base, innings: s.inn, teamName: s.batting, full: false });
    add(bowl, "bowlingCard", { ...base, innings: s.inn, teamName: s.fielding });
  }
  const current = side(state.innings_number ?? 1);
  if (current) {
    add("45", "fallOfWickets", { ...base, innings: current.inn, teamName: current.batting });
  }
  add("6", "playingXi", { ...base, side: 1 });
  add("7", "playingXi", { ...base, side: 2 });
  add("8", "matchSummary", { ...base, innings });
  add("13", "matchIntro", base);
  add("14", "inningsBreak", { ...base, innings });
  add("15", "breakStrap", { ...base, kind: "drinks", variant: "card", strap: null });
  add("28", "breakStrap", { ...base, kind: "rain_delay", variant: "card", strap: null });
  add("16", "batterLowerThird", { ...base, slot: "striker", variant: "figures", strap: null });
  add("17", "batterLowerThird", { ...base, slot: "non_striker", variant: "figures", strap: null });
  add("18", "bowlerLowerThird", { ...base, variant: "figures", strap: null });
  add("19", "batterLowerThird", { ...base, slot: "last_out", variant: "figures", strap: null });
  for (const view of CAREER) {
    add(view, "playerProfile", { ...base, slot: SLOT[view]!, mode: "career" });
  }
  for (const view of SERIES) {
    add(view, "playerProfile", { ...base, slot: SLOT[view]!, mode: "tournament" });
  }
  if (snapshots?.pointsTable) add("20", "pointsTable", { ...base, table: snapshots.pointsTable });
  if (snapshots?.leaderboard) add("43", "leaderboard", { ...base, board: snapshots.leaderboard });
  if (snapshots?.nextFixture) add("44", "nextFixture", { ...base, fixture: snapshots.nextFixture });
  add("21", "runsPerOver", base);
  add("22", "worm", base);
  add("41", "runRates", base);
  add("23", "partnership", { ...base, variant: "split", strap: null });
  add("29", "playerOfTheMatch", { ...base, innings });
  add("40", "wagonWheel", { ...base, batterId: state.striker_id ?? null });
  add(
    "42",
    winPredictorFromLive(state)?.kind === "projection" ? "projectedScore" : "winPredictor",
    { ...base, variant: "card", strap: null },
  );
  return out;
}

export function BroadcastSuiteOverlay({
  state,
  match = null,
  activeView = "1",
  onSelectView,
  showControls = false,
  snapshots = null,
  sponsor = null,
  theme = "standard",
  customColors = null,
}: BroadcastSuiteOverlayProps) {
  const available = broadcastViewAvailable(activeView, { state, match, snapshots });
  const { innings } = useScorecardInnings(match);
  const lowerThird = LOWER_THIRD.has(activeView);
  const showBug = activeView === "1" || lowerThird || !available;
  const base: ElementBaseProps = {
    state,
    match,
    snapshots,
    theme,
    customColors,
    layout: "bottom",
  };

  return (
    <div data-view={activeView} className="contents">
      {showControls && (
        <nav
          aria-label="Graphics"
          className="pointer-events-auto fixed left-1/2 top-4 z-50 flex max-w-[96vw] -translate-x-1/2 flex-wrap justify-center gap-1 rounded-lg bg-black/80 p-1.5"
        >
          {BROADCAST_VIEW_OPTIONS.map((opt) => {
            const ok = broadcastViewAvailable(opt.id, { state, match, snapshots });
            return (
              <button
                key={opt.id}
                type="button"
                disabled={!ok}
                aria-pressed={activeView === opt.id}
                onClick={() => onSelectView?.(opt.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-sans text-sm text-white/80 hover:bg-white/15 disabled:opacity-35",
                  activeView === opt.id && "bg-white text-black hover:bg-white",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </nav>
      )}

      <OverlayElement
        id="scoreBug"
        present={showBug}
        motionKey={`${state.total_runs}/${state.total_wickets}`}
        props={{
          ...base,
          sponsor,
          marginOffsetPx: 0,
          phase: overlayPhaseOf(state),
        }}
      />

      {viewEntries(base, innings).map((v) => (
        <OverlayElement
          key={v.view}
          id={v.element}
          present={available && activeView === v.view}
          props={v.props}
        />
      ))}
    </div>
  );
}
