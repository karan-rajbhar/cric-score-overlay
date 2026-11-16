import "server-only";
import { getAdminFirestore } from "./firebase/admin";
import { AdminDataSource } from "./firebase/datasource-admin";
import type { DataSource, Doc } from "./firebase/datasource";
import { parsePlayerRef, playerLookup } from "./player-ref";

/*
 * What a player's and a team's link preview images show, read on the
 * server without a session (the crawler has none). Fetched only when a
 * link is shared, never with a page view. Null for anything missing or
 * unreadable, so a preview never breaks.
 */

export interface SharePlayer {
  user: Doc;
  /** `player_career_stats/{userId}`, when they have figures. */
  stats: Doc | null;
}

/** The player named like the page's URL (`@handle` or id): 2 reads. */
export async function loadSharePlayer(
  rawId: string,
  ds?: DataSource,
): Promise<SharePlayer | null> {
  const ref = parsePlayerRef(rawId);
  if (!ref) return null;
  try {
    const source = ds ?? new AdminDataSource(getAdminFirestore());
    const { column, value } = playerLookup(ref);
    const user =
      column === "id"
        ? await source.getById("users", value)
        : ((await source.query("users", [{ field: "username", op: "==", value }], {
            limit: 1,
          }))[0] ?? null);
    if (!user) return null;
    const stats = await source.getById("player_career_stats", String(user.id));
    return { user, stats };
  } catch (err) {
    console.error("loadSharePlayer failed:", err);
    return null;
  }
}

export interface ShareTeam {
  team: Doc;
  clubName: string | null;
}

/** A team and its club's name: 1 or 2 reads (the roster is on the team). */
export async function loadShareTeam(
  teamId: string,
  ds?: DataSource,
): Promise<ShareTeam | null> {
  if (!teamId || teamId.includes("/") || teamId.length > 128) return null;
  try {
    const source = ds ?? new AdminDataSource(getAdminFirestore());
    const team = await source.getById("teams", teamId);
    if (!team) return null;
    const club = team.club_id
      ? await source.getById("clubs", String(team.club_id))
      : null;
    return { team, clubName: club ? String(club.name ?? "") || null : null };
  } catch (err) {
    console.error("loadShareTeam failed:", err);
    return null;
  }
}
