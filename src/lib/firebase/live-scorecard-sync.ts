/**
 * Keeps `live_scorecard/{matchId}` (see `live-scorecard.ts`) in step with
 * the match's innings documents.
 *
 * - Every scoring transaction: {@link stageLiveScorecards} runs just before
 *   commit (with the innings summary) and rebuilds the doc of each match
 *   whose innings the transaction writes, from the previous doc (the other
 *   innings and the names cache: 1 read) plus the innings as written. Its
 *   reads are in the transaction, so a concurrent scorer write retries it.
 * - `writeLiveState` (every refresh, and live_state's first build) and the
 *   write hook for builder writes to innings rebuild it from the stored
 *   innings with {@link stageFullLiveScorecard} / {@link refreshLiveScorecard}.
 *
 * The doc is written only when its content changes, so listeners are billed
 * only for real changes. Names come from the previous doc, the live_state
 * names cache, users already read in the transaction and the two teams'
 * roster snapshots; a profile is read only for a player on neither roster.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { DataSource } from "./datasource";
import { matchIdOf } from "./innings-summary";
import {
  buildLiveScorecard,
  decodeLiveScorecard,
  LIVE_SCORECARD_COLLECTION,
  liveScorecardUserIds,
  sameLiveScorecard,
  type LiveScorecardDoc,
  type ScorecardSource,
} from "./live-scorecard";
import type { PendingWrite, ScoringTx } from "./scoring/tx";
import type { MatchesRow, RosterEntry, TeamsRow, UsersRow } from "./types";

type Names = Record<string, string | null>;

const LIVE_STATE = "live_state";

function liveStateNames(t: ScoringTx, matchId: string): Names {
  const pending = t.pending(LIVE_STATE, matchId);
  const data =
    pending && pending.kind !== "delete"
      ? pending.data
      : (t.known<Record<string, unknown>>(LIVE_STATE, matchId) ?? null);
  const refs = (data?.refs ?? null) as { names?: Names } | null;
  return refs?.names ?? {};
}

/** Display names for `ids`: caches first, then rosters, then profiles. */
async function resolveNames(
  t: ScoringTx,
  matchId: string,
  ids: string[],
  cached: Names,
): Promise<Names> {
  const out: Names = {};
  const known = { ...liveStateNames(t, matchId), ...cached };
  let missing: string[] = [];
  for (const id of ids) {
    if (Object.prototype.hasOwnProperty.call(known, id)) {
      out[id] = known[id] ?? null;
      continue;
    }
    const user = t.known<UsersRow>("users", id);
    if (user) out[id] = user.full_name ?? null;
    else missing.push(id);
  }
  if (!missing.length) return out;

  const match =
    t.known<MatchesRow>("matches", matchId) ??
    (await t.doc<MatchesRow>("matches", matchId));
  const teamIds = [match?.team1_id, match?.team2_id].filter(
    (id): id is string => !!id,
  );
  const teams = await Promise.all(
    teamIds.map(
      async (id) =>
        t.known<TeamsRow>("teams", id) ?? (await t.doc<TeamsRow>("teams", id)),
    ),
  );
  const roster = new Map<string, string | null>();
  for (const team of teams) {
    for (const entry of (team?.roster ?? []) as RosterEntry[]) {
      if (entry.user?.id) roster.set(entry.user.id, entry.user.full_name);
    }
  }
  missing = missing.filter((id) => {
    if (!roster.has(id)) return true;
    out[id] = roster.get(id) ?? null;
    return false;
  });
  if (missing.length) {
    for (const id of missing) out[id] = null;
    const users = await t.docs<UsersRow>("users", missing);
    for (const u of users) out[u.id] = u.full_name ?? null;
  }
  return out;
}

/** Build the doc for `innings` and stage it when its content changed. */
async function stageDoc(
  t: ScoringTx,
  matchId: string,
  innings: ScorecardSource[],
  prev: LiveScorecardDoc | null,
  cachedNames: Names,
): Promise<void> {
  const ids = liveScorecardUserIds(innings);
  const names = await resolveNames(t, matchId, ids, cachedNames);
  const doc = buildLiveScorecard({
    matchId,
    innings,
    nameOf: (id) => names[id] ?? null,
    version: (prev?.version ?? 0) + 1,
    now: new Date().toISOString(),
  });
  if (prev && sameLiveScorecard(prev, doc)) return;
  t.put(LIVE_SCORECARD_COLLECTION, matchId, doc);
}

/**
 * Rebuild a match's doc from its stored innings (as of this transaction's
 * staged writes). Reads the previous doc and the innings.
 */
export async function stageFullLiveScorecard(
  t: ScoringTx,
  matchId: string,
): Promise<void> {
  const [prev, stored] = await Promise.all([
    t.doc<LiveScorecardDoc>(LIVE_SCORECARD_COLLECTION, matchId),
    t.where<ScorecardSource>("innings", [["match_id", "==", matchId]]),
  ]);
  const docs = new Map<string, ScorecardSource>(stored.map((i) => [i.id, i]));
  for (const w of t.pendingWrites()) {
    if (w.table !== "innings") continue;
    applyWrite(docs, w, docs.get(w.id) ?? null);
  }
  const cached = prev ? decodeLiveScorecard(prev).names : {};
  await stageDoc(t, matchId, [...docs.values()], prev, cached);
}

function applyWrite(
  docs: Map<string, ScorecardSource>,
  w: PendingWrite,
  base: ScorecardSource | null,
): void {
  if (w.kind === "delete") {
    docs.delete(w.id);
  } else if (w.kind === "set") {
    docs.set(w.id, { ...w.data, id: w.id } as unknown as ScorecardSource);
  } else if (base) {
    docs.set(w.id, { ...base, ...w.data, id: w.id } as ScorecardSource);
  }
}

/**
 * Stage the doc of every match whose innings this transaction writes.
 * Normal deliveries: 1 read (the previous doc) and 1 write.
 */
export async function stageLiveScorecards(t: ScoringTx): Promise<void> {
  const writes = t.pendingWrites().filter((w) => w.table === "innings");
  if (!writes.length) return;
  const byMatch = new Map<string, PendingWrite[]>();
  for (const w of writes) {
    const matchId = await matchIdOf(t, w);
    if (!matchId) continue;
    const list = byMatch.get(matchId) ?? [];
    list.push(w);
    byMatch.set(matchId, list);
  }

  for (const [matchId, list] of byMatch) {
    if (t.pending("matches", matchId)?.kind === "delete") {
      t.delete(LIVE_SCORECARD_COLLECTION, matchId);
      continue;
    }
    const prev = await t.doc<LiveScorecardDoc>(
      LIVE_SCORECARD_COLLECTION,
      matchId,
    );
    if (!prev) {
      await stageFullLiveScorecard(t, matchId);
      continue;
    }
    const decoded = decodeLiveScorecard(prev);
    const docs = new Map(decoded.innings.map((i) => [i.id, i]));
    for (const w of list) {
      // Merges apply to the stored innings (the engine reads an innings
      // before writing it; otherwise read it here).
      const base =
        w.kind === "merge"
          ? (t.known<ScorecardSource>("innings", w.id) ??
            (await t.doc<ScorecardSource>("innings", w.id)))
          : null;
      applyWrite(docs, w, base);
    }
    await stageDoc(t, matchId, [...docs.values()], prev, decoded.names);
  }
}

/**
 * Rebuild `live_scorecard/{matchId}` from the stored innings (after builder
 * writes to innings, or to create it for a match that predates it).
 */
export async function refreshLiveScorecard(
  ds: DataSource,
  matchId: string,
  db?: Firestore | null,
): Promise<void> {
  const { runScoringTransaction } = await import("./scoring/tx");
  await runScoringTransaction({ ds, db }, (t) =>
    stageFullLiveScorecard(t, matchId),
  );
}

/**
 * The stored doc (1 read), created on first use for live matches that
 * predate it. Null when the match has no innings yet.
 */
export async function ensureLiveScorecard(
  ds: DataSource,
  matchId: string,
  db?: Firestore | null,
): Promise<LiveScorecardDoc | null> {
  const read = async () =>
    (await ds.getById(
      LIVE_SCORECARD_COLLECTION,
      matchId,
    )) as unknown as LiveScorecardDoc | null;
  const existing = await read();
  if (existing) return existing;
  await refreshLiveScorecard(ds, matchId, db);
  return read();
}
