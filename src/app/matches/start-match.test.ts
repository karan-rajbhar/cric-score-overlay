/**
 * `startMatch` (the toss) over the in-memory store: a second toss, a
 * finished match and a toss winner outside the match change nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/match-cache", () => ({ invalidateMatchCache: vi.fn() }));
vi.mock("~/lib/push/notify", () => ({
  notifyFollowersAfter: vi.fn(),
  matchEventOf: vi.fn(),
  inningsEndEventOf: vi.fn(),
}));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import type { AppUser } from "~/lib/firebase/auth-types";
import { MemoryDataSource } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { startMatch } from "./mutations";

let ds: MemoryDataSource;

beforeEach(() => {
  ds = new MemoryDataSource({
    users: [{ id: "u1", full_name: "Asha" }],
    teams: [
      { id: "A", name: "Alpha" },
      { id: "B", name: "Bravo" },
    ],
    matches: [
      {
        id: "m1",
        title: "Alpha vs Bravo",
        team1_id: "A",
        team2_id: "B",
        status: "scheduled",
        created_by: "u1",
        match_admins: ["u1"],
        overs_per_innings: 20,
      },
    ],
  });
  state.client = serverClientFor({
    ds,
    db: null,
    getUser: async () =>
      ({ id: "u1", email: null, phone: null, user_metadata: {} }) as AppUser,
  });
});

const match = () => ds.getById("matches", "m1");
const innings = () =>
  ds.query("innings", [{ field: "match_id", op: "==", value: "m1" }]);

describe("startMatch", () => {
  it("starts a scheduled match with the side the toss sends in", async () => {
    const res = await startMatch("m1", "A", "bowl");
    expect(res.error).toBeNull();
    expect(await match()).toMatchObject({
      status: "live",
      toss_winner_team_id: "A",
      toss_decision: "bowl",
      current_innings: 1,
    });
    expect(await innings()).toEqual([
      expect.objectContaining({ innings_number: 1, team_id: "B" }),
    ]);
  });

  it("refuses a second toss on a live match and keeps the first", async () => {
    await startMatch("m1", "A", "bat");
    const res = await startMatch("m1", "B", "bat");
    expect(res).toEqual({
      data: null,
      error: "This match has already started",
    });
    expect(await match()).toMatchObject({
      toss_winner_team_id: "A",
      toss_decision: "bat",
    });
    expect(await innings()).toEqual([
      expect.objectContaining({ innings_number: 1, team_id: "A" }),
    ]);
  });

  it("refuses a finished match", async () => {
    await ds.update("matches", "m1", {
      status: "completed",
      current_innings: 2,
    });
    const res = await startMatch("m1", "A", "bat");
    expect(res.error).toBe("This match has already started");
    expect(await match()).toMatchObject({
      status: "completed",
      current_innings: 2,
    });
    expect(await innings()).toEqual([]);
  });

  it("refuses a toss winner who is not playing", async () => {
    const res = await startMatch("m1", "C", "bat");
    expect(res.error).toBe("Choose the team that won the toss");
    expect((await match())?.status).toBe("scheduled");
    expect(await innings()).toEqual([]);
  });

  it("finishes a start that stopped after opening the innings", async () => {
    await ds.insert("innings", [
      { id: "i1", match_id: "m1", innings_number: 1, team_id: "A" },
    ]);
    const res = await startMatch("m1", "A", "bowl");
    expect(res.error).toBeNull();
    expect((await match())?.status).toBe("live");
    expect(await innings()).toEqual([
      expect.objectContaining({ id: "i1", innings_number: 1, team_id: "B" }),
    ]);
  });
});
