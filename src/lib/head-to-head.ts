/** The slice of a match the head-to-head view needs. */
export interface MeetingLike {
  id: string;
  status: string | null;
  winning_team_id: string | null;
  scheduled_at: string | null;
}

export interface HeadToHeadSummary<T extends MeetingLike> {
  /** Finished meetings, the latest first. They alone make up the record. */
  completed: T[];
  /** Live and upcoming meetings: live first, then by date. No result yet. */
  open: T[];
  team1Wins: number;
  team2Wins: number;
  /** Ties, no results and anything without a winner. */
  others: number;
  /** The side that won the latest meetings in a row (two or more). */
  streak: { teamId: string; count: number } | null;
}

const IN_PLAY = new Set(["live", "innings_break"]);

function byDate(a: MeetingLike, b: MeetingLike): number {
  return (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "");
}

/**
 * Splits two teams' meetings (`rows`, latest first) into the record, which
 * counts finished matches only, and the matches still to be played or in
 * progress. Abandoned and cancelled matches are in neither.
 */
export function summarizeHeadToHead<T extends MeetingLike>(
  rows: T[],
  team1Id: string,
  team2Id: string,
): HeadToHeadSummary<T> {
  const completed = rows.filter((m) => m.status === "completed");
  const open = rows
    .filter((m) => m.status === "scheduled" || IN_PLAY.has(m.status ?? ""))
    .sort((a, b) => {
      const live =
        Number(IN_PLAY.has(b.status ?? "")) -
        Number(IN_PLAY.has(a.status ?? ""));
      return live || byDate(a, b);
    });
  const team1Wins = completed.filter(
    (m) => m.winning_team_id === team1Id,
  ).length;
  const team2Wins = completed.filter(
    (m) => m.winning_team_id === team2Id,
  ).length;

  const latest = completed[0]?.winning_team_id ?? null;
  let count = 0;
  if (latest) {
    for (const m of completed) {
      if (m.winning_team_id !== latest) break;
      count += 1;
    }
  }
  return {
    completed,
    open,
    team1Wins,
    team2Wins,
    others: completed.length - team1Wins - team2Wins,
    streak: latest && count >= 2 ? { teamId: latest, count } : null,
  };
}
