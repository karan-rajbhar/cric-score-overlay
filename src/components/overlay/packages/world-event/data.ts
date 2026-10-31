/**
 * World event's figures, all derived from what an element is given (the
 * live row, the match, its innings): nothing is read and nothing is made
 * up. A helper with nothing to work from answers null.
 */

import { formatDismissalType, isCaughtAndBowled } from "~/lib/cricket";
import type {
  BattingPerformance,
  Innings,
  Match,
  MatchTeam,
  TeamPlayer,
} from "~/lib/match-types";
import { battingSide, teamCode } from "../../overlay-kit";
import type { ChaseLine } from "../shared/derive";
import { sidesOf } from "../../score-bug";
import type { LiveMatchState } from "../../types";

export interface SideInfo {
  /** Team 1 or team 2 (colours follow the side, not the innings). */
  n: 1 | 2;
  name: string;
  code: string;
  logo: string | null;
}

/** Team 1 and team 2 as the live row names them. */
export function teamsOf(state: LiveMatchState): [SideInfo, SideInfo] {
  return [
    {
      n: 1,
      name: state.team1_name ?? "",
      code: teamCode(state.team1_short_name, state.team1_name),
      logo: state.team1_logo_url ?? null,
    },
    {
      n: 2,
      name: state.team2_name ?? "",
      code: teamCode(state.team2_short_name, state.team2_name),
      logo: state.team2_logo_url ?? null,
    },
  ];
}

/** The batting side and the fielding side (team 1 first when unknown). */
export function battingAndBowling(state: LiveMatchState): {
  bat: SideInfo;
  bowl: SideInfo;
} {
  const [t1, t2] = teamsOf(state);
  const side = battingSide(state);
  const { batting, bowling } = sidesOf(state);
  const bat = side === 2 ? t2 : t1;
  const bowl = side === 2 ? t1 : t2;
  return {
    bat: {
      ...bat,
      name: batting.name ?? bat.name,
      code: teamCode(batting.short, batting.name) || bat.code,
    },
    bowl: {
      ...bowl,
      name: bowling.name ?? bowl.name,
      code: teamCode(bowling.short, bowling.name) || bowl.code,
    },
  };
}

/** The side (1 / 2) a team name belongs to; null when it is neither. */
export function sideOfName(
  state: LiveMatchState,
  name: string | null | undefined,
): 1 | 2 | null {
  if (!name) return null;
  if (name === state.team1_name) return 1;
  if (name === state.team2_name) return 2;
  return null;
}

/** The side that batted in `innings` (by team id, else by name). */
export function sideOfInnings(
  state: LiveMatchState,
  innings: Innings,
  match: Match | null | undefined,
): 1 | 2 {
  if (match?.team1_id && innings.team_id === match.team1_id) return 1;
  if (match?.team2_id && innings.team_id === match.team2_id) return 2;
  const current = innings.innings_number === state.innings_number;
  const name = current ? state.batting_team_name : state.bowling_team_name;
  return sideOfName(state, name) ?? (innings.innings_number % 2 === 1 ? 1 : 2);
}

export const fixed2 = (n: number | null | undefined): string | null =>
  n === null || n === undefined || !Number.isFinite(n) ? null : n.toFixed(2);

/**
 * Where the chasing side finishes at its current rate (whole runs), from
 * the shared chase line; null before a ball.
 */
export function finishAtCurrentRate(state: LiveMatchState, chase: ChaseLine | null): number | null {
  if (!chase || chase.currentRate === null || !state.total_balls) return null;
  return Math.round((state.total_runs ?? 0) + (chase.currentRate * chase.ballsRemaining) / 6);
}

/** 1 → "1st", 2 → "2nd", 11 → "11th". */
export function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? "th"}`;
}

/** Someone's name from an innings' bowling or batting rows. */
function nameIn(innings: Innings, id: string | null | undefined): string | null {
  if (!id) return null;
  return (
    innings.bowling_performances?.find((b) => b.user_id === id)?.user
      ?.full_name ??
    innings.batting_performances?.find((b) => b.user_id === id)?.user
      ?.full_name ??
    null
  );
}

/** A surname for dismissals: "Owen Hughes" → "Hughes". */
export function surnameOf(full: string | null | undefined): string {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(" ") : (parts[0] ?? "");
}

/**
 * How a batter was out, scorecard style ("c Price b Hughes", "lbw b
 * Hughes", "run out (Moss)"), from the fall of wickets; "not out" while in.
 */
export function dismissalText(
  batter: BattingPerformance,
  innings: Innings,
): string {
  if (!batter.is_out) {
    return batter.dismissal_type === "retired_hurt" ? "retired hurt" : "not out";
  }
  const fow = innings.fall_of_wickets?.find(
    (f) => f.batsman_out_id === batter.user_id,
  );
  const type = batter.dismissal_type ?? fow?.dismissal_type ?? null;
  const bowler = surnameOf(fow?.bowler?.full_name ?? nameIn(innings, fow?.bowler_id));
  const fielder = surnameOf(
    fow?.fielder?.full_name ?? nameIn(innings, fow?.fielder_id),
  );
  const b = bowler ? `b ${bowler}` : "";
  switch (type) {
    case "bowled":
      return b || "bowled";
    case "lbw":
      return bowler ? `lbw ${b}` : "lbw";
    case "caught":
      if (bowler && isCaughtAndBowled(type, fow?.fielder_id, fow?.bowler_id))
        return `c & ${b}`;
      if (fielder) return `c ${fielder} ${b}`.trim();
      return bowler ? `caught, ${b}` : "caught";
    case "stumped":
      return fielder ? `st ${fielder} ${b}`.trim() : bowler ? `stumped, ${b}` : "stumped";
    case "run_out":
      return fielder ? `run out (${fielder})` : "run out";
    case "hit_wicket":
      return bowler ? `hit wicket ${b}` : "hit wicket";
    default:
      return formatDismissalType(type).toLowerCase();
  }
}

/** Squad roles that are marks, not playing roles. */
const MARK_ROLES = new Set(["captain", "vice_captain", "wicket_keeper", "player"]);

export interface XiEntry {
  id: string;
  userId: string;
  name: string;
  /** "(c)", "(wk)", "(c, wk)" or "". */
  mark: string;
  /** "Batter", "All-rounder"... when the squad records one. */
  role: string | null;
}

/** A team's playing XI in batting order, with captain / keeper marks. */
export function xiOf(team: MatchTeam | null | undefined): XiEntry[] {
  const players: TeamPlayer[] = (team?.team_players ?? [])
    .filter((p) => p.is_playing_xi === true)
    .sort(
      (a, b) =>
        (a.batting_order ?? Number.MAX_SAFE_INTEGER) -
        (b.batting_order ?? Number.MAX_SAFE_INTEGER),
    );
  return players.map((p) => {
    const role = p.role_in_team ?? null;
    const captain = role === "captain" || (!!team?.captain_id && team.captain_id === p.user_id);
    const keeper = role === "wicket_keeper";
    const mark = captain && keeper ? "(c, wk)" : captain ? "(c)" : keeper ? "(wk)" : "";
    const label =
      role && !MARK_ROLES.has(role)
        ? role.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
        : keeper
          ? "Wicketkeeper"
          : null;
    return { id: p.id, userId: p.user_id, name: p.user?.full_name ?? "", mark, role: label };
  });
}

/** The main innings (1 and 2) in order. */
export function mainInnings(innings: Innings[]): Innings[] {
  return [...innings]
    .filter((i) => i.innings_number <= 2)
    .sort((a, b) => a.innings_number - b.innings_number);
}

/** The side that won, by name (null for a tie or no result). */
export function winnerSide(state: LiveMatchState): 1 | 2 | null {
  return sideOfName(state, state.winning_team_name);
}

/** A name as the score bug sets it: "Arjun Mehta" → "A Mehta". */
export function bugName(full: string | null | undefined): string {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]![0]} ${parts.slice(1).join(" ")}`;
}

/** "142-4": the world feed's runs-wickets. */
export const scoreText = (runs: number | null | undefined, wickets: number | null | undefined) =>
  `${runs ?? 0}-${wickets ?? 0}`;

/** The match's own title ("Final"), without the tournament name it repeats. */
export function matchTitleOf(state: LiveMatchState): string | null {
  const title = state.title?.trim();
  const event = state.tournament_name?.trim();
  if (!title || title === event) return null;
  if (event && title.toLowerCase().startsWith(event.toLowerCase())) {
    return title.slice(event.length).replace(/^[\s·:,\-–]+/, "").trim() || null;
  }
  return title;
}
