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
 *   innings with {@link stageFullLiveScorecard} (`refreshLiveScorecard` in
 *   `scorecard-refresh.ts`).
 *
 * The doc is written only when its content changes, so listeners are billed
 * only for real changes. Names come from the previous doc, the live_state
 * names cache, users already read in the transaction and the two teams'
 * roster snapshots; a profile is read only for a player on neither roster.
 */

import { matchIdOf } from "./innings-summary";
import { canonicalJson } from "./derive.mjs";
import {
  buildLiveScorecard,
  decodeLiveScorecard,
  LIVE_SCORECARD_COLLECTION,
  liveCopyOf,
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
  // The live_state copy carries over (refreshed by stageLiveCopies when
  // this transaction writes live_state too).
  const live = prev?.live ?? (await currentLiveCopy(t, matchId));
  t.put(LIVE_SCORECARD_COLLECTION, matchId, live ? { ...doc, live } : doc);
}

/** The match's live_state as copied into the scorecard (1 read if unread). */
async function currentLiveCopy(
  t: ScoringTx,
  matchId: string,
): Promise<Record<string, unknown> | null> {
  const after = t.docAfter(LIVE_STATE, matchId);
  const live =
    after === undefined
      ? await t.doc<Record<string, unknown>>(LIVE_STATE, matchId)
      : after;
  return live ? liveCopyOf(live) : null;
}

/**
 * Copy every `live_state` the transaction writes into its match's
 * `live_scorecard.live` (runs last, before commit), so the copy is always
 * the live_state of the same commit. Normal deliveries write the scorecard
 * anyway: no extra write; the scorecard was read already: no extra read.
 * A match without a scorecard doc is left alone (viewers then follow
 * live_state).
 */
export async function stageLiveCopies(t: ScoringTx): Promise<void> {
  for (const w of t.pendingWrites()) {
    if (w.table !== LIVE_STATE || w.kind === "delete") continue;
    const matchId = w.id;
    const card = t.pending(LIVE_SCORECARD_COLLECTION, matchId);
    if (card?.kind === "delete") continue;
    const after = t.docAfter(LIVE_STATE, matchId);
    if (!after) continue;
    const live = liveCopyOf(after);
    const current =
      card?.kind === "set"
        ? (card.data as unknown as LiveScorecardDoc)
        : (t.docAfter(LIVE_SCORECARD_COLLECTION, matchId) as
            | LiveScorecardDoc
            | null
            | undefined) ??
          (await t.doc<LiveScorecardDoc>(LIVE_SCORECARD_COLLECTION, matchId));
    if (!current) continue;
    if (canonicalJson(current.live ?? null) === canonicalJson(live)) continue;
    const { id: _id, ...rest } = current as LiveScorecardDoc & { id?: string };
    void _id;
    t.put(LIVE_SCORECARD_COLLECTION, matchId, {
      ...rest,
      // A doc this transaction did not rebuild moves to its next version.
      version: card ? rest.version : (rest.version ?? 0) + 1,
      live,
    });
  }
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

