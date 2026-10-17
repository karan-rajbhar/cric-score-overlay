import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { listSentInvitations } from "./data";

function invite(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `i${i}`,
    email: `p${i}@gmail.com`,
    invited_by: "me",
    status: "pending",
    accepted_by: null,
    scorer_match_ids: [],
    created_at: `2026-01-${String(i).padStart(2, "0")}T00:00:00.000Z`,
    updated_at: null,
    ...extra,
  };
}

function setup() {
  const ds = new MemoryDataSource({
    users: [
      { id: "me" },
      { id: "joined", full_name: "Joined Player", username: "joined" },
    ],
    matches: [{ id: "m1", title: "Lions vs Tigers" }],
    invitations: [
      invite(1, { status: "accepted", accepted_by: "joined" }),
      invite(2, { scorer_match_ids: ["m1"] }),
      invite(3, { status: "revoked" }),
      ...Array.from({ length: 6 }, (_, k) => invite(10 + k)),
      invite(4, { invited_by: "someone-else" }),
    ],
  });
  const db = serverClientFor({ ds, db: null, getUser: async () => null });
  return { ds, db };
}

describe("listSentInvitations", () => {
  it("lists the caller's invites newest first with names and matches", async () => {
    const { db } = setup();
    const rows = await listSentInvitations(db, "me");
    expect(rows.map((r) => r.id)).toEqual([
      "i15",
      "i14",
      "i13",
      "i12",
      "i11",
      "i10",
      "i3",
      "i2",
      "i1",
    ]);
    expect(rows.find((r) => r.id === "i1")).toMatchObject({
      status: "accepted",
      accepted_by: {
        id: "joined",
        full_name: "Joined Player",
        username: "joined",
      },
    });
    expect(rows.find((r) => r.id === "i2")?.scorer_matches).toEqual([
      { id: "m1", title: "Lions vs Tigers" },
    ]);
    expect(rows.find((r) => r.id === "i3")?.status).toBe("revoked");
  });

  it("reads only the page it shows (indexed, limited)", async () => {
    const { ds, db } = setup();
    const before = ds.billedReads;
    const rows = await listSentInvitations(db, "me", 3);
    expect(rows.map((r) => r.id)).toEqual(["i15", "i14", "i13"]);
    // 3 invites, no profiles or matches needed (an empty query bills 1).
    expect(ds.billedReads - before).toBe(3);
  });
});
