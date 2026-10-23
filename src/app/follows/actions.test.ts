import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state: { ds: unknown; userId: string | null } = { ds: null, userId: null };

vi.mock("~/lib/admin-data-source", () => ({
  adminDataSource: () => state.ds,
}));
vi.mock("~/lib/firebase/server", async () => {
  const { serverClientFor } = await import("~/lib/firebase/server-client");
  return {
    createServerClient: async () =>
      serverClientFor({
        ds: state.ds as never,
        db: null,
        getUser: async () =>
          state.userId
            ? ({ id: state.userId, email: null, phone: null, user_metadata: {} } as never)
            : null,
      }),
  };
});

import { MemoryDataSource, type Doc } from "~/lib/firebase/datasource";
import { getFollowingFeed, getMyFollows, setFollow } from "./actions";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;
const STRIKERS = "750e8400-e29b-41d4-a716-446655440001";

let ds: MemoryDataSource;

beforeEach(() => {
  ds = new MemoryDataSource(seed);
  state.ds = ds;
  state.userId = "550e8400-e29b-41d4-a716-446655440001";
});

describe("follow actions", () => {
  it("follows and unfollows, returning what the user follows", async () => {
    expect(await getMyFollows()).toEqual({ data: [], error: null });
    expect(await setFollow("team", STRIKERS, true)).toEqual({
      data: [`team:${STRIKERS}`],
      error: null,
    });
    expect((await getMyFollows()).data).toEqual([`team:${STRIKERS}`]);
    expect(await setFollow("team", STRIKERS, false)).toEqual({
      data: [],
      error: null,
    });
  });

  it("refuses bad input, missing targets and signed-out users", async () => {
    expect((await setFollow("club", STRIKERS, true)).error).toBe("Invalid request");
    expect((await setFollow("team", "../x", true)).error).toBe("Invalid request");
    expect((await setFollow("team", "no-such-team", true)).error).toBe("Not found");
    state.userId = null;
    expect((await setFollow("team", STRIKERS, true)).error).toBe("Sign in to follow");
    expect(await getMyFollows()).toEqual({ data: [], error: null });
    expect(await getFollowingFeed()).toEqual({ data: null, error: null });
  });

  it("serves the feed with no match reads when nothing is followed", async () => {
    const before = ds.billedReads;
    const res = await getFollowingFeed();
    expect(res.data).toMatchObject({ targets: [], upcoming: [] });
    // The follows document only (missing: still 1 read).
    expect(ds.billedReads - before).toBe(1);
  });

  it("serves upcoming fixtures of followed teams", async () => {
    await setFollow("team", STRIKERS, true);
    const res = await getFollowingFeed();
    expect(res.error).toBeNull();
    expect(res.data?.targets).toEqual([`team:${STRIKERS}`]);
    expect(res.data?.teamIds).toEqual([STRIKERS]);
  });
});
