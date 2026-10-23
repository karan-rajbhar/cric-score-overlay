"use client";

/**
 * The graphics suite's visuals that are not cards of their own elsewhere
 * (the Standard package's team list, match summary, innings break, intro,
 * partnership split, stoppage and player-of-the-match elements). Pure:
 * `broadcast-suite-overlay.tsx` decides what is on air.
 */

import type { Innings, Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import {
  CardShell,
  eyebrowOf,
  OV,
  oversText,
  TeamMark,
  teamCode,
} from "./overlay-kit";
import { playingXi, tossWinnerName } from "./presentation-card-views";
import { inningsTeamName, scoreOf } from "./scorecard-cards";
import type { LiveMatchState } from "./types";

function inningsNo(innings: Innings[], n: number): Innings | undefined {
  return innings.find((i) => i.innings_number === n);
}

export function TeamListCard({
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
export function Leaders({ innings }: { innings: Innings }) {
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

export function SummaryCard({
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

export function IntroCard({
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

export function PartnershipView({ state, innings }: { state: LiveMatchState; innings: Innings[] }) {
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

export function StoppageCard({ state, kind }: { state: LiveMatchState; kind: "drinks" | "rain" }) {
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

export function PlayerOfTheMatch({
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

