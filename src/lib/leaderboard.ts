/**
 * Detailed cricket leaderboard computation engine for tournaments and clubs.
 * Computes batting, bowling, fielding, and MVP statistics with sorting and filtering.
 */

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
  if (balls !== undefined && balls !== null && balls > 0) {
    return balls;
  }
  if (overs !== undefined && overs !== null && overs > 0) {
    const fullOvers = Math.floor(overs);
    const remainderBalls = Math.round((overs - fullOvers) * 10);
    return fullOvers * 6 + remainderBalls;
  }
  return 0;
}

/**
 * Formats total legal balls into standard cricket overs notation (e.g. 23 balls -> "3.5").
 */
export function formatOvers(balls: number): string {
  const completeOvers = Math.floor(balls / 6);
  const remainder = balls % 6;
  return `${completeOvers}.${remainder}`;
}

export function buildLeaderboardData(params: {
  batting?: RawBattingRecord[] | null;
  bowling?: RawBowlingRecord[] | null;
  fallOfWickets?: RawFallOfWicketRecord[] | null;
}): LeaderboardData {
  const battingRecords = params.batting ?? [];
  const bowlingRecords = params.bowling ?? [];
  const fowRecords = params.fallOfWickets ?? [];

  // Track matches participated in across all roles
  const playerMatchesMap = new Map<string, Set<string>>();
  const playerNamesMap = new Map<string, { name: string; avatar: string | null }>();

  const registerPlayerMatch = (
    userId: string,
    matchId: string,
    userInfo: { name: string; avatar: string | null },
  ) => {
    if (!playerMatchesMap.has(userId)) {
      playerMatchesMap.set(userId, new Set());
    }
    playerMatchesMap.get(userId)!.add(matchId);

    if (!playerNamesMap.has(userId) || playerNamesMap.get(userId)!.name === "Player") {
      playerNamesMap.set(userId, userInfo);
    }
  };

  // 1. Compute Batting Statistics
  const batterMap = new Map<
    string,
    {
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      innings: number;
      notOuts: number;
      highestScore: number;
      isHighestNotOut: boolean;
      centuries: number;
      fifties: number;
      battingPoints: number;
    }
  >();

  for (const b of battingRecords) {
    if (!b.user_id) continue;
    const user = resolveUserInfo(b.user, "Batter");
    registerPlayerMatch(b.user_id, b.match_id, user);

    const stats = batterMap.get(b.user_id) ?? {
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      innings: 0,
      notOuts: 0,
      highestScore: 0,
      isHighestNotOut: false,
      centuries: 0,
      fifties: 0,
      battingPoints: 0,
    };

    const runs = b.runs_scored ?? 0;
    const balls = b.balls_faced ?? 0;
    const fours = b.fours ?? 0;
    const sixes = b.sixes ?? 0;
    const isOut = b.is_out ?? false;

    stats.runs += runs;
    stats.balls += balls;
    stats.fours += fours;
    stats.sixes += sixes;
    stats.innings += 1;

    if (!isOut) {
      stats.notOuts += 1;
    }

    if (runs > stats.highestScore) {
      stats.highestScore = runs;
      stats.isHighestNotOut = !isOut;
    } else if (runs === stats.highestScore && !isOut) {
      stats.isHighestNotOut = true;
    }

    if (runs >= 100) {
      stats.centuries += 1;
    } else if (runs >= 50) {
      stats.fifties += 1;
    }

    // Batting MVP Points Calculation
    let batPts = runs;
    batPts += fours * 1;
    batPts += sixes * 2;
    if (runs >= 100) batPts += 30;
    else if (runs >= 50) batPts += 15;
    else if (runs >= 30) batPts += 5;

    if (balls >= 10) {
      const sr = (runs / balls) * 100;
      if (sr >= 200) batPts += 12;
      else if (sr >= 150) batPts += 6;
      else if (sr < 80) batPts -= 4;
    }

    if (!isOut && runs >= 20) {
      batPts += 5;
    }

    stats.battingPoints += batPts;
    batterMap.set(b.user_id, stats);
  }

  const battingList: BattingLeaderboardEntry[] = Array.from(batterMap.entries()).map(
    ([userId, s]) => {
      const userInfo = playerNamesMap.get(userId) ?? { name: "Player", avatar: null };
      const dismissals = s.innings - s.notOuts;
      const avg = dismissals > 0 ? s.runs / dismissals : null;
      const sr = s.balls > 0 ? (s.runs / s.balls) * 100 : 0;
      const boundaryRuns = s.fours * 4 + s.sixes * 6;
      const boundaryPct =
        s.runs > 0 ? ((boundaryRuns / s.runs) * 100).toFixed(1) + "%" : "0.0%";

      return {
        userId,
        name: userInfo.name,
        avatar: userInfo.avatar,
        matches: playerMatchesMap.get(userId)?.size ?? 1,
        innings: s.innings,
        notOuts: s.notOuts,
        runs: s.runs,
        balls: s.balls,
        fours: s.fours,
        sixes: s.sixes,
        highestScore: s.highestScore,
        isHighestNotOut: s.isHighestNotOut,
        highestScoreDisplay: `${s.highestScore}${s.isHighestNotOut ? "*" : ""}`,
        average: avg,
        averageDisplay:
          avg !== null ? avg.toFixed(2) : s.runs > 0 ? `${s.runs}*` : "—",
        strikeRate: sr,
        strikeRateDisplay: sr.toFixed(2),
        centuries: s.centuries,
        fifties: s.fifties,
        boundaryPercent: boundaryPct,
      };
    },
  );

  // 2. Compute Bowling Statistics
  const bowlerMap = new Map<
    string,
    {
      balls: number;
      maidens: number;
      runsConceded: number;
      wickets: number;
      innings: number;
      bestBowling: BestBowlingFigures;
      threeWickets: number;
      fiveWickets: number;
      bowlingPoints: number;
    }
  >();

  for (const b of bowlingRecords) {
    if (!b.user_id) continue;
    const user = resolveUserInfo(b.user, "Bowler");
    registerPlayerMatch(b.user_id, b.match_id, user);

    const stats = bowlerMap.get(b.user_id) ?? {
      balls: 0,
      maidens: 0,
      runsConceded: 0,
      wickets: 0,
      innings: 0,
      bestBowling: { wickets: 0, runs: 9999, display: "0/0" },
      threeWickets: 0,
      fiveWickets: 0,
      bowlingPoints: 0,
    };

    const deliveries = getLegalDeliveries(b.balls_bowled, b.overs_bowled);
    const runs = b.runs_conceded ?? 0;
    const wkts = b.wickets_taken ?? 0;
    const maidens = b.maidens ?? 0;

    stats.balls += deliveries;
    stats.runsConceded += runs;
    stats.wickets += wkts;
    stats.maidens += maidens;
    stats.innings += 1;

    // Track best bowling in an innings
    const currentBest = stats.bestBowling;
    if (
      wkts > currentBest.wickets ||
      (wkts === currentBest.wickets && runs < currentBest.runs) ||
      currentBest.display === "0/0"
    ) {
      stats.bestBowling = {
        wickets: wkts,
        runs,
        display: `${wkts}/${runs}`,
      };
    }

    if (wkts >= 5) {
      stats.fiveWickets += 1;
    } else if (wkts >= 3) {
      stats.threeWickets += 1;
    }

    // Bowling MVP Points Calculation
    let bowlPts = wkts * 25;
    if (wkts >= 5) bowlPts += 30;
    else if (wkts >= 3) bowlPts += 15;

    bowlPts += maidens * 12;

    if (deliveries >= 12) {
      const econ = (runs / deliveries) * 6;
      if (econ < 5.0) bowlPts += 15;
      else if (econ < 6.5) bowlPts += 8;
      else if (econ > 10.0) bowlPts -= 6;
    }

    stats.bowlingPoints += bowlPts;
    bowlerMap.set(b.user_id, stats);
  }

  const bowlingList: BowlingLeaderboardEntry[] = Array.from(bowlerMap.entries()).map(
    ([userId, s]) => {
      const userInfo = playerNamesMap.get(userId) ?? { name: "Player", avatar: null };
      const avg = s.wickets > 0 ? s.runsConceded / s.wickets : null;
      const oversDec = s.balls / 6;
      const econ = oversDec > 0 ? s.runsConceded / oversDec : 0;
      const sr = s.wickets > 0 ? s.balls / s.wickets : null;

      return {
        userId,
        name: userInfo.name,
        avatar: userInfo.avatar,
        matches: playerMatchesMap.get(userId)?.size ?? 1,
        innings: s.innings,
        overs: formatOvers(s.balls),
        balls: s.balls,
        maidens: s.maidens,
        runsConceded: s.runsConceded,
        wickets: s.wickets,
        bestBowling: s.bestBowling.display === "0/0" && s.wickets === 0
          ? { wickets: 0, runs: s.runsConceded, display: `0/${s.runsConceded}` }
          : s.bestBowling,
        average: avg,
        averageDisplay: avg !== null ? avg.toFixed(2) : "—",
        economy: econ,
        economyDisplay: econ.toFixed(2),
        strikeRate: sr,
        strikeRateDisplay: sr !== null ? sr.toFixed(1) : "—",
        threeWickets: s.threeWickets,
        fiveWickets: s.fiveWickets,
      };
    },
  );

  // 3. Compute Fielding Statistics
  const fielderMap = new Map<
    string,
    {
      catches: number;
      stumpings: number;
      runOuts: number;
      fieldingPoints: number;
    }
  >();

  // Helper to record a fielding dismissal
  const recordFieldingEvent = (
    fielderId: string,
    dismissalType: string | null | undefined,
    matchId: string,
    userInfo?: { name: string; avatar: string | null },
  ) => {
    if (!fielderId) return;
    if (userInfo) {
      registerPlayerMatch(fielderId, matchId, userInfo);
    }
    const stats = fielderMap.get(fielderId) ?? {
      catches: 0,
      stumpings: 0,
      runOuts: 0,
      fieldingPoints: 0,
    };

    const type = (dismissalType ?? "").toLowerCase();
    if (type.includes("stump")) {
      stats.stumpings += 1;
      stats.fieldingPoints += 15;
    } else if (type.includes("run")) {
      stats.runOuts += 1;
      stats.fieldingPoints += 15;
    } else {
      stats.catches += 1;
      stats.fieldingPoints += 10;
    }
    fielderMap.set(fielderId, stats);
  };

  // Process fall_of_wickets first
  const processedFowKeys = new Set<string>();
  for (const fow of fowRecords) {
    if (fow.fielder_id) {
      const user = resolveUserInfo(fow.fielder, "Fielder");
      const batsmanId = fow.batsman_out_id ?? fow.batsman_id ?? "";
      const key = `${fow.match_id}_${batsmanId}_${fow.fielder_id}`;
      processedFowKeys.add(key);
      recordFieldingEvent(fow.fielder_id, fow.dismissal_type, fow.match_id, user);
    }
  }

  // Fallback to batting_performances fielder_id for any not captured in fow
  for (const b of battingRecords) {
    if (b.fielder_id && b.is_out) {
      const key = `${b.match_id}_${b.user_id}_${b.fielder_id}`;
      if (!processedFowKeys.has(key)) {
        const user = resolveUserInfo(b.fielder, "Fielder");
        recordFieldingEvent(b.fielder_id, b.dismissal_type, b.match_id, user);
      }
    }
  }

  const fieldingList: FieldingLeaderboardEntry[] = Array.from(fielderMap.entries()).map(
    ([userId, s]) => {
      const userInfo = playerNamesMap.get(userId) ?? { name: "Player", avatar: null };
      return {
        userId,
        name: userInfo.name,
        avatar: userInfo.avatar,
        matches: playerMatchesMap.get(userId)?.size ?? 1,
        catches: s.catches,
        stumpings: s.stumpings,
        runOuts: s.runOuts,
        totalDismissals: s.catches + s.stumpings + s.runOuts,
      };
    },
  );

  // 4. Compute MVP Leaderboard
  const allUserIds = new Set<string>([
    ...Array.from(batterMap.keys()),
    ...Array.from(bowlerMap.keys()),
    ...Array.from(fielderMap.keys()),
  ]);

  const mvpList: MvpLeaderboardEntry[] = Array.from(allUserIds).map((userId) => {
    const userInfo = playerNamesMap.get(userId) ?? { name: "Player", avatar: null };
    const bat = batterMap.get(userId);
    const bowl = bowlerMap.get(userId);
    const field = fielderMap.get(userId);

    const batPts = bat?.battingPoints ?? 0;
    const bowlPts = bowl?.bowlingPoints ?? 0;
    const fieldPts = field?.fieldingPoints ?? 0;
    const totalPts = batPts + bowlPts + fieldPts;

    const runs = bat?.runs ?? 0;
    const wkts = bowl?.wickets ?? 0;
    const catches = field?.catches ?? 0;
    const stumpings = field?.stumpings ?? 0;
    const runOuts = field?.runOuts ?? 0;

    const summaryParts: string[] = [];
    if (runs > 0) summaryParts.push(`${runs} runs`);
    if (wkts > 0) summaryParts.push(`${wkts} wkts`);
    const totalDism = catches + stumpings + runOuts;
    if (totalDism > 0) summaryParts.push(`${totalDism} dism`);
    const summary = summaryParts.length > 0 ? summaryParts.join(" • ") : "No impact stats";

    return {
      userId,
      name: userInfo.name,
      avatar: userInfo.avatar,
      matches: playerMatchesMap.get(userId)?.size ?? 1,
      totalPoints: totalPts,
      battingPoints: batPts,
      bowlingPoints: bowlPts,
      fieldingPoints: fieldPts,
      runs,
      wickets: wkts,
      catches,
      stumpings,
      runOuts,
      summary,
    };
  });

  // Default Sorts
  battingList.sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate);
  bowlingList.sort((a, b) => b.wickets - a.wickets || a.economy - b.economy);
  fieldingList.sort((a, b) => b.totalDismissals - a.totalDismissals);
  mvpList.sort((a, b) => b.totalPoints - a.totalPoints || b.runs - a.runs);

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
