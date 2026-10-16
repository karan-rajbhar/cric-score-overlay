/**
 * `matches.innings_summary`: the score line of each innings (see
 * `INNINGS_SUMMARY_FIELDS`), so match lists, cards and the points table
 * read one document per match instead of also reading its innings.
 *
 * Kept in step by:
 * - every scoring transaction: {@link stageInningsSummaries} runs just
 *   before commit and folds the transaction's innings writes into the
 *   match's summary (the match is patched in the same commit, usually
 *   alongside the patch the engine already makes, so no extra write);
 * - builder writes to innings (match start, abandon, target edits): the
 *   write hook calls {@link refreshInningsSummary}.
 *
 * Readers use the summary only when every match in the result has one
 * (`expandEmbedded`), so matches that predate it still work.
 */

import type { DataSource } from "./datasource";
import {
  canonicalJson,
  INNINGS_SUMMARY_FIELDS,
  inningsSummaryEntry,
  inningsSummaryOf,
} from "./derive.mjs";
import type { PendingWrite, ScoringTx } from "./scoring/tx";

type Entry = Record<string, unknown>;

function picked(data: Record<string, unknown>): Entry {
  const out: Entry = {};
  for (const f of INNINGS_SUMMARY_FIELDS) {
    if (f in data && f !== "id") out[f] = data[f] ?? null;
  }
  return out;
}

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) =>
      Number(a.innings_number ?? 0) - Number(b.innings_number ?? 0) ||
      (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0),
  );
}

async function matchIdOf(
  t: ScoringTx,
  w: PendingWrite,
): Promise<string | null> {
  if (w.kind !== "delete" && typeof w.data.match_id === "string") {
    return w.data.match_id;
  }
  const stored =
    t.known<{ match_id?: unknown }>("innings", w.id) ??
    ((await t.getById("innings", w.id)) as { match_id?: unknown } | null);
  return typeof stored?.match_id === "string" ? stored.match_id : null;
}

/**
 * Stage the summary of every match whose innings this transaction writes.
 * Reads nothing when the match was already read (the scoring engine always
 * reads it) and its summary exists.
 */
export async function stageInningsSummaries(t: ScoringTx): Promise<void> {
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
    if (t.pending("matches", matchId)?.kind === "delete") continue;
    const match =
      t.known<{ innings_summary?: unknown }>("matches", matchId) ??
      ((await t.getById("matches", matchId)) as {
        innings_summary?: unknown;
      } | null);
    if (!match) continue;
    const current = Array.isArray(match.innings_summary)
      ? (match.innings_summary as Entry[])
      : null;

    let next: Entry[] | null = current ? current.map((e) => ({ ...e })) : null;
    if (next) {
      for (const w of list) {
        const i = next.findIndex((e) => e.id === w.id);
        if (w.kind === "delete") {
          if (i >= 0) next.splice(i, 1);
        } else if (w.kind === "set") {
          const entry = inningsSummaryEntry({ ...w.data, id: w.id });
          if (i >= 0) next[i] = entry;
          else next.push(entry);
        } else if (i >= 0) {
          next[i] = { ...next[i], ...picked(w.data) };
        } else {
          const stored = t.known<Entry>("innings", w.id);
          if (!stored) {
            next = null;
            break;
          }
          next.push(inningsSummaryEntry({ ...stored, ...w.data, id: w.id }));
        }
      }
    }
    if (!next) {
      // No summary yet (or an entry is missing): build it from the innings.
      const stored = await t.query("innings", [
        { field: "match_id", op: "==", value: matchId },
      ]);
      const docs = new Map<string, Entry>(stored.map((d) => [d.id, d]));
      for (const w of list) {
        if (w.kind === "delete") docs.delete(w.id);
        else if (w.kind === "set") docs.set(w.id, { ...w.data, id: w.id });
        else docs.set(w.id, { ...(docs.get(w.id) ?? {}), ...w.data, id: w.id });
      }
      next = inningsSummaryOf([...docs.values()]);
    } else {
      next = sortEntries(next);
    }
    if (!current || canonicalJson(current) !== canonicalJson(next)) {
      t.patch("matches", matchId, { innings_summary: next });
    }
  }
}

/**
 * Rebuild one match's summary from its innings (after builder writes to
 * innings). Runs in a transaction so it cannot interleave with scoring.
 */
export async function refreshInningsSummary(
  ds: DataSource,
  matchId: string,
): Promise<void> {
  const { runScoringTransaction } = await import("./scoring/tx");
  await runScoringTransaction({ ds }, async (t) => {
    const [match, innings] = await Promise.all([
      t.getById("matches", matchId),
      t.query("innings", [{ field: "match_id", op: "==", value: matchId }]),
    ]);
    if (!match) return;
    const next = inningsSummaryOf(innings);
    if (canonicalJson(match.innings_summary ?? null) !== canonicalJson(next)) {
      t.patch("matches", matchId, { innings_summary: next });
    }
  });
}
