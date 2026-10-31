/**
 * Detailed cricket leaderboard computation engine for tournaments and clubs.
 * Computes batting, bowling, fielding, and MVP statistics with sorting and filtering.
 *
 * Figures come from per-player accumulators (`lib/firebase/stats.mjs`):
 * the stored `leaderboards/*` documents, or raw rows folded the same way.
 */

import { fieldingCreditOf } from "~/lib/cricket";
import {
  applyBatting,
  applyBowling,
  batLine,
  bowlLine,
  emptyAcc,
  fieldingPoints,
  legalDeliveries,
  type StatsAcc,
} from "~/lib/firebase/stats.mjs";

export interface RawBattingRecord {
  match_id: string;
  innings_id?: string | null;
  user_id: string;
  runs_scored?: number | null;
  balls_faced?: number | null;
  fours?: number | null;
  sixes?: number | null;
  is_out?: boolean | null;
  dismissal_type?: string | null;
  bowler_id?: string | null;
  fielder_id?: string | null;
  user?:
    | { id?: string; full_name?: string | null; avatar_url?: string | null }
    | { id?: string; full_name?: string | null; avatar_url?: string | null }[]
    | null;
  fielder?:
    | { id?: string; full_name?: string | null; avatar_url?: string | null }
    | { id?: string; full_name?: string | null; avatar_url?: string | null }[]
    | null;
}

export interface RawBowlingRecord {
  match_id: string;
  innings_id?: string | null;
  user_id: string;
  overs_bowled?: number | null;
  balls_bowled?: number | null;
  runs_conceded?: number | null;
  wickets_taken?: number | null;
  maidens?: number | null;
  wides?: number | null;
  no_balls?: number | null;
  user?:
    | { id?: string; full_name?: string | null; avatar_url?: string | null }
    | { id?: string; full_name?: string | null; avatar_url?: string | null }[]
    | null;
}

export interface RawFallOfWicketRecord {
  match_id: string;
  innings_id?: string | null;
  batsman_id?: string | null;
  batsman_out_id?: string | null;
  bowler_id?: string | null;
  fielder_id?: string | null;
  dismissal_type?: string | null;
  fielder?:
    | { id?: string; full_name?: string | null; avatar_url?: string | null }
    | { id?: string; full_name?: string | null; avatar_url?: string | null }[]
    | null;
}

export interface BestBowlingFigures {
  wickets: number;
  runs: number;
  display: string;
  overs?: string;
  economy?: string;
}

export interface BattingLeaderboardEntry {
  userId: string;
  name: string;
  avatar: string | null;
  matches: number;
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  highestScore: number;
  isHighestNotOut: boolean;
  highestScoreDisplay: string;
  highestScoreBalls?: number;
  highestScoreFours?: number;
  highestScoreSixes?: number;
  highestScoreStrikeRateDisplay?: string;
  average: number | null;
  averageDisplay: string;
  strikeRate: number;
  strikeRateDisplay: string;
  centuries: number;
  fifties: number;
  boundaryPercent: string;
}

export interface BowlingLeaderboardEntry {
  userId: string;
  name: string;
  avatar: string | null;
  matches: number;
  innings: number;
  overs: string;
  balls: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  bestBowling: BestBowlingFigures;
  average: number | null;
  averageDisplay: string;
  economy: number;
  economyDisplay: string;
  strikeRate: number | null;
  strikeRateDisplay: string;
  threeWickets: number;
  fiveWickets: number;
}

export interface FieldingLeaderboardEntry {
  userId: string;
  name: string;
  avatar: string | null;
  matches: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  totalDismissals: number;
}

export interface MvpLeaderboardEntry {
  userId: string;
  name: string;
  avatar: string | null;
  matches: number;
  totalPoints: number;
  battingPoints: number;
  bowlingPoints: number;
  fieldingPoints: number;
  runs: number;
  wickets: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  summary: string;
}

export interface LeaderboardHighlights {
  orangeCap: BattingLeaderboardEntry | null;
  purpleCap: BowlingLeaderboardEntry | null;
  mvpLeader: MvpLeaderboardEntry | null;
  mostSixes: BattingLeaderboardEntry | null;
  mostFours: BattingLeaderboardEntry | null;
  highestScore: BattingLeaderboardEntry | null;
  bestBowling: BowlingLeaderboardEntry | null;
  bestEconomy: BowlingLeaderboardEntry | null;
  topFielder: FieldingLeaderboardEntry | null;
}

export interface LeaderboardData {
  batting: BattingLeaderboardEntry[];
  bowling: BowlingLeaderboardEntry[];
  fielding: FieldingLeaderboardEntry[];
  mvp: MvpLeaderboardEntry[];
  highlights: LeaderboardHighlights;
}

export type BattingSortOption =
  | "runs"
  | "centuries"
  | "fifties"
  | "highestScore"
  | "average"
  | "strikeRate"
  | "sixes"
  | "fours"
  | "balls";

export type BowlingSortOption =
  | "wickets"
  | "bestBowling"
  | "average"
  | "economy"
  | "maidens"
  | "balls"
  | "threeWickets"
  | "fiveWickets";

export type FieldingSortOption =
  | "totalDismissals"
  | "catches"
  | "stumpings"
  | "runOuts";

export type MvpSortOption =
  | "totalPoints"
  | "battingPoints"
  | "bowlingPoints"
  | "fieldingPoints";

function resolveUserInfo(
  user: unknown,
  fallbackName = "Player",
): { name: string; avatar: string | null } {
  if (!user) return { name: fallbackName, avatar: null };
  const u = Array.isArray(user)
    ? (user[0] as { full_name?: string | null; avatar_url?: string | null } | undefined)
    : (user as { full_name?: string | null; avatar_url?: string | null } | undefined);
  return {
    name: u?.full_name?.trim() || fallbackName,
    avatar: u?.avatar_url ?? null,
  };
}

/**
 * Converts overs notation (e.g. 3.4) or raw balls to total legal deliveries.
 */
export function getLegalDeliveries(balls?: number | null, overs?: number | null): number {
  return legalDeliveries(balls, overs);
}

/**
 * Formats total legal balls into standard cricket overs notation (e.g. 23 balls -> "3.5").
 */
export function formatOvers(balls: number): string {
  const completeOvers = Math.floor(balls / 6);
  const remainder = balls % 6;
  return `${completeOvers}.${remainder}`;
}

/** A player's figures in some scope plus who they are (see stats.mjs). */
export type LeaderboardPlayer = StatsAcc & {
  name: string | null;
  avatar_url: string | null;
};

/**
 * Leaderboard rows from per-player accumulators: stored ones
 * (`leaderboards/{scope}_{id}`, see stats.mjs) or ones folded from raw
 * records by {@link buildLeaderboardData}. Every figure is defined here.
 */
export function leaderboardFromPlayers(
  players: Record<string, LeaderboardPlayer>,
): LeaderboardData {
  const battingList: BattingLeaderboardEntry[] = [];
  const bowlingList: BowlingLeaderboardEntry[] = [];
  const fieldingList: FieldingLeaderboardEntry[] = [];
  const mvpList: MvpLeaderboardEntry[] = [];

  for (const [userId, p] of Object.entries(players)) {
    const name = p.name?.trim() || "Player";
    const avatar = p.avatar_url ?? null;
    const matches = Math.max(1, p.m);

    if (p.bi > 0) {
      const dismissals = p.bi - p.no;
      const avg = dismissals > 0 ? p.r / dismissals : null;
      const sr = p.b > 0 ? (p.r / p.b) * 100 : 0;
      const boundaryRuns = p.f4 * 4 + p.f6 * 6;
      const hs = p.hs ?? { r: 0, no: false, b: 0, f4: 0, f6: 0, n: 0 };
      battingList.push({
        userId,
        name,
        avatar,
        matches,
        innings: p.bi,
        notOuts: p.no,
        runs: p.r,
        balls: p.b,
        fours: p.f4,
        sixes: p.f6,
        highestScore: hs.r,
        isHighestNotOut: hs.no,
        highestScoreDisplay: `${hs.r}${hs.no ? "*" : ""}`,
        highestScoreBalls: hs.b,
        highestScoreFours: hs.f4,
        highestScoreSixes: hs.f6,
        highestScoreStrikeRateDisplay:
          hs.b > 0 ? ((hs.r / hs.b) * 100).toFixed(2) : "—",
        average: avg,
        averageDisplay:
          avg !== null ? avg.toFixed(2) : p.r > 0 ? `${p.r}*` : "—",
        strikeRate: sr,
        strikeRateDisplay: sr.toFixed(2),
        centuries: p.c100,
        fifties: p.c50,
        boundaryPercent:
          p.r > 0 ? ((boundaryRuns / p.r) * 100).toFixed(1) + "%" : "0.0%",
      });
    }

    if (p.wi > 0) {
      const avg = p.w > 0 ? p.rc / p.w : null;
      const oversDec = p.wb / 6;
      const econ = oversDec > 0 ? p.rc / oversDec : 0;
      const sr = p.w > 0 ? p.wb / p.w : null;
      const bb = p.bb ?? { w: 0, r: p.rc, b: p.wb, n: 0 };
      bowlingList.push({
        userId,
        name,
        avatar,
        matches,
        innings: p.wi,
        overs: formatOvers(p.wb),
        balls: p.wb,
        maidens: p.md,
        runsConceded: p.rc,
        wickets: p.w,
        bestBowling: {
          wickets: bb.w,
          runs: bb.r,
          display: `${bb.w}/${bb.r}`,
          overs: formatOvers(bb.b),
          economy: bb.b > 0 ? (bb.r / (bb.b / 6)).toFixed(2) : "0.00",
        },
        average: avg,
        averageDisplay: avg !== null ? avg.toFixed(2) : "—",
        economy: econ,
        economyDisplay: econ.toFixed(2),
        strikeRate: sr,
        strikeRateDisplay: sr !== null ? sr.toFixed(1) : "—",
        threeWickets: p.w3,
        fiveWickets: p.w5,
      });
    }

    const dismissals = p.ct + p.st + p.ro;
    if (dismissals > 0) {
      fieldingList.push({
        userId,
        name,
        avatar,
        matches,
        catches: p.ct,
        stumpings: p.st,
        runOuts: p.ro,
        totalDismissals: dismissals,
      });
    }

    if (p.bi > 0 || p.wi > 0 || dismissals > 0) {
      const fieldPts = fieldingPoints(p);
      const summaryParts: string[] = [];
      if (p.r > 0) summaryParts.push(`${p.r} runs`);
      if (p.w > 0) summaryParts.push(`${p.w} wkts`);
      if (dismissals > 0) summaryParts.push(`${dismissals} dism`);
      mvpList.push({
        userId,
        name,
        avatar,
        matches,
        totalPoints: p.bp + p.wp + fieldPts,
        battingPoints: p.bp,
        bowlingPoints: p.wp,
        fieldingPoints: fieldPts,
        runs: p.r,
        wickets: p.w,
        catches: p.ct,
        stumpings: p.st,
        runOuts: p.ro,
        summary:
          summaryParts.length > 0 ? summaryParts.join(" • ") : "No impact stats",
      });
    }
  }

  // Default sorts (ties by player id, so the order never depends on input).
  const byId = (a: { userId: string }, b: { userId: string }) =>
    a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  battingList.sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate || byId(a, b));
  bowlingList.sort((a, b) => b.wickets - a.wickets || a.economy - b.economy || byId(a, b));
  fieldingList.sort((a, b) => b.totalDismissals - a.totalDismissals || byId(a, b));
  mvpList.sort((a, b) => b.totalPoints - a.totalPoints || b.runs - a.runs || byId(a, b));

  // Compute Highlights
  const firstBatter = battingList[0];
  const orangeCap = firstBatter && firstBatter.runs > 0 ? firstBatter : null;

  const firstBowler = bowlingList[0];
  const purpleCap = firstBowler && firstBowler.wickets > 0 ? firstBowler : null;

  const firstMvp = mvpList[0];
  const mvpLeader = firstMvp && firstMvp.totalPoints > 0 ? firstMvp : null;

  const sortedSixes = [...battingList].sort((a, b) => b.sixes - a.sixes || b.runs - a.runs);
  const sixesLeader = sortedSixes[0];
  const mostSixes = sixesLeader && sixesLeader.sixes > 0 ? sixesLeader : null;

  const sortedFours = [...battingList].sort((a, b) => b.fours - a.fours || b.runs - a.runs);
  const foursLeader = sortedFours[0];
  const mostFours = foursLeader && foursLeader.fours > 0 ? foursLeader : null;

  const sortedHighest = [...battingList].sort(
    (a, b) =>
      b.highestScore - a.highestScore ||
      (b.isHighestNotOut ? 1 : 0) - (a.isHighestNotOut ? 1 : 0),
  );
  const hsLeader = sortedHighest[0];
  const highestScore = hsLeader && hsLeader.highestScore > 0 ? hsLeader : null;

  const sortedBowling = [...bowlingList].sort((a, b) => {
    if (b.bestBowling.wickets !== a.bestBowling.wickets) {
      return b.bestBowling.wickets - a.bestBowling.wickets;
    }
    return a.bestBowling.runs - b.bestBowling.runs;
  });
  const bbiLeader = sortedBowling[0];
  const bestBowling = bbiLeader && bbiLeader.bestBowling.wickets > 0 ? bbiLeader : null;

  // Best economy for bowlers with at least 12 balls (2 overs)
  const eligibleEconBowlers = bowlingList.filter((b) => b.balls >= 12);
  const sortedEcon =
    eligibleEconBowlers.length > 0
      ? [...eligibleEconBowlers].sort((a, b) => a.economy - b.economy)
      : [...bowlingList].sort((a, b) => a.economy - b.economy);
  const bestEconomy = sortedEcon[0] ?? null;

  const firstFielder = fieldingList[0];
  const topFielder =
    firstFielder && firstFielder.totalDismissals > 0 ? firstFielder : null;

  return {
    batting: battingList,
    bowling: bowlingList,
    fielding: fieldingList,
    mvp: mvpList,
    highlights: {
      orangeCap,
      purpleCap,
      mvpLeader,
      mostSixes,
      mostFours,
      highestScore,
      bestBowling,
      bestEconomy,
      topFielder,
    },
  };
}

/**
 * Leaderboard from raw scorecard rows (batting / bowling performances and
 * fall of wickets), e.g. a match's own superstars. Folds them into the same
 * accumulators the stored leaderboards hold.
 */
export function buildLeaderboardData(params: {
  batting?: RawBattingRecord[] | null;
  bowling?: RawBowlingRecord[] | null;
  fallOfWickets?: RawFallOfWicketRecord[] | null;
}): LeaderboardData {
  const players = new Map<string, LeaderboardPlayer>();
  const matchIds = new Map<string, Set<string>>();
  const playerOf = (
    userId: string,
    matchId: string,
    user: { name: string; avatar: string | null },
    fallback: string,
  ) => {
    let p = players.get(userId);
    if (!p) {
      p = { ...emptyAcc(), name: null, avatar_url: null };
      players.set(userId, p);
    }
    if (!p.name && user.name !== fallback) {
      p.name = user.name;
      p.avatar_url = user.avatar;
    } else if (!p.name && !p.avatar_url) {
      p.avatar_url = user.avatar;
    }
    const set = matchIds.get(userId) ?? new Set<string>();
    set.add(matchId);
    matchIds.set(userId, set);
    return p;
  };

  for (const b of params.batting ?? []) {
    if (!b.user_id) continue;
    const p = playerOf(b.user_id, b.match_id, resolveUserInfo(b.user, "Batter"), "Batter");
    applyBatting(p, batLine(b), 1);
  }
  for (const b of params.bowling ?? []) {
    if (!b.user_id) continue;
    const p = playerOf(b.user_id, b.match_id, resolveUserInfo(b.user, "Bowler"), "Bowler");
    applyBowling(p, bowlLine(b), 1);
  }

  const field = (
    fielderId: string,
    dismissalType: string | null | undefined,
    matchId: string,
    user: unknown,
  ) => {
    const p = playerOf(fielderId, matchId, resolveUserInfo(user, "Fielder"), "Fielder");
    const credit = fieldingCreditOf(dismissalType);
    if (credit === "stumpings") p.st += 1;
    else if (credit === "run_outs") p.ro += 1;
    else if (credit === "catches") p.ct += 1;
  };
  const seen = new Set<string>();
  for (const fow of params.fallOfWickets ?? []) {
    if (!fow.fielder_id) continue;
    const batsmanId = fow.batsman_out_id ?? fow.batsman_id ?? "";
    seen.add(`${fow.match_id}_${batsmanId}_${fow.fielder_id}`);
    field(fow.fielder_id, fow.dismissal_type, fow.match_id, fow.fielder);
  }
  // Batting rows name a fielder the fall of wickets may not have.
  for (const b of params.batting ?? []) {
    if (!b.fielder_id || !b.is_out) continue;
    if (seen.has(`${b.match_id}_${b.user_id}_${b.fielder_id}`)) continue;
    field(b.fielder_id, b.dismissal_type, b.match_id, b.fielder);
  }

  const out: Record<string, LeaderboardPlayer> = {};
  for (const [userId, p] of players) {
    p.m = matchIds.get(userId)?.size ?? 1;
    out[userId] = p;
  }
  return leaderboardFromPlayers(out);
}

/**
 * Sorts batting leaderboard entries according to user selection.
 */
export function sortBattingEntries(
  entries: BattingLeaderboardEntry[],
  sortBy: BattingSortOption,
): BattingLeaderboardEntry[] {
  const copy = [...entries];
  switch (sortBy) {
    case "runs":
      return copy.sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate);
    case "centuries":
      return copy.sort((a, b) => b.centuries - a.centuries || b.runs - a.runs);
    case "fifties":
      return copy.sort((a, b) => b.fifties - a.fifties || b.runs - a.runs);
    case "highestScore":
      return copy.sort(
        (a, b) =>
          b.highestScore - a.highestScore ||
          (b.isHighestNotOut ? 1 : 0) - (a.isHighestNotOut ? 1 : 0) ||
          b.runs - a.runs,
      );
    case "average":
      return copy.sort((a, b) => {
        const avgA = a.average ?? (a.runs > 0 ? 9999 : -1);
        const avgB = b.average ?? (b.runs > 0 ? 9999 : -1);
        return avgB - avgA || b.runs - a.runs;
      });
    case "strikeRate":
      return copy.sort((a, b) => b.strikeRate - a.strikeRate || b.runs - a.runs);
    case "sixes":
      return copy.sort((a, b) => b.sixes - a.sixes || b.runs - a.runs);
    case "fours":
      return copy.sort((a, b) => b.fours - a.fours || b.runs - a.runs);
    case "balls":
      return copy.sort((a, b) => b.balls - a.balls || b.runs - a.runs);
    default:
      return copy;
  }
}

/**
 * Sorts bowling leaderboard entries according to user selection.
 */
export function sortBowlingEntries(
  entries: BowlingLeaderboardEntry[],
  sortBy: BowlingSortOption,
): BowlingLeaderboardEntry[] {
  const copy = [...entries];
  switch (sortBy) {
    case "wickets":
      return copy.sort((a, b) => b.wickets - a.wickets || a.economy - b.economy);
    case "bestBowling":
      return copy.sort((a, b) => {
        if (b.bestBowling.wickets !== a.bestBowling.wickets) {
          return b.bestBowling.wickets - a.bestBowling.wickets;
        }
        return a.bestBowling.runs - b.bestBowling.runs;
      });
    case "average":
      return copy.sort((a, b) => {
        const avgA = a.average ?? 9999;
        const avgB = b.average ?? 9999;
        return avgA - avgB || b.wickets - a.wickets;
      });
    case "economy":
      return copy.sort((a, b) => a.economy - b.economy || b.wickets - a.wickets);
    case "maidens":
      return copy.sort((a, b) => b.maidens - a.maidens || b.wickets - a.wickets);
    case "balls":
      return copy.sort((a, b) => b.balls - a.balls || b.wickets - a.wickets);
    case "threeWickets":
      return copy.sort((a, b) => b.threeWickets - a.threeWickets || b.wickets - a.wickets);
    case "fiveWickets":
      return copy.sort((a, b) => b.fiveWickets - a.fiveWickets || b.wickets - a.wickets);
    default:
      return copy;
  }
}

/**
 * Sorts fielding leaderboard entries according to user selection.
 */
export function sortFieldingEntries(
  entries: FieldingLeaderboardEntry[],
  sortBy: FieldingSortOption,
): FieldingLeaderboardEntry[] {
  const copy = [...entries];
  switch (sortBy) {
    case "totalDismissals":
      return copy.sort((a, b) => b.totalDismissals - a.totalDismissals || b.catches - a.catches);
    case "catches":
      return copy.sort((a, b) => b.catches - a.catches || b.totalDismissals - a.totalDismissals);
    case "stumpings":
      return copy.sort((a, b) => b.stumpings - a.stumpings || b.totalDismissals - a.totalDismissals);
    case "runOuts":
      return copy.sort((a, b) => b.runOuts - a.runOuts || b.totalDismissals - a.totalDismissals);
    default:
      return copy;
  }
}

/**
 * Sorts MVP leaderboard entries according to user selection.
 */
export function sortMvpEntries(
  entries: MvpLeaderboardEntry[],
  sortBy: MvpSortOption,
): MvpLeaderboardEntry[] {
  const copy = [...entries];
  switch (sortBy) {
    case "totalPoints":
      return copy.sort((a, b) => b.totalPoints - a.totalPoints || b.runs - a.runs);
    case "battingPoints":
      return copy.sort((a, b) => b.battingPoints - a.battingPoints || b.totalPoints - a.totalPoints);
    case "bowlingPoints":
      return copy.sort((a, b) => b.bowlingPoints - a.bowlingPoints || b.totalPoints - a.totalPoints);
    case "fieldingPoints":
      return copy.sort((a, b) => b.fieldingPoints - a.fieldingPoints || b.totalPoints - a.totalPoints);
    default:
      return copy;
  }
}
