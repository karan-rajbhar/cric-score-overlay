/**
 * Finds existing players for every "add a player" box (the stable route
 * `GET /api/players/search`).
 *
 * `@name` means a username: the exact handle is looked up first (1 read)
 * and listed first, so a handle that is also a common first name is not
 * lost among everyone called that. Handles starting with it come next.
 */

import type { FoundPlayer, PlayerSearchResult } from "~/lib/player-search";
import { typedHandle } from "~/lib/player-search";
import type { QueryBuilder } from "./query-builder";
import { prefixSearch } from "./search";
import type { TableName } from "./types";

/**
 * Profiles a search reads. More than a box shows: the people each box
 * leaves out (its own squad, listed already) must not crowd out the one
 * being looked for.
 */
export const PLAYER_SEARCH_LIMIT = 15;

const PLAYER_FIELDS = "id, full_name, username";

interface SearchClient {
  from<T extends TableName>(table: T): QueryBuilder<T>;
}

type Profile = {
  id: string;
  full_name: string | null;
  username?: string | null;
};

/** The exact handle first, then handles starting with it, then the rest. */
function byHandle(rows: Profile[], handle: string): Profile[] {
  const rank = (p: Profile) =>
    p.username === handle ? 0 : p.username?.startsWith(handle) ? 1 : 2;
  return [...rows].sort((a, b) => rank(a) - rank(b));
}

/** Who of `ids` belongs to the club (one read per member found). */
async function clubMembersOf(
  db: SearchClient,
  clubId: string,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data } = await db
    .from("club_memberships")
    .select("user_id")
    .eq("club_id", clubId)
    .in("user_id", ids);
  return new Set(((data ?? []) as { user_id: string }[]).map((m) => m.user_id));
}

export async function searchPlayers(
  db: SearchClient,
  query: string,
  /** The club of the match or team being added to: its members come first. */
  { clubId }: { clubId?: string | null } = {},
): Promise<{ data: PlayerSearchResult | null; error: string | null }> {
  const { data, error } = await prefixSearch(
    db,
    "users",
    query,
    PLAYER_FIELDS,
    PLAYER_SEARCH_LIMIT,
    { everyMatch: true },
  );
  if (error) return { data: null, error };

  let rows = data as Profile[];
  const more = rows.length >= PLAYER_SEARCH_LIMIT;

  const handle = typedHandle(query);
  if (handle) {
    const exact = await db
      .from("users")
      .select(PLAYER_FIELDS)
      .eq("username", handle)
      .limit(1);
    if (exact.error) return { data: null, error: exact.error.message };
    const owner = ((exact.data ?? []) as Profile[]).filter(
      (p) => !rows.some((r) => r.id === p.id),
    );
    rows = byHandle([...owner, ...rows], handle);
  }

  // How many matches each has played (one batched read of their career
  // docs), so two players of the same name can be told apart.
  const { data: careers } = rows.length
    ? await db
        .from("player_career_stats")
        .select("id, total_matches")
        .in(
          "id",
          rows.map((u) => u.id),
        )
    : { data: [] };
  const matches = new Map(
    ((careers ?? []) as { id: string; total_matches: number | null }[]).map(
      (c) => [c.id, c.total_matches ?? 0],
    ),
  );
  const members = clubId
    ? await clubMembersOf(
        db,
        clubId,
        rows.map((u) => u.id),
      )
    : new Set<string>();
  const players: FoundPlayer[] = rows.map((u) => ({
    id: u.id,
    name: u.full_name ?? "Player",
    username: u.username ?? null,
    matches: matches.get(u.id) ?? 0,
    clubMember: members.has(u.id),
  }));
  // Members first, keeping the name and username order within each group.
  const ranked = [
    ...players.filter((p) => p.clubMember),
    ...players.filter((p) => !p.clubMember),
  ];
  return { data: { players: ranked, more }, error: null };
}
