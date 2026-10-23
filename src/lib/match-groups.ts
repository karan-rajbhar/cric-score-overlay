/**
 * A list of matches split the way fixture pages show them: live, upcoming,
 * results, and no result (abandoned or cancelled: they count in the points
 * table's NR column, so they stay listed with their reason).
 */
export function matchGroupsOf<T extends { status: string | null }>(
  matches: readonly T[],
) {
  return {
    live: matches.filter((m) => m.status === "live"),
    upcoming: matches.filter((m) => m.status === "scheduled"),
    results: matches.filter((m) => m.status === "completed"),
    noResult: matches.filter(
      (m) => m.status === "abandoned" || m.status === "cancelled",
    ),
  };
}
