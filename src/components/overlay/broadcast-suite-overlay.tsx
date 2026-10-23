"use client";

/**
 * The broadcast graphics suite: one view at a time, picked by the producer
 * (`SET_BROADCAST_VIEW`). View ids are kept from the earlier suite so
 * saved commands still work; their content is rebuilt on the shared
 * overlay kit and themes.
 *
 * Nothing is invented: a view whose data does not exist renders nothing,
 * and {@link broadcastViewAvailable} tells the control room which views it
 * can offer. Data comes from the `live_state` row, `live_scorecard` (one
 * read when a scorecard view shows), career documents and the ball log
 * (read when shown) and the control room's snapshots (standings,
 * leaderboards, fixtures, tournament figures).
 */

import type { ReactNode } from "react";
import type { Innings, Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { ChartCard, chartAvailable } from "./charts-card";
import { useScorecardInnings } from "./overlay-data";
import {
  CardShell,
  eyebrowOf,
  FullScreen,
  OV,
  OverlayFrame,
  oversText,
  TeamMark,
  teamCode,
  type OverlayThemeProps,
} from "./overlay-kit";
import {
  playingXi,
  presentationCardAvailable,
  tossWinnerName,
} from "./presentation-cards";
import {
  CareerCard,
  InningsFiguresCard,
  playerInSlot,
  SeriesCard,
  type PlayerSlot,
} from "./profile-card";
import { ScoreBug } from "./score-bug";
import { InningsCard, inningsTeamName, scoreOf } from "./scorecard-cards";
import {
  LeaderboardCard,
  NextFixtureCard,
  PointsTableCard,
} from "./standings-cards";
import type {
  BroadcastViewId,
  LiveMatchState,
  OverlaySnapshots,
} from "./types";
import { WagonWheelCard, wagonWheelAvailable } from "./wagon-wheel-card";
import { WinPredictorCard, winPredictorAvailable } from "./win-predictor-card";

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

function TeamListCard({
  state,
  match,
  side,
}: {
  state: LiveMatchState;
  match?: Match | null;
  side: 1 | 2;
}) {
  const team = side === 1 ? match?.team1 : match?.team2;
  const players = playingXi(team?.team_players);
  if (!players.length) return null;
  return (
    <CardShell
      className="max-w-[44rem]"
      eyebrow={eyebrowOf(state, "Playing XI")}
      title={side === 1 ? (state.team1_name ?? "") : (state.team2_name ?? "")}
    >
      <ol className="columns-1 space-y-1">
        {players.map((p, i) => (
          <li key={p.id} className="flex items-baseline gap-3 text-lg">
            <span className={cn("w-6 text-right tabular-nums", OV.cardMuted)}>
              {i + 1}
            </span>
            <span className="truncate font-medium">
              {p.user?.full_name ?? ""}
              {p.role_in_team === "captain"
                ? " (c)"
                : p.role_in_team === "wicket_keeper"
                  ? " (wk)"
                  : ""}
            </span>
          </li>
        ))}
      </ol>
    </CardShell>
  );
}

/** Best batters and bowlers of an innings, for summaries. */
function Leaders({ innings }: { innings: Innings }) {
  const bat = [...(innings.batting_performances ?? [])]
    .filter((b) => b.balls_faced > 0)
    .sort((a, b) => b.runs_scored - a.runs_scored)
    .slice(0, 3);
  const bowl = [...(innings.bowling_performances ?? [])]
    .filter((b) => b.balls_bowled > 0)
    .sort((a, b) => b.wickets_taken - a.wickets_taken || a.runs_conceded - b.runs_conceded)
    .slice(0, 2);
  return (
    <div className="grid grid-cols-2 gap-6">
      <ul className="space-y-1">
        {bat.map((b) => (
          <li key={b.id} className="flex items-baseline justify-between gap-3 text-lg">
            <span className="truncate font-medium">{b.user?.full_name ?? ""}</span>
            <span className="tabular-nums">
              <span className="font-bold">{b.runs_scored}</span>
              {!b.is_out && "*"}{" "}
              <span className={OV.cardMuted}>({b.balls_faced})</span>
            </span>
          </li>
        ))}
      </ul>
      <ul className="space-y-1">
        {bowl.map((b) => (
          <li key={b.id} className="flex items-baseline justify-between gap-3 text-lg">
            <span className="truncate font-medium">{b.user?.full_name ?? ""}</span>
            <span className="tabular-nums">
              <span className="font-bold">
                {b.wickets_taken}-{b.runs_conceded}
              </span>{" "}
              <span className={OV.cardMuted}>({oversText(b.balls_bowled)})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InningsSummaryRow({
  state,
  match,
  innings,
}: {
  state: LiveMatchState;
  match?: Match | null;
  innings: Innings;
}) {
  return (
    <div className={cn("border-b py-3 last:border-0", OV.cardLine)}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="truncate text-[1.5rem] font-semibold">
          {inningsTeamName(state, innings, match?.team1_id)}
        </span>
        <span className="text-[1.75rem] font-bold tabular-nums">
          {scoreOf(innings)}
          <span className={cn("ml-2 text-lg font-normal", OV.cardMuted)}>
            ({oversText(innings.total_balls)} ov)
          </span>
        </span>
      </div>
      <Leaders innings={innings} />
    </div>
  );
}

function SummaryCard({
  state,
  match,
  innings,
  breakCard,
}: {
  state: LiveMatchState;
  match?: Match | null;
  innings: Innings[];
  breakCard?: boolean;
}) {
  const shown = innings.filter((i) => i.innings_number <= (breakCard ? 1 : 2));
  if (!shown.length) return null;
  const first = inningsNo(innings, 1);
  const aside = breakCard
    ? first && (
        <span className={cn("text-[1.5rem] font-semibold", OV.accentText)}>
          Target {first.total_runs + 1}
        </span>
      )
    : state.result_description
      ? null
      : state.runs_needed !== null && state.balls_remaining !== null
        ? (
            <span className={cn("text-lg tabular-nums", OV.barMuted)}>
              Need {state.runs_needed} from {state.balls_remaining}
            </span>
          )
        : null;
  return (
    <CardShell
      className="max-w-[72rem]"
      eyebrow={eyebrowOf(state, breakCard ? "Innings break" : "Match summary")}
      title={
        breakCard
          ? `${inningsTeamName(state, first ?? shown[0]!, match?.team1_id)} ${scoreOf(first ?? shown[0]!)}`
          : (state.result_description ?? `${state.team1_name} v ${state.team2_name}`)
      }
      aside={aside}
    >
      {shown.map((inn) => (
        <InningsSummaryRow key={inn.id} state={state} match={match} innings={inn} />
      ))}
    </CardShell>
  );
}

function IntroCard({
  state,
  match,
}: {
  state: LiveMatchState;
  match?: Match | null;
}) {
  const toss = tossWinnerName(state, match);
  const sides = [
    { name: state.team1_name, short: state.team1_short_name, logo: state.team1_logo_url },
    { name: state.team2_name, short: state.team2_short_name, logo: state.team2_logo_url },
  ];
  return (
    <CardShell
      className="max-w-[64rem]"
      eyebrow={state.tournament_name ?? state.match_format ?? undefined}
      title={state.title ?? `${state.team1_name} v ${state.team2_name}`}
    >
      <div className="flex items-center justify-around gap-8 py-4">
        {sides.map((s, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-3">
            <span
              className={cn(
                "flex h-28 w-28 items-center justify-center rounded-lg p-4 text-[2rem]",
                OV.panel,
              )}
            >
              <TeamMark logoUrl={s.logo} code={teamCode(s.short, s.name)} />
            </span>
            <span className="max-w-full truncate text-[1.75rem] font-semibold">
              {s.name}
            </span>
          </div>
        ))}
      </div>
      <p className={cn("text-center text-lg", OV.cardMuted)}>
        {[
          state.venue,
          toss &&
            `${toss} won the toss and chose to ${state.toss_decision === "bowl" ? "bowl" : "bat"}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </CardShell>
  );
}

function PartnershipView({ state, innings }: { state: LiveMatchState; innings: Innings[] }) {
  const current = inningsNo(innings, state.innings_number ?? 0);
  const stand = current?.partnerships?.find((p) => p.is_current);
  const row = (id: string | null | undefined, name: string | null) => {
    const own =
      stand && id
        ? stand.batsman1_id === id
          ? { r: stand.batsman1_runs, b: stand.batsman1_balls }
          : stand.batsman2_id === id
            ? { r: stand.batsman2_runs, b: stand.batsman2_balls }
            : null
        : null;
    return { name, own };
  };
  const rows = [
    row(state.striker_id, state.striker_name),
    row(state.non_striker_id, state.non_striker_name),
  ];
  const total = Math.max(1, state.partnership_runs ?? 0);
  return (
    <CardShell
      className="max-w-[56rem]"
      eyebrow={eyebrowOf(state, "Partnership")}
      title={`${state.partnership_runs ?? 0} runs`}
      aside={
        <span className={cn("text-[1.5rem] tabular-nums", OV.barMuted)}>
          off {state.partnership_balls ?? 0} balls
        </span>
      }
    >
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between text-lg">
              <span className="truncate font-medium">{r.name}</span>
              {r.own?.r !== null && r.own?.r !== undefined && (
                <span className="tabular-nums">
                  <span className="font-bold">{r.own.r}</span>{" "}
                  <span className={OV.cardMuted}>({r.own.b ?? 0})</span>
                </span>
              )}
            </div>
            {r.own?.r !== null && r.own?.r !== undefined && (
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={i === 0 ? "h-full bg-series-1" : "h-full bg-series-2"}
                  style={{ width: `${Math.round((r.own.r / total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function StoppageCard({ state, kind }: { state: LiveMatchState; kind: "drinks" | "rain" }) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[64rem] items-stretch overflow-hidden rounded-lg",
        OV.bar,
        OV.shadow,
      )}
    >
      <span className={cn("flex items-center px-6 text-lg font-semibold", OV.accent)}>
        {kind === "drinks" ? "Drinks" : "Weather"}
      </span>
      <span className="flex-1 px-6 py-4 text-[1.75rem] font-semibold">
        {kind === "drinks" ? "Drinks break" : "Rain stopped play"}
      </span>
      {state.total_runs !== null && (
        <span className={cn("flex items-center px-6 text-[1.75rem] font-bold tabular-nums", OV.panel)}>
          {teamCode(state.batting_team_short_name, state.batting_team_name)}{" "}
          {state.total_runs}/{state.total_wickets ?? 0}
        </span>
      )}
    </div>
  );
}

function PlayerOfTheMatch({
  state,
  match,
  innings,
}: {
  state: LiveMatchState;
  match?: Match | null;
  innings: Innings[];
}) {
  const potm = match?.player_of_the_match;
  if (!potm?.full_name) return null;
  const bat = innings.flatMap((i) => i.batting_performances ?? []).find((b) => b.user_id === potm.id);
  const bowl = innings.flatMap((i) => i.bowling_performances ?? []).find((b) => b.user_id === potm.id);
  const figures = [
    bat && bat.balls_faced > 0 && `${bat.runs_scored}${bat.is_out ? "" : "*"} (${bat.balls_faced})`,
    bowl && bowl.balls_bowled > 0 && `${bowl.wickets_taken}-${bowl.runs_conceded} (${oversText(bowl.balls_bowled)})`,
  ].filter(Boolean);
  return (
    <div className={cn("flex w-full max-w-[64rem] overflow-hidden rounded-lg", OV.shadow)}>
      <div className={cn("flex-1 px-6 py-3", OV.bar)}>
        <span className={cn("block text-base font-medium", OV.barMuted)}>
          {eyebrowOf(state, "Player of the match")}
        </span>
        <span className="block truncate text-[2rem] font-semibold">{potm.full_name}</span>
      </div>
      {figures.length > 0 && (
        <div className={cn("flex items-center px-6 text-[1.5rem] font-bold tabular-nums", OV.panel)}>
          {figures.join(" · ")}
        </div>
      )}
    </div>
  );
}

function ViewContent({
  view,
  state,
  match,
  snapshots,
  innings,
}: {
  view: BroadcastViewId;
  state: LiveMatchState;
  match?: Match | null;
  snapshots?: OverlaySnapshots | null;
  innings: Innings[];
}): ReactNode {
  const slot = SLOT[view];
  switch (view) {
    case "2":
    case "3":
    case "4":
    case "5": {
      const inn = inningsNo(innings, view === "2" || view === "3" ? 1 : 2);
      if (!inn) return null;
      const batting = view === "2" || view === "4";
      const battingName = inningsTeamName(state, inn, match?.team1_id);
      const fieldingName =
        battingName === state.team1_name ? (state.team2_name ?? "") : (state.team1_name ?? "");
      return (
        <InningsCard
          state={state}
          innings={inn}
          teamName={batting ? battingName : fieldingName}
          kind={batting ? "batting" : "bowling"}
        />
      );
    }
    case "6":
    case "7":
      return <TeamListCard state={state} match={match} side={view === "6" ? 1 : 2} />;
    case "8":
      return <SummaryCard state={state} match={match} innings={innings} />;
    case "13":
      return <IntroCard state={state} match={match} />;
    case "14":
      return <SummaryCard state={state} match={match} innings={innings} breakCard />;
    case "15":
      return <StoppageCard state={state} kind="drinks" />;
    case "28":
      return <StoppageCard state={state} kind="rain" />;
    case "16":
    case "17":
    case "18":
    case "19":
      return <InningsFiguresCard state={state} slot={slot!} />;
    case "24":
    case "25":
    case "26":
    case "27":
      return <CareerCard state={state} slot={slot!} />;
    case "36":
    case "37":
    case "38":
    case "39":
      return <SeriesCard state={state} slot={slot!} series={snapshots?.series} />;
    case "20":
      return <PointsTableCard state={state} table={snapshots?.pointsTable} />;
    case "21":
      return <ChartCard state={state} match={match} kind="manhattan" />;
    case "22":
      return <ChartCard state={state} match={match} kind="worm" />;
    case "41":
      return <ChartCard state={state} match={match} kind="run_rate" />;
    case "23":
      return <PartnershipView state={state} innings={innings} />;
    case "29":
      return <PlayerOfTheMatch state={state} match={match} innings={innings} />;
    case "40":
      return <WagonWheelCard state={state} match={match} />;
    case "42":
      return <WinPredictorCard state={state} />;
    case "43":
      return <LeaderboardCard state={state} board={snapshots?.leaderboard} />;
    case "44":
      return <NextFixtureCard state={state} fixture={snapshots?.nextFixture} />;
    default:
      return null;
  }
}

export function BroadcastSuiteOverlay({
  state,
  match = null,
  activeView = "1",
  onSelectView,
  showControls = false,
  snapshots,
  sponsor,
  theme,
  customColors,
}: BroadcastSuiteOverlayProps) {
  const available = broadcastViewAvailable(activeView, { state, match, snapshots });
  const { innings } = useScorecardInnings(match);
  const lowerThird = LOWER_THIRD.has(activeView);
  const showBug = activeView === "1" || lowerThird || !available;

  return (
    <OverlayFrame
      state={state}
      theme={theme}
      customColors={customColors}
      data-view={activeView}
    >
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

      {showBug && (
        <ScoreBug
          state={state}
          match={match}
          layout="bottom"
          theme={theme}
          customColors={customColors}
          sponsor={sponsor}
        />
      )}

      {available && activeView !== "1" &&
        (lowerThird ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-[12rem] z-30 flex justify-center px-12">
            <ViewContent
              view={activeView}
              state={state}
              match={match}
              snapshots={snapshots}
              innings={innings}
            />
          </div>
        ) : (
          <FullScreen>
            <ViewContent
              view={activeView}
              state={state}
              match={match}
              snapshots={snapshots}
              innings={innings}
            />
          </FullScreen>
        ))}
    </OverlayFrame>
  );
}
