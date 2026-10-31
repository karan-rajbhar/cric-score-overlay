import { formatDecimalOvers } from "~/lib/cricket";
import type { FallOfWicket } from "~/lib/match-types";

/** How one wicket fell, in the words of the scorecard's dropdown. */
export interface DismissalDetail {
  /** "4.4": the ball the wicket fell on. */
  over: string;
  /** "Jacob Duffy to Sanju Samson". */
  headline: string;
  /** "Out, caught by Glenn Phillips". */
  outcome: string;
  /** "40/1 · wicket 1". */
  score: string;
}

/** How each type reads, given who held the catch / stumping / run out. */
const HOW_OUT: Record<string, (fielder: string | null, cb: boolean) => string> =
  {
    bowled: () => "bowled",
    lbw: () => "LBW",
    caught: (f, cb) =>
      cb ? "caught and bowled" : f ? `caught by ${f}` : "caught",
    stumped: (f) => (f ? `stumped by ${f}` : "stumped"),
    run_out: (f) => (f ? `run out (${f})` : "run out"),
  };

/** The how-out clause: "caught by X", "bowled", "run out (X)". */
export function howOut(
  type: string | null | undefined,
  fielder: string | null,
  caughtAndBowled: boolean,
): string {
  const key = type ?? "bowled";
  return HOW_OUT[key]?.(fielder, caughtAndBowled) ?? key.replace(/_/g, " ");
}

/**
 * What the fall-of-wickets entry says about a dismissal: the ball, who
 * bowled to whom, how the batter went and the score at the time. Everything
 * is already on the innings, so opening it costs no read.
 */
export function dismissalDetailOf(
  batterName: string,
  entry: FallOfWicket | undefined,
  type?: string | null,
): DismissalDetail | null {
  if (!entry) return null;
  const bowler = entry.bowler?.full_name ?? null;
  const fielder = entry.fielder?.full_name ?? null;
  const fielderIsBowler =
    Boolean(entry.fielder_id) && entry.fielder_id === entry.bowler_id;
  const how = howOut(type ?? entry.dismissal_type, fielder, fielderIsBowler);
  return {
    over: formatDecimalOvers(entry.overs_at_fall),
    headline: bowler ? `${bowler} to ${batterName}` : batterName,
    outcome: `Out, ${how}`,
    score: `${entry.runs_at_fall}/${entry.wicket_number} · wicket ${entry.wicket_number}`,
  };
}
