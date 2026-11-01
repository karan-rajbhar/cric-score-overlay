/**
 * Who has a part in a match and what they did there, from the match as
 * the pages hold it (no reads): for "Replace a player", which lists them
 * and says what moves to the player who really played.
 */
import type { Match } from "~/lib/match-types";

export interface MatchPart {
  id: string;
  name: string;
  username: string | null;
  /** The team they played for. */
  teamId: string;
  teamName: string;
  batted: boolean;
  runs: number;
  balls: number;
  out: boolean;
  bowled: boolean;
  wickets: number;
  runsConceded: number;
  catches: number;
  stumpings: number;
  runOuts: number;
}

type MatchLike = Pick<Match, "team1_id" | "team2_id" | "team1" | "team2" | "innings">;

/** The other team of the match. */
function opponent(match: MatchLike, teamId: string): string {
  return teamId === match.team1_id ? match.team2_id : match.team1_id;
}

/**
 * Everyone with a part in the match (batted, bowled, or took a catch,
 * stumping or run-out), in the order they first appear, with their figures
 * across its innings. Names come from the squads, else the scorecard.
 */
export function matchParts(match: MatchLike): MatchPart[] {
  const teamName = (id: string) =>
    id === match.team1_id ? match.team1.name : match.team2.name;
  const names = new Map<string, string>();
  const usernames = new Map<string, string>();
  for (const team of [match.team1, match.team2]) {
    for (const tp of team.team_players ?? []) {
      if (tp.user?.full_name) names.set(tp.user_id, tp.user.full_name);
      if (tp.user?.username) usernames.set(tp.user_id, tp.user.username);
    }
  }
  const parts = new Map<string, MatchPart>();
  const partOf = (id: string, teamId: string, name?: string | null) => {
    let p = parts.get(id);
    if (!p) {
      p = {
        id,
        name: names.get(id) ?? name ?? "Player",
        username: usernames.get(id) ?? null,
        teamId,
        teamName: teamName(teamId),
        batted: false,
        runs: 0,
        balls: 0,
        out: false,
        bowled: false,
        wickets: 0,
        runsConceded: 0,
        catches: 0,
        stumpings: 0,
        runOuts: 0,
      };
      parts.set(id, p);
    }
    return p;
  };
  const innings = [...(match.innings ?? [])].sort(
    (a, b) => a.innings_number - b.innings_number,
  );
  for (const inn of innings) {
    const fielding = opponent(match, inn.team_id);
    for (const b of inn.batting_performances ?? []) {
      const p = partOf(b.user_id, inn.team_id, b.user?.full_name);
      p.batted = true;
      p.runs += b.runs_scored ?? 0;
      p.balls += b.balls_faced ?? 0;
      p.out ||= Boolean(b.is_out);
    }
    for (const b of inn.bowling_performances ?? []) {
      const p = partOf(b.user_id, fielding, b.user?.full_name);
      p.bowled = true;
      p.wickets += b.wickets_taken ?? 0;
      p.runsConceded += b.runs_conceded ?? 0;
    }
    for (const f of inn.fall_of_wickets ?? []) {
      if (!f.fielder_id) continue;
      const p = partOf(f.fielder_id, fielding);
      if (f.dismissal_type === "caught") p.catches += 1;
      else if (f.dismissal_type === "stumped") p.stumpings += 1;
      else if (f.dismissal_type === "run_out") p.runOuts += 1;
    }
  }
  return [...parts.values()];
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** Their figures in a few characters, for a list: "34 (22) · 2/18 · 1 ct". */
export function partFigures(p: MatchPart): string {
  const bits: string[] = [];
  if (p.batted) bits.push(`${p.runs}${p.out ? "" : "*"} (${p.balls})`);
  if (p.bowled) bits.push(`${p.wickets}/${p.runsConceded}`);
  if (p.catches) bits.push(`${p.catches} ct`);
  if (p.stumpings) bits.push(`${p.stumpings} st`);
  if (p.runOuts) bits.push(`${p.runOuts} ro`);
  return bits.join(" · ");
}

/** What moves with them, in words: "34 runs, 2 wickets and 1 catch". */
export function partInWords(p: MatchPart): string {
  const bits: string[] = [];
  if (p.batted) bits.push(plural(p.runs, "run", "runs"));
  if (p.bowled) bits.push(plural(p.wickets, "wicket", "wickets"));
  if (p.catches) bits.push(plural(p.catches, "catch", "catches"));
  if (p.stumpings) bits.push(plural(p.stumpings, "stumping", "stumpings"));
  if (p.runOuts) bits.push(plural(p.runOuts, "run-out", "run-outs"));
  if (bits.length <= 1) return bits[0] ?? "everything they did";
  return `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}`;
}
