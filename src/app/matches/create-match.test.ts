import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/match-cache", () => ({ invalidateMatchCache: vi.fn() }));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import type { AppUser } from "~/lib/firebase/auth-types";
import { MemoryDataSource } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { createMatch } from "./mutations";

let ds: MemoryDataSource;

beforeEach(() => {
  ds = new MemoryDataSource({
    users: [{ id: "u1", full_name: "Asha" }],
    teams: [
      { id: "t1", name: "Lions", short_name: "LIO", created_by: "u1" },
      { id: "t2", name: "Tigers", short_name: "TIG", created_by: "u1" },
      { id: "t3", name: "Strangers", created_by: "someone-else" },
    ],
  });
  state.client = serverClientFor({
    ds,
    db: null,
    getUser: async () =>
      ({ id: "u1", email: null, phone: null, user_metadata: {} }) as AppUser,
  });
});

const base = {
  title: "",
  matchFormat: "T20" as const,
  oversPerInnings: 20,
  team1Id: "t1",
  team2Id: "t2",
};

describe("createMatch", () => {
  it("names the match after the teams and stores the match rules", async () => {
    const res = await createMatch({
      ...base,
      matchFormat: "T10",
      oversPerInnings: 10,
      ballsPerOver: 5,
      wicketsPerInnings: 7,
      wideRunsToBatsman: true,
      scheduledAt: "2026-10-17T10:00:00.000Z",
    });
    expect(res.error).toBeNull();
    const match = await ds.getById("matches", res.data!.id as string);
    expect(match).toMatchObject({
      title: "Lions vs Tigers",
      match_format: "T10",
      overs_per_innings: 10,
      balls_per_over: 5,
      wickets_per_innings: 7,
      wide_runs_to_batsman: true,
      wide_counts_as_ball_faced: false,
      noball_extras_to_batsman: false,
      status: "scheduled",
      team1_snapshot: { id: "t1", name: "Lions", short_name: "LIO" },
      team2_snapshot: { id: "t2", name: "Tigers", short_name: "TIG" },
    });
  });

  it("keeps a title the user typed", async () => {
    const res = await createMatch({ ...base, title: "  Final  " });
    const match = await ds.getById("matches", res.data!.id as string);
    expect(match?.title).toBe("Final");
    expect(match?.balls_per_over).toBe(6);
  });

  it("rejects out-of-range rules before writing", async () => {
    expect((await createMatch({ ...base, oversPerInnings: 0 })).error).toMatch(
      /overs/i,
    );
    expect((await createMatch({ ...base, ballsPerOver: 13 })).error).toMatch(
      /balls per over/i,
    );
    expect(
      (await createMatch({ ...base, wicketsPerInnings: 0 })).error,
    ).toMatch(/wickets/i);
    expect(await ds.query("matches", [])).toHaveLength(0);
  });

  it("still refuses an opponent the user does not manage", async () => {
    const res = await createMatch({ ...base, team2Id: "t3" });
    expect(res.error).toMatch(/opponent/i);
  });
});
