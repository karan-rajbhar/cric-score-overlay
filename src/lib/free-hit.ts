/**
 * Free hits on the scoring screen. Not a Law of Cricket but a playing
 * condition many competitions use, so each match says whether it applies
 * (`matches.free_hit`; null or absent: on, as before the setting existed).
 */

interface LoggedBall {
  extra_type?: string | null;
  is_wicket?: boolean | null;
  dismissal_type?: string | null;
}

/** Whether the match plays free hits (on unless switched off). */
export function freeHitsOn(match: { free_hit?: boolean | null } | null) {
  return match?.free_hit !== false;
}

/** A log entry between balls: a retirement or runs awarded. */
function isEvent(b: LoggedBall): boolean {
  if (
    b.is_wicket &&
    (b.dismissal_type === "retired_hurt" || b.dismissal_type === "retired_out")
  ) {
    return true;
  }
  return b.extra_type === "penalty" || b.extra_type === "bonus";
}

/**
 * Whether the next delivery is a free hit, from this over's log in order:
 * the ball after a no-ball is one, and it stays one while that ball is a
 * wide or another no-ball. Events between balls change nothing.
 */
export function nextIsFreeHit(
  balls: readonly LoggedBall[],
  enabled = true,
): boolean {
  if (!enabled) return false;
  let free = false;
  for (const b of balls) {
    if (isEvent(b)) continue;
    if (b.extra_type === "no_ball") free = true;
    else if (b.extra_type !== "wide") free = false;
  }
  return free;
}
