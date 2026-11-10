import { describe, expect, it } from "vitest";
import type { AppUser } from "../auth-types";
import { MemoryDataSource } from "../datasource";
import { addTeamPlayer, createTeamPlayer, ensureOwnProfile } from "./profiles";

function googleUser(id: string, email: string | null, name = "Ann"): AppUser {
  return {
    id,
    email,
    phone: null,
    user_metadata: { full_name: name },
    provider: "google.com",
  };
}

describe("ensureOwnProfile and users_private", () => {
  it("creates a public profile without contact details", async () => {
    const ds = new MemoryDataSource();
    const res = await ensureOwnProfile(ds, googleUser("u1", "Ann@Gmail.com"));
    expect(res.action).toBe("created");
    const profile = await ds.getById("users", "u1");
    expect(profile).toMatchObject({ full_name: "Ann", username: "ann" });
    expect(profile).not.toHaveProperty("email");
    expect(profile).not.toHaveProperty("phone");
    expect(await ds.getById("users_private", "u1")).toMatchObject({
      email: "ann@gmail.com",
      phone: null,
    });
  });

  it("does not write when nothing changed", async () => {
    const ds = new MemoryDataSource();
    await ensureOwnProfile(ds, googleUser("u1", "ann@gmail.com"));
    const profileBefore = await ds.getById("users", "u1");
    const privateBefore = await ds.getById("users_private", "u1");
    await new Promise((r) => setTimeout(r, 2));
    const res = await ensureOwnProfile(ds, googleUser("u1", "ann@gmail.com"));
    expect(res.action).toBe("updated");
    expect(await ds.getById("users", "u1")).toEqual(profileBefore);
    expect(await ds.getById("users_private", "u1")).toEqual(privateBefore);
  });

  it("fills users_private for a profile that predates it", async () => {
    const ds = new MemoryDataSource({
      users: [{ id: "u1", full_name: "Ann", username: "ann" }],
    });
    await ensureOwnProfile(ds, googleUser("u1", "ann@gmail.com"));
    expect(await ds.getById("users_private", "u1")).toMatchObject({
      email: "ann@gmail.com",
    });
  });

  it("re-maps a seeded profile found by its private email", async () => {
    const ds = new MemoryDataSource({
      users: [{ id: "seed-1", full_name: "John Smith", username: "john" }],
      users_private: [
        { id: "seed-1", email: "john@email.com", phone: "+1234" },
      ],
      team_players: [{ id: "tp1", team_id: "t1", user_id: "seed-1" }],
    });
    const res = await ensureOwnProfile(
      ds,
      googleUser("auth-1", "John@email.com", "John"),
    );
    expect(res).toMatchObject({ action: "remapped", username: "john" });
    expect(await ds.getById("users", "seed-1")).toBeNull();
    expect(await ds.getById("users_private", "seed-1")).toBeNull();
    expect(await ds.getById("users", "auth-1")).toMatchObject({
      full_name: "John Smith",
    });
    expect(await ds.getById("users_private", "auth-1")).toMatchObject({
      email: "john@email.com",
      phone: "+1234",
    });
    expect(await ds.getById("team_players", "tp1")).toMatchObject({
      user_id: "auth-1",
    });
  });

  it("gives an account without email a placeholder private email", async () => {
    const ds = new MemoryDataSource();
    await ensureOwnProfile(ds, googleUser("abcdef1234", null));
    expect(await ds.getById("users_private", "abcdef1234")).toMatchObject({
      email: "player-abcdef12@players.local",
    });
  });
});

describe("createTeamPlayer", () => {
  it("stores the placeholder email privately", async () => {
    const ds = new MemoryDataSource({
      teams: [{ id: "t1", created_by: "owner", club_id: null }],
    });
    const res = await createTeamPlayer(ds, "owner", "t1", "Sam Lee", 7);
    const profile = await ds.getById("users", res.user_id);
    expect(profile).toMatchObject({ full_name: "Sam Lee" });
    expect(profile).not.toHaveProperty("email");
    const priv = await ds.getById("users_private", res.user_id);
    expect(String(priv?.email)).toMatch(
      /^player\.samlee\.[0-9a-f]{8}@players\.local$/,
    );
  });

  it("lets a match's invited scorer add players to its teams, also to correct it after it is over", async () => {
    const ds = new MemoryDataSource({
      teams: [
        { id: "t1", created_by: "owner", club_id: null },
        { id: "t2", created_by: "owner", club_id: null },
        { id: "t3", created_by: "owner", club_id: null },
      ],
      matches: [
        {
          id: "m1",
          created_by: "owner",
          match_admins: ["coscorer"],
          team1_id: "t1",
          team2_id: "t2",
          status: "live",
        },
      ],
    });
    // Not without the match, and not to a team outside it.
    await expect(
      createTeamPlayer(ds, "coscorer", "t1", "Ana", null),
    ).rejects.toThrow(/not_authorized/);
    await expect(
      createTeamPlayer(ds, "coscorer", "t3", "Ana", null, "m1"),
    ).rejects.toThrow(/not_authorized/);
    // Someone who does not score the match.
    await expect(
      createTeamPlayer(ds, "stranger", "t1", "Ana", null, "m1"),
    ).rejects.toThrow(/not_authorized/);

    for (const team of ["t1", "t2"]) {
      const res = await createTeamPlayer(ds, "coscorer", team, "Ana", null, "m1");
      const rows = await ds.query("team_players", [
        { field: "user_id", op: "==", value: res.user_id },
      ]);
      expect(rows).toMatchObject([{ team_id: team, added_by: "coscorer" }]);
    }

    // After the match: still, to put the player who really played in the
    // squad (a wrong player replaced); still never a team outside it.
    await ds.update("matches", "m1", { status: "completed" });
    await expect(
      createTeamPlayer(ds, "coscorer", "t1", "Ben", null, "m1"),
    ).resolves.toMatchObject({ full_name: "Ben" });
    await expect(
      createTeamPlayer(ds, "coscorer", "t3", "Ben", null, "m1"),
    ).rejects.toThrow(/not_authorized/);
  });
});

describe("addTeamPlayer", () => {
  it("adds a registered player to a squad once, for the same people who may create one", async () => {
    const ds = new MemoryDataSource({
      teams: [
        { id: "t1", created_by: "owner", club_id: null },
        { id: "t2", created_by: "owner", club_id: null },
      ],
      users: [{ id: "u1", full_name: "Sam Lee" }],
      matches: [
        {
          id: "m1",
          created_by: "owner",
          match_admins: ["coscorer"],
          team1_id: "t1",
          team2_id: "t2",
          status: "live",
        },
      ],
    });
    await expect(addTeamPlayer(ds, "coscorer", "t1", "u1")).rejects.toThrow(
      /not_authorized/,
    );
    await expect(
      addTeamPlayer(ds, "coscorer", "t1", "nobody", "m1"),
    ).rejects.toThrow(/player_not_found/);

    const res = await addTeamPlayer(ds, "coscorer", "t1", "u1", "m1");
    expect(res).toEqual({ user_id: "u1", full_name: "Sam Lee" });
    // Again (a retried request): still one squad row.
    await addTeamPlayer(ds, "coscorer", "t1", "u1", "m1");
    const rows = await ds.query("team_players", [
      { field: "user_id", op: "==", value: "u1" },
    ]);
    expect(rows).toMatchObject([{ team_id: "t1", added_by: "coscorer" }]);
  });
});

describe("addTeamPlayer for a placeholder", () => {
  it("adds one only for someone who runs a team that has it", async () => {
    const ds = new MemoryDataSource({
      teams: [
        { id: "t1", created_by: "owner", club_id: null },
        { id: "t2", created_by: "rival", club_id: null },
        { id: "t3", created_by: "owner", club_id: null },
        { id: "mine", created_by: "outsider", club_id: null },
      ],
      users: [
        { id: "p2", full_name: "Placeholder", is_placeholder: true },
        { id: "orphan", full_name: "Nobody's", is_placeholder: true },
      ],
      team_players: [{ id: "tp", team_id: "t2", user_id: "p2" }],
      matches: [
        {
          id: "m1",
          created_by: "owner",
          match_admins: ["coscorer"],
          team1_id: "t1",
          team2_id: "t2",
          status: "live",
        },
      ],
    });
    const squadOf = async (teamId: string) =>
      (
        await ds.query("team_players", [
          { field: "team_id", op: "==", value: teamId },
        ])
      ).map((r) => r.user_id);

    // An outsider, and a team admin with no say over the player's team.
    await expect(addTeamPlayer(ds, "outsider", "mine", "p2")).rejects.toThrow(
      /not_authorized/,
    );
    await expect(addTeamPlayer(ds, "owner", "t3", "p2")).rejects.toThrow(
      /not_authorized/,
    );
    await expect(addTeamPlayer(ds, "outsider", "mine", "orphan")).rejects.toThrow(
      /not_authorized/,
    );
    expect(await squadOf("mine")).toEqual([]);
    expect(await squadOf("t3")).toEqual([]);

    // The match's scorer, from the other side's squad ("Plays for ...").
    await addTeamPlayer(ds, "coscorer", "t1", "p2", "m1");
    expect(await squadOf("t1")).toEqual(["p2"]);
    // The player's own team admin, to another team of theirs.
    await addTeamPlayer(ds, "rival", "t2", "p2");
    await ds.update("teams", "t3", { captain_id: "rival" });
    await addTeamPlayer(ds, "rival", "t3", "p2");
    expect(await squadOf("t3")).toEqual(["p2"]);
  });
});

describe("addTeamPlayer for a placeholder in no squad", () => {
  it("adds them back for an admin of a team they played for", async () => {
    // Taken out of every squad by mistake; one batted for t1, one bowled
    // for t1 (in t2's innings), both against t2.
    const ds = new MemoryDataSource({
      teams: [
        { id: "t1", created_by: "owner", club_id: null },
        { id: "t2", created_by: "rival", club_id: null },
        { id: "t3", created_by: "owner", club_id: null },
        { id: "mine", created_by: "outsider", club_id: null },
      ],
      users: [
        { id: "bat", full_name: "Batter", is_placeholder: true },
        { id: "bowl", full_name: "Bowler", is_placeholder: true },
      ],
      matches: [{ id: "m0", team1_id: "t1", team2_id: "t2", status: "completed" }],
      innings: [
        { id: "i1", match_id: "m0", team_id: "t1", innings_number: 1 },
        { id: "i2", match_id: "m0", team_id: "t2", innings_number: 2 },
      ],
      player_matches: [
        { id: "m0_bat", match_id: "m0", user_id: "bat", batting: [{ innings_id: "i1" }], bowling: [] },
        { id: "m0_bowl", match_id: "m0", user_id: "bowl", batting: [], bowling: [{ innings_id: "i2" }] },
      ],
    });
    const squads = async () =>
      (await ds.query("team_players", [])).map((r) => `${r.team_id}:${r.user_id}`).sort();

    for (const player of ["bat", "bowl"]) {
      // Not for the other side's admin, nor an outsider.
      await expect(addTeamPlayer(ds, "rival", "t2", player)).rejects.toThrow(
        /placeholder_of_other_team/,
      );
      await expect(addTeamPlayer(ds, "outsider", "mine", player)).rejects.toThrow(
        /placeholder_of_other_team/,
      );
    }
    expect(await squads()).toEqual([]);

    await addTeamPlayer(ds, "owner", "t1", "bat");
    await addTeamPlayer(ds, "owner", "t3", "bowl");
    expect(await squads()).toEqual(["t1:bat", "t3:bowl"]);
  });
});
