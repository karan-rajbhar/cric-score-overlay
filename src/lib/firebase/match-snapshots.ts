/**
 * Display copies of a match's tournament and club (`tournament_snapshot`,
 * `club_snapshot`), so match pages read neither: the query builder answers
 * `tournament:tournaments(id, name, ...)` / `club:clubs(id, name)` from them
 * (schema `CARRIED_SNAPSHOTS`). Kept in step by the server write hooks:
 * a match whose tournament / club changes gets new copies, and renaming a
 * tournament or club refreshes its matches.
 */

import type { DataSource, Doc } from "./datasource";
import {
  canonicalJson,
  MATCH_PARENT_SNAPSHOTS as SPECS,
  pickSnapshot as parentSnapshot,
} from "./derive.mjs";
import type { WriteEvent } from "./query-builder";

/**
 * Server write hook. Never throws; a failure leaves the old copy (the
 * builder then still answers from it, as for a missing tournament).
 */
export async function syncMatchParentSnapshots(
  ds: DataSource,
  event: WriteEvent,
): Promise<void> {
  try {
    const { table, before, after } = event;
    if (!after) return;
    if (table === "matches") {
      const patch: Record<string, unknown> = {};
      for (const s of SPECS) {
        const id = after[s.local];
        const snap = after[s.field] as Doc | null | undefined;
        const want = typeof id === "string" && id ? id : null;
        if ((snap?.id ?? null) === want && s.field in after) continue;
        patch[s.field] = want
          ? parentSnapshot(await ds.getById(s.table, want), s.columns)
          : null;
      }
      if (Object.keys(patch).length)
        await ds.update("matches", after.id, patch);
      return;
    }
    const spec = SPECS.find((s) => s.table === table);
    if (!spec || event.op !== "update" || !before) return;
    const snap = parentSnapshot(after, spec.columns);
    if (
      canonicalJson(parentSnapshot(before, spec.columns)) ===
      canonicalJson(snap)
    ) {
      return;
    }
    const matches = await ds.query("matches", [
      { field: spec.local, op: "==", value: after.id },
    ]);
    for (const m of matches) {
      if (canonicalJson(m[spec.field] ?? null) !== canonicalJson(snap)) {
        await ds.update("matches", m.id, { [spec.field]: snap });
      }
    }
  } catch (err) {
    console.error("syncMatchParentSnapshots failed:", err);
  }
}
