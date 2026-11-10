/**
 * `FirestoreScoringTx.flush`: a patch replaces each top-level field it
 * names whole. A plain `{ merge: true }` would merge nested maps leaf by
 * leaf, so a key a new `last_ball` leaves out (`penalty_team_id`,
 * `no_ball_runs`) would survive from the old one; the in-memory double the
 * other tests use replaces fields whole, so they could not see it.
 */

import type { Firestore, Transaction } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { FirestoreScoringTx } from "./tx";

function fakes() {
  const calls: unknown[][] = [];
  const db = {
    collection: (table: string) => ({
      doc: (id: string) => `${table}/${id}`,
    }),
  } as unknown as Firestore;
  const tx = {
    set: (...args: unknown[]) => calls.push(["set", ...args]),
    delete: (...args: unknown[]) => calls.push(["delete", ...args]),
  } as unknown as Transaction;
  return { t: new FirestoreScoringTx(db, tx), calls };
}

describe("FirestoreScoringTx.flush", () => {
  it("replaces each patched field whole, sets a put document, deletes", () => {
    const { t, calls } = fakes();
    t.patch("innings", "i1", {
      last_ball: { seq: 4, extras: 0 },
      total_runs: 12,
      skipped: undefined,
    });
    t.patch("innings", "i1", { updated_at: "now" });
    t.put("overs", "i1_0", { id: "i1_0", balls: [] });
    t.delete("overs", "i1_1");
    t.flush();
    expect(calls).toEqual([
      [
        "set",
        "innings/i1",
        {
          last_ball: { seq: 4, extras: 0 },
          total_runs: 12,
          skipped: undefined,
          updated_at: "now",
        },
        // Not `{ merge: true }`: the stored last_ball's other keys go.
        { mergeFields: ["last_ball", "total_runs", "updated_at"] },
      ],
      ["set", "overs/i1_0", { balls: [] }],
      ["delete", "overs/i1_1"],
    ]);
  });
});
