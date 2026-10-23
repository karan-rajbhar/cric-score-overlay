import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { AppUser } from "../auth-types";
import { MemoryDataSource } from "../datasource";
import { canProduceOverlay as canProduceOverlayHelper } from "../permissions";
import { serverClientFor } from "../server-client";
import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import { acceptInvitations, revokeInvitation } from "./access";
import { canProduceOverlay, isMatchAdmin } from "./auth-helpers";
import { inviteStreamerEmail } from "./streamers";

const match = {
  id: "m1",
  created_by: "creator",
  match_admins: ["scorer"],
  match_streamers: ["streamer"],
  club_id: null,
  tournament_id: null,
};

function client(ds: MemoryDataSource, uid: string) {
  return serverClientFor({
    ds,
    db: null,
    getUser: async () =>
      ({ id: uid, email: null, phone: null, user_metadata: {} }) as AppUser,
  });
}

describe("canProduceOverlay", () => {
  it("lets streamers drive the overlay without making them match admins", async () => {
    const ds = new MemoryDataSource({ matches: [match] });
    expect(await canProduceOverlay(ds, "m1", "streamer")).toBe(true);
    expect(await isMatchAdmin(ds, "m1", "streamer")).toBe(false);
  });

  it("keeps every match admin and nobody else", async () => {
    const ds = new MemoryDataSource({ matches: [match] });
    expect(await canProduceOverlay(ds, "m1", "creator")).toBe(true);
    expect(await canProduceOverlay(ds, "m1", "scorer")).toBe(true);
    expect(await canProduceOverlay(ds, "m1", "stranger")).toBe(false);
    expect(await canProduceOverlay(ds, "missing", "streamer")).toBe(false);
    expect(await canProduceOverlay(ds, "m1", null)).toBe(false);
  });

  it("answers the same through the server client and permissions helper", async () => {
    const ds = new MemoryDataSource({ matches: [match] });
    const db = client(ds, "streamer");
    expect(await canProduceOverlayHelper(db, "m1", "streamer")).toBe(true);
    expect(await canProduceOverlayHelper(ds, "m1", "streamer")).toBe(true);
    expect(await canProduceOverlayHelper(db, "m1", "stranger")).toBe(false);
    // Scoring rights are unchanged: is_match_admin stays false.
    expect((await db.rpc("is_match_admin", { p_match_id: "m1" })).data).toBe(
      false,
    );
    expect(
      (await db.rpc("can_produce_overlay", { p_match_id: "m1" })).data,
    ).toBe(true);
  });

  it("refuses a streamer's ball: streamers cannot score", async () => {
    const side = stage2Driver(
      syntheticTables({ overs_per_innings: 3, wickets_per_innings: 10 }),
      true,
    );
    const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
    await replay.step({ kind: "ball", ball: { runs: 1 } });
    await side.ds.update("matches", "M", { match_streamers: ["streamer"] });
    side.ctx = { ...side.ctx, uid: "streamer" };
    const out = await replay.step({ kind: "ball", ball: { runs: 1 } });
    expect(out).toBeInstanceOf(Error);
    expect((out as Error).message).toBe("not_authorized");
    expect(await canProduceOverlay(side.ds, "M", "streamer")).toBe(true);
  });
});

describe("streamer invites", () => {
  const users = [{ id: "creator" }, { id: "member-1", full_name: "Mem Ber" }];
  const usersPrivate = [{ id: "member-1", email: "member@gmail.com" }];

  it("adds an existing user straight away", async () => {
    const ds = new MemoryDataSource({
      users,
      users_private: usersPrivate,
      matches: [{ ...match, match_streamers: [] }],
    });
    const out = await inviteStreamerEmail(ds, "creator", "Member@Gmail.com", "m1");
    expect(out).toEqual({ status: "added_streamer", name: "Mem Ber" });
    expect((await ds.getById("matches", "m1"))!.match_streamers).toEqual([
      "member-1",
    ]);
    expect(
      (await inviteStreamerEmail(ds, "creator", "member@gmail.com", "m1"))
        .status,
    ).toBe("already_streamer");
  });

  it("invites a new email, which becomes a streamer (not a scorer) on sign-in", async () => {
    const ds = new MemoryDataSource({
      users,
      matches: [{ ...match, match_streamers: [] }, { ...match, id: "m2" }],
    });
    expect(
      (await inviteStreamerEmail(ds, "creator", "new@gmail.com", "m1")).status,
    ).toBe("invited");
    expect(
      (await inviteStreamerEmail(ds, "creator", "new@gmail.com", "m2")).status,
    ).toBe("already_invited");
    const [invite] = ds.all("invitations");
    expect(invite).toMatchObject({
      email: "new@gmail.com",
      status: "pending",
      scorer_match_ids: [],
      streamer_match_ids: ["m1", "m2"],
    });

    await acceptInvitations(ds, "New@Gmail.com", "new-uid");
    const m1 = (await ds.getById("matches", "m1"))!;
    expect(m1.match_streamers).toEqual(["new-uid"]);
    expect(m1.match_admins).toEqual(["scorer"]);
    expect((await ds.getById("matches", "m2"))!.match_streamers).toEqual([
      "streamer",
      "new-uid",
    ]);
    expect((await ds.getById("invitations", invite!.id))!.status).toBe(
      "accepted",
    );
    expect(await isMatchAdmin(ds, "m1", "new-uid")).toBe(false);
    expect(await canProduceOverlay(ds, "m1", "new-uid")).toBe(true);
  });

  it("accepts scorer and streamer invites together", async () => {
    const ds = new MemoryDataSource({
      matches: [
        { ...match, match_admins: [], match_streamers: [] },
        { ...match, id: "m2", match_admins: [], match_streamers: [] },
      ],
      invitations: [
        {
          id: "i1",
          email: "both@gmail.com",
          status: "pending",
          scorer_match_ids: ["m1"],
          streamer_match_ids: ["m2"],
        },
      ],
    });
    await acceptInvitations(ds, "both@gmail.com", "u");
    expect((await ds.getById("matches", "m1"))!.match_admins).toEqual(["u"]);
    expect((await ds.getById("matches", "m2"))!.match_streamers).toEqual([
      "u",
    ]);
  });

  it("only lets the match's admins invite streamers", async () => {
    const ds = new MemoryDataSource({
      users: [...users, { id: "streamer" }],
      matches: [match],
    });
    await expect(
      inviteStreamerEmail(ds, "streamer", "x@gmail.com", "m1"),
    ).rejects.toThrow(/scorers can invite streamers/);
    await expect(
      inviteStreamerEmail(ds, null, "x@gmail.com", "m1"),
    ).rejects.toThrow(/Authentication required/);
  });

  it("lets a match admin revoke a streamer invite they did not send", async () => {
    const ds = new MemoryDataSource({
      matches: [match],
      invitations: [
        {
          id: "i1",
          email: "new@gmail.com",
          invited_by: "creator",
          status: "pending",
          streamer_match_ids: ["m1"],
        },
      ],
    });
    await expect(revokeInvitation(ds, "stranger", "i1")).rejects.toThrow();
    expect(await revokeInvitation(ds, "scorer", "i1")).toEqual({
      status: "revoked",
    });
  });
});
