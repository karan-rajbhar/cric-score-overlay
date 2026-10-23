/**
 * Tournament Fixture Scheduling Algorithm.
 * Generates round-robin fixtures using the polygon / circle rotation method.
 * Guarantees each pair of teams meets exactly once.
 */

export interface ScheduledFixture {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
}

export function generateRoundRobinFixtures(
  teamIds: string[],
): ScheduledFixture[] {
  if (teamIds.length < 2) return [];

  const teams = [...teamIds];
  const isOdd = teams.length % 2 !== 0;
  if (isOdd) {
    teams.push("__BYE__");
  }

  const n = teams.length;
  const totalRounds = n - 1;
  const matchesPerRound = n / 2;
  const fixtures: ScheduledFixture[] = [];

  // Circle method: Fix index 0, rotate indices 1 to n-1
  for (let round = 1; round <= totalRounds; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];

      // Ignore byes and undefined
      if (home && away && home !== "__BYE__" && away !== "__BYE__") {
        // Alternate home and away across rounds
        if (round % 2 === 1) {
          fixtures.push({ round, homeTeamId: home, awayTeamId: away });
        } else {
          fixtures.push({ round, homeTeamId: away, awayTeamId: home });
        }
      }
    }

    // Rotate array keeping teams[0] fixed
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  return fixtures;
}

// ---------------------------------------------------------------------------
// Groups and knockouts
//
// A knockout is single elimination, re-seeded each round: the best seed
// left plays the worst. When the number of teams is not a power of two the
// first round has byes: the top seeds go straight to the second round, the
// rest play down to a power of two. "Mixed" plays round-robin groups first,
// then the top teams of each group go into the knockout.
//
// No match is created with undecided teams: the organiser creates each next
// round once the previous one has results (`planNextRound`).
// ---------------------------------------------------------------------------

export const GROUP_NAMES = "ABCDEFGH".split("");
export const MAX_GROUPS = GROUP_NAMES.length;

export interface GroupFixture extends ScheduledFixture {
  group: string;
}

export interface KnockoutFixture {
  round: number;
  /** 1-based position in the round, best seed's match first. */
  slot: number;
  /** "Semi-final 1", "Final". */
  label: string;
  homeTeamId: string;
  awayTeamId: string;
}

/** Groups of teams in seed order, dealt in a snake (A B B A A B ...). */
export function splitIntoGroups(
  seeds: string[],
  groupCount: number,
): { name: string; teamIds: string[] }[] {
  const count = Math.max(1, Math.min(groupCount, MAX_GROUPS, seeds.length));
  const groups = Array.from({ length: count }, (_, i) => ({
    name: GROUP_NAMES[i]!,
    teamIds: [] as string[],
  }));
  seeds.forEach((team, i) => {
    const lap = Math.floor(i / count);
    const pos = i % count;
    groups[lap % 2 === 0 ? pos : count - 1 - pos]!.teamIds.push(team);
  });
  return groups;
}

/** Round-robin fixtures within each group; groups play their rounds together. */
export function generateGroupFixtures(
  groups: { name: string; teamIds: string[] }[],
): GroupFixture[] {
  return groups
    .flatMap((g) =>
      generateRoundRobinFixtures(g.teamIds).map((f) => ({ ...f, group: g.name })),
    )
    .sort((a, b) => a.round - b.round || a.group.localeCompare(b.group));
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/** "Final", "Semi-final", "Quarter-final", "Round of 16"; "First round" with byes. */
export function knockoutRoundLabel(teamsInRound: number): string {
  if (!isPowerOfTwo(teamsInRound)) return "First round";
  if (teamsInRound === 2) return "Final";
  if (teamsInRound === 4) return "Semi-final";
  if (teamsInRound === 8) return "Quarter-final";
  return `Round of ${teamsInRound}`;
}

/** Best against worst among `teams` (in seed order). */
function pairBestWorst(
  teams: string[],
  round: number,
  label: string,
): KnockoutFixture[] {
  const fixtures: KnockoutFixture[] = [];
  const count = teams.length / 2;
  for (let i = 0; i < count; i += 1) {
    fixtures.push({
      round,
      slot: i + 1,
      label: count > 1 ? `${label} ${i + 1}` : label,
      homeTeamId: teams[i]!,
      awayTeamId: teams[teams.length - 1 - i]!,
    });
  }
  return fixtures;
}

/**
 * The first knockout round for teams in seed order. With n teams and P the
 * largest power of two <= n, the top 2P - n seeds have byes and the other
 * 2(n - P) play, so P teams reach round 2.
 */
export function knockoutFirstRound(seeds: string[]): {
  fixtures: KnockoutFixture[];
  byes: string[];
} {
  const n = seeds.length;
  if (n < 2) return { fixtures: [], byes: [...seeds] };
  const p = 2 ** Math.floor(Math.log2(n));
  if (p === n) {
    return { fixtures: pairBestWorst(seeds, 1, knockoutRoundLabel(n)), byes: [] };
  }
  const byeCount = 2 * p - n;
  return {
    fixtures: pairBestWorst(seeds.slice(byeCount), 1, knockoutRoundLabel(n)),
    byes: seeds.slice(0, byeCount),
  };
}

/** A tournament match as the planner sees it. */
export interface BracketMatch {
  id: string;
  stage: "group" | "knockout";
  round: number | null;
  group: string | null;
  team1Id: string;
  team2Id: string;
  /** "scheduled", "live", "completed", "abandoned". */
  status: string;
  winnerId: string | null;
  /** "win", "tie", "no_result", "abandoned". */
  resultType: string | null;
  /** Innings totals by team, for group standings (net run rate). */
  totals?: { teamId: string; runs: number; balls: number; allOut: boolean }[];
  /** Balls in a full innings (overs x balls per over), for all-out teams. */
  quotaBalls?: number;
  ballsPerOver?: number;
}

export interface GroupStanding {
  teamId: string;
  group: string;
  played: number;
  wins: number;
  losses: number;
  ties: number;
  noResults: number;
  points: number;
  netRunRate: number;
}

type StandingRow = GroupStanding & {
  /** Runs for / overs faced, runs against / overs bowled (net run rate). */
  rf: number;
  of: number;
  ra: number;
  ob: number;
};

function emptyRow(teamId: string, group: string): StandingRow {
  return {
    teamId,
    group,
    played: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    noResults: 0,
    points: 0,
    netRunRate: 0,
    rf: 0,
    of: 0,
    ra: 0,
    ob: 0,
  };
}

/** Win, tie or no result; true when the runs count towards net run rate. */
function recordResult(a: StandingRow, b: StandingRow, m: BracketMatch): boolean {
  a.played += 1;
  b.played += 1;
  if (m.winnerId === a.teamId || m.winnerId === b.teamId) {
    const [w, l] = m.winnerId === a.teamId ? [a, b] : [b, a];
    w.wins += 1;
    l.losses += 1;
    return true;
  }
  if (m.resultType === "tie") {
    a.ties += 1;
    b.ties += 1;
    return true;
  }
  a.noResults += 1;
  b.noResults += 1;
  return false;
}

/** Each innings' runs and overs (an all-out side charged its full overs). */
function addRuns(a: StandingRow, b: StandingRow, m: BracketMatch): void {
  const bpo = m.ballsPerOver && m.ballsPerOver > 0 ? m.ballsPerOver : 6;
  for (const t of m.totals ?? []) {
    const overs = (t.allOut && m.quotaBalls ? m.quotaBalls : t.balls) / bpo;
    const [batting, bowling] =
      t.teamId === a.teamId ? [a, b] : t.teamId === b.teamId ? [b, a] : [];
    if (!batting || !bowling) continue;
    batting.rf += t.runs;
    batting.of += overs;
    bowling.ra += t.runs;
    bowling.ob += overs;
  }
}

function finish(row: StandingRow): GroupStanding {
  const { rf, of, ra, ob, ...rest } = row;
  return {
    ...rest,
    points: rest.wins * 2 + rest.ties + rest.noResults,
    netRunRate:
      of > 0 && ob > 0 ? Math.round((rf / of - ra / ob) * 1000) / 1000 : 0,
  };
}

/**
 * Standings of each group from its finished matches: 2 points a win, 1 a
 * tie or no result; then net run rate (an all-out side is charged its full
 * overs), then wins.
 */
export function groupStandings(
  groups: { name: string; teamIds: string[] }[],
  matches: BracketMatch[],
): Map<string, GroupStanding[]> {
  const out = new Map<string, GroupStanding[]>();
  for (const g of groups) {
    const rows = new Map(g.teamIds.map((t) => [t, emptyRow(t, g.name)]));
    for (const m of matches) {
      if (m.stage !== "group" || m.group !== g.name || !isFinished(m)) continue;
      const a = rows.get(m.team1Id);
      const b = rows.get(m.team2Id);
      if (a && b && recordResult(a, b, m)) addRuns(a, b, m);
    }
    const table = [...rows.values()].map(finish);
    table.sort(
      (x, y) =>
        y.points - x.points ||
        y.netRunRate - x.netRunRate ||
        y.wins - x.wins ||
        g.teamIds.indexOf(x.teamId) - g.teamIds.indexOf(y.teamId),
    );
    out.set(g.name, table);
  }
  return out;
}

/**
 * Knockout seeds from group standings: group winners in group order, then
 * runners-up, ... so best-against-worst keeps teams of a group apart
 * (A1 v B2, B1 v A2).
 */
export function qualifiersFromGroups(
  standings: Map<string, GroupStanding[]>,
  perGroup: number,
): string[] {
  const seeds: string[] = [];
  const names = [...standings.keys()].sort();
  for (let rank = 0; rank < perGroup; rank += 1) {
    for (const name of names) {
      const row = standings.get(name)?.[rank];
      if (row) seeds.push(row.teamId);
    }
  }
  return seeds;
}

/** Groups as the group-stage matches recorded them. */
export function groupsOfMatches(
  matches: BracketMatch[],
): { name: string; teamIds: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const m of matches) {
    if (m.stage !== "group" || !m.group) continue;
    const teams = groups.get(m.group) ?? [];
    for (const t of [m.team1Id, m.team2Id]) if (!teams.includes(t)) teams.push(t);
    groups.set(m.group, teams);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, teamIds]) => ({ name, teamIds }));
}

export type NextRound =
  | {
      kind: "groups";
      groups: { name: string; teamIds: string[] }[];
      fixtures: GroupFixture[];
    }
  | {
      kind: "knockout";
      round: number;
      label: string;
      fixtures: KnockoutFixture[];
      byes: string[];
    }
  /** The current round has matches still to finish. */
  | { kind: "waiting"; matchIds: string[] }
  /** Finished without a winner (tie, no result): decide them first. */
  | { kind: "undecided"; matchIds: string[] }
  | { kind: "complete"; championId: string }
  | { kind: "invalid"; reason: string };

export interface PlanInput {
  format: string | null | undefined;
  /** Confirmed teams, best seed first. */
  seeds: string[];
  matches: BracketMatch[];
  /** Mixed: groups to create (default 2). */
  groupCount?: number;
  /** Mixed: teams from each group into the knockout (default 2). */
  qualifiersPerGroup?: number;
}

const isFinished = (m: BracketMatch) =>
  m.status === "completed" || m.status === "abandoned";

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Whether these entrants produce exactly the first round already played. */
function matchesFirstRound(entrants: string[], knockout: BracketMatch[]): boolean {
  const played = new Set(
    knockout
      .filter((m) => (m.round ?? 1) === 1)
      .map((m) => pairKey(m.team1Id, m.team2Id)),
  );
  const planned = knockoutFirstRound(entrants).fixtures;
  return (
    planned.length === played.size &&
    planned.every((f) => played.has(pairKey(f.homeTeamId, f.awayTeamId)))
  );
}

const CHANGED =
  "The teams no longer match the first round; schedule the next match by hand";

function nextKnockoutRound(
  entrants: string[],
  knockout: BracketMatch[],
): NextRound {
  if (knockout.length === 0) {
    if (entrants.length < 2) {
      return { kind: "invalid", reason: "At least 2 teams are needed for a knockout" };
    }
    const first = knockoutFirstRound(entrants);
    return {
      kind: "knockout",
      round: 1,
      label: knockoutRoundLabel(entrants.length),
      fixtures: first.fixtures,
      byes: first.byes,
    };
  }
  const current = Math.max(...knockout.map((m) => m.round ?? 1));
  const inRound = knockout.filter((m) => (m.round ?? 1) === current);
  const unfinished = inRound.filter((m) => !isFinished(m));
  if (unfinished.length > 0) {
    return { kind: "waiting", matchIds: unfinished.map((m) => m.id) };
  }
  const undecided = inRound.filter(
    (m) => m.winnerId !== m.team1Id && m.winnerId !== m.team2Id,
  );
  if (undecided.length > 0) {
    return { kind: "undecided", matchIds: undecided.map((m) => m.id) };
  }
  const losers = new Set(
    knockout
      .filter((m) => m.winnerId === m.team1Id || m.winnerId === m.team2Id)
      .map((m) => (m.winnerId === m.team1Id ? m.team2Id : m.team1Id)),
  );
  const alive = entrants.filter((t) => !losers.has(t));
  if (alive.length === 1) return { kind: "complete", championId: alive[0]! };
  if (alive.length < 2 || !isPowerOfTwo(alive.length)) {
    return {
      kind: "invalid",
      reason: "The knockout results do not fit a bracket; schedule the next match by hand",
    };
  }
  const label = knockoutRoundLabel(alive.length);
  return {
    kind: "knockout",
    round: current + 1,
    label,
    fixtures: pairBestWorst(alive, current + 1, label),
    byes: [],
  };
}

/** What "Create next round" creates for a knockout or mixed tournament. */
export function planNextRound(input: PlanInput): NextRound {
  const groupMatches = input.matches.filter((m) => m.stage === "group");
  const knockout = input.matches.filter((m) => m.stage === "knockout");
  if (input.format === "knockout") {
    if (knockout.length > 0 && !matchesFirstRound(input.seeds, knockout)) {
      return { kind: "invalid", reason: CHANGED };
    }
    return nextKnockoutRound(input.seeds, knockout);
  }
  if (input.format !== "mixed") {
    return {
      kind: "invalid",
      reason: "Rounds are created for knockout and mixed tournaments only",
    };
  }
  if (groupMatches.length === 0) {
    const groupCount = input.groupCount ?? 2;
    if (groupCount < 2 || groupCount > MAX_GROUPS) {
      return { kind: "invalid", reason: `Choose 2 to ${MAX_GROUPS} groups` };
    }
    if (input.seeds.length < groupCount * 2) {
      return {
        kind: "invalid",
        reason: `${groupCount} groups need at least ${groupCount * 2} confirmed teams`,
      };
    }
    const groups = splitIntoGroups(input.seeds, groupCount);
    return { kind: "groups", groups, fixtures: generateGroupFixtures(groups) };
  }
  const unfinished = groupMatches.filter((m) => !isFinished(m));
  if (unfinished.length > 0) {
    return { kind: "waiting", matchIds: unfinished.map((m) => m.id) };
  }
  const groups = groupsOfMatches(groupMatches);
  const standings = groupStandings(groups, groupMatches);
  const smallest = Math.min(...groups.map((g) => g.teamIds.length));
  if (knockout.length > 0) {
    // How many went through is whatever produced the first round.
    for (let k = 1; k <= smallest; k += 1) {
      const seeds = qualifiersFromGroups(standings, k);
      if (matchesFirstRound(seeds, knockout)) {
        return nextKnockoutRound(seeds, knockout);
      }
    }
    return { kind: "invalid", reason: CHANGED };
  }
  const perGroup = input.qualifiersPerGroup ?? 2;
  if (perGroup < 1 || perGroup > smallest) {
    return {
      kind: "invalid",
      reason: `Choose 1 to ${smallest} teams through from each group`,
    };
  }
  if (perGroup * groups.length < 2) {
    return { kind: "invalid", reason: "At least 2 teams must go through" };
  }
  return nextKnockoutRound(qualifiersFromGroups(standings, perGroup), knockout);
}
