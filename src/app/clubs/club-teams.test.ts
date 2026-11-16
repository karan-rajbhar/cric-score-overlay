import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import type { AppUser } from "~/lib/firebase/auth-types";
import { MemoryDataSource } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { getTeamsForClub, setTeamClub } from "./club-teams";

let ds: MemoryDataSource;

function signIn(id: string) {
  state.client = serverClientFor({
    ds,
    db: null,
    getUser: async () =>
      ({ id, email: null, phone: null, user_metadata: {} }) as AppUser,
  });
}

beforeEach(() => {
  ds = new MemoryDataSource({
    users: [
      { id: "sec", full_name: "Secretary" },
      { id: "cap", full_name: "Captain" },
    ],
    clubs: [
      { id: "unity", name: "Unity CC", owner_id: "sec" },
      { id: "other", name: "Other CC", owner_id: "cap" },
    ],
    teams: [
      // Played the club's matches, made by the secretary: not in the club.
      { id: "omkar", name: "Omkar 11", created_by: "sec", club_id: null },
      // Played the club's matches, someone else's team in another club.
      { id: "rivals", name: "Rivals", created_by: "cap", captain_id: "cap", club_id: "other" },
      // Already the club's.
      { id: "first", name: "Unity Firsts", created_by: "sec", club_id: "unity" },
      // The secretary's, never played for the club.
      { id: "nets", name: "Net side", created_by: "sec", club_id: null },
    ],
    matches: [
      { id: "m1", club_id: "unity", team1_id: "omkar", team2_id: "rivals", scheduled_at: "2026-11-15T04:00:00.000Z" },
      { id: "m2", club_id: "unity", team1_id: "first", team2_id: "omkar", scheduled_at: "2026-11-08T04:00:00.000Z" },
    ],
  });
});

describe("a club's existing teams", () => {
  it("suggests the teams in its matches first, never one already in it", async () => {
    signIn("sec");
    const { teams, error } = await getTeamsForClub("unity");
    expect(error).toBeNull();
    expect(teams.map((t) => [t.id, t.playedForClub, t.inOtherClub, t.canAdd])).toEqual([
      ["omkar", true, false, true],
      ["rivals", true, true, false],
      ["nets", false, false, true],
    ]);
  });

  it("is for the club's admins only", async () => {
    signIn("cap");
    expect((await getTeamsForClub("unity")).error).toMatch(/admins/);
  });

  it("adds a team its admin runs", async () => {
    signIn("sec");
    expect(await setTeamClub("omkar", "unity")).toEqual({ error: null });
    expect((await ds.getById("teams", "omkar"))?.club_id).toBe("unity");
  });

  it("needs a say over the team, and the club's admin to join", async () => {
    signIn("sec");
    expect((await setTeamClub("rivals", "unity")).error).toMatch(/creator, captain/);
    signIn("cap");
    // Captain of Rivals, but not an admin of Unity.
    expect((await setTeamClub("rivals", "unity")).error).toMatch(/club's admins/);
    // Leaving a club takes only a say over the team.
    expect(await setTeamClub("rivals", null)).toEqual({ error: null });
    expect((await ds.getById("teams", "rivals"))?.club_id).toBeNull();
  });
});
