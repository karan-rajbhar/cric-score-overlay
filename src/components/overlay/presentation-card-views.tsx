"use client";

/**
 * The presentation cards' visuals (the Standard package's toss, playing
 * XI, scorecard, partnership, this over and result elements). Pure: each
 * draws what it is given; `presentation-cards.tsx` decides what is on air.
 */

import type { Innings, Match, TeamPlayer } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import {
  BallTrack,
  CardShell,
  economyText,
  eyebrowOf,
  OV,
  overTokens,
  oversText,
  TeamMark,
  teamCode,
} from "./overlay-kit";
import { InningsCard, inningsTeamName, scoreOf } from "./scorecard-cards";
import type { LiveMatchState } from "./types";

/** The playing XI of a team: players flagged for this match, in order. */
export function playingXi(players: TeamPlayer[] | undefined): TeamPlayer[] {
  return (players ?? [])
    .filter((p) => p.is_playing_xi === true)
    .sort(
      (a, b) =>
        (a.batting_order ?? Number.MAX_SAFE_INTEGER) -
        (b.batting_order ?? Number.MAX_SAFE_INTEGER),
    );
}

/** The side that won the toss, from the match's team ids. */
export function tossWinnerName(
  state: LiveMatchState,
  match: Match | null | undefined,
): string | null {
  if (!state.toss_winner_team_id || !match) return null;
  if (state.toss_winner_team_id === match.team1_id) return state.team1_name;
  if (state.toss_winner_team_id === match.team2_id) return state.team2_name;
  return null;
}

function TeamBlock({
  name,
  short,
  logoUrl,
}: {
  name: string | null;
  short: string | null;
  logoUrl: string | null | undefined;
}) {
  const code = teamCode(short, name);
  return (
    <div className="flex min-w-0 flex-col items-center gap-3">
      <span
        className={cn(
          "flex h-28 w-28 items-center justify-center rounded-lg p-4 text-[2rem]",
          OV.panel,
        )}
      >
        <TeamMark logoUrl={logoUrl} code={code} />
      </span>
      <span className="max-w-[24rem] truncate text-[1.75rem] font-semibold">
        {name}
      </span>
    </div>
  );
}

export function TossCard({
  state,
  match,
}: {
  state: LiveMatchState;
  match: Match | null;
}) {
  const winner = tossWinnerName(state, match);
  const choice = state.toss_decision === "bowl" ? "bowl" : "bat";
  return (
    <CardShell
      className="max-w-[60rem]"
      eyebrow={eyebrowOf(state, "Toss")}
      title={`${winner} won the toss`}
      aside={
        <span className={cn("text-[1.5rem] font-semibold", OV.accentText)}>
          Chose to {choice}
        </span>
      }
    >
      <div className="flex items-center justify-around gap-8 py-4">
        <TeamBlock
          name={state.team1_name}
          short={state.team1_short_name}
          logoUrl={state.team1_logo_url}
        />
        <span className={cn("text-[1.5rem]", OV.cardMuted)}>v</span>
        <TeamBlock
          name={state.team2_name}
          short={state.team2_short_name}
          logoUrl={state.team2_logo_url}
        />
      </div>
      {(state.venue || state.umpire1_name) && (
        <p className={cn("mt-2 text-center text-lg", OV.cardMuted)}>
          {[
            state.venue,
            state.umpire1_name &&
              `Umpires ${state.umpire1_name}${state.umpire2_name ? ` and ${state.umpire2_name}` : ""}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </CardShell>
  );
}

function roleMark(role: string | null | undefined): string {
  if (role === "captain") return " (c)";
  if (role === "wicket_keeper") return " (wk)";
  return "";
}

export function XiColumn({
  name,
  players,
}: {
  name: string | null;
  players: TeamPlayer[];
}) {
  return (
    <div className="min-w-0">
      <h3
        className={cn(
          "mb-2 truncate border-b pb-2 text-[1.5rem] font-semibold",
          OV.cardLine,
        )}
      >
        {name}
      </h3>
      <ol className="space-y-1">
        {players.map((p, i) => (
          <li key={p.id} className="flex items-baseline gap-3 text-lg">
            <span className={cn("w-6 text-right tabular-nums", OV.cardMuted)}>
              {i + 1}
            </span>
            <span className="truncate font-medium">
              {p.user?.full_name ?? ""}
              {roleMark(p.role_in_team)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PlayingXiCard({
  state,
  match,
}: {
  state: LiveMatchState;
  match: Match | null;
}) {
  const one = playingXi(match?.team1?.team_players);
  const two = playingXi(match?.team2?.team_players);
  return (
    <CardShell
      className="max-w-[72rem]"
      eyebrow={eyebrowOf(state, "Team lineups")}
      title="Playing XI"
    >
      <div className="grid grid-cols-2 gap-12">
        <XiColumn name={state.team1_name} players={one} />
        <XiColumn name={state.team2_name} players={two} />
      </div>
    </CardShell>
  );
}

export function ScorecardCard({
  state,
  match,
  innings,
}: {
  state: LiveMatchState;
  match: Match | null;
  innings: Innings[];
}) {
  const current =
    innings.find((i) => i.innings_number === state.innings_number) ??
    innings[innings.length - 1];
  if (!current) return null;
  return (
    <InningsCard
      state={state}
      innings={current}
      teamName={inningsTeamName(state, current, match?.team1_id)}
      kind="full"
    />
  );
}

export function PartnershipCard({
  state,
  innings,
}: {
  state: LiveMatchState;
  innings: Innings[];
}) {
  const current = innings.find((i) => i.innings_number === state.innings_number);
  const stand = current?.partnerships?.find((p) => p.is_current);
  const share = (id: string | null | undefined) => {
    if (!stand || !id) return null;
    if (stand.batsman1_id === id)
      return { runs: stand.batsman1_runs, balls: stand.batsman1_balls };
    if (stand.batsman2_id === id)
      return { runs: stand.batsman2_runs, balls: stand.batsman2_balls };
    return null;
  };
  const batters = [
    { id: state.striker_id, name: state.striker_name },
    { id: state.non_striker_id, name: state.non_striker_name },
  ];
  return (
    <CardShell
      className="max-w-[52rem]"
      eyebrow={eyebrowOf(state, "Partnership")}
      title={`${state.partnership_runs ?? 0} runs`}
      aside={
        <span className={cn("text-[1.5rem] tabular-nums", OV.barMuted)}>
          off {state.partnership_balls ?? 0} balls
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-6">
        {batters.map((b) => {
          const s = share(b.id);
          return (
            <div key={b.id ?? b.name} className="min-w-0">
              <p className="truncate text-[1.5rem] font-medium">{b.name}</p>
              {s && s.runs !== null && s.runs !== undefined ? (
                <p className="text-[2.25rem] font-bold tabular-nums">
                  {s.runs}
                  <span
                    className={cn("ml-2 text-lg font-normal", OV.cardMuted)}
                  >
                    ({s.balls ?? 0})
                  </span>
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

export function OverSummaryCard({ state }: { state: LiveMatchState }) {
  const over = (state.current_over ?? 0) + 1;
  const econ = economyText(state.bowler_runs, state.bowler_balls);
  return (
    <CardShell
      className="max-w-[52rem]"
      eyebrow={eyebrowOf(state, `Over ${over}`)}
      title={`${state.this_over_runs ?? 0} ${state.this_over_runs === 1 ? "run" : "runs"} this over`}
      aside={
        <span className="text-[2.5rem] font-bold tabular-nums">
          {state.total_runs ?? 0}/{state.total_wickets ?? 0}
        </span>
      }
    >
      <BallTrack balls={overTokens(state)} slots={6} />
      {state.current_bowler_name && (
        <p className="mt-4 flex items-baseline justify-between gap-4 text-lg">
          <span className="truncate font-medium">
            {state.current_bowler_name}
          </span>
          <span className="tabular-nums">
            <span className="font-bold">
              {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0}
            </span>{" "}
            <span className={OV.cardMuted}>
              ({oversText(state.bowler_balls)}
              {econ ? ` · Econ ${econ}` : ""})
            </span>
          </span>
        </p>
      )}
    </CardShell>
  );
}

export function ResultCard({
  state,
  match,
  innings,
}: {
  state: LiveMatchState;
  match: Match | null;
  innings: Innings[];
}) {
  const main = innings.filter((i) => i.innings_number <= 2);
  return (
    <CardShell
      className="max-w-[60rem]"
      eyebrow={eyebrowOf(state, "Result")}
      title={state.result_description ?? ""}
    >
      {main.length > 0 && (
        <div className="grid grid-cols-2 gap-8">
          {main.map((inn) => (
            <div key={inn.id} className="min-w-0">
              <p className="truncate text-[1.5rem] font-medium">
                {inningsTeamName(state, inn, match?.team1_id)}
              </p>
              <p className="text-[2.5rem] font-bold tabular-nums">
                {scoreOf(inn)}
                <span className={cn("ml-2 text-lg font-normal", OV.cardMuted)}>
                  ({oversText(inn.total_balls)} ov)
                </span>
              </p>
            </div>
          ))}
        </div>
      )}
      {match?.player_of_the_match?.full_name && (
        <p className={cn("mt-4 border-t pt-4 text-lg", OV.cardLine)}>
          <span className={OV.cardMuted}>Player of the match </span>
          <span className="font-semibold">
            {match.player_of_the_match.full_name}
          </span>
        </p>
      )}
    </CardShell>
  );
}

