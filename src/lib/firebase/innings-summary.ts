/**
 * `matches.innings_summary`: the score line of each innings (see
 * `INNINGS_SUMMARY_FIELDS`), so match lists, cards and the points table
 * read one document per match instead of also reading its innings.
 *
 * Kept in step by:
 * - every scoring transaction: {@link stageInningsSummaries} runs just
 *   before commit and folds the transaction's innings writes into the
 *   match's summary (the match is patched in the same commit). A live
 *   match's innings in progress is the exception: its running totals change
 *   with every ball, and writing the match for them would cost a write per
 *   ball, so its entry is refreshed only with the next structural change
 *   (innings or match end, undo across innings, any other match write);
 * - builder writes to innings (match start, abandon, target edits): the
 *   write hook calls `refreshInningsSummary` (`scorecard-refresh.ts`).
 *
 * So in a live match the entry of an innings that is not completed may be
 * behind: readers that show it re-read that innings
 * ({@link staleSummaryInnings}). Readers use the summary only when every
 * match in the result has one (`expandEmbedded`), so matches that predate
 * it still work.
 */

import {
  canonicalJson,
  inningsSummaryEntry,
  inningsSummaryOf,
  SUMMARY_TOTAL_FIELDS,
  summaryTotalsOf,
} from "./derive.mjs";
import type { PendingWrite, ScoringTx } from "./scoring/tx";

type Entry = Record<string, unknown>;

/**
 * The match patch for summary `next`: the summary and its totals
 * (`summaryTotalsOf`: club milestones), or null when the stored copies
 * already match. A match whose totals are missing or behind (written before
 * they existed) gets them with its next summary write.
 */
export function inningsSummaryPatch(
  match: Entry,
  next: Entry[],
): Record<string, unknown> | null {
  const totals: Entry = summaryTotalsOf(next);
  const same =
    canonicalJson(match.innings_summary ?? null) === canonicalJson(next) &&
    SUMMARY_TOTAL_FIELDS.every(
      (f) => canonicalJson(match[f] ?? null) === canonicalJson(totals[f]),
    );
  return same ? null : { innings_summary: next, ...totals };
}

/**
 * Ids of the summary entries of `match` that may be behind their innings:
 * while the match is live, the innings not completed yet (see above).
 */
export function staleSummaryInnings(match: {
  status?: unknown;
  innings_summary?: unknown;
}): string[] {
  if (match.status !== "live" || !Array.isArray(match.innings_summary)) {
    return [];
  }
  return (match.innings_summary as Entry[])
    .filter((e) => e.is_completed !== true && typeof e.id === "string")
    .map((e) => e.id as string);
}

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) =>
      Number(a.innings_number ?? 0) - Number(b.innings_number ?? 0) ||
      (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0),
  );
}

/** The match an innings write belongs to (from the write or the stored doc). */
export async function matchIdOf(
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
 * Whether this transaction only moves the running totals of the live
 * match's innings in progress (a delivery, an undo or edit in it, a crease
 * change): then the summary is left as it is (see the module comment).
 */
function onlyRunningTotals(
  t: ScoringTx,
  match: Entry & { id: string },
  writes: readonly PendingWrite[],
  current: readonly Entry[],
): boolean {
  if (match.status !== "live" || t.pending("matches", match.id)) return false;
  return writes.every((w) => {
    if (w.kind !== "merge") return false;
    const entry = current.find((e) => e.id === w.id);
    const after = t.docAfter("innings", w.id);
    return (
      !!entry &&
      entry.is_completed !== true &&
      !!after &&
      after.is_completed !== true &&
      after.innings_number === (match.current_innings ?? 1)
    );
  });
}

/**
 * Stage the summary of every match whose innings this transaction writes.
 * Reads nothing when the match was already read (the scoring engine always
 * reads it) and its summary exists. Entries are built from the innings as
 * stored after the commit; entries of innings the transaction read but did
 * not write are refreshed too (no read), so a summary left behind by the
 * running-totals exception catches up with any structural change.
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
      t.known<Entry>("matches", matchId) ??
      ((await t.getById("matches", matchId)) as
        | (Entry & { id: string })
        | null);
    if (!match) continue;
    const current = Array.isArray(match.innings_summary)
      ? (match.innings_summary as Entry[])
      : null;
    if (current && onlyRunningTotals(t, match, list, current)) continue;

    let next: Entry[] | null = current ? current.map((e) => ({ ...e })) : null;
    if (next) {
      for (const w of list) {
        const i = next.findIndex((e) => e.id === w.id);
        if (w.kind === "delete") {
          if (i >= 0) next.splice(i, 1);
          continue;
        }
        const after = t.docAfter("innings", w.id);
        if (!after) {
          // Merged into a document this transaction never read.
          next = null;
          break;
        }
        const entry = inningsSummaryEntry(after);
        if (i >= 0) next[i] = entry;
        else next.push(entry);
      }
    }
    if (next) {
      const written = new Set(list.map((w) => w.id));
      next = next.map((e) => {
        const known =
          typeof e.id === "string" && !written.has(e.id)
            ? t.known<Entry>("innings", e.id)
            : null;
        return known ? inningsSummaryEntry(known) : e;
      });
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
    const patch = inningsSummaryPatch(match, next);
    if (patch) t.patch("matches", matchId, patch);
  }
}

