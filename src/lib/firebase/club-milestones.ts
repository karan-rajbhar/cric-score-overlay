/**
 * A club's milestones (matches, completed matches, runs, wickets, highest
 * team score) as aggregations over its matches instead of reading them
 * all: two count()s, two sum()s over the totals each match carries
 * (`summaryTotalsOf`, written with its innings summary) and its few best
 * innings. A live match's innings in progress is not in those totals (the
 * summary does not follow every ball): `clubMilestonesOf` swaps in the
 * live matches' totals from their fresh innings.
 */

import type { DataSource, Doc } from "./datasource";
import { summaryTotalsOf } from "./derive.mjs";

/** Best innings read beyond the live matches (ties are rare). */
const TOP_INNINGS = 10;

export interface ClubMilestoneAggregates {
  matches: number;
  completed: number;
  runs: number;
  wickets: number;
  /** Matches with the highest innings, best first. */
  top: Doc[];
}

export async function clubMilestoneAggregates(
  ds: DataSource,
  clubId: string,
  liveCount: number,
): Promise<ClubMilestoneAggregates> {
  if (!ds.sum) throw new Error("sum() is not supported here");
  const byClub = [{ field: "club_id", op: "==" as const, value: clubId }];
  const [matches, completed, runs, wickets, top] = await Promise.all([
    ds.count("matches", byClub),
    ds.count("matches", [
      ...byClub,
      { field: "status", op: "==", value: "completed" },
    ]),
    ds.sum("matches", byClub, "summary_runs"),
    ds.sum("matches", byClub, "summary_wickets"),
    ds.query("matches", byClub, {
      orderBy: [{ field: "best_innings_runs", direction: "desc" }],
      limit: TOP_INNINGS + liveCount,
    }),
  ]);
  return { matches, completed, runs, wickets, top };
}

interface InningsLine {
  team_id?: string | null;
  total_runs?: number | null;
  total_wickets?: number | null;
  total_overs?: number | null;
}

export interface MilestoneMatch {
  id: string;
  scheduled_at?: string | null;
  team1?: { id: string; name: string } | null;
  team2?: { id: string; name: string } | null;
  innings?: InningsLine[] | null;
  summary_runs?: number | null;
  summary_wickets?: number | null;
  best_innings?: {
    runs: number;
    wickets: number;
    overs: number;
    team_id: string | null;
  } | null;
}

export interface ClubMilestoneFigures {
  totalMatches: number;
  completedMatches: number;
  totalRuns: number;
  totalWickets: number;
  highestTeamScore: {
    runs: number;
    wickets: number;
    overs: number;
    teamName?: string;
  } | null;
}

/**
 * The milestones of a club whose every match is at hand (`matches` in list
 * order, live ones with fresh innings): add up their innings.
 */
export function clubMilestonesFromList(
  matches: readonly (MilestoneMatch & { status?: string | null })[],
): ClubMilestoneFigures {
  let totalRuns = 0;
  let totalWickets = 0;
  let highestTeamScore: ClubMilestoneFigures["highestTeamScore"] = null;
  for (const m of matches) {
    for (const inn of m.innings ?? []) {
      const runs = inn.total_runs ?? 0;
      const wickets = inn.total_wickets ?? 0;
      totalRuns += runs;
      totalWickets += wickets;
      if (!highestTeamScore || runs > highestTeamScore.runs) {
        const team =
          inn.team_id === m.team1?.id
            ? m.team1
            : inn.team_id === m.team2?.id
              ? m.team2
              : null;
        highestTeamScore = {
          runs,
          wickets,
          overs: inn.total_overs ?? 0,
          teamName: team?.name ?? undefined,
        };
      }
    }
  }
  return {
    totalMatches: matches.length,
    completedMatches: matches.filter((m) => m.status === "completed").length,
    totalRuns,
    totalWickets,
    highestTeamScore,
  };
}

/** Latest first (no date first), then by id: the club's match list order. */
function listOrder(a: MilestoneMatch, b: MilestoneMatch): number {
  const x = a.scheduled_at ?? null;
  const y = b.scheduled_at ?? null;
  if (x !== y) {
    if (x === null) return -1;
    if (y === null) return 1;
    return x < y ? 1 : -1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The milestones from the aggregates, with each live match (its innings
 * fresh, as the leaderboard patched them) counted from its innings instead
 * of its stored totals. Same figures as adding up every match's innings.
 */
export function clubMilestonesOf(
  agg: ClubMilestoneAggregates,
  live: readonly MilestoneMatch[],
): ClubMilestoneFigures {
  let runs = agg.runs;
  let wickets = agg.wickets;
  const liveIds = new Set(live.map((m) => m.id));
  const candidates: Array<{
    match: MilestoneMatch;
    best: NonNullable<MilestoneMatch["best_innings"]>;
  }> = [];
  for (const m of live) {
    const fresh = summaryTotalsOf(
      (m.innings ?? []) as Record<string, unknown>[],
    );
    runs += fresh.summary_runs - (m.summary_runs ?? 0);
    wickets += fresh.summary_wickets - (m.summary_wickets ?? 0);
    if (fresh.best_innings)
      candidates.push({ match: m, best: fresh.best_innings });
  }
  for (const doc of agg.top as unknown as MilestoneMatch[]) {
    if (liveIds.has(doc.id) || !doc.best_innings) continue;
    candidates.push({ match: doc, best: doc.best_innings });
  }
  candidates.sort(
    (a, b) => b.best.runs - a.best.runs || listOrder(a.match, b.match),
  );
  const top = candidates[0];
  let highestTeamScore: ClubMilestoneFigures["highestTeamScore"] = null;
  if (top) {
    const { match, best } = top;
    const team =
      best.team_id === match.team1?.id
        ? match.team1
        : best.team_id === match.team2?.id
          ? match.team2
          : null;
    highestTeamScore = {
      runs: best.runs,
      wickets: best.wickets,
      overs: best.overs,
      teamName: team?.name ?? undefined,
    };
  }
  return {
    totalMatches: agg.matches,
    completedMatches: agg.completed,
    totalRuns: runs,
    totalWickets: wickets,
    highestTeamScore,
  };
}
