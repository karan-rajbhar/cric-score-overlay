import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/match-cache", () => ({ invalidateMatchCache: vi.fn() }));
vi.mock("~/lib/firebase/live-sync", () => ({ refreshLiveState: vi.fn() }));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import type { AppUser } from "~/lib/firebase/auth-types";
import { MemoryDataSource, type Doc } from "~/lib/firebase/datasource";
import { refreshLiveState } from "~/lib/firebase/live-sync";
import { serverClientFor } from "~/lib/firebase/server-client";
import { setMatchClub } from "./club";

let ds: MemoryDataSource;

function signIn(id: string | null) {
  state.client = serverClientFor({
    ds,
    db: null,
    getUser: async () =>
      id
        ? ({ id, email: null, phone: null, user_metadata: {} } as AppUser)
        : null,
  });
}

describe("setMatchClub: who may", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ds = new MemoryDataSource({
      users: ["owner", "admin", "scorer", "member", "outsider"].map((id) => ({
        id,
      })),
      clubs: [
        { id: "c1", name: "Riverside CC", owner_id: "owner" },
        { id: "c2", name: "Hill CC", owner_id: "someone" },
      ],
      club_memberships: [
        { id: "k1", club_id: "c1", user_id: "admin", role: "admin", status: "active" },
        { id: "k2", club_id: "c1", user_id: "scorer", role: "member", status: "active" },
        { id: "k3", club_id: "c1", user_id: "member", role: "member", status: "active" },
      ],
      matches: [
        {
          id: "m1",
          status: "completed",
          created_by: "scorer",
          match_admins: ["scorer", "outsider"],
          team1_id: "A",
          team2_id: "B",
          club_id: null,
        },
        {
          id: "m2",
          status: "completed",
          created_by: "scorer",
          match_admins: ["scorer"],
          team1_id: "A",
          team2_id: "B",
          tournament_id: "t1",
        },
      ],
    });
  });

  const clubOf = async (id: string) =>
    (await ds.getById("matches", id)) as Doc | null;

  it("lets a member who scores the match add it, with the side that counts", async () => {
    signIn("scorer");
    expect(await setMatchClub("m1", "c1", "team1")).toEqual({ error: null });
    expect(await clubOf("m1")).toMatchObject({
      club_id: "c1",
      club_side: "team1",
      club_snapshot: { id: "c1", name: "Riverside CC" },
    });
    expect(refreshLiveState).toHaveBeenCalledWith(expect.anything(), "m1");
  });

  it("lets the club's admins add any match", async () => {
    for (const id of ["owner", "admin"]) {
      signIn(id);
      expect(await setMatchClub("m1", "c1", "both")).toEqual({ error: null });
      expect((await clubOf("m1"))?.club_side ?? null).toBeNull();
      await ds.update("matches", "m1", { club_id: null });
    }
  });

  it("refuses a scorer who is not a member, and a member who does not score", async () => {
    for (const id of ["outsider", "member"]) {
      signIn(id);
      expect((await setMatchClub("m1", "c1", "both")).error).toMatch(
        /club's admins, or members who score this match/,
      );
    }
    expect((await clubOf("m1"))?.club_id).toBeNull();
  });

  it("needs leave to take a match out of its club as well", async () => {
    await ds.update("matches", "m1", { club_id: "c2" });
    signIn("scorer"); // a member of c1 but not of c2
    expect((await setMatchClub("m1", "c1", "both")).error).toBeTruthy();
    expect((await clubOf("m1"))?.club_id).toBe("c2");
  });

  it("leaves a tournament match with its tournament's club", async () => {
    signIn("owner");
    expect((await setMatchClub("m2", "c1", "both")).error).toMatch(
      /tournament's club/,
    );
  });

  it("refuses signed-out users and unknown sides", async () => {
    signIn(null);
    expect((await setMatchClub("m1", "c1", "both")).error).toMatch(/logged in/);
    signIn("owner");
    expect(
      (await setMatchClub("m1", "c1", "away" as never)).error,
    ).toBeTruthy();
  });
});

describe("setMatchClub: the statistics follow", () => {
  const seed = JSON.parse(
    readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
  ) as Record<string, Doc[]>;
  const done = seed.matches!.find(
    (m) => m.status === "completed" && m.club_id && !m.tournament_id,
  );

  it("moves a finished match out of the club and back for its own side only", async () => {
    if (!done) return; // the seed has no such match
    ds = new MemoryDataSource(structuredClone(seed));
    const club = String(done.club_id);
    const owner = String(seed.clubs!.find((c) => c.id === club)!.owner_id);
    const records = () =>
      ds.all("player_matches").filter((d) => d.match_id === done.id);
    signIn(owner);

    // Started without a club: nobody's figures are the club's.
    expect(await setMatchClub(String(done.id), null, "both")).toEqual({
      error: null,
    });
    expect(records().every((r) => r.club_id === null)).toBe(true);

    // Added for team1 only: only team1's players count. They batted in
    // team1's innings, and bowled and fielded in team2's.
    expect(await setMatchClub(String(done.id), club, "team1")).toEqual({
      error: null,
    });
    type Line = { user_id: string };
    type Wicket = { fielder_id?: string | null };
    const innings = seed.innings!.filter((i) => i.match_id === done.id);
    const team1 = new Set<string>();
    for (const i of innings) {
      if (i.team_id === done.team1_id) {
        for (const b of i.batting as Line[]) team1.add(b.user_id);
      } else {
        for (const b of i.bowling as Line[]) team1.add(b.user_id);
        for (const f of i.fall_of_wickets as Wicket[])
          if (f.fielder_id) team1.add(f.fielder_id);
      }
    }
    expect(team1.size).toBeGreaterThan(0);
    expect(records().some((r) => !team1.has(String(r.user_id)))).toBe(true);
    for (const r of records()) {
      expect(r.club_id).toBe(team1.has(String(r.user_id)) ? club : null);
    }
  });
});
