/**
 * Display copies of player profiles kept in step with their source:
 *
 * - `teams.roster` (see `derive.mjs#rosterOf`): rebuilt when the team's
 *   team_players change, and the player's entry refreshed when a profile's
 *   name / avatar / username changes;
 * - `club_memberships.user_snapshot`;
 * - the `name` / `avatar_url` of each player in the leaderboard shards
 *   (`leaderboards/*`; only the player's own shard of each scope).
 *
 * Each refresh runs in a transaction (so it cannot interleave with the
 * scoring engine's leaderboard updates) and writes only what changed.
 */

import type { DataSource, Doc } from "./datasource";
import { canonicalJson, rosterOf, userSnapshot } from "./derive.mjs";
import { runScoringTransaction } from "./scoring/tx";
import {
  boardIdentity,
  boardKeysOf,
  LEADERBOARDS_COLLECTION,
} from "./stats.mjs";
import type { RosterEntry } from "./types";

/**
 * Rebuild `teams/{teamId}.roster` from its team_players. Player snapshots
 * already in the roster are reused; only players new to it (or listed in
 * `refreshUsers`) are read.
 */
export async function refreshRoster(
  ds: DataSource,
  teamId: string,
  refreshUsers: readonly string[] = [],
): Promise<void> {
  await runScoringTransaction({ ds }, async (t) => {
    const [team, players] = await Promise.all([
      t.getById("teams", teamId),
      t.query("team_players", [{ field: "team_id", op: "==", value: teamId }]),
    ]);
    if (!team) return;
    const previous = Array.isArray(team.roster)
      ? (team.roster as RosterEntry[])
      : [];
    const users = new Map<string, Record<string, unknown>>();
    for (const e of previous) {
      if (e.user && !refreshUsers.includes(e.user.id))
        users.set(e.user.id, { ...e.user });
    }
    const missing = Array.from(
      new Set(
        players
          .map((p) => p.user_id)
          .filter(
            (id): id is string => typeof id === "string" && !users.has(id),
          ),
      ),
    );
    if (missing.length) {
      for (const u of await t.getByIds("users", missing)) users.set(u.id, u);
    }
    const roster = rosterOf(players, users);
    if (canonicalJson(team.roster ?? null) !== canonicalJson(roster)) {
      t.patch("teams", teamId, { roster });
    }
  });
}

/**
 * A profile's display fields changed (or it was created / re-keyed):
 * refresh its roster entries and leaderboard names.
 */
export async function refreshPlayerIdentity(
  ds: DataSource,
  userId: string,
): Promise<void> {
  const [memberships, records, clubs, user] = await Promise.all([
    ds.query("team_players", [{ field: "user_id", op: "==", value: userId }]),
    ds.query("player_matches", [{ field: "user_id", op: "==", value: userId }]),
    ds.query("club_memberships", [
      { field: "user_id", op: "==", value: userId },
    ]),
    ds.getById("users", userId),
  ]);
  const snapshot = userSnapshot(user);
  for (const m of clubs) {
    if (canonicalJson(m.user_snapshot ?? null) !== canonicalJson(snapshot)) {
      await ds.update("club_memberships", m.id, { user_snapshot: snapshot });
    }
  }
  const teamIds = Array.from(
    new Set(
      memberships
        .map((m) => m.team_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  );
  for (const teamId of teamIds) await refreshRoster(ds, teamId, [userId]);

  const keys = Array.from(
    new Set(records.flatMap((r) => boardKeysOf(r as never))),
  );
  if (!keys.length) return;
  await runScoringTransaction({ ds }, async (t) => {
    const [user, boards] = await Promise.all([
      t.getById("users", userId),
      t.getByIds(LEADERBOARDS_COLLECTION, keys),
    ]);
    const identity = boardIdentity(user);
    for (const board of boards) {
      const players = (board.players ?? {}) as Record<string, Doc>;
      const entry = players[userId];
      if (!entry) continue;
      if (
        entry.name === identity.name &&
        (entry.avatar_url ?? null) === identity.avatar_url
      ) {
        continue;
      }
      // A whole-document write: merge writes keep map keys they omit.
      t.put(LEADERBOARDS_COLLECTION, board.id, {
        ...board,
        players: { ...players, [userId]: { ...entry, ...identity } },
      });
    }
  });
}
