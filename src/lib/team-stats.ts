/*
 * A team's figures from its matches at hand (the team page's latest ones):
 * how it does batting first and chasing, its highest and lowest totals and
 * its biggest wins. Pure; no reads of its own (the page has the matches and
 * their innings already).
 */

import { lastMainInningsOf } from "./multi-innings";

interface StatsInnings {
  team_id: string;
  innings_number: number;
  total_runs: number;
  total_wickets: number;
  total_overs?: number | null;
  is_completed?: boolean | null;
  declared?: boolean | null;
}

interface StatsMatch {
  id: string;
  status: string;
  /** 2: a Test, whose four innings are all totals. */
  innings_per_side?: number | null;
  winning_team_id?: string | null;
  win_margin?: number | null;
  win_margin_type?: string | null;
  scheduled_at?: string | null;
  team1?: { id: string; name: string } | null;
  team2?: { id: string; name: string } | null;
  innings?: StatsInnings[];
}

/** One total and where it came from. */
export interface TeamTotal {
  matchId: string;
  runs: number;
  wickets: number;
  overs: number | null;
  opponent: string;
}

export interface TeamStats {
  /** Finished matches the figures come from. */
  matches: number;
  battingFirst: { played: number; won: number };
  chasing: { played: number; won: number };
  highest: TeamTotal | null;
  /** The lowest total of an innings that ended (all out or its overs). */
  lowest: TeamTotal | null;
  /** Average runs an innings. */
  average: number | null;
  /** The biggest wins: by runs (batting first) and by wickets (chasing). */
  biggestByRuns: { matchId: string; margin: number; opponent: string } | null;
  biggestByWickets: { matchId: string; margin: number; opponent: string } | null;
}

export function teamStatsOf(
  matches: readonly StatsMatch[],
  teamId: string,
): TeamStats {
  const finished = matches.filter((m) => m.status === "completed");
  const stats: TeamStats = {
    matches: finished.length,
    battingFirst: { played: 0, won: 0 },
    chasing: { played: 0, won: 0 },
    highest: null,
    lowest: null,
    average: null,
    biggestByRuns: null,
    biggestByWickets: null,
  };
  let runs = 0;
  let innings = 0;
  for (const m of finished) {
    // A side can be missing (a team deleted since): never fail the page.
    const opponent =
      (m.team1?.id === teamId ? m.team2 : m.team1)?.name ?? "another team";
    // The main match only: a super over is not a total. A Test's side has
    // two innings, each a total.
    const last = lastMainInningsOf(m);
    const main = (m.innings ?? []).filter((i) => i.innings_number <= last);
    const owned = main
      .filter((i) => i.team_id === teamId)
      .sort((a, b) => a.innings_number - b.innings_number);
    const won = m.winning_team_id === teamId;
    if (owned[0]) {
      const side =
        owned[0].innings_number === 1 ? stats.battingFirst : stats.chasing;
      side.played += 1;
      if (won) side.won += 1;
    }
    for (const own of owned) {
      const total: TeamTotal = {
        matchId: m.id,
        runs: own.total_runs ?? 0,
        wickets: own.total_wickets ?? 0,
        overs: own.total_overs ?? null,
        opponent,
      };
      runs += total.runs;
      innings += 1;
      if (!stats.highest || total.runs > stats.highest.runs) stats.highest = total;
      // A chase that won was not over its overs, nor a declaration a low
      // total.
      const ended =
        own.is_completed !== false &&
        !(own.innings_number === last && won) &&
        !own.declared;
      if (ended && (!stats.lowest || total.runs < stats.lowest.runs)) {
        stats.lowest = total;
      }
    }
    const margin = m.win_margin ?? 0;
    if (won && margin > 0) {
      const entry = { matchId: m.id, margin, opponent };
      if (m.win_margin_type === "runs") {
        if (!stats.biggestByRuns || margin > stats.biggestByRuns.margin) {
          stats.biggestByRuns = entry;
        }
      } else if (m.win_margin_type === "wickets") {
        if (!stats.biggestByWickets || margin > stats.biggestByWickets.margin) {
          stats.biggestByWickets = entry;
        }
      }
    }
  }
  stats.average = innings > 0 ? Math.round(runs / innings) : null;
  return stats;
}
