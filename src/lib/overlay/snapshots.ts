/**
 * Snapshots for the overlay's tournament cards (points table, leaders,
 * next match, tournament figures): built on the server for the control
 * room, which sends them in a `SET_SNAPSHOTS` command (the overlay reads
 * nothing for them). Pure: the server action loads the data.
 */

import type {
  FixtureSnapshot,
  LeaderboardSnapshot,
  OverlaySnapshots,
  PointsTableSnapshot,
  SeriesFigures,
} from "~/components/overlay/types";
import type {
  BattingLeaderboardEntry,
  BowlingLeaderboardEntry,
  LeaderboardData,
} from "~/lib/leaderboard";

export interface StandingInput {
  team_id: string | null;
  matches_played: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  no_results: number | null;
  points: number | null;
  net_run_rate: number | null;
}

export interface TeamInput {
  id: string;
  name: string;
  short_name: string | null;
  logo_url?: string | null;
}

/** Rows shown at most (the command stays well under its 16 KB cap). */
export const SNAPSHOT_LIMITS = { table: 16, leaders: 8, series: 30 } as const;

export function pointsTableSnapshot(
  title: string,
  standings: readonly StandingInput[],
  teams: ReadonlyMap<string, TeamInput>,
  highlight: readonly string[],
): PointsTableSnapshot | null {
  const rows = standings
    .filter((s) => s.team_id && teams.has(s.team_id))
    .slice(0, SNAPSHOT_LIMITS.table)
    .map((s) => {
      const team = teams.get(s.team_id!)!;
      return {
        team: team.name,
        short: team.short_name,
        played: s.matches_played ?? 0,
        won: s.wins ?? 0,
        lost: s.losses ?? 0,
        tied: s.ties ?? 0,
        noResult: s.no_results ?? 0,
        points: s.points ?? 0,
        nrr: s.net_run_rate,
        highlight: highlight.includes(team.id),
      };
    });
  return rows.length ? { title, rows } : null;
}

export type LeaderBoardKind = "runs" | "wickets";

export function leaderboardSnapshot(
  data: LeaderboardData,
  kind: LeaderBoardKind,
): LeaderboardSnapshot | null {
  if (kind === "wickets") {
    const rows = data.bowling
      .filter((b) => b.wickets > 0)
      .slice(0, SNAPSHOT_LIMITS.leaders)
      .map((b) => ({
        name: b.name,
        value: b.wickets,
        detail: `${b.matches} ${b.matches === 1 ? "match" : "matches"} · Econ ${b.economyDisplay}`,
        playerId: b.userId,
      }));
    return rows.length ? { title: "Most wickets", metric: "Wickets", rows } : null;
  }
  const rows = data.batting
    .filter((b) => b.runs > 0)
    .slice(0, SNAPSHOT_LIMITS.leaders)
    .map((b) => ({
      name: b.name,
      value: b.runs,
      detail: `${b.innings} inns · SR ${b.strikeRateDisplay}`,
      playerId: b.userId,
    }));
  return rows.length ? { title: "Most runs", metric: "Runs", rows } : null;
}

/** Tournament figures of the players in this match. */
export function seriesSnapshot(
  data: LeaderboardData,
  playerIds: readonly string[],
): Record<string, SeriesFigures> | null {
  const bat = new Map<string, BattingLeaderboardEntry>(
    data.batting.map((b) => [b.userId, b]),
  );
  const bowl = new Map<string, BowlingLeaderboardEntry>(
    data.bowling.map((b) => [b.userId, b]),
  );
  const out: Record<string, SeriesFigures> = {};
  for (const id of playerIds) {
    if (Object.keys(out).length >= SNAPSHOT_LIMITS.series) break;
    const b = bat.get(id);
    const w = bowl.get(id);
    if (!b && !w) continue;
    out[id] = {
      matches: Math.max(b?.matches ?? 0, w?.matches ?? 0),
      ...(b
        ? {
            runs: b.runs,
            highest: b.highestScoreDisplay,
            ...(b.average !== null ? { average: b.average } : {}),
            strikeRate: b.strikeRate,
          }
        : {}),
      ...(w && w.balls > 0
        ? {
            wickets: w.wickets,
            economy: w.economy,
            best: w.bestBowling.display,
          }
        : {}),
    };
  }
  return Object.keys(out).length ? out : null;
}

export interface FixtureInput {
  id: string;
  status: string | null;
  scheduled_at: string | null;
  venue: string | null;
  title?: string | null;
  team1_snapshot?: TeamInput | null;
  team2_snapshot?: TeamInput | null;
}

/** The first scheduled match after now that is not this one. */
export function nextFixtureSnapshot(
  matches: readonly FixtureInput[],
  currentMatchId: string,
  now: Date,
): FixtureSnapshot | null {
  const next = matches.find(
    (m) =>
      m.id !== currentMatchId &&
      m.status === "scheduled" &&
      !!m.scheduled_at &&
      new Date(m.scheduled_at).getTime() > now.getTime() &&
      m.team1_snapshot?.name &&
      m.team2_snapshot?.name,
  );
  if (!next) return null;
  return {
    title: "Next match",
    team1: next.team1_snapshot!.name,
    team1Short: next.team1_snapshot!.short_name,
    team1Logo: next.team1_snapshot!.logo_url ?? null,
    team2: next.team2_snapshot!.name,
    team2Short: next.team2_snapshot!.short_name,
    team2Logo: next.team2_snapshot!.logo_url ?? null,
    startsAt: next.scheduled_at,
    venue: next.venue,
  };
}

/** Everything together, leaving out what has no data. */
export function overlaySnapshots(parts: {
  pointsTable: PointsTableSnapshot | null;
  leaderboard: LeaderboardSnapshot | null;
  nextFixture: FixtureSnapshot | null;
  series: Record<string, SeriesFigures> | null;
}): OverlaySnapshots {
  const out: OverlaySnapshots = {};
  if (parts.pointsTable) out.pointsTable = parts.pointsTable;
  if (parts.leaderboard) out.leaderboard = parts.leaderboard;
  if (parts.nextFixture) out.nextFixture = parts.nextFixture;
  if (parts.series) out.series = parts.series;
  return out;
}
