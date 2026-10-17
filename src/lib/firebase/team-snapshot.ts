/**
 * Denormalized team display fields on matches (`team1_snapshot`,
 * `team2_snapshot`), so match lists cost one read per match instead of also
 * reading both teams.
 *
 * - Written when a match is created (callers pass `matchTeamSnapshots`; the
 *   server write hook fills any that are missing).
 * - Refreshed by the server write hook whenever a team's name, short name
 *   or logo changes, or a match's team ids change.
 * - Readers call {@link attachMatchTeams}, which uses the snapshot and only
 *   reads `teams` for matches that predate it.
 */

import type { DataSource } from "./datasource";
import type { QueryBuilder, WriteEvent } from "./query-builder";
import type { MatchesRow, TeamSnapshot, TeamsRow } from "./types";

/** Team fields copied onto matches. */
export const SNAPSHOT_FIELDS = ["name", "short_name", "logo_url"] as const;

export function teamSnapshot(
  team: Pick<TeamsRow, "id" | "name"> &
    Partial<Pick<TeamsRow, "short_name" | "logo_url">>,
): TeamSnapshot {
  return {
    id: team.id,
    name: team.name,
    short_name: team.short_name ?? null,
    logo_url: team.logo_url ?? null,
  };
}

function sameSnapshot(
  a: TeamSnapshot | null | undefined,
  b: TeamSnapshot,
): boolean {
  return (
    !!a &&
    a.id === b.id &&
    a.name === b.name &&
    (a.short_name ?? null) === b.short_name &&
    (a.logo_url ?? null) === b.logo_url
  );
}

/** `{ team1_snapshot, team2_snapshot }` for a new match (2 reads, batched). */
export async function matchTeamSnapshots(
  ds: DataSource,
  team1Id: string | null | undefined,
  team2Id: string | null | undefined,
): Promise<{
  team1_snapshot: TeamSnapshot | null;
  team2_snapshot: TeamSnapshot | null;
}> {
  const ids = [team1Id, team2Id].filter((id): id is string => !!id);
  const teams = ids.length
    ? ((await ds.getByIds("teams", ids)) as unknown as TeamsRow[])
    : [];
  const byId = new Map(teams.map((t) => [t.id, teamSnapshot(t)]));
  return {
    team1_snapshot: (team1Id && byId.get(team1Id)) || null,
    team2_snapshot: (team2Id && byId.get(team2Id)) || null,
  };
}

/**
 * Rewrites the snapshot of `team` on every match that plays it (2 indexed
 * queries, one write per match whose copy is out of date).
 */
export async function refreshTeamSnapshots(
  ds: DataSource,
  team: TeamsRow,
): Promise<number> {
  const snap = teamSnapshot(team);
  let writes = 0;
  for (const side of ["team1", "team2"] as const) {
    const matches = (await ds.query("matches", [
      { field: `${side}_id`, op: "==", value: team.id },
    ])) as unknown as MatchesRow[];
    for (const match of matches) {
      if (sameSnapshot(match[`${side}_snapshot`], snap)) continue;
      await ds.update("matches", match.id, { [`${side}_snapshot`]: snap });
      writes += 1;
    }
  }
  return writes;
}

/**
 * Server write hook: keeps snapshots in step with team and match writes.
 * Never throws; a failure leaves the old snapshot (readers still work).
 */
export async function syncTeamSnapshots(
  ds: DataSource,
  event: WriteEvent,
): Promise<void> {
  try {
    const { table, before, after } = event;
    if (!after) return;
    if (table === "teams" && event.op !== "insert" && before) {
      const changed = SNAPSHOT_FIELDS.some(
        (f) => (before[f] ?? null) !== (after[f] ?? null),
      );
      if (changed) await refreshTeamSnapshots(ds, after as unknown as TeamsRow);
      return;
    }
    if (table !== "matches") return;
    // New match without snapshots, or its teams changed. Old matches heal
    // on their next builder write too.
    const match = after as unknown as MatchesRow;
    const need1 =
      !!match.team1_id && match.team1_snapshot?.id !== match.team1_id;
    const need2 =
      !!match.team2_id && match.team2_snapshot?.id !== match.team2_id;
    if (!need1 && !need2) return;
    const snaps = await matchTeamSnapshots(
      ds,
      need1 ? match.team1_id : null,
      need2 ? match.team2_id : null,
    );
    const patch: Record<string, unknown> = {};
    if (snaps.team1_snapshot) patch.team1_snapshot = snaps.team1_snapshot;
    if (snaps.team2_snapshot) patch.team2_snapshot = snaps.team2_snapshot;
    if (Object.keys(patch).length) await ds.update("matches", match.id, patch);
  } catch (err) {
    console.error("syncTeamSnapshots failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Read side
// ---------------------------------------------------------------------------

export type MatchTeamFields = {
  id?: string;
  team1_id?: string | null;
  team2_id?: string | null;
  team1_snapshot?: TeamSnapshot | null;
  team2_snapshot?: TeamSnapshot | null;
  team1?: unknown;
  team2?: unknown;
};

interface TeamsClient {
  from(table: "teams"): QueryBuilder<"teams">;
}

/** The columns a list query must select for {@link attachMatchTeams}. */
export const MATCH_TEAM_COLUMNS =
  "team1_id, team2_id, team1_snapshot, team2_snapshot";

/**
 * Sets `team1` / `team2` ({ id, name, short_name, logo_url }) on each match
 * from its snapshot. Matches without one (created before snapshots) fall
 * back to one batched `teams` read, so nothing breaks before migration.
 * Mutates and returns `rows`.
 */
export async function attachMatchTeams<T extends MatchTeamFields>(
  db: TeamsClient,
  rows: T[],
): Promise<T[]> {
  const missing = new Set<string>();
  for (const row of rows) {
    if (!row) continue;
    if (!row.team1_snapshot && row.team1_id) missing.add(row.team1_id);
    if (!row.team2_snapshot && row.team2_id) missing.add(row.team2_id);
  }
  const fetched = new Map<string, TeamSnapshot>();
  if (missing.size) {
    const { data } = await db
      .from("teams")
      .select("id, name, short_name, logo_url")
      .in("id", Array.from(missing));
    for (const team of (data ?? []) as TeamsRow[]) {
      fetched.set(team.id, teamSnapshot(team));
    }
  }
  for (const row of rows) {
    if (!row) continue;
    row.team1 =
      row.team1_snapshot ??
      (row.team1_id ? fetched.get(row.team1_id) : undefined) ??
      null;
    row.team2 =
      row.team2_snapshot ??
      (row.team2_id ? fetched.get(row.team2_id) : undefined) ??
      null;
  }
  return rows;
}
