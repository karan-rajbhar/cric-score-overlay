/**
 * The match's over / ball position (`current_over`, `current_ball`).
 *
 * It is derived from the current innings' legal balls, so a delivery does
 * not have to rewrite the match document: `matches.current_over` /
 * `current_ball` are legacy copies that are no longer kept in step. Every
 * reader that shows the position goes through these helpers (server and
 * browser).
 */

interface PositionMatch {
  balls_per_over?: number | null;
  current_innings?: number | null;
  current_over?: number | null;
  current_ball?: number | null;
}

interface PositionInnings {
  innings_number: number;
  total_balls?: number | null;
}

export interface MatchPosition {
  current_over: number;
  current_ball: number;
}

/** Over / ball reached after `totalBalls` legal deliveries. */
export function positionOf(
  totalBalls: number | null | undefined,
  ballsPerOver: number | null | undefined,
): MatchPosition {
  const bpo = ballsPerOver && ballsPerOver > 0 ? ballsPerOver : 6;
  const legal = totalBalls ?? 0;
  return { current_over: Math.floor(legal / bpo), current_ball: legal % bpo };
}

/**
 * The position of `match`: from `innings` (its current innings) when it is
 * known, else the stored copies (a match that has not started).
 */
export function matchPositionOf(
  match: PositionMatch,
  innings: PositionInnings | null | undefined,
): MatchPosition {
  if (innings) return positionOf(innings.total_balls, match.balls_per_over);
  return {
    current_over: match.current_over ?? 0,
    current_ball: match.current_ball ?? 0,
  };
}

/**
 * `match` with `current_over` / `current_ball` derived from its embedded
 * `innings` (the current one), as every response that exposes them returns
 * it. Unchanged when the current innings is not embedded.
 */
export function withMatchPosition<M extends object>(match: M): M {
  const m = match as PositionMatch & { innings?: PositionInnings[] | null };
  const current = Array.isArray(m.innings)
    ? m.innings.find((i) => i.innings_number === (m.current_innings ?? 1))
    : undefined;
  if (!current) return match;
  const pos = positionOf(current.total_balls, m.balls_per_over);
  if (
    m.current_over === pos.current_over &&
    m.current_ball === pos.current_ball
  ) {
    return match;
  }
  return { ...match, ...pos };
}
