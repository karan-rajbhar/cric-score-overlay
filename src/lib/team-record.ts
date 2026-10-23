/**
 * A team's record from its matches. Played counts finished matches only
 * (completed, abandoned or cancelled; not upcoming or live ones), so it
 * adds up: won + lost + tied or no result. Win rate leaves out the matches
 * with no winner.
 */
export function teamRecordOf(
  matches: readonly { status: string; winning_team_id?: string | null }[],
  teamId: string,
) {
  const finished = matches.filter(
    (m) =>
      m.status === "completed" ||
      m.status === "abandoned" ||
      m.status === "cancelled",
  );
  const won = finished.filter((m) => m.winning_team_id === teamId).length;
  const lost = finished.filter(
    (m) => !!m.winning_team_id && m.winning_team_id !== teamId,
  ).length;
  const noWinner = finished.length - won - lost;
  const decided = won + lost;
  return {
    played: finished.length,
    won,
    lost,
    /** Tied, abandoned or no result. */
    noWinner,
    /** Of the matches with a winner; null before any. */
    winRate: decided > 0 ? Math.round((won / decided) * 100) : null,
  };
}

/** Match statuses that count as played (see {@link teamRecordOf}). */
export const FINISHED_STATUSES = ["completed", "abandoned", "cancelled"];

/**
 * {@link teamRecordOf} from counts (the team page counts its matches
 * instead of reading them all): finished matches, those this team won and
 * those with any winner.
 */
export function teamRecordFromCounts(counts: {
  played: number;
  won: number;
  decided: number;
}) {
  const { played, won, decided } = counts;
  const lost = decided - won;
  return {
    played,
    won,
    lost,
    noWinner: played - won - lost,
    winRate: decided > 0 ? Math.round((won / decided) * 100) : null,
  };
}
