import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import type { AppUser } from "~/lib/firebase/auth-types";
import { MemoryDataSource, type Doc } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { getMyUpcomingMatches, getOnboardingProgress } from "./actions";
import { onboardingComplete } from "./onboarding";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

function signIn(ds: MemoryDataSource, id: string | null) {
  state.client = serverClientFor({
    ds,
    db: null,
    getUser: async () =>
      id
        ? ({ id, email: null, phone: null, user_metadata: {} } as AppUser)
        : null,
  });
}

describe("getOnboardingProgress", () => {
  it("is empty for a brand-new user, for 3 billed reads", async () => {
    const ds = new MemoryDataSource(seed);
    signIn(ds, "brand-new");
    const before = ds.billedReads;
    const p = await getOnboardingProgress();
    expect(p).toEqual({
      teamId: null,
      hasPlayers: false,
      matchId: null,
      hasCoScorer: false,
    });
    expect(ds.billedReads - before).toBe(3);
  });

  it("tracks each step from the user's own data", async () => {
    const ds = new MemoryDataSource({
      teams: [{ id: "t1", created_by: "u1", roster: [{ user_id: "u1" }] }],
    });
    signIn(ds, "u1");
    let p = (await getOnboardingProgress())!;
    expect(p).toMatchObject({ teamId: "t1", hasPlayers: false });
    expect(onboardingComplete(p)).toBe(false);

    await ds.update("teams", "t1", {
      roster: [{ user_id: "u1" }, { user_id: "u2" }],
    });
    // createMatch lists the creator among the scorers.
    await ds.insert("matches", [
      { id: "m1", created_by: "u1", match_admins: ["u1"] },
    ]);
    p = (await getOnboardingProgress())!;
    expect(p).toMatchObject({ hasPlayers: true, matchId: "m1" });
    expect(p.hasCoScorer).toBe(false);
    // Inviting a co-scorer is optional.
    expect(onboardingComplete(p)).toBe(true);

    await ds.update("matches", "m1", { match_admins: ["u1", "u3"] });
    expect((await getOnboardingProgress())!.hasCoScorer).toBe(true);
  });

  it("stays bounded for a busy seeded user", async () => {
    const ds = new MemoryDataSource(seed);
    const owner = String(seed.matches![0]!.created_by);
    signIn(ds, owner);
    const before = ds.billedReads;
    const p = (await getOnboardingProgress())!;
    expect(p.matchId).not.toBeNull();
    expect(ds.billedReads - before).toBeLessThanOrEqual(11);
  });

  it("returns null when signed out", async () => {
    signIn(new MemoryDataSource(), null);
    expect(await getOnboardingProgress()).toBeNull();
  });
});

describe("getMyUpcomingMatches", () => {
  const match = (id: string, fields: Record<string, unknown>) => ({
    id,
    status: "scheduled",
    match_admins: [],
    created_by: "someone",
    team1_id: "x1",
    team2_id: "x2",
    ...fields,
  });

  it("lists the matches you score or play in, soonest first", async () => {
    const ds = new MemoryDataSource({
      team_players: [{ id: "tp", team_id: "mine", user_id: "u1" }],
      matches: [
        match("later", { scheduled_at: "2026-12-01T10:00:00.000Z", match_admins: ["u1"] }),
        match("soon", { scheduled_at: "2026-11-01T10:00:00.000Z", team2_id: "mine" }),
        match("old-created", { scheduled_at: "2026-11-15T10:00:00.000Z", created_by: "u1" }),
        match("others", { scheduled_at: "2026-10-25T10:00:00.000Z" }),
        match("done", { status: "completed", match_admins: ["u1"], scheduled_at: "2026-10-01T10:00:00.000Z" }),
      ],
    });
    signIn(ds, "u1");
    const mine = (await getMyUpcomingMatches())!;
    expect(mine.map((m) => m.id)).toEqual(["soon", "old-created", "later"]);
  });

  it("stays bounded on the seed and is null when signed out", async () => {
    const ds = new MemoryDataSource(seed);
    const owner = String(seed.matches![0]!.created_by);
    signIn(ds, owner);
    const before = ds.billedReads;
    await getMyUpcomingMatches();
    // 5 queries of at most 6 matches, plus the user's squad entries.
    expect(ds.billedReads - before).toBeLessThanOrEqual(40);
    signIn(new MemoryDataSource(), null);
    expect(await getMyUpcomingMatches()).toBeNull();
  });
});
