import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("~/lib/firebase/live-sync", () => ({
  notifySquadChanged: vi.fn(),
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
import {
  addPlayerToTeam,
  removePlayerFromTeam,
  updatePlayerRole,
} from "./actions";

let ds: MemoryDataSource;
const T = "lions";

beforeEach(() => {
  // Captain A, vice-captain B, player C; the organiser runs the team.
  ds = new MemoryDataSource({
    users: [
      { id: "org", full_name: "Organiser" },
      { id: "a", full_name: "Asha" },
      { id: "b", full_name: "Bala" },
      { id: "c", full_name: "Chirag" },
    ],
    teams: [
      {
        id: T,
        name: "Lions",
        created_by: "org",
        captain_id: "a",
        vice_captain_id: "b",
      },
    ],
    team_players: [
      { id: "tp-a", team_id: T, user_id: "a", role_in_team: "captain" },
      { id: "tp-b", team_id: T, user_id: "b", role_in_team: "vice_captain" },
      { id: "tp-c", team_id: T, user_id: "c", role_in_team: "player" },
    ],
  });
  state.client = serverClientFor({
    ds,
    db: null,
    getUser: async () =>
      ({ id: "org", email: null, phone: null, user_metadata: {} }) as AppUser,
  });
});

/** The team's two columns and each squad row's role, side by side. */
async function roles() {
  const team = (await ds.getById("teams", T))!;
  const rows = await ds.query("team_players", [
    { field: "team_id", op: "==", value: T },
  ]);
  return {
    captain: team.captain_id ?? null,
    vice: team.vice_captain_id ?? null,
    squad: Object.fromEntries(rows.map((r) => [r.user_id, r.role_in_team])),
  };
}

describe("captain and vice-captain stay in step with the squad", () => {
  it("a new captain takes over: the old one becomes a player", async () => {
    expect(await updatePlayerRole(T, "c", "captain")).toEqual({ success: true });
    expect(await roles()).toEqual({
      captain: "c",
      vice: "b",
      squad: { a: "player", b: "vice_captain", c: "captain" },
    });
  });

  it("the vice-captain made captain is no longer vice-captain", async () => {
    await updatePlayerRole(T, "b", "captain");
    expect(await roles()).toEqual({
      captain: "b",
      vice: null,
      squad: { a: "player", b: "captain", c: "player" },
    });
  });

  it("a captain set as a regular player or keeper is no longer captain", async () => {
    await updatePlayerRole(T, "a", "player");
    expect(await roles()).toMatchObject({ captain: null, vice: "b" });
    await updatePlayerRole(T, "b", "wicket_keeper");
    expect(await roles()).toEqual({
      captain: null,
      vice: null,
      squad: { a: "player", b: "wicket_keeper", c: "player" },
    });
  });

  it("a captain taken out of the squad is no longer captain", async () => {
    expect(await removePlayerFromTeam(T, "a")).toEqual({ success: true });
    expect(await removePlayerFromTeam(T, "b")).toEqual({ success: true });
    expect(await roles()).toEqual({
      captain: null,
      vice: null,
      squad: { c: "player" },
    });
  });

  it("adds only someone who exists, with a role it knows, in step too", async () => {
    expect(await addPlayerToTeam(T, "ghost")).toEqual({
      error: "That player no longer exists",
    });
    expect(await addPlayerToTeam(T, "org", "emperor")).toEqual({
      error: "Choose captain, vice-captain, wicket-keeper or player",
    });
    expect((await roles()).squad).not.toHaveProperty("ghost");
    expect((await roles()).squad).not.toHaveProperty("org");

    expect(await addPlayerToTeam(T, "org", "captain")).toEqual({
      success: true,
    });
    expect(await roles()).toEqual({
      captain: "org",
      vice: "b",
      squad: { a: "player", b: "vice_captain", c: "player", org: "captain" },
    });
  });

  it("refuses someone not in the squad and a role it does not know", async () => {
    const before = await roles();
    expect((await updatePlayerRole(T, "org", "captain")).error).toBe(
      "That player is not in this team's squad",
    );
    expect((await updatePlayerRole(T, "c", "emperor")).error).toBe(
      "Choose captain, vice-captain, wicket-keeper or player",
    );
    expect(await roles()).toEqual(before);
  });
});
