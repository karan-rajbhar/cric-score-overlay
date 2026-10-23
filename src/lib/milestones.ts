/**
 * A player's milestones (hundreds, fifties, 3 and 5 wicket hauls) and best
 * figures, from the batting and bowling records the player page already
 * holds (its `player_matches` read): no reads of their own.
 *
 * Hat-tricks are not here: they need the order of the deliveries, which
 * only the ball log has.
 */

interface MatchRef {
  id: string;
  title?: string | null;
  scheduled_at?: string | null;
}

export interface MilestoneBatting {
  match_id: string;
  runs_scored: number;
  balls_faced: number;
  is_out: boolean;
  /** The match date (player_matches.match_date). */
  created_at?: string | null;
  match?: MatchRef | null;
}

export interface MilestoneBowling {
  match_id: string;
  wickets_taken: number;
  runs_conceded: number;
  overs_bowled: number;
  created_at?: string | null;
  match?: MatchRef | null;
}

export type MilestoneKind = "hundred" | "fifty" | "five_wickets" | "three_wickets";

export interface Milestone {
  kind: MilestoneKind;
  /** "Hundred", "Fifty", "5 wickets", "3 wickets". */
  label: string;
  /** "104*", "52", "5/23". */
  figure: string;
  /** "(61 balls)", "(4 overs)". */
  detail: string;
  matchId: string;
  matchTitle: string | null;
  date: string | null;
}

export interface BestFigure {
  figure: string;
  detail: string;
  matchId: string;
  matchTitle: string | null;
  date: string | null;
}

export interface PlayerMilestones {
  hundreds: number;
  fifties: number;
  fiveWickets: number;
  threeWickets: number;
  bestBatting: BestFigure | null;
  bestBowling: BestFigure | null;
  /** Newest first. */
  milestones: Milestone[];
}

const LABELS: Record<MilestoneKind, string> = {
  hundred: "Hundred",
  fifty: "Fifty",
  five_wickets: "5 wickets",
  three_wickets: "3 wickets",
};

function dateOf(row: { created_at?: string | null; match?: MatchRef | null }) {
  return row.match?.scheduled_at ?? row.created_at ?? null;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Overs as cricket writes them: 3.4, 4. */
function oversText(overs: number) {
  const text = Number.isInteger(overs) ? String(overs) : overs.toFixed(1);
  return `${text} ${overs === 1 ? "over" : "overs"}`;
}

const battingFigure = (b: MilestoneBatting) =>
  `${b.runs_scored}${b.is_out ? "" : "*"}`;
const bowlingFigure = (b: MilestoneBowling) =>
  `${b.wickets_taken}/${b.runs_conceded}`;

/** Higher runs; on a tie not out, then fewer balls. */
function betterInnings(a: MilestoneBatting, b: MilestoneBatting): boolean {
  if (a.runs_scored !== b.runs_scored) return a.runs_scored > b.runs_scored;
  if (a.is_out !== b.is_out) return !a.is_out;
  return a.balls_faced < b.balls_faced;
}

/** More wickets; on a tie fewer runs, then fewer overs. */
function betterSpell(a: MilestoneBowling, b: MilestoneBowling): boolean {
  if (a.wickets_taken !== b.wickets_taken) {
    return a.wickets_taken > b.wickets_taken;
  }
  if (a.runs_conceded !== b.runs_conceded) {
    return a.runs_conceded < b.runs_conceded;
  }
  return a.overs_bowled < b.overs_bowled;
}

function milestoneOf(
  kind: MilestoneKind,
  figure: string,
  detail: string,
  row: { match_id: string; created_at?: string | null; match?: MatchRef | null },
): Milestone {
  return {
    kind,
    label: LABELS[kind],
    figure,
    detail,
    matchId: row.match_id,
    matchTitle: row.match?.title ?? null,
    date: dateOf(row),
  };
}

const battingKind = (b: MilestoneBatting): MilestoneKind | null =>
  b.runs_scored >= 100 ? "hundred" : b.runs_scored >= 50 ? "fifty" : null;

const bowlingKind = (b: MilestoneBowling): MilestoneKind | null =>
  b.wickets_taken >= 5
    ? "five_wickets"
    : b.wickets_taken >= 3
      ? "three_wickets"
      : null;

function bestOf<T>(rows: readonly T[], better: (a: T, b: T) => boolean): T | null {
  let best: T | null = null;
  for (const row of rows) if (!best || better(row, best)) best = row;
  return best;
}

const ballsDetail = (b: MilestoneBatting) => `(${plural(b.balls_faced, "ball")})`;
const oversDetail = (b: MilestoneBowling) => `(${oversText(b.overs_bowled)})`;

export function playerMilestones(
  batting: readonly MilestoneBatting[],
  bowling: readonly MilestoneBowling[],
): PlayerMilestones {
  const milestones: Milestone[] = [];
  for (const b of batting) {
    const kind = battingKind(b);
    if (kind) milestones.push(milestoneOf(kind, battingFigure(b), ballsDetail(b), b));
  }
  for (const b of bowling) {
    const kind = bowlingKind(b);
    if (kind) milestones.push(milestoneOf(kind, bowlingFigure(b), oversDetail(b), b));
  }
  milestones.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const count = (kind: MilestoneKind) =>
    milestones.filter((m) => m.kind === kind).length;

  const innings = bestOf(batting, betterInnings);
  const spell = bestOf(
    bowling.filter((b) => b.wickets_taken > 0),
    betterSpell,
  );
  const best = (
    row: MilestoneBatting | MilestoneBowling,
    figure: string,
    detail: string,
  ): BestFigure => ({
    figure,
    detail,
    matchId: row.match_id,
    matchTitle: row.match?.title ?? null,
    date: dateOf(row),
  });
  return {
    hundreds: count("hundred"),
    fifties: count("fifty"),
    fiveWickets: count("five_wickets"),
    threeWickets: count("three_wickets"),
    bestBatting:
      innings && innings.runs_scored > 0
        ? best(innings, battingFigure(innings), ballsDetail(innings))
        : null,
    bestBowling: spell ? best(spell, bowlingFigure(spell), oversDetail(spell)) : null,
    milestones,
  };
}
