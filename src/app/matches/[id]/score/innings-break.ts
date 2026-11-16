/**
 * Whether the scoring screen is between innings: the next innings is open
 * with no ball bowled and no batters in, and its openers have not been asked
 * for (`startedInningsId`: the innings the scorer started from the break
 * card). The screen then shows the innings-break card instead of opening the
 * openers dialog by itself, so the scorer can agree the total, check the
 * scorecard or undo a wrong last ball first.
 */
export function isAtInningsBreak(input: {
  status: string | null | undefined;
  innings: { id: string; innings_number: number; total_balls?: number | null } | null | undefined;
  strikerId: string | null | undefined;
  nonStrikerId: string | null | undefined;
  startedInningsId: string | null;
}): boolean {
  const { status, innings, strikerId, nonStrikerId, startedInningsId } = input;
  return (
    status === "live" &&
    Boolean(innings) &&
    (innings?.innings_number ?? 1) >= 2 &&
    (innings?.total_balls ?? 0) === 0 &&
    !strikerId &&
    !nonStrikerId &&
    startedInningsId !== innings?.id
  );
}
