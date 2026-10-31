import type { Match } from "./match-types";
import {
  ballFaced,
  bowlerConcedes,
  isLegalDelivery,
  NON_BOWLER_DISMISSALS,
} from "./firebase/scoring/recompute";

/** The match's balls-faced rules (null: the Laws' convention). */
type FacedRules = Parameters<typeof ballFaced>[0];
import { dismissalDetailOf, type DismissalDetail } from "./dismissal-detail";
import { playerAwardOf, type PlayerAward } from "./player-award";
import {
  bowlerEconomy,
  byBattingOrder,
  chaseLine,
  deliveryKind,
  deliveryLabel,
  dismissalText,
  displayStatusOf,
  formatBowlerOvers,
  formatDecimalOvers,
  inningsBalls,
  isWicketFall,
  oversFromBalls,
  runRate,
  scoreLine,
  sidesInBattingOrder,
  strikeRate,
  teamName,
  topBatters,
  topBowlers,
} from "./cricket";

// ---------------------------------------------------------------------------
// Shareable summary image
// ---------------------------------------------------------------------------

export interface ExportBatter {
  name: string;
  userId?: string | null;
  runs: number;
  balls: number;
  notOut: boolean;
  sr: string;
}

export interface ExportBowler {
  name: string;
  userId?: string | null;
  /** Cricket overs notation, e.g. "3.4". */
  overs: string;
  runs: number;
  wickets: number;
  econ: string;
}

export interface ExportTeamStats {
  name: string;
  shortName: string;
  scoreLine: string;
  batters: ExportBatter[];
  bowlers: ExportBowler[];
}

export interface MatchExportSummary {
  title: string;
  format: string;
  venue?: string | null;
  playedAt?: string | null;
  /** Being played: the image says "Live" and where it stands, not a result. */
  live: boolean;
  /** The result; while live, where the match stands (see `matchSituation`). */
  result: string;
  matchUrl: string;
  team1: ExportTeamStats;
  team2: ExportTeamStats;
  playerOfTheMatch?: string | null;
}

export function buildExportSummary(
  match: Match,
  matchUrl: string,
): MatchExportSummary {
  const teamStats = (
    team: Match["team1"],
    battingInnings = inningsFor(match, team.id),
  ): ExportTeamStats => ({
    name: team.name,
    shortName: team.short_name ?? team.name.slice(0, 3).toUpperCase(),
    scoreLine: scoreLine(battingInnings),
    batters: topBatters(battingInnings).map((b) => ({
      name: b.user?.full_name ?? "—",
      userId: b.user_id ?? null,
      runs: b.runs_scored ?? 0,
      balls: b.balls_faced ?? 0,
      notOut: !b.is_out,
      sr: strikeRate(b.runs_scored, b.balls_faced),
    })),
    bowlers: topBowlers(match, team.id).map((b) => ({
      name: b.user?.full_name ?? "—",
      userId: b.user_id ?? null,
      overs: formatBowlerOvers(b),
      runs: b.runs_conceded ?? 0,
      wickets: b.wickets_taken ?? 0,
      econ: bowlerEconomy(b),
    })),
  });

  return {
    title: match.title,
    format: `${match.match_format} · ${match.overs_per_innings} ov`,
    venue: match.venue,
    playedAt: match.scheduled_at
      ? new Date(match.scheduled_at).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null,
    live: isLive(match),
    result: matchSituation(match),
    matchUrl,
    // In batting order: the side that batted first is shown first.
    team1: teamStats(sidesInBattingOrder(match)[0].team),
    team2: teamStats(sidesInBattingOrder(match)[1].team),
    playerOfTheMatch: match.player_of_the_match?.full_name ?? null,
  };
}


const isLive = (match: Pick<Match, "status">) =>
  match.status === "live" || match.status === "innings_break";

/**
 * Where a match stands, in a line: the result once it is over; while it is
 * live, the chase ("Warriors need 40 runs from 30 balls") or who is batting
 * and at what rate.
 */
export function matchSituation(match: Match): string {
  if (!isLive(match)) {
    return (
      match.result_description?.trim() ||
      (match.status === "abandoned" ? "Match abandoned" : "Match completed")
    );
  }
  const inn =
    match.innings?.find((i) => i.innings_number === match.current_innings) ??
    match.innings?.at(-1);
  if (!inn) return "Live";
  const bpo = match.balls_per_over || 6;
  const batting = teamName(match, inn.team_id);
  const balls = inningsBalls(inn, bpo);
  // The chase over the overs it has (a DLS revision's included).
  const chase = chaseLine(match, inn, batting, bpo);
  if (displayStatusOf(match) === "innings_break") {
    return chase ? `Innings break. ${chase}` : "Innings break";
  }
  if (chase) return chase;
  if (balls === 0 && inn.total_runs === 0) return `${batting} bat first`;
  return `${batting} batting · run rate ${runRate(inn.total_runs, balls, bpo)}`;
}

function inningsFor(match: Match, teamId: string) {
  return match.innings?.find((i) => i.team_id === teamId);
}

/**
 * The 1st and 2nd innings in batting order (the side that batted first,
 * then the chase), whichever of team 1 / team 2 batted first.
 */
function mainInningsInOrder(
  match: Match,
): [InningsRow | undefined, InningsRow | undefined] {
  const main = (match.innings ?? []).filter((i) => i.innings_number <= 2);
  return [
    main.find((i) => i.innings_number === 1),
    main.find((i) => i.innings_number === 2),
  ];
}


type InningsRow = NonNullable<Match["innings"]>[number];

/** Batted in the innings (a not-out batter who has not faced yet too). */
function hasBatted(
  b: NonNullable<InningsRow["batting_performances"]>[number],
): boolean {
  return (
    (b.balls_faced ?? 0) > 0 ||
    b.is_out ||
    (b.runs_scored ?? 0) > 0 ||
    Boolean(b.is_current_batsman) ||
    Boolean(b.dismissal_type)
  );
}


export interface Partnership {
  wicketNumber: number;
  runs: number;
  balls: number;
  batter1: { name: string; runs: number; balls: number };
  batter2: { name: string; runs: number; balls: number };
  isUnbroken?: boolean;
}


/**
 * The innings' partnerships from its ball log, in the order the balls were
 * bowled (`seq`): a partnership is the pair at the crease, ended by a
 * wicket or by either batter leaving (a retirement, a change); each
 * batter's share is the runs and balls he faced in it. Runs include extras
 * and penalty runs to this side. Without a ball log there is nothing to
 * tell who batted together: none.
 */
function getInningsPartnerships(
  inn: InningsRow,
  rules: FacedRules = {},
): Partnership[] {
  const deliveries = (inn.ball_by_ball ?? []).slice().sort((a, b) => {
    const sa = (a as { seq?: number | null }).seq;
    const sb = (b as { seq?: number | null }).seq;
    if (typeof sa === "number" && typeof sb === "number") return sa - sb;
    const overDiff = (a.over_number ?? 0) - (b.over_number ?? 0);
    if (overDiff !== 0) return overDiff;
    return (a.ball_number ?? 0) - (b.ball_number ?? 0);
  });
  const nameOf = (id: string, fromBall?: { full_name?: string | null } | null) =>
    fromBall?.full_name ??
    inn.batting_performances?.find((bp) => bp.user_id === id)?.user
      ?.full_name ??
    "Batter";

  const partnerships: Partnership[] = [];
  let wicketsDown = 0;
  let current: {
    ids: [string, string];
    runs: number;
    balls: number;
    share: Map<string, { name: string; runs: number; balls: number }>;
  } | null = null;

  const close = (isUnbroken: boolean) => {
    if (!current) return;
    if (current.runs > 0 || current.balls > 0 || !isUnbroken) {
      const [a, b] = current.ids;
      partnerships.push({
        wicketNumber: wicketsDown + 1,
        runs: current.runs,
        balls: current.balls,
        batter1: { ...current.share.get(a)! },
        batter2: { ...current.share.get(b)! },
        isUnbroken,
      });
    }
    current = null;
  };

  for (const d of deliveries) {
    const penaltyTeam = (d as { penalty_team_id?: string | null }).penalty_team_id;
    // Penalty runs logged for the other side are not this pair's.
    if (penaltyTeam && penaltyTeam !== inn.team_id) continue;
    const striker = d.batsman_id;
    const other = d.non_striker_id;
    if (striker && other) {
      const samePair =
        current !== null &&
        current.ids.includes(striker) &&
        current.ids.includes(other);
      if (!samePair) {
        // A new pair without a wicket in between: a retirement or a change.
        close(false);
        current = {
          ids: [striker, other],
          runs: 0,
          balls: 0,
          share: new Map([
            [striker, { name: nameOf(striker, d.batsman), runs: 0, balls: 0 }],
            [other, { name: nameOf(other, d.non_striker), runs: 0, balls: 0 }],
          ]),
        };
      }
    }
    if (!current) continue;
    const runs = d.runs_scored ?? 0;
    const extras = d.extras ?? 0;
    current.runs += runs + extras;
    // The balls the pair faced: their shares add up to the stand's.
    const faced = !penaltyTeam && ballFaced(rules, d);
    if (faced) current.balls += 1;
    const facing = striker ? current.share.get(striker) : undefined;
    if (facing && !penaltyTeam) {
      facing.runs += runs;
      if (faced) facing.balls += 1;
    }
    if (d.is_wicket) {
      // Retired hurt ends the stand but is not a wicket.
      const isWicket = d.dismissal_type !== "retired_hurt";
      close(false);
      if (isWicket) wicketsDown += 1;
    }
  }
  close(true);
  return partnerships;
}


export interface OverData {
  overNumber: number;
  runs: number;
  wickets: number;
  cumulativeRuns: number;
  cumulativeWickets: number;
  balls: Array<{
    text: string;
    type: "dot" | "single" | "four" | "six" | "wicket" | "extra";
  }>;
  batters: Array<{ name: string; runs: number; balls: number }>;
  bowlerName: string;
  bowlerOvers: string;
  bowlerMaidens: number;
  bowlerRuns: number;
  bowlerWickets: number;
}

function getInningsOverComparison(
  inn: InningsRow,
  rules: FacedRules = {},
): OverData[] {
  const deliveries = (inn.ball_by_ball ?? []).slice().sort((a, b) => {
    const overDiff = (a.over_number ?? 0) - (b.over_number ?? 0);
    if (overDiff !== 0) return overDiff;
    return (a.ball_number ?? 0) - (b.ball_number ?? 0);
  });

  if (!deliveries.length) return [];

  const oversMap = new Map<number, typeof deliveries>();
  for (const d of deliveries) {
    const ov = d.over_number ?? 0;
    const list = oversMap.get(ov) ?? [];
    list.push(d);
    oversMap.set(ov, list);
  }

  const sortedOverNumbers = Array.from(oversMap.keys()).sort((a, b) => a - b);

  let cumulativeRuns = 0;
  let cumulativeWickets = 0;

  const bowlerStats = new Map<
    string,
    { balls: number; runs: number; wickets: number; maidens: number }
  >();
  const batterStats = new Map<string, { runs: number; balls: number }>();

  const result: OverData[] = [];

  for (const ovNum of sortedOverNumbers) {
    const overDeliveries = oversMap.get(ovNum) ?? [];
    let overRuns = 0;
    let overBowlerRuns = 0;
    let overWickets = 0;
    let overLegalBalls = 0;
    const overBattersSet = new Set<string>();
    let overBowlerId = "";

    const ballsList: OverData["balls"] = [];

    for (const d of overDeliveries) {
      const runsScored = d.runs_scored ?? 0;
      const extras = d.extras ?? 0;
      const totalBallRuns = runsScored + extras;
      overRuns += totalBallRuns;

      const isWkt = isWicketFall(d);
      if (isWkt) overWickets++;

      const isLegal = isLegalDelivery(d);
      if (isLegal) overLegalBalls++;
      // As the engine charges it (not byes, leg byes or penalties).
      const bowlerRuns = bowlerConcedes(d);
      overBowlerRuns += bowlerRuns;

      if (d.batsman_id) {
        overBattersSet.add(d.batsman_id);
        const bStat = batterStats.get(d.batsman_id) ?? { runs: 0, balls: 0 };
        bStat.runs += runsScored;
        if (ballFaced(rules, d)) bStat.balls++;
        batterStats.set(d.batsman_id, bStat);
      }

      if (d.bowler_id) {
        overBowlerId = d.bowler_id;
        const bwStat = bowlerStats.get(d.bowler_id) ?? {
          balls: 0,
          runs: 0,
          wickets: 0,
          maidens: 0,
        };
        bwStat.runs += bowlerRuns;
        if (isWkt && !NON_BOWLER_DISMISSALS.has(d.dismissal_type ?? ""))
          bwStat.wickets++;
        if (isLegal) bwStat.balls++;
        bowlerStats.set(d.bowler_id, bwStat);
      }

      const kind = deliveryKind(d);
      ballsList.push({
        text: deliveryLabel(d),
        type: kind === "run" ? "single" : kind,
      });
    }

    cumulativeRuns += overRuns;
    cumulativeWickets += overWickets;

    if (overBowlerRuns === 0 && overLegalBalls >= 6 && overBowlerId) {
      const bwStat = bowlerStats.get(overBowlerId);
      if (bwStat) bwStat.maidens++;
    }

    const currentBowlerProg = overBowlerId ? bowlerStats.get(overBowlerId) : null;
    const bowlerOversStr = currentBowlerProg
      ? oversFromBalls(currentBowlerProg.balls)
      : "1.0";

    const bowlerPerf = inn.bowling_performances?.find(
      (bp) => bp.user_id === overBowlerId,
    );
    const bowlerName =
      bowlerPerf?.user?.full_name ??
      (overDeliveries[0] as unknown as { bowler?: { full_name?: string } })
        ?.bowler?.full_name ??
      "Bowler";

    const battersInOver: OverData["batters"] = [];
    for (const bId of overBattersSet) {
      const bPerf = inn.batting_performances?.find((bp) => bp.user_id === bId);
      const bName =
        bPerf?.user?.full_name ??
        (overDeliveries.find((d) => d.batsman_id === bId) as unknown as {
          batsman?: { full_name?: string };
        })?.batsman?.full_name ??
        "Batter";
      const bStat = batterStats.get(bId) ?? { runs: 0, balls: 0 };
      battersInOver.push({
        name: bName,
        runs: bStat.runs,
        balls: bStat.balls,
      });
    }

    result.push({
      overNumber: ovNum + 1,
      runs: overRuns,
      wickets: overWickets,
      cumulativeRuns,
      cumulativeWickets,
      balls: ballsList,
      batters: battersInOver,
      bowlerName,
      bowlerOvers: bowlerOversStr,
      bowlerMaidens: currentBowlerProg?.maidens ?? 0,
      bowlerRuns: currentBowlerProg?.runs ?? overRuns,
      bowlerWickets: currentBowlerProg?.wickets ?? overWickets,
    });
  }

  return result;
}


interface PhaseStat {
  phaseName: string;
  oversLabel: string;
  runs: number;
  wickets: number;
  balls: number;
  rr: string;
}

/**
 * Powerplay / middle / death overs for an innings of `maxOvers`: the
 * usual 1-6 / 7-15 / 16-20 for T20, 1-10 / 11-40 / 41-50 for 50 overs,
 * and in proportion for other lengths (null when too short to split).
 */
export function phaseBoundaries(
  maxOvers: number,
): { ppEnd: number; midEnd: number } | null {
  if (maxOvers < 4) return null;
  const ppEnd = maxOvers >= 40 ? 10 : Math.max(1, Math.round(maxOvers * 0.3));
  const deathOvers =
    maxOvers >= 40 ? 10 : Math.max(1, Math.round(maxOvers * 0.25));
  const midEnd = Math.max(ppEnd + 1, maxOvers - deathOvers);
  return midEnd < maxOvers ? { ppEnd, midEnd } : null;
}

function getPhaseStatsForInnings(
  inn: InningsRow | undefined,
  maxOvers = 20,
  ballsPerOver = 6,
): PhaseStat[] {
  if (!inn) return [];
  const bounds = phaseBoundaries(maxOvers);
  if (!bounds) return [];
  const { ppEnd, midEnd } = bounds;

  const phasesDef = [
    { name: "Powerplay", start: 1, end: ppEnd, label: `Overs 1-${ppEnd}` },
    {
      name: "Middle overs",
      start: ppEnd + 1,
      end: midEnd,
      label: `Overs ${ppEnd + 1}-${midEnd}`,
    },
    {
      name: "Death overs",
      start: midEnd + 1,
      end: maxOvers,
      label: `Overs ${midEnd + 1}-${maxOvers}`,
    },
  ];

  const deliveries = inn.ball_by_ball ?? [];

  if (deliveries.length > 0) {
    return phasesDef.map((ph) => {
      let pRuns = 0;
      let pWkts = 0;
      let pBalls = 0;

      for (const d of deliveries) {
        const ov = (d.over_number ?? 0) + 1; // 1-indexed over number
        if (ov >= ph.start && ov <= ph.end) {
          pRuns += (d.runs_scored ?? 0) + (d.extras ?? 0);
          if (d.is_wicket) pWkts++;
          if (d.extra_type !== "wide" && d.extra_type !== "no_ball") pBalls++;
        }
      }

      const oversDec = pBalls / (ballsPerOver > 0 ? ballsPerOver : 6);
      const rr = oversDec > 0 ? (pRuns / oversDec).toFixed(2) : "0.00";

      return {
        phaseName: ph.name,
        oversLabel: ph.label,
        runs: pRuns,
        wickets: pWkts,
        balls: pBalls,
        rr,
      };
    });
  }

  return [];
}


export interface ImpactLeader {
  id: string;
  name: string;
  teamName: string;
  teamTag: string;
  points: number;
  highlight: string;
}

function calculateMatchImpactLeaders(match: Match): ImpactLeader[] {
  const scores = new Map<
    string,
    {
      name: string;
      teamName: string;
      teamTag: string;
      points: number;
      highlightParts: string[];
    }
  >();

  const team1Name = match.team1.name;
  const team1Tag =
    match.team1.short_name ?? team1Name.slice(0, 3).toUpperCase();
  const team2Name = match.team2.name;
  const team2Tag =
    match.team2.short_name ?? team2Name.slice(0, 3).toUpperCase();

  for (const inn of match.innings ?? []) {
    const isTeam1 = inn.team_id === match.team1_id;
    const battingTeamName = isTeam1 ? team1Name : team2Name;
    const battingTeamTag = isTeam1 ? team1Tag : team2Tag;
    const bowlingTeamName = isTeam1 ? team2Name : team1Name;
    const bowlingTeamTag = isTeam1 ? team2Tag : team1Tag;

    for (const b of inn.batting_performances ?? []) {
      const uId = b.user_id;
      const uName = b.user?.full_name ?? "Player";
      const cur = scores.get(uId) ?? {
        name: uName,
        teamName: battingTeamName,
        teamTag: battingTeamTag,
        points: 0,
        highlightParts: [],
      };

      const runs = b.runs_scored ?? 0;
      const balls = b.balls_faced ?? 0;
      const fours = b.fours ?? 0;
      const sixes = b.sixes ?? 0;

      let batPts = runs;
      batPts += fours * 1 + sixes * 2;
      if (runs >= 100) batPts += 40;
      else if (runs >= 50) batPts += 20;
      else if (runs >= 30) batPts += 10;

      if (runs >= 15 && balls > 0 && runs / balls >= 1.5) {
        batPts += 10;
      }

      cur.points += batPts;
      if (runs > 0) {
        cur.highlightParts.push(`${runs} runs (${balls}b)`);
      }
      scores.set(uId, cur);
    }

    for (const bw of inn.bowling_performances ?? []) {
      const uId = bw.user_id;
      const uName = bw.user?.full_name ?? "Player";
      const cur = scores.get(uId) ?? {
        name: uName,
        teamName: bowlingTeamName,
        teamTag: bowlingTeamTag,
        points: 0,
        highlightParts: [],
      };

      const wkts = bw.wickets_taken ?? 0;
      const runs = bw.runs_conceded ?? 0;
      const maidens = bw.maidens ?? 0;
      const overs = (bw.balls_bowled ?? 0) / 6 || (bw.overs_bowled ?? 0);

      let bowlPts = wkts * 25;
      if (wkts >= 5) bowlPts += 30;
      else if (wkts >= 3) bowlPts += 15;
      bowlPts += maidens * 15;

      if (overs >= 2) {
        const econ = runs / overs;
        if (econ <= 5.0) bowlPts += 25;
        else if (econ <= 6.0) bowlPts += 15;
      }

      cur.points += bowlPts;
      if (wkts > 0 || maidens > 0) {
        cur.highlightParts.push(`${wkts}/${runs} (${formatBowlerOvers(bw)} ov)`);
      }
      scores.set(uId, cur);
    }
  }

  return Array.from(scores.entries())
    .map(([id, val]) => ({
      id,
      name: val.name,
      teamName: val.teamName,
      teamTag: val.teamTag,
      points: Math.round(val.points),
      highlight:
        val.highlightParts.join(" · ") || "All-round contribution",
    }))
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);
}


// ---------------------------------------------------------------------------
// Full match report: the data the report page (/matches/[id]/report) shows,
// built from the match and its ball log. The page draws it with the design
// system's components (~/components/report).
// ---------------------------------------------------------------------------

export interface ReportTeam {
  name: string;
  shortName: string | null;
  logoUrl: string | null;
}

export interface ReportBatter {
  name: string;
  userId: string | null;
  dismissal: string;
  /** How the wicket fell, for the scorecard's dropdown (null: not out). */
  detail: DismissalDetail | null;
  notOut: boolean;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: string;
}

export interface ReportBowler {
  name: string;
  userId: string | null;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: string;
  /** From the ball log; null without one. */
  dots: number | null;
  fours: number | null;
  sixes: number | null;
  wides: number;
  noBalls: number;
}

export interface ReportInnings {
  id: string;
  /** "1st innings", "2nd innings", "Super over". */
  heading: string;
  team: ReportTeam;
  /** "178/5". */
  score: string;
  overs: string;
  runRate: string;
  /** The chase's target, on the second innings of a pair. */
  target: number | null;
  inProgress: boolean;
  batters: ReportBatter[];
  extras: { total: number; detail: string };
  /** "12 fours and 3 sixes: 66 runs, 37% of the total". */
  boundaries: string | null;
  didNotBat: string[];
  fallOfWickets: { score: string; name: string; over: string }[];
  /** From the ball log: empty without one. */
  partnerships: Partnership[];
  bowlers: ReportBowler[];
}

export interface ReportPhaseRow {
  name: string;
  overs: string;
  /** Each side's runs/wickets and run rate in the phase, batting order. */
  sides: [{ score: string; runRate: string }, { score: string; runRate: string } | null];
  /** The side that scored more than 4 runs more (index), else null. */
  ahead: 0 | 1 | null;
}

export interface ReportChartSide {
  key: string;
  label: string;
  score: string;
  overs: { over: number; runs: number; wickets: number; total: number; totalWickets: number }[];
}

export interface MatchReportModel {
  title: string;
  /** "Strikers vs Thunder – match report.pdf". */
  fileName: string;
  matchUrl: string;
  matchIdShort: string;
  /** The day the report was made (YYYY-MM-DD). */
  generated: string;
  /** "17 Oct 2026, 18:30", when scheduled. */
  date: string | null;
  tournament: string | null;
  club: string | null;
  /** The two sides in batting order (the side that batted first first). */
  teams: [ReportTeam, ReportTeam];
  info: { label: string; value: string; wide?: boolean }[];
  playerOfTheMatch: PlayerAward | null;
  innings: ReportInnings[];
  phases: { teams: [string, string]; rows: ReportPhaseRow[] } | null;
  impact: ImpactLeader[];
  charts: { maxOvers: number; sides: ReportChartSide[] } | null;
  /** Over N of each innings side by side (null: that innings had none). */
  overs: { teams: [string, string]; rows: [OverData | null, OverData | null][] } | null;
  signoff: { role: string; name: string | null }[];
}

const teamRef = (t: Match["team1"]): ReportTeam => ({
  name: t.name,
  shortName: t.short_name ?? null,
  logoUrl: t.logo_url ?? null,
});

const tagOf = (t: Match["team1"]) =>
  t.short_name ?? t.name.slice(0, 3).toUpperCase();

function reportBatters(inn: InningsRow): ReportBatter[] {
  // The order they came in, as on a scorecard.
  return (inn.batting_performances ?? [])
    .filter(hasBatted)
    .sort(byBattingOrder)
    .map((b) => ({
      name: b.user?.full_name ?? "—",
      userId: b.user_id ?? null,
      dismissal:
        !b.is_out && b.dismissal_type === "retired_hurt"
          ? "retired hurt"
          : dismissalText(b, inn.fall_of_wickets ?? []),
      detail: b.is_out
        ? dismissalDetailOf(
            b.user?.full_name ?? "Batter",
            (inn.fall_of_wickets ?? []).find(
              (f) => f.batsman_out_id === b.user_id,
            ),
            b.dismissal_type,
          )
        : null,
      notOut: !b.is_out && b.dismissal_type !== "retired_hurt",
      runs: b.runs_scored ?? 0,
      balls: b.balls_faced ?? 0,
      fours: b.fours ?? 0,
      sixes: b.sixes ?? 0,
      strikeRate: strikeRate(b.runs_scored, b.balls_faced),
    }));
}

function extrasOf(inn: InningsRow): ReportInnings["extras"] {
  const parts = (
    [
      ["b", inn.extras_byes],
      ["lb", inn.extras_leg_byes],
      ["wd", inn.extras_wides],
      ["nb", inn.extras_no_balls],
      ["p", inn.extras_penalties],
    ] as const
  )
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `${k} ${v}`);
  return {
    total: inn.extras_total ?? 0,
    detail: parts.length ? `(${parts.join(", ")})` : "",
  };
}

function boundariesOf(inn: InningsRow): string | null {
  const bats = inn.batting_performances ?? [];
  const fours = bats.reduce((n, b) => n + (b.fours ?? 0), 0);
  const sixes = bats.reduce((n, b) => n + (b.sixes ?? 0), 0);
  const runs = fours * 4 + sixes * 6;
  const total = inn.total_runs ?? 0;
  if (runs === 0 || total === 0) return null;
  const count = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  return `${count(fours, "four", "fours")} and ${count(sixes, "six", "sixes")}: ${runs} runs, ${Math.round((runs / total) * 100)}% of the total`;
}

function didNotBatOf(
  inn: InningsRow,
  team: Match["team1"] | Match["team2"] | undefined,
): string[] {
  if (!team?.team_players?.length) return [];
  const batted = new Set(
    (inn.batting_performances ?? []).filter(hasBatted).map((b) => b.user_id),
  );
  return team.team_players
    .filter((p) => p.user?.id && !batted.has(p.user.id))
    .map((p) => p.user?.full_name)
    .filter((n): n is string => Boolean(n));
}

function fallOfWicketsOf(inn: InningsRow): ReportInnings["fallOfWickets"] {
  return [...(inn.fall_of_wickets ?? [])]
    .sort((a, b) => a.wicket_number - b.wicket_number)
    .map((f) => ({
      score: `${f.wicket_number}-${f.runs_at_fall}`,
      name: f.batsman?.full_name ?? "Batter",
      over: formatDecimalOvers(f.overs_at_fall),
    }));
}

function reportBowlers(inn: InningsRow): ReportBowler[] {
  // In the order they came on (the stored order), as on a scorecard.
  const log = inn.ball_by_ball ?? [];
  return (inn.bowling_performances ?? [])
    .filter(
      (b) =>
        (b.balls_bowled ?? 0) > 0 ||
        (b.overs_bowled ?? 0) > 0 ||
        (b.runs_conceded ?? 0) > 0,
    )
    .map((b) => {
      const mine = log.filter((d) => d.bowler_id === b.user_id);
      const count = (pred: (d: (typeof log)[number]) => boolean) =>
        log.length > 0 ? mine.filter(pred).length : null;
      return {
        name: b.user?.full_name ?? "—",
        userId: b.user_id ?? null,
        overs: formatBowlerOvers(b),
        maidens: b.maidens ?? 0,
        runs: b.runs_conceded ?? 0,
        wickets: b.wickets_taken ?? 0,
        economy: bowlerEconomy(b),
        dots: count((d) => (d.runs_scored ?? 0) === 0 && (d.extras ?? 0) === 0),
        fours: count((d) => (d.runs_scored ?? 0) === 4),
        sixes: count((d) => (d.runs_scored ?? 0) === 6),
        wides: b.wides ?? 0,
        noBalls: b.no_balls ?? 0,
      };
    });
}

function reportInnings(
  inn: InningsRow,
  heading: string,
  team: Match["team1"] | Match["team2"],
  rules: FacedRules = {},
): ReportInnings {
  const balls = inningsBalls(inn);
  return {
    id: inn.id,
    heading,
    team: teamRef(team),
    score: `${inn.total_runs ?? 0}/${inn.total_wickets ?? 0}`,
    overs: oversFromBalls(balls),
    runRate:
      balls > 0 ? ((inn.total_runs ?? 0) / (balls / 6)).toFixed(2) : "0.00",
    target:
      inn.target_runs && inn.innings_number % 2 === 0 ? inn.target_runs : null,
    inProgress: !inn.is_completed,
    batters: reportBatters(inn),
    extras: extrasOf(inn),
    boundaries: boundariesOf(inn),
    didNotBat: didNotBatOf(inn, team),
    fallOfWickets: fallOfWicketsOf(inn),
    partnerships: getInningsPartnerships(inn, rules),
    bowlers: reportBowlers(inn),
  };
}

/**
 * Every innings in order (the match's two, then any super overs) as the
 * report and the match page's Scorecard tab show them.
 */
export function allInnings(match: Match): ReportInnings[] {
  const teamOf = (inn: InningsRow) =>
    inn.team_id === match.team2_id ? match.team2 : match.team1;
  return (match.innings ?? [])
    .slice()
    .sort((a, b) => a.innings_number - b.innings_number)
    .map((inn, i) =>
      reportInnings(
        inn,
        i === 0 ? "1st innings" : i === 1 ? "2nd innings" : "Super over",
        teamOf(inn),
        match,
      ),
    );
}

function phasesOf(match: Match): MatchReportModel["phases"] {
  const [inn1, inn2] = mainInningsInOrder(match);
  const maxOvers = match.overs_per_innings || 20;
  const bpo = match.balls_per_over || 6;
  const p1 = getPhaseStatsForInnings(inn1, maxOvers, bpo);
  const p2 = getPhaseStatsForInnings(inn2, maxOvers, bpo);
  if (p1.length === 0) return null;
  const [{ team: first }, { team: second }] = sidesInBattingOrder(match);
  const fig = (p: PhaseStat) => ({
    score: `${p.runs}/${p.wickets}`,
    runRate: p.rr,
  });
  return {
    teams: [tagOf(first), tagOf(second)],
    rows: p1.map((a, i) => {
      const b = p2[i];
      return {
        name: a.phaseName,
        overs: a.oversLabel,
        sides: [fig(a), b ? fig(b) : null],
        ahead: !b
          ? null
          : a.runs > b.runs + 4
            ? 0
            : b.runs > a.runs + 4
              ? 1
              : null,
      };
    }),
  };
}

function chartsOf(match: Match): MatchReportModel["charts"] {
  const sides = mainInningsInOrder(match)
    .filter((inn): inn is InningsRow => Boolean(inn))
    .map((inn) => {
      const team = inn.team_id === match.team2_id ? match.team2 : match.team1;
      return {
        key: inn.id,
        label: tagOf(team),
        score: `${inn.total_runs ?? 0}/${inn.total_wickets ?? 0}`,
        overs: getInningsOverComparison(inn, match).map((o) => ({
          over: o.overNumber,
          runs: o.runs,
          wickets: o.wickets,
          total: o.cumulativeRuns,
          totalWickets: o.cumulativeWickets,
        })),
      };
    })
    .filter((s) => s.overs.length > 0);
  if (sides.length === 0) return null;
  return {
    maxOvers: Math.max(
      match.overs_per_innings || 20,
      ...sides.map((s) => s.overs.length),
      1,
    ),
    sides,
  };
}

function oversOf(match: Match): MatchReportModel["overs"] {
  const inn1 =
    match.innings?.find((i) => i.innings_number === 1) ?? match.innings?.[0];
  const inn2 =
    match.innings?.find((i) => i.innings_number === 2) ?? match.innings?.[1];
  if (!inn1) return null;
  const o1 = getInningsOverComparison(inn1, match);
  const o2 = inn2 ? getInningsOverComparison(inn2, match) : [];
  if (o1.length === 0 && o2.length === 0) return null;
  const nameOf = (inn: InningsRow | undefined, fallback: Match["team1"]) =>
    inn
      ? inn.team_id === match.team1_id
        ? match.team1.name
        : match.team2.name
      : fallback.name;
  return {
    teams: [nameOf(inn1, match.team1), nameOf(inn2, match.team2)],
    rows: Array.from({ length: Math.max(o1.length, o2.length) }, (_, i) => [
      o1[i] ?? null,
      o2[i] ?? null,
    ]),
  };
}

function infoOf(match: Match, date: string | null): MatchReportModel["info"] {
  const toss = match.toss_winner_team_id
    ? `${match.toss_winner_team_id === match.team2.id ? match.team2.name : match.team1.name} won the toss and chose to ${match.toss_decision === "bowl" ? "bowl" : "bat"}`
    : null;
  const umpires = [
    match.umpire1_name,
    match.umpire2_name,
    match.third_umpire_name,
  ]
    .filter(Boolean)
    .join(", ");
  const conditions = [match.pitch_conditions, match.weather_conditions]
    .filter(Boolean)
    .join(" · ");
  const rules = [
    match.wickets_per_innings && match.wickets_per_innings < 10
      ? `${match.wickets_per_innings} wickets a side`
      : null,
    match.last_man_stands ? "Last man stands" : null,
    match.golden_ball ? "Golden ball tiebreak" : null,
  ].filter(Boolean);
  // Only what the match holds: a missing fact gets no row, not a filler.
  const rows: [string, string | null | undefined, boolean?][] = [
    ["Organiser", match.tournament?.name ?? match.club?.name ?? null],
    ["Match", match.title],
    ["Format", match.match_format],
    ["Overs", `${match.overs_per_innings} overs a side`],
    ["Venue", match.venue ?? null],
    ["Date and time", date],
    ["Toss", toss],
    ["Umpires", umpires || null],
    ["Scorer", match.scorer_name ?? null],
    ["Ball", match.ball_type ?? null],
    ["Pitch and weather", conditions || null, true],
    ["Special rules", rules.join(", ") || null, true],
    ["Match ID", `#${match.id.slice(0, 8)}`],
  ];
  return rows
    .filter((r): r is [string, string, boolean?] => Boolean(r[1]))
    .map(([label, value, wide]) => ({ label, value, wide }));
}

function signoffOf(match: Match): MatchReportModel["signoff"] {
  // Names only when the match holds them; otherwise a blank line to write
  // the name on (never the role repeated as a name).
  return [
    {
      role: `${match.team1.short_name ?? match.team1.name} captain`,
      name: match.team1.captain?.full_name ?? null,
    },
    {
      role: `${match.team2.short_name ?? match.team2.name} captain`,
      name: match.team2.captain?.full_name ?? null,
    },
    { role: "Lead match umpire", name: match.umpire1_name ?? null },
    { role: "Official scorer / referee", name: match.scorer_name ?? null },
  ];
}

/** Everything the report page shows, in the order it shows it. */
export function buildMatchReport(
  match: Match,
  matchUrl: string,
  now: Date = new Date(),
): MatchReportModel {
  // Batting order: the side that batted first, then the chase.
  const [{ team: first }, { team: second }] = sidesInBattingOrder(match);
  const date = match.scheduled_at
    ? new Date(match.scheduled_at).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  return {
    title: match.title,
    fileName: `${first.name} vs ${second.name} – match report.pdf`
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, " ")
      .trim(),
    matchUrl,
    matchIdShort: match.id.slice(0, 8).toUpperCase(),
    generated: now.toISOString().slice(0, 10),
    date,
    tournament: match.tournament?.name ?? null,
    club: match.club?.name ?? null,
    teams: [teamRef(first), teamRef(second)],
    info: infoOf(match, date),
    playerOfTheMatch: playerAwardOf(match),
    innings: allInnings(match),
    phases: phasesOf(match),
    impact: calculateMatchImpactLeaders(match),
    charts: chartsOf(match),
    overs: oversOf(match),
    signoff: signoffOf(match),
  };
}
