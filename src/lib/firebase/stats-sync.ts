/**
 * Keeps `player_matches` and the statistics built from them
 * (`player_career_stats/{userId}`, `leaderboards/{scope}_{id}`) in step,
 * inside the caller's transaction, so a crash or a concurrent scorer can
 * never leave them disagreeing.
 *
 * {@link syncMatchRecords} is the only writer of `player_matches`: it reads
 * a match's stored records, writes the ones that differ from what its
 * completed innings give, and applies exactly those changes to the
 * statistics ({@link applyStatsChanges}):
 *
 * - sums move by the difference of the changed innings only;
 * - removing a player's only best innings / spell (undo across an innings
 *   end, an edit to a completed innings) rebuilds that player's figures
 *   from their records (one query);
 * - a missing career / leaderboard document (new player, new tournament,
 *   or data that predates it) is built from its records the same way.
 *
 * The result always equals `rebuildStats` over the stored records (see
 * stats-sync.test.ts and the golden replays in scoring/incremental.test.ts).
 */

import type { Doc } from "./datasource";
import { PLAYER_MATCHES_COLLECTION, playerMatchDocs } from "./scorecard";
import { sameRow } from "./scoring/rows";
import type { ScoringTx } from "./scoring/tx";
import {
  accOf,
  boardIdentity,
  CAREER_COLLECTION,
  careerDocOf,
  emptyAcc,
  LEADERBOARDS_COLLECTION,
  leaderboardDocOf,
  replacePlayerMatch,
  scopeKeysOf,
  SCOPES,
  type BoardPlayer,
  type StatsAcc,
} from "./stats.mjs";
import type { InningsRow, MatchesRow, PlayerMatchesRow } from "./types";

export interface PlayerMatchChange {
  before: PlayerMatchesRow | null;
  after: PlayerMatchesRow | null;
}

function userOf(c: PlayerMatchChange): string {
  return (c.after ?? c.before)!.user_id;
}

function idOf(c: PlayerMatchChange): string {
  return (c.after ?? c.before)!.id;
}

function isAcc(value: unknown): value is StatsAcc {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as StatsAcc).m === "number" &&
    typeof (value as StatsAcc).bi === "number"
  );
}

/** Stored records overlaid with this transaction's changes. */
function overlay(
  stored: Doc[],
  changes: readonly PlayerMatchChange[],
  keep: (pm: PlayerMatchesRow) => boolean,
): PlayerMatchesRow[] {
  const byId = new Map(
    (stored as unknown as PlayerMatchesRow[]).map((d) => [d.id, d]),
  );
  for (const c of changes) {
    byId.delete(idOf(c));
    if (c.after && keep(c.after)) byId.set(c.after.id, c.after);
  }
  return [...byId.values()].filter(keep);
}

const withoutStamp = (doc: object) => {
  const copy: Record<string, unknown> = { ...doc };
  delete copy.last_updated;
  delete copy.updated_at;
  delete copy.id;
  return copy;
};

/**
 * Apply player record changes (already staged by the caller) to the
 * career and leaderboard documents.
 */
export async function applyStatsChanges(
  t: ScoringTx,
  changes: readonly PlayerMatchChange[],
  now: string,
): Promise<void> {
  if (!changes.length) return;
  const userIds = Array.from(new Set(changes.map(userOf)));
  const boardIds = Array.from(
    new Set(
      changes.flatMap((c) => [
        ...scopeKeysOf(c.before),
        ...scopeKeysOf(c.after),
      ]),
    ),
  );
  const [careerDocs, boardDocs] = await Promise.all([
    t.getByIds(CAREER_COLLECTION, userIds),
    t.getByIds(LEADERBOARDS_COLLECTION, boardIds),
  ]);
  const storedCareer = new Map(careerDocs.map((d) => [d.id, d]));
  const storedBoard = new Map(boardDocs.map((d) => [d.id, d]));

  // ---- careers ----
  const careers = new Map<string, StatsAcc | null>();
  const rebuildUsers = new Set<string>();
  for (const userId of userIds) {
    const acc = storedCareer.get(userId)?.acc;
    if (isAcc(acc)) careers.set(userId, structuredClone(acc));
    else rebuildUsers.add(userId);
  }

  // ---- leaderboards ----
  const boards = new Map<string, Record<string, BoardPlayer> | null>();
  for (const id of boardIds) {
    const doc = storedBoard.get(id);
    boards.set(
      id,
      doc && doc.players && typeof doc.players === "object"
        ? structuredClone(doc.players as Record<string, BoardPlayer>)
        : null,
    );
  }
  /** board id -> users whose entry must be rebuilt from their records */
  const rebuildEntries = new Map<string, Set<string>>();
  const markEntry = (board: string, userId: string) => {
    const set = rebuildEntries.get(board) ?? new Set();
    set.add(userId);
    rebuildEntries.set(board, set);
  };
  const newEntries = new Map<string, Set<string>>();

  for (const c of changes) {
    const userId = userOf(c);
    const acc = careers.get(userId);
    if (acc && !replacePlayerMatch(acc, c.before, c.after)) {
      rebuildUsers.add(userId);
    }
    const inBefore = new Set(scopeKeysOf(c.before));
    const inAfter = new Set(scopeKeysOf(c.after));
    for (const id of new Set([...inBefore, ...inAfter])) {
      const players = boards.get(id);
      if (!players) continue; // rebuilt from the scope's records below
      if (rebuildEntries.get(id)?.has(userId)) continue;
      const b = inBefore.has(id) ? c.before : null;
      const a = inAfter.has(id) ? c.after : null;
      let entry = players[userId];
      if (!entry) {
        if (b) {
          markEntry(id, userId); // stored entry missing: rebuild it
          continue;
        }
        entry = { ...emptyAcc(), name: null, avatar_url: null };
        players[userId] = entry;
        const set = newEntries.get(id) ?? new Set();
        set.add(userId);
        newEntries.set(id, set);
      }
      if (!replacePlayerMatch(entry, b, a)) markEntry(id, userId);
    }
  }

  // ---- rebuild reads: a player's records / a scope's records ----
  const entryUsers = new Set<string>();
  for (const set of rebuildEntries.values())
    for (const u of set) entryUsers.add(u);
  const queryUsers = Array.from(new Set([...rebuildUsers, ...entryUsers]));
  const missingBoards = boardIds.filter((id) => boards.get(id) === null);
  const [userRecords, scopeRecords] = await Promise.all([
    Promise.all(
      queryUsers.map((u) =>
        t.query(PLAYER_MATCHES_COLLECTION, [
          { field: "user_id", op: "==", value: u },
        ]),
      ),
    ),
    Promise.all(
      missingBoards.map((id) => {
        const [scope, field] = SCOPES.find(([s]) => id.startsWith(`${s}_`))!;
        return t.query(PLAYER_MATCHES_COLLECTION, [
          { field, op: "==", value: id.slice(scope.length + 1) },
        ]);
      }),
    ),
  ]);
  const recordsOf = new Map(
    queryUsers.map((u, i) => [
      u,
      overlay(userRecords[i]!, changes, (pm) => pm.user_id === u),
    ]),
  );
  for (const userId of rebuildUsers) {
    careers.set(userId, accOf(recordsOf.get(userId) ?? []));
  }
  for (const [id, users] of rebuildEntries) {
    const players = boards.get(id);
    if (!players) continue;
    for (const userId of users) {
      const records = (recordsOf.get(userId) ?? []).filter((pm) =>
        scopeKeysOf(pm).includes(id),
      );
      const prev = players[userId];
      players[userId] = {
        ...accOf(records),
        name: prev?.name ?? null,
        avatar_url: prev?.avatar_url ?? null,
      };
      if (!prev) {
        const set = newEntries.get(id) ?? new Set();
        set.add(userId);
        newEntries.set(id, set);
      }
    }
  }
  missingBoards.forEach((id, i) => {
    const records = overlay(scopeRecords[i]!, changes, (pm) =>
      scopeKeysOf(pm).includes(id),
    );
    const byUser = new Map<string, PlayerMatchesRow[]>();
    for (const pm of records) {
      const list = byUser.get(pm.user_id) ?? [];
      list.push(pm);
      byUser.set(pm.user_id, list);
    }
    const players: Record<string, BoardPlayer> = {};
    for (const [userId, list] of byUser) {
      players[userId] = { ...accOf(list), name: null, avatar_url: null };
    }
    boards.set(id, players);
    newEntries.set(id, new Set(byUser.keys()));
  });

  // ---- names for players new to a leaderboard ----
  const nameIds = new Set<string>();
  for (const [id, users] of newEntries) {
    const players = boards.get(id)!;
    for (const u of users) if (players[u] && players[u].m > 0) nameIds.add(u);
  }
  if (nameIds.size) {
    const users = new Map(
      (await t.getByIds("users", [...nameIds])).map((u) => [u.id, u]),
    );
    for (const [id, set] of newEntries) {
      const players = boards.get(id)!;
      for (const u of set) {
        if (players[u]) Object.assign(players[u], boardIdentity(users.get(u)));
      }
    }
  }

  // ---- writes (only what changed) ----
  for (const [userId, acc] of careers) {
    const stored = storedCareer.get(userId) ?? null;
    if (!acc || acc.m <= 0) {
      if (stored) t.delete(CAREER_COLLECTION, userId);
      continue;
    }
    const doc = careerDocOf(userId, acc, now);
    if (!stored || !sameRow(withoutStamp(doc), withoutStamp(stored))) {
      t.put(CAREER_COLLECTION, userId, doc);
    }
  }
  for (const [id, players] of boards) {
    if (!players) continue;
    for (const [u, entry] of Object.entries(players)) {
      if (entry.m <= 0) delete players[u];
    }
    const stored = storedBoard.get(id) ?? null;
    if (!Object.keys(players).length) {
      if (stored) t.delete(LEADERBOARDS_COLLECTION, id);
      continue;
    }
    const doc = leaderboardDocOf(id, players, now);
    if (!stored || !sameRow(withoutStamp(doc), withoutStamp(stored))) {
      t.put(LEADERBOARDS_COLLECTION, id, doc);
    }
  }
}

/**
 * Bring a match's `player_matches` (and the statistics) in line with its
 * innings as they will be stored after this transaction. `match` null
 * means the match is gone: its records are removed.
 */
export async function syncMatchRecords(
  t: ScoringTx,
  matchId: string,
  match: MatchesRow | null,
  innings: readonly InningsRow[],
  now: string,
): Promise<{ written: number; deleted: number }> {
  const stored = (await t.query(PLAYER_MATCHES_COLLECTION, [
    { field: "match_id", op: "==", value: matchId },
  ])) as unknown as PlayerMatchesRow[];
  const previous = new Map(stored.map((d) => [d.id, d]));
  const wanted = match ? playerMatchDocs(match, [...innings], now) : [];
  const changes: PlayerMatchChange[] = [];
  let written = 0;
  let deleted = 0;
  for (const doc of wanted) {
    const prev = previous.get(doc.id) ?? null;
    previous.delete(doc.id);
    if (prev && sameRow(doc, prev)) continue;
    t.put(PLAYER_MATCHES_COLLECTION, doc.id, doc);
    changes.push({ before: prev, after: doc });
    written += 1;
  }
  for (const prev of previous.values()) {
    t.delete(PLAYER_MATCHES_COLLECTION, prev.id);
    changes.push({ before: prev, after: null });
    deleted += 1;
  }
  await applyStatsChanges(t, changes, now);
  return { written, deleted };
}
