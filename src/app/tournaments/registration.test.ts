import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("~/lib/match-cache", () => ({ invalidateMatchCache: vi.fn() }));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import type { AppUser } from "~/lib/firebase/auth-types";
import { MemoryDataSource } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { createMatch } from "~/app/matches/mutations";
import {
  createTournament,
  generateTournamentFixtures,
  registerTeamForTournament,
  updateRegistrationStatus,
  updateTournament,
} from "./actions";

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
      { id: "org", full_name: "Organiser" },
      { id: "cap", full_name: "Captain" },
      { id: "plr", full_name: "Player" },
    ],
    tournaments: [
      { id: "tour", name: "Summer Cup", created_by: "org", club_id: null },
    ],
    teams: [
      { id: "lions", name: "Lions", created_by: "cap", captain_id: "cap" },
      { id: "tigers", name: "Tigers", created_by: "org", captain_id: "org" },
    ],
    team_players: [{ id: "tp1", team_id: "lions", user_id: "plr" }],
  });
});

const registrationOf = async (teamId: string) =>
  (await ds.query("tournament_registrations", [
    { field: "team_id", op: "==", value: teamId },
  ]))[0];

const standingOf = async (teamId: string) =>
  (await ds.query("tournament_standings", [
    { field: "team_id", op: "==", value: teamId },
  ]))[0];

describe("registerTeamForTournament", () => {
  it("keeps a captain's request waiting, out of the points table", async () => {
    signIn("cap");
    const res = await registerTeamForTournament("tour", "lions");
    expect(res).toEqual({ success: true, status: "pending" });
    expect(await registrationOf("lions")).toMatchObject({ status: "pending" });

    // Another team's confirmation recalculates the table: still not there.
    signIn("org");
    await registerTeamForTournament("tour", "tigers");
    expect(await standingOf("tigers")).toBeDefined();
    expect(await standingOf("lions")).toBeUndefined();
  });

  it("adds an organiser's team straight away", async () => {
    signIn("org");
    const res = await registerTeamForTournament("tour", "tigers");
    expect(res).toEqual({ success: true, status: "confirmed" });
    expect(await registrationOf("tigers")).toMatchObject({ status: "confirmed" });
    expect(await standingOf("tigers")).toBeDefined();
  });

  it("refuses someone who only plays for the team", async () => {
    signIn("plr");
    const res = await registerTeamForTournament("tour", "lions");
    expect(res).toEqual({
      error: "You can only register teams that you represent or manage.",
    });
    expect(await registrationOf("lions")).toBeUndefined();
  });

  it("puts a request in the table once the organisers confirm it", async () => {
    signIn("cap");
    await registerTeamForTournament("tour", "lions");
    const reg = await registrationOf("lions");
    signIn("org");
    expect(
      await updateRegistrationStatus(reg!.id as string, "tour", "confirmed"),
    ).toEqual({ success: true });
    expect(await standingOf("lions")).toBeDefined();
  });

  it("does not let a waiting team play tournament matches", async () => {
    signIn("cap");
    await registerTeamForTournament("tour", "lions");
    signIn("org");
    await registerTeamForTournament("tour", "tigers");
    const res = await createMatch({
      title: "",
      matchFormat: "T20",
      oversPerInnings: 20,
      team1Id: "tigers",
      team2Id: "lions",
      tournamentId: "tour",
      scheduledAt: "2026-11-01T10:00:00.000Z",
    });
    expect(res.error).toBe(
      "The selected opponent team is not registered in this tournament.",
    );
  });
});

describe("tournament rules", () => {
  it("stores the overs chosen when the tournament is created", async () => {
    signIn("org");
    const fd = new FormData();
    fd.set("name", "Ten over cup");
    fd.set("match_format", "T10");
    fd.set("overs_per_innings", "10");
    expect(await createTournament(fd)).toBeUndefined();
    const [created] = await ds.query("tournaments", [
      { field: "name", op: "==", value: "Ten over cup" },
    ]);
    expect(created).toMatchObject({
      match_format: "T10",
      overs_per_innings: 10,
      status: "upcoming",
    });
  });

  it("refuses overs out of range", async () => {
    signIn("org");
    const fd = new FormData();
    fd.set("name", "Long cup");
    fd.set("overs_per_innings", "80");
    expect(await createTournament(fd)).toEqual({
      error: "Overs must be between 1 and 50",
    });
  });

  it("lets the organisers set the status and keeps the wickets when not sent", async () => {
    await ds.update("tournaments", "tour", { wickets_per_innings: 8 });
    signIn("org");
    const fd = new FormData();
    fd.set("name", "Summer Cup");
    fd.set("status", "ongoing");
    expect(await updateTournament("tour", fd)).toEqual({ success: true });
    expect(await ds.getById("tournaments", "tour")).toMatchObject({
      status: "ongoing",
      wickets_per_innings: 8,
      overs_per_innings: 20,
    });

    fd.set("status", "finished");
    expect(await updateTournament("tour", fd)).toEqual({
      error: "Unknown tournament status",
    });
  });
});

describe("generateTournamentFixtures", () => {
  it("starts at the organiser's chosen time, one round a day", async () => {
    await ds.insert("teams", [
      { id: "hawks", name: "Hawks", created_by: "org" },
    ]);
    signIn("org");
    for (const team of ["lions", "tigers", "hawks"]) {
      await registerTeamForTournament("tour", team);
    }
    const first = "2026-11-01T04:30:00.000Z"; // 10:00 in India
    const res = await generateTournamentFixtures("tour", first);
    expect(res).toMatchObject({ success: true, count: 3 });

    const fixtures = await ds.query("matches", [
      { field: "tournament_id", op: "==", value: "tour" },
    ]);
    const times = fixtures.map((m) => String(m.scheduled_at)).sort();
    expect(times[0]).toBe(first);
    for (const t of times) {
      // Whole days after the first match, never midnight UTC.
      const days = (Date.parse(t) - Date.parse(first)) / 86_400_000;
      expect(Number.isInteger(days)).toBe(true);
    }
  });

  it("refuses an unreadable start", async () => {
    signIn("org");
    expect(await generateTournamentFixtures("tour", "not a date")).toEqual({
      error: "Pick the first match's day and time",
    });
  });
});
