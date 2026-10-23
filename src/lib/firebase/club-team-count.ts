/**
 * `clubs.team_count`: how many teams a club has, so the clubs list reads
 * one document per club instead of also counting its teams. Recounted
 * (one count() read) by the server write hook whenever a team is created
 * or deleted or moves club; `scripts/migrate-club-team-counts.mjs`
 * backfilled the clubs that predate it, and readers count the teams of a
 * club that has none (`withTeamCounts` on the clubs page).
 */

import type { DataSource } from "./datasource";
import type { WriteEvent } from "./query-builder";

/** The clubs whose team count a write to `teams` may have changed. */
export function clubsAffectedBy(event: WriteEvent): string[] {
  if (event.table !== "teams") return [];
  const before = event.before?.club_id;
  const after = event.after?.club_id;
  if (event.op === "update" && before === after) return [];
  return [...new Set([before, after])].filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
}

/** Server write hook. Never throws; a failed recount is logged. */
export async function syncClubTeamCounts(
  ds: DataSource,
  event: WriteEvent,
): Promise<void> {
  for (const clubId of clubsAffectedBy(event)) {
    try {
      const club = await ds.getById("clubs", clubId);
      if (!club) continue;
      const count = await ds.count("teams", [
        { field: "club_id", op: "==", value: clubId },
      ]);
      if (club.team_count !== count) {
        await ds.update("clubs", clubId, { team_count: count });
      }
    } catch (err) {
      console.error("syncClubTeamCounts failed:", err);
    }
  }
}
