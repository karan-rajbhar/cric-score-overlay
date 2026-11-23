/**
 * Two-innings matches: a Test, or any match where each side bats twice
 * (`matches.innings_per_side` 2). The one place their rules live, for the
 * engine (`scoring/result.ts`), the device's offline replay and every
 * screen that shows one:
 *
 * - Innings 1 and 2 are each side's first innings; innings 3 belongs to the
 *   side that batted first, or to the other side when it follows on
 *   (Law 14); innings 4 is the chase. No super overs: a tie stays a tie.
 * - A side ahead after the third innings that the other side need not
 *   pass wins by an innings and the difference (Law 16.1).
 * - A match not won or tied when time runs out is drawn: the scorer ends
 *   it (Law 16.3). Nothing ends a day or a match by the clock here.
 * - No overs limit unless the match sets one (`overs_per_innings`).
 *
 * Pure: types only, so the engine, the browser and the tests share it.
 */
// Relative, as the engine imports this module (scripts load it with jiti).
import type {
  CloseOfPlay,
  InningsRow,
  MatchesRow,
  PlayBreak,
} from "./firebase/types";

/** The match fields these rules read. */
export type MultiInningsMatch = Partial<
  Pick<MatchesRow, "innings_per_side" | "match_format" | "overs_per_innings" | "days">
>;

/** An innings as these rules read it (stored doc, summary entry or view). */
export type InningsLine = Pick<InningsRow, "team_id" | "innings_number"> &
  Partial<
    Pick<
      InningsRow,
      | "id"
      | "total_runs"
      | "total_wickets"
      | "total_balls"
      | "is_completed"
      | "declared"
      | "follow_on"
      | "target_runs"
    >
  >;

/** Days a two-innings match may be scheduled for. */
export const MATCH_DAYS = { min: 1, max: 5 } as const;

/** Innings each side bats: 2 in a two-innings match, else 1. */
export function inningsPerSideOf(match: MultiInningsMatch | null | undefined): 1 | 2 {
  return match?.innings_per_side === 2 ? 2 : 1;
}

/** Whether each side bats twice (a Test, a two-day game, ...). */
export function isTwoInningsMatch(match: MultiInningsMatch | null | undefined): boolean {
  return inningsPerSideOf(match) === 2;
}

/** The last innings of the match proper (2, or 4 with two innings a side). */
export function lastMainInningsOf(match: MultiInningsMatch | null | undefined): number {
  return inningsPerSideOf(match) * 2;
}

/**
 * The overs an innings may last, or null for none: a two-innings match has
 * no limit unless it sets one; a limited-overs match without a figure has
 * the app's old default of 20.
 */
export function oversLimitOf(match: MultiInningsMatch): number | null {
  const overs = match.overs_per_innings;
  if (isTwoInningsMatch(match)) return overs && overs > 0 ? overs : null;
  return overs ?? 20;
}

/** The match's scheduled days, when it is a two-innings match. */
export function daysOf(match: MultiInningsMatch): number | null {
  if (!isTwoInningsMatch(match)) return null;
  const days = match.days;
  if (typeof days === "number" && days >= MATCH_DAYS.min) {
    return Math.min(days, MATCH_DAYS.max);
  }
  // Older or hand-made documents: a Test is five days, else one.
  return match.match_format === "Test" ? 5 : 1;
}

/**
 * The first-innings lead the side batting first needs to make the other
 * side follow on (Law 14.1.1): 200 in a match of five days or more, 150 in
 * three or four, 100 in two, 75 in one.
 */
export function followOnLeadFor(days: number | null | undefined): number {
  const d = days ?? 5;
  if (d >= 5) return 200;
  if (d >= 3) return 150;
  if (d === 2) return 100;
  return 75;
}

function runsOf(i: InningsLine): number {
  return i.total_runs ?? 0;
}

/**
 * Runs each side has made in the match proper up to innings `upTo`
 * (included), keyed by team id.
 */
export function teamTotals(
  innings: readonly InningsLine[],
  upTo: number,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const i of innings) {
    if (i.innings_number > upTo || !i.team_id) continue;
    totals.set(i.team_id, (totals.get(i.team_id) ?? 0) + runsOf(i));
  }
  return totals;
}

/**
 * The lead of `teamId` over the other side after innings `upTo`: positive
 * ahead, negative behind.
 */
export function leadOf(
  innings: readonly InningsLine[],
  teamId: string,
  upTo: number,
): number {
  let ours = 0;
  let theirs = 0;
  for (const [team, runs] of teamTotals(innings, upTo)) {
    if (team === teamId) ours += runs;
    else theirs += runs;
  }
  return ours - theirs;
}

/** What closing an innings of a two-innings match leads to. */
export type NextAfterInnings =
  | { kind: "next"; teamId: string; target: number | null }
  | { kind: "innings_win"; winnerId: string; margin: number }
  | { kind: "decided" };

/**
 * What follows innings `completed` (its total as it closes, the rest from
 * `innings`) in a two-innings match: the next innings and its batting side,
 * a win by an innings, or the chase decided (the fourth innings: its result
 * is the target's, `advanceAfterInnings`). `otherTeam` gives the side not
 * named. The third innings goes to the side that batted first; a follow-on
 * moves it before its first ball (`followOnOf`).
 */
export function nextAfterInnings(
  completed: InningsLine,
  innings: readonly InningsLine[],
  otherTeam: (teamId: string) => string,
): NextAfterInnings {
  const n = completed.innings_number;
  const all = [
    ...innings.filter((i) => i.innings_number !== n),
    completed,
  ];
  if (n === 1) return { kind: "next", teamId: otherTeam(completed.team_id), target: null };
  if (n === 2) {
    const first = all.find((i) => i.innings_number === 1)?.team_id;
    return { kind: "next", teamId: first ?? otherTeam(completed.team_id), target: null };
  }
  if (n === 3) {
    const lead = leadOf(all, completed.team_id, 3);
    const other = otherTeam(completed.team_id);
    // Behind on two innings to one: the other side need not bat again.
    if (lead < 0) return { kind: "innings_win", winnerId: other, margin: -lead };
    return { kind: "next", teamId: other, target: lead + 1 };
  }
  return { kind: "decided" };
}

/**
 * The fourth innings' target from the first three: what the side batting
 * last needs to pass the other side's total by one. Null before then.
 */
export function fourthInningsTarget(
  innings: readonly InningsLine[],
  battingTeamId: string,
): number | null {
  if (!innings.some((i) => i.innings_number === 3)) return null;
  return Math.max(1, -leadOf(innings, battingTeamId, 3) + 1);
}

/** The choice a follow-on offers, when it can be made. */
export interface FollowOnOption {
  /** The side that batted first and may enforce it. */
  leaderId: string;
  /** The side that would bat again. */
  trailerId: string;
  /** The first-innings lead. */
  lead: number;
  /** The lead the match needs for it (Law 14.1.1). */
  needed: number;
  /** Whether it is enforced now (the third innings is the trailer's). */
  enforced: boolean;
}

/**
 * The follow-on while it can still be decided: a two-innings match whose
 * third innings has not had a ball (`started`), the first two complete, and
 * the side that batted first ahead by at least the lead the match's days
 * need. Null otherwise.
 */
export function followOnOf(
  match: MultiInningsMatch,
  innings: readonly InningsLine[],
  started: boolean,
): FollowOnOption | null {
  if (!isTwoInningsMatch(match) || started) return null;
  const first = innings.find((i) => i.innings_number === 1);
  const second = innings.find((i) => i.innings_number === 2);
  const third = innings.find((i) => i.innings_number === 3);
  if (!first || !second || !third) return null;
  if (!first.is_completed || !second.is_completed || third.is_completed) return null;
  const lead = runsOf(first) - runsOf(second);
  const needed = followOnLeadFor(daysOf(match));
  if (lead < needed) return null;
  return {
    leaderId: first.team_id,
    trailerId: second.team_id,
    lead,
    needed,
    enforced: third.team_id === second.team_id,
  };
}

/**
 * How an innings closed, as a scorecard marks it: "dec" for a declaration,
 * "forfeited" for one declared before a ball (Law 15.2); "f/o" for a side
 * following on. Empty for anything else.
 */
export function inningsMarks(innings: InningsLine): string[] {
  const marks: string[] = [];
  if (innings.follow_on) marks.push("f/o");
  if (innings.declared) {
    const played = (innings.total_balls ?? 0) > 0 || runsOf(innings) > 0 || (innings.total_wickets ?? 0) > 0;
    marks.push(played ? "dec" : "forfeited");
  }
  return marks;
}

/** Whether a declared innings was forfeited (no ball, no run). */
export function isForfeited(innings: InningsLine): boolean {
  return inningsMarks(innings).includes("forfeited");
}

/**
 * One innings as a two-innings scorecard writes it: "245" all out, "450/7d"
 * declared, "180/4" in play or not out, "f/o" noted by the caller.
 */
export function inningsScoreText(
  innings: InningsLine,
  wicketsCap = 10,
): string {
  if (isForfeited(innings)) return "forfeited";
  const runs = runsOf(innings);
  const wickets = innings.total_wickets ?? 0;
  if (innings.is_completed && !innings.declared && wickets >= wicketsCap) {
    return `${runs}`;
  }
  return `${runs}/${wickets}${innings.declared ? "d" : ""}`;
}

/** A side's innings of the match proper, in order. */
export function sideInningsOf<I extends InningsLine>(
  match: MultiInningsMatch,
  innings: readonly I[],
  teamId: string,
): I[] {
  const last = lastMainInningsOf(match);
  return innings
    .filter((i) => i.team_id === teamId && i.innings_number <= last)
    .sort((a, b) => a.innings_number - b.innings_number);
}

/**
 * A side's score in a two-innings match: "245 & 180/4" (just its innings
 * so far). Empty when it has not batted.
 */
export function sideScoreText(
  match: MultiInningsMatch & Partial<Pick<MatchesRow, "wickets_per_innings">>,
  innings: readonly InningsLine[],
  teamId: string,
): string {
  const cap = match.wickets_per_innings ?? 10;
  return sideInningsOf(match, innings, teamId)
    .map((i) => inningsScoreText(i, cap))
    .join(" & ");
}

/**
 * An innings' heading on a scorecard: "1st innings" / "2nd innings" (in a
 * two-innings match, the side's own: the third innings is a side's 2nd),
 * with "(f/o)" for a follow-on; "Super over" after a limited-overs match.
 */
export function inningsHeading(
  match: MultiInningsMatch | null | undefined,
  innings: Pick<InningsLine, "innings_number" | "follow_on">,
): string {
  const n = innings.innings_number;
  if (n > lastMainInningsOf(match)) return "Super over";
  const label = isTwoInningsMatch(match)
    ? n <= 2
      ? "1st innings"
      : "2nd innings"
    : n === 1
      ? "1st innings"
      : "2nd innings";
  return innings.follow_on ? `${label} (f/o)` : label;
}

/** "1st innings" / "2nd innings" of the side batting in innings `n`. */
export function sideInningsLabel(
  match: MultiInningsMatch,
  inningsNumber: number,
): string {
  if (!isTwoInningsMatch(match)) {
    return inningsNumber === 1 ? "1st innings" : "2nd innings";
  }
  return inningsNumber <= 2 ? "1st innings" : "2nd innings";
}

const runsWord = (n: number) => `${n} ${n === 1 ? "run" : "runs"}`;

/**
 * Where the side batting in `current` stands in a two-innings match: its
 * lead or deficit ("Lions trail by 120 runs", "Lions lead by 45 runs",
 * "Scores level"), or the chase in the fourth innings ("Lions need 230 runs
 * to win"). Without a name: "Trail by 120 runs". Null in the first innings
 * or once the chase is won.
 */
export function standingLine(
  innings: readonly InningsLine[],
  current: InningsLine,
  teamName?: string | null,
): string | null {
  const n = current.innings_number;
  if (n < 2) return null;
  const say = (verb: string, rest: string) =>
    teamName ? `${teamName} ${verb} ${rest}` : `${verb[0]!.toUpperCase()}${verb.slice(1)} ${rest}`;
  if (n === 4 && current.target_runs) {
    const need = current.target_runs - runsOf(current);
    if (need <= 0) return null;
    return say("need", `${runsWord(need)} to win`);
  }
  const all = [...innings.filter((i) => i.innings_number !== n), current];
  const lead = leadOf(all, current.team_id, n);
  if (lead === 0) return "Scores level";
  return lead > 0
    ? say("lead", `by ${runsWord(lead)}`)
    : say("trail", `by ${runsWord(-lead)}`);
}

/** "Lunch", "Tea", "Stumps". */
export function playBreakName(kind: PlayBreak): string {
  return kind === "lunch" ? "Lunch" : kind === "tea" ? "Tea" : "Stumps";
}

/**
 * The day of play as a viewer reads it: "Day 2", "Lunch, day 2", "Stumps,
 * day 1". Null for a limited-overs match, or one not under way.
 */
export function dayLine(
  match: MultiInningsMatch &
    Partial<Pick<MatchesRow, "status" | "current_day" | "play_break">>,
): string | null {
  if (!isTwoInningsMatch(match) || match.status !== "live") return null;
  const day = match.current_day && match.current_day > 0 ? match.current_day : 1;
  return match.play_break
    ? `${playBreakName(match.play_break)}, day ${day}`
    : `Day ${day}`;
}

/**
 * The close-of-play entry for the end of day `day`, from the innings in
 * play (or the last one when between innings).
 */
export function closeOfPlayOf(
  day: number,
  innings: Pick<
    InningsRow,
    "innings_number" | "team_id" | "total_runs" | "total_wickets" | "total_balls"
  >,
): CloseOfPlay {
  return {
    day,
    innings_number: innings.innings_number,
    team_id: innings.team_id,
    runs: innings.total_runs ?? 0,
    wickets: innings.total_wickets ?? 0,
    balls: innings.total_balls ?? 0,
  };
}
