"use client";

/**
 * The ball log behind a package's charts and wagon wheel, read the way
 * the Standard cards read it (`useInningsBallLog`: each innings' overs
 * when the card shows and the innings has moved since; demo innings carry
 * theirs). No other reads.
 */

import { useMemo } from "react";
import type { Innings, Match } from "~/lib/match-types";
import { useInningsBallLog, useScorecardInnings } from "../../overlay-data";
import { inningsTeamName } from "../../scorecard-cards";
import type { LiveMatchState } from "../../types";
import { overTable, wagonWheelShots, type OverPoint, type Shot } from "./charts";

export interface InningsSeries {
  innings: Innings;
  /** The side that batted (1 / 2). */
  side: 1 | 2;
  name: string;
  table: OverPoint[];
}

/**
 * Each of the first two innings' over table, once their balls are in;
 * null while loading.
 */
export function useInningsSeries(
  state: LiveMatchState,
  match: Match | null | undefined,
): InningsSeries[] | null {
  const { innings } = useScorecardInnings(match);
  const main = useMemo(() => innings.filter((i) => i.innings_number <= 2), [innings]);
  const log = useInningsBallLog(state, main, true);
  return useMemo(() => {
    if (!log) return null;
    return main.map((inn) => {
      const name = inningsTeamName(state, inn, match?.team1_id);
      const side: 1 | 2 = match?.team1_id
        ? inn.team_id === match.team1_id
          ? 1
          : 2
        : name === state.team2_name
          ? 2
          : 1;
      return { innings: inn, side, name, table: overTable(log.get(inn.id) ?? []) };
    });
  }, [main, log, match, state]);
}

export interface BatterShots {
  /** The batter's name (striker or non-striker by id). */
  name: string | null;
  shots: Shot[];
  /** The ball log is in. */
  loaded: boolean;
}

/** A batter's shots this innings (the striker when `batterId` is null). */
export function useBatterShots(
  state: LiveMatchState,
  match: Match | null | undefined,
  batterId: string | null,
): BatterShots {
  const id = batterId ?? state.striker_id ?? null;
  const name = id && id === state.non_striker_id ? state.non_striker_name : state.striker_name;
  const { innings } = useScorecardInnings(match);
  const current = useMemo(
    () => innings.filter((i) => i.innings_number === state.innings_number),
    [innings, state.innings_number],
  );
  const log = useInningsBallLog(state, current, true);
  const shots = useMemo(
    () => (current[0] && log ? wagonWheelShots(log.get(current[0].id) ?? [], id) : []),
    [log, current, id],
  );
  return { name, shots, loaded: !!log };
}
