import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("~/lib/match-cache", () => ({ invalidateMatchCache: vi.fn() }));
vi.mock("~/lib/firebase/live-sync", () => ({
  refreshLiveMatchesFor: vi.fn(),
  refreshLiveState: vi.fn(),
}));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import type { AppUser } from "~/lib/firebase/auth-types";
import { MemoryDataSource } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { createTeam, updateTeam } from "./actions";

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
    users: [{ id: "cap" }, { id: "plr" }, { id: "org" }],
    teams: [
      { id: "t1", name: "Lions", short_name: "LIO", created_by: "cap", captain_id: "cap" },
      { id: "t2", name: "Tigers", short_name: "TIGERS", created_by: "cap" },
    ],
    team_players: [{ id: "tp1", team_id: "t1", user_id: "plr" }],
    matches: [
      {
        id: "m1",
        team1_id: "t1",
        team2_id: "t2",
        status: "scheduled",
        team1_snapshot: { id: "t1", name: "Lions", short_name: "LIO", logo_url: null },
      },
    ],
  });
});

describe("updateTeam", () => {
  it("renames a team, and its matches show the new name", async () => {
    signIn("cap");
    expect(
      await updateTeam("t1", {
        name: " Mumbai Lions ",
        shortName: "mli",
        description: "  Since 1990 ",
      }),
    ).toEqual({ error: null });
    expect(await ds.getById("teams", "t1")).toMatchObject({
      name: "Mumbai Lions",
      short_name: "MLI",
      description: "Since 1990",
    });
    expect(await ds.getById("matches", "m1")).toMatchObject({
      team1_snapshot: { name: "Mumbai Lions", short_name: "MLI" },
    });
  });

  it("refuses someone who only plays for the team", async () => {
    signIn("plr");
    expect((await updateTeam("t1", { name: "Hacked" })).error).toMatch(
      /can edit it/,
    );
    expect(await ds.getById("teams", "t1")).toMatchObject({ name: "Lions" });
  });

  it("needs a name and a short name that fits the scoreboard", async () => {
    signIn("cap");
    expect(await updateTeam("t1", { name: "  " })).toEqual({
      error: "Team name is required",
    });
    expect(await updateTeam("t1", { name: "Lions", shortName: "LIONSX" })).toEqual({
      error: "Short name: up to 5 letters",
    });
    // An older, longer short name may stay as it is.
    expect(
      await updateTeam("t2", { name: "Tigers XI", shortName: "TIGERS" }),
    ).toEqual({ error: null });
  });
});

describe("team colours", () => {
  it("stores #rrggbb colours and copies them onto the team's matches", async () => {
    signIn("cap");
    expect(
      await updateTeam("t1", {
        name: "Lions",
        primaryColor: "#1E3A8A",
        secondaryColor: "#facc15",
      }),
    ).toEqual({ error: null });
    expect(await ds.getById("teams", "t1")).toMatchObject({
      primary_color: "#1e3a8a",
      secondary_color: "#facc15",
    });
    expect(await ds.getById("matches", "m1")).toMatchObject({
      team1_snapshot: {
        name: "Lions",
        primary_color: "#1e3a8a",
        secondary_color: "#facc15",
      },
    });

    // Cleared with null, left alone when not sent.
    await updateTeam("t1", { name: "Lions", secondaryColor: null });
    expect(await ds.getById("teams", "t1")).toMatchObject({
      primary_color: "#1e3a8a",
      secondary_color: null,
    });
    expect(await ds.getById("matches", "m1")).toMatchObject({
      team1_snapshot: { secondary_color: null },
    });
  });

  it("rejects anything that is not #rrggbb, on edit and on create", async () => {
    signIn("cap");
    for (const bad of ["red", "#fff", "1e3a8a", "#1e3a8az"]) {
      expect(await updateTeam("t1", { name: "Lions", primaryColor: bad })).toEqual({
        error: "Team colours must look like #1a2b3c",
      });
    }
    expect(await ds.getById("teams", "t1")).not.toHaveProperty(
      "primary_color",
      "red",
    );
    const fd = new FormData();
    fd.set("name", "Bad colours");
    fd.set("secondary_color", "blue");
    expect(await createTeam(fd)).toEqual({
      error: "Team colours must look like #1a2b3c",
    });
  });

  it("refuses colour changes from someone who cannot manage the team", async () => {
    signIn("plr");
    expect(
      (await updateTeam("t1", { name: "Lions", primaryColor: "#000000" })).error,
    ).toMatch(/can edit it/);
  });

  it("gives new matches the team's colours", async () => {
    await ds.update("teams", "t1", { primary_color: "#15803d" });
    signIn("cap");
    const { createMatch } = await import("~/app/matches/mutations");
    const res = await createMatch({
      title: "",
      matchFormat: "T20",
      oversPerInnings: 20,
      team1Id: "t1",
      team2Id: "t2",
      scheduledAt: "2026-11-01T10:00:00.000Z",
    });
    expect(res.error).toBeNull();
    expect(await ds.getById("matches", res.data!.id as string)).toMatchObject({
      team1_snapshot: { primary_color: "#15803d", secondary_color: null },
      team2_snapshot: { primary_color: null },
    });
  });
});

describe("createTeam", () => {
  const form = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  };
  const squadOf = async (teamId: string) =>
    ds.query("team_players", [{ field: "team_id", op: "==", value: teamId }]);
  const teamNamed = async (name: string) =>
    (await ds.query("teams", [{ field: "name", op: "==", value: name }]))[0]!;

  it("adds the creator to the squad as captain by default", async () => {
    signIn("org");
    await createTeam(form({ name: "Hawks", primary_color: "#7C3AED" }));
    const team = await teamNamed("Hawks");
    expect(team).toMatchObject({
      captain_id: "org",
      created_by: "org",
      primary_color: "#7c3aed",
      secondary_color: null,
    });
    expect(await squadOf(team.id as string)).toMatchObject([
      { user_id: "org", role_in_team: "captain" },
    ]);
  });

  it("leaves the creator out when they do not play for the team", async () => {
    signIn("org");
    await createTeam(form({ name: "Eagles", join_squad: "false" }));
    const team = await teamNamed("Eagles");
    expect(team).toMatchObject({ captain_id: null, created_by: "org" });
    expect(await squadOf(team.id as string)).toEqual([]);

    // They still manage it.
    expect(await updateTeam(team.id as string, { name: "Eagles XI" })).toEqual({
      error: null,
    });
  });
});
