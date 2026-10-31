/**
 * The Test classic package's figures, worded the way long-form coverage
 * words them: "138-5", bowling figures as overs-maidens-runs-wickets
 * ("18.4-3-42-2"), the fall of wickets as "1-23", the lead or the deficit
 * from the innings totals in a multi-innings match, else the chase.
 *
 * Pure: everything comes from the live row and the page's match, and a
 * slot with no data returns null (the graphics close it up). Nothing here
 * invents a day, a session, minutes batted or a spell: `live_state` has
 * none of them yet.
 */

import { formatDismissalType, isCaughtAndBowled, formatFowOvers } from "~/lib/cricket";
import type {
  BattingPerformance,
  FallOfWicket,
  Innings,
  InningsPartnership,
  Match,
} from "~/lib/match-types";
import type { LiveMatchState } from "../../types";
import { ballsPerOverOf, chaseLine, oversText } from "../shared/derive";

/** "1st", "2nd", "3rd", "4th", "11th", "21st". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Runs and wickets the long-form way: "138-5" (all out: "212"). */
export function scoreText(
  runs: number | null | undefined,
  wickets: number | null | undefined,
): string {
  const r = runs ?? 0;
  const w = wickets ?? 0;
  return w >= 10 ? `${r}` : `${r}-${w}`;
}

/**
 * A match played over two innings a side (Test, first-class, multi-day).
 * Its third and fourth innings are real innings, not super overs.
 */
export function isMultiInnings(format: string | null | undefined): boolean {
  if (!format) return false;
  return /\btest\b|first[\s-]?class|multi[\s-]?day|two[\s-]innings|\b[2-5][\s-]?day/i.test(
    format,
  );
}

/** Bowling figures as overs-maidens-runs-wickets: "18.4-3-42-2". */
export function bowlingFigures(
  balls: number | null | undefined,
  maidens: number | null | undefined,
  runs: number | null | undefined,
  wickets: number | null | undefined,
  ballsPerOver = 6,
): string {
  return `${oversText(balls, ballsPerOver)}-${maidens ?? 0}-${runs ?? 0}-${wickets ?? 0}`;
}

/** "1 four", "9 fours". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ---- where the match stands --------------------------------------------------

export type Standing =
  | { kind: "lead"; runs: number; text: string }
  | { kind: "trail"; runs: number; text: string }
  | { kind: "level"; runs: 0; text: string }
  | {
      kind: "chase";
      need: number;
      balls: number | null;
      target: number;
      text: string;
    };

/**
 * Where the batting side stands: in a multi-innings match from the second
 * innings on, its lead or deficit over the other side's innings so far
 * ("Trail by 123", "Lead by 45"); with a target, the chase ("Need 19 from
 * 8 balls", or "Need 104 to win" with no ball limit). Null when neither
 * applies (a first innings, a target reached) or the innings totals are
 * not at hand (a strap has no match).
 */
export function standingOf(
  state: LiveMatchState,
  match: Match | null | undefined,
): Standing | null {
  const multi = isMultiInnings(state.match_format ?? match?.match_format);
  const n = state.innings_number ?? 0;
  if (!multi) {
    const chase = chaseLine(state, ballsPerOverOf(match));
    return chase
      ? {
          kind: "chase",
          need: chase.runsNeeded,
          balls: chase.ballsRemaining,
          target: chase.target,
          text: chase.text,
        }
      : null;
  }
  // A Test's fourth innings: a target and no ball limit.
  const target = state.target_runs;
  if (target && !state.innings_completed) {
    const need = state.runs_needed ?? target - (state.total_runs ?? 0);
    if (need <= 0) return null;
    return { kind: "chase", need, balls: null, target, text: `Need ${need} to win` };
  }
  if (n < 2 || !match?.innings?.length) return null;
  const battingId = battingTeamIdOf(state, match);
  if (!battingId) return null;
  let ours = 0;
  let theirs = 0;
  for (const inn of match.innings) {
    if (inn.innings_number > n) continue;
    const runs =
      inn.innings_number === n ? (state.total_runs ?? inn.total_runs) : inn.total_runs;
    if (inn.team_id === battingId) ours += runs ?? 0;
    else theirs += runs ?? 0;
  }
  const diff = ours - theirs;
  if (diff === 0) return { kind: "level", runs: 0, text: "Scores level" };
  return diff > 0
    ? { kind: "lead", runs: diff, text: `Lead by ${diff}` }
    : { kind: "trail", runs: -diff, text: `Trail by ${-diff}` };
}

/** The batting side's team id, from the match's teams by name. */
export function battingTeamIdOf(
  state: LiveMatchState,
  match: Match | null | undefined,
): string | null {
  if (!match) return null;
  const current = match.innings?.find(
    (i) => i.innings_number === state.innings_number,
  );
  if (current?.team_id) return current.team_id;
  const name = state.batting_team_name;
  if (!name) return null;
  if (name === (state.team1_name ?? match.team1?.name)) return match.team1_id;
  if (name === (state.team2_name ?? match.team2?.name)) return match.team2_id;
  return null;
}

/**
 * The innings as long-form graphics name it: "1st innings" / "2nd
 * innings" for each side in a multi-innings match (the third innings is a
 * side's 2nd), "Super over" past the second in a limited-overs one.
 */
export function inningsTitle(
  inningsNumber: number | null | undefined,
  format: string | null | undefined,
): string {
  const n = inningsNumber ?? 1;
  if (isMultiInnings(format)) return `${ordinal(n <= 2 ? 1 : 2)} innings`;
  if (n >= 3) return "Super over";
  return `${ordinal(n)} innings`;
}

/**
 * The batting side's earlier innings in a multi-innings match, for "325 &
 * 112-2" (null in a limited-overs match or a side's first innings).
 */
export function earlierInningsOf(
  state: LiveMatchState,
  match: Match | null | undefined,
): Innings | null {
  if (!isMultiInnings(state.match_format ?? match?.match_format)) return null;
  const battingId = battingTeamIdOf(state, match);
  const n = state.innings_number ?? 0;
  if (!battingId || n < 3) return null;
  return (
    [...(match?.innings ?? [])]
      .filter((i) => i.team_id === battingId && i.innings_number < n)
      .sort((a, b) => a.innings_number - b.innings_number)[0] ?? null
  );
}

/** The innings before the current one (the break's "156-7 (20 ov)"). */
export function previousInnings(
  state: LiveMatchState,
  match: Match | null | undefined,
): Innings | null {
  const n = state.innings_number ?? 0;
  return match?.innings?.find((i) => i.innings_number === n - 1) ?? null;
}

/** The overs an innings may last, for "of 20" (none in a multi-innings match). */
export function oversLimitOf(state: LiveMatchState): number | null {
  if (isMultiInnings(state.match_format)) return null;
  if ((state.innings_number ?? 1) >= 3) return 1;
  return state.overs_per_innings ?? null;
}

// ---- scorecard lines ---------------------------------------------------------

/** A batter's name in an innings, from its scorecard. */
export function nameIn(innings: Innings, userId: string | null | undefined): string {
  if (!userId) return "";
  const bat = innings.batting_performances?.find((b) => b.user_id === userId);
  if (bat?.user?.full_name) return bat.user.full_name;
  const fow = innings.fall_of_wickets?.find((f) => f.batsman_out_id === userId);
  return fow?.batsman?.full_name ?? "";
}

/** The surname, for tight spaces: "Leo Fernandes" -> "Fernandes". */
export function surname(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

/**
 * How a batter was out, in the scorecard's words: "c Shah b Khan",
 * "c & b Khan", "lbw b Khan", "run out (Shah)". The fielder is named only
 * when the record has one ("caught b Khan" otherwise: never a guessed
 * "c & b").
 */
export function howOut(
  batter: Pick<BattingPerformance, "user_id" | "is_out" | "dismissal_type">,
  fow: FallOfWicket[] | undefined,
  names?: ReadonlyMap<string, string>,
): string {
  if (!batter.is_out) {
    return batter.dismissal_type === "retired_hurt" ? "retired hurt" : "not out";
  }
  const entry = fow?.find((f) => f.batsman_out_id === batter.user_id);
  const type = batter.dismissal_type ?? entry?.dismissal_type ?? null;
  const named = (id: string | null | undefined) =>
    id ? (names?.get(id) ?? null) : null;
  const bowler = entry?.bowler?.full_name ?? named(entry?.bowler_id);
  const fielder = entry?.fielder?.full_name ?? named(entry?.fielder_id);
  switch (type) {
    case "bowled":
      return bowler ? `b ${bowler}` : "bowled";
    case "lbw":
      return bowler ? `lbw b ${bowler}` : "lbw";
    case "caught":
      if (bowler && isCaughtAndBowled(type, entry?.fielder_id, entry?.bowler_id))
        return `c & b ${bowler}`;
      if (fielder && bowler) return `c ${fielder} b ${bowler}`;
      if (bowler) return `caught b ${bowler}`;
      return fielder ? `c ${fielder}` : "caught";
    case "stumped":
      if (fielder && bowler) return `st ${fielder} b ${bowler}`;
      return bowler ? `stumped b ${bowler}` : "stumped";
    case "hit_wicket":
      return bowler ? `hit wkt b ${bowler}` : "hit wicket";
    case "run_out":
      return fielder ? `run out (${fielder})` : "run out";
    default:
      return formatDismissalType(type).toLowerCase();
  }
}

/**
 * Player names by id from what the match already holds: the innings'
 * scorecards and both squads (for the bowler and fielder of a wicket
 * whose record carries only their ids).
 */
export function playerNames(
  innings: Innings,
  match: Match | null | undefined,
): Map<string, string> {
  const out = new Map<string, string>();
  const add = (id: string | null | undefined, name: string | null | undefined) => {
    if (id && name && !out.has(id)) out.set(id, name);
  };
  for (const b of innings.batting_performances ?? []) add(b.user_id, b.user?.full_name);
  for (const b of innings.bowling_performances ?? []) add(b.user_id, b.user?.full_name);
  for (const t of [match?.team1, match?.team2]) {
    for (const p of t?.team_players ?? []) add(p.user_id, p.user?.full_name);
  }
  return out;
}

/** The batters who appear on the card (batted, out, or in). */
export function battingRows(innings: Innings): BattingPerformance[] {
  return [...(innings.batting_performances ?? [])]
    .filter((b) => b.balls_faced > 0 || b.is_out || b.is_current_batsman)
    .sort(
      (a, b) =>
        (a.batting_position ?? Number.MAX_SAFE_INTEGER) -
        (b.batting_position ?? Number.MAX_SAFE_INTEGER),
    );
}

/**
 * The batting side's playing XI not yet in: "Did not bat" once the innings
 * is over, "Yet to bat" while it runs. Empty without a squad.
 */
export function yetToBat(innings: Innings, match: Match | null | undefined): string[] {
  if (!match) return [];
  const team =
    innings.team_id === match.team1_id
      ? match.team1
      : innings.team_id === match.team2_id
        ? match.team2
        : null;
  const xi = (team?.team_players ?? [])
    .filter((p) => p.is_playing_xi === true)
    .sort(
      (a, b) =>
        (a.batting_order ?? Number.MAX_SAFE_INTEGER) -
        (b.batting_order ?? Number.MAX_SAFE_INTEGER),
    );
  const batted = new Set(battingRows(innings).map((b) => b.user_id));
  return xi
    .filter((p) => !batted.has(p.user_id))
    .map((p) => p.user?.full_name ?? "")
    .filter(Boolean);
}

/** "Extras 8 (b 1, lb 2, w 5, nb 0)" parts. */
export function extrasParts(innings: Innings): string {
  const parts = [
    `b ${innings.extras_byes ?? 0}`,
    `lb ${innings.extras_leg_byes ?? 0}`,
    `w ${innings.extras_wides ?? 0}`,
    `nb ${innings.extras_no_balls ?? 0}`,
  ];
  if (innings.extras_penalties) parts.push(`pen ${innings.extras_penalties}`);
  return parts.join(", ");
}

/** "(5 wkts, 18.4 ov)" / "(all out, 19.2 ov)". */
export function totalDetail(innings: Innings, ballsPerOver = 6): string {
  const wk =
    innings.total_wickets >= 10
      ? "all out"
      : plural(innings.total_wickets, "wkt");
  return `${wk}, ${oversText(innings.total_balls, ballsPerOver)} ov`;
}

export interface FowEntry {
  wicket: number;
  runs: number;
  overs: string;
  batter: string;
  /** The stand the wicket ended, when the innings records it. */
  stand: number | null;
}

/** The fall of wickets in order, with the stand each one broke. */
export function fallOfWickets(innings: Innings): FowEntry[] {
  const stands = innings.partnerships ?? [];
  return [...(innings.fall_of_wickets ?? [])]
    .sort((a, b) => a.wicket_number - b.wicket_number)
    .map((f) => ({
      wicket: f.wicket_number,
      runs: f.runs_at_fall,
      overs: formatFowOvers(f.overs_at_fall),
      batter: f.batsman?.full_name ?? nameIn(innings, f.batsman_out_id),
      stand:
        stands.find((s) => s.wicket_number === f.wicket_number)?.runs ?? null,
    }));
}

export interface StandRow {
  /** "1st wkt"; the current one: "Unbroken". */
  label: string;
  wicket: number | null;
  current: boolean;
  runs: number;
  balls: number;
  a: { name: string; runs: number | null; balls: number | null };
  b: { name: string; runs: number | null; balls: number | null };
}

/** Every stand of an innings in order (the open one last, as "Unbroken"). */
export function partnershipRows(innings: Innings): StandRow[] {
  const list = innings.partnerships ?? [];
  return list.map((p: InningsPartnership, i) => {
    const wicket = p.wicket_number ?? null;
    const current = !!p.is_current || (wicket === null && i === list.length - 1);
    return {
      label: wicket ? `${ordinal(wicket)} wkt` : current ? "Unbroken" : `${ordinal(i + 1)} wkt`,
      wicket,
      current,
      runs: p.runs ?? 0,
      balls: p.balls ?? 0,
      a: {
        name: nameIn(innings, p.batsman1_id),
        runs: p.batsman1_runs ?? null,
        balls: p.batsman1_balls ?? null,
      },
      b: {
        name: nameIn(innings, p.batsman2_id),
        runs: p.batsman2_runs ?? null,
        balls: p.batsman2_balls ?? null,
      },
    };
  });
}

// ---- milestones --------------------------------------------------------------

/** The honours-board heading for a milestone kind. */
export function milestoneHeading(kind: string): string | null {
  switch (kind) {
    case "fifty":
      return "Half-century";
    case "hundred":
      return "Century";
    case "three_for":
      return "Three wickets";
    case "five_for":
      return "Five-wicket haul";
    case "hat_trick":
      return "Hat-trick";
    case "milestone":
      return "Milestone";
    default:
      return null;
  }
}

/** The year a match is played, for an honours-board line (null without a date). */
export function matchYear(match: Match | null | undefined): string | null {
  const iso = match?.scheduled_at ?? match?.actual_start_time;
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : String(d.getUTCFullYear());
}
