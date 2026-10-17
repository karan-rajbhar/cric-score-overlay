/**
 * Shared rules for deleting a match (browser and server): the name the
 * user types to confirm, and where to go afterwards.
 */

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** The text a user types to confirm: the match title (or "delete"). */
export function deleteConfirmName(title: string | null | undefined): string {
  return title?.trim() || "delete";
}

/** Whether `typed` confirms deleting a match titled `title` (case-insensitive, trimmed). */
export function confirmsMatchDelete(
  typed: string | null | undefined,
  title: string | null | undefined,
): boolean {
  return normalize(typed) === normalize(deleteConfirmName(title));
}

/** Where to land after deleting: the tournament, else the club, else all matches. */
export function afterDeleteHref(match: {
  tournament_id?: string | null;
  club_id?: string | null;
}): string {
  if (match.tournament_id) return `/tournaments/${match.tournament_id}`;
  if (match.club_id) return `/clubs/${match.club_id}`;
  return "/matches";
}
