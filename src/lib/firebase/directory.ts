/**
 * Player display names from team rosters (`teams.roster`, see derive.mjs):
 * one read per team instead of one per player, falling back to the
 * profiles of players who are on none of the given teams.
 */

import type { QueryBuilder } from "./query-builder";
import type { RosterEntry, TableName } from "./types";

export interface DirectoryUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface DirectoryClient {
  from<T extends TableName>(table: T): QueryBuilder<T>;
}

export async function playerDirectory(
  db: DirectoryClient,
  teamIds: Iterable<string | null | undefined>,
  userIds: Iterable<string | null | undefined>,
): Promise<Map<string, DirectoryUser>> {
  const out = new Map<string, DirectoryUser>();
  const teams = Array.from(new Set(teamIds)).filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
  if (teams.length) {
    const { data } = await db
      .from("teams")
      .select("id, roster")
      .in("id", teams);
    for (const team of (data ?? []) as { roster?: RosterEntry[] | null }[]) {
      for (const entry of team.roster ?? []) {
        const u = entry.user;
        if (u?.id) {
          out.set(u.id, {
            id: u.id,
            full_name: u.full_name ?? null,
            avatar_url: u.avatar_url ?? null,
          });
        }
      }
    }
  }
  const missing = Array.from(new Set(userIds)).filter(
    (id): id is string => typeof id === "string" && !!id && !out.has(id),
  );
  if (missing.length) {
    const { data } = await db
      .from("users")
      .select("id, full_name, avatar_url")
      .in("id", missing);
    for (const u of (data ?? []) as DirectoryUser[]) out.set(u.id, u);
  }
  return out;
}
