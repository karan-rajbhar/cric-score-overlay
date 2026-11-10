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
  deleteTournament,
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

describe("updateRegistrationStatus", () => {
  it("lets only the registration's own organisers confirm or reject it", async () => {
    // "plr" organises a tournament of their own, and the captain's request
    // waits in Summer Cup.
    await ds.insert("tournaments", [
      { id: "other", name: "Other Cup", created_by: "plr", club_id: null },
    ]);
    signIn("cap");
    await registerTeamForTournament("tour", "lions");
    const reg = await registrationOf("lions");

    signIn("plr");
    for (const status of ["confirmed", "rejected"] as const) {
      expect(
        await updateRegistrationStatus(reg!.id as string, "other", status),
      ).toEqual({
        error: "Only tournament organizers can approve or reject registrations.",
      });
    }
    expect(await registrationOf("lions")).toMatchObject({
      status: "pending",
      tournament_id: "tour",
    });
    expect((await registrationOf("lions"))!.approved_by ?? null).toBeNull();
  });

  it("refuses a status other than confirmed or rejected", async () => {
    signIn("cap");
    await registerTeamForTournament("tour", "lions");
    const reg = await registrationOf("lions");
    signIn("org");
    expect(
      await updateRegistrationStatus(
        reg!.id as string,
        "tour",
        "withdrawn" as "confirmed",
      ),
    ).toEqual({ error: "Unknown registration status" });
    expect(await registrationOf("lions")).toMatchObject({ status: "pending" });
  });
});

describe("a rejected registration", () => {
  it("lets the team register again, keeping one row", async () => {
    signIn("cap");
    await registerTeamForTournament("tour", "lions");
    const reg = await registrationOf("lions");
    signIn("org");
    await updateRegistrationStatus(reg!.id as string, "tour", "rejected");

    signIn("cap");
    expect(await registerTeamForTournament("tour", "lions")).toEqual({
      success: true,
      status: "pending",
    });
    const rows = await ds.query("tournament_registrations", [
      { field: "team_id", op: "==", value: "lions" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: reg!.id, status: "pending" });

    // A team already in (or waiting) is not registered twice.
    expect(await registerTeamForTournament("tour", "lions")).toEqual({
      error: "This team is already registered",
    });
  });

  it("takes a team rejected after confirmation out of the points table", async () => {
    signIn("org");
    await registerTeamForTournament("tour", "tigers");
    expect(await standingOf("tigers")).toBeDefined();
    const reg = await registrationOf("tigers");
    await updateRegistrationStatus(reg!.id as string, "tour", "rejected");
    expect(await standingOf("tigers")).toBeUndefined();

    // Added again by the organisers: straight back in.
    expect(await registerTeamForTournament("tour", "tigers")).toEqual({
      success: true,
      status: "confirmed",
    });
    expect(await standingOf("tigers")).toBeDefined();
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

  it("refuses an end date before the start and an unknown format", async () => {
    signIn("org");
    const fd = new FormData();
    fd.set("name", "Backwards cup");
    fd.set("start_date", "2026-12-10");
    fd.set("end_date", "2026-12-01");
    expect(await createTournament(fd)).toEqual({
      error: "The end date is before the start date",
    });

    fd.delete("end_date");
    fd.set("tournament_format", "swiss");
    expect(await createTournament(fd)).toEqual({
      error: "Unknown tournament format",
    });
    expect(await updateTournament("tour", fd)).toEqual({
      error: "Unknown tournament format",
    });
    expect(await ds.query("tournaments", [])).toHaveLength(1);
  });
});

describe("a completed tournament", () => {
  it("takes no new registrations or generated fixtures", async () => {
    signIn("org");
    await registerTeamForTournament("tour", "tigers");
    await ds.insert("teams", [{ id: "hawks", name: "Hawks", created_by: "org" }]);
    await registerTeamForTournament("tour", "hawks");
    await ds.update("tournaments", "tour", { status: "completed" });

    const over = { error: "This tournament is over" };
    expect(await registerTeamForTournament("tour", "lions")).toEqual(over);
    signIn("cap");
    expect(await registerTeamForTournament("tour", "lions")).toEqual(over);
    signIn("org");
    expect(
      await generateTournamentFixtures("tour", "2026-11-01T04:30:00.000Z"),
    ).toEqual(over);
    expect(await registrationOf("lions")).toBeUndefined();
    expect(
      await ds.query("matches", [{ field: "tournament_id", op: "==", value: "tour" }]),
    ).toEqual([]);
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

  it("takes the tournament's rules as the match wizard does, once", async () => {
    // An older tournament keeps its overs in custom_overs only.
    await ds.update("tournaments", "tour", {
      match_format: "Custom",
      overs_per_innings: null,
      custom_overs: 10,
      wickets_per_innings: 8,
    });
    signIn("org");
    for (const team of ["lions", "tigers"]) {
      await registerTeamForTournament("tour", team);
    }
    const first = "2026-11-01T04:30:00.000Z";
    expect(await generateTournamentFixtures("tour", first)).toMatchObject({
      success: true,
      count: 1,
    });
    const fixtures = () =>
      ds.query("matches", [{ field: "tournament_id", op: "==", value: "tour" }]);
    expect(await fixtures()).toEqual([
      expect.objectContaining({
        match_format: "T10",
        overs_per_innings: 10,
        wickets_per_innings: 8,
      }),
    ]);

    // A stale page or a second organiser: no fixture twice.
    expect(await generateTournamentFixtures("tour", first)).toEqual({
      error: "Every pair of teams already has a fixture.",
    });
    expect(await fixtures()).toHaveLength(1);
  });
});

describe("deleteTournament", () => {
  it("deletes the fixtures that never started and keeps the rest as standalone matches", async () => {
    await ds.insert("teams", [{ id: "hawks", name: "Hawks", created_by: "org" }]);
    signIn("org");
    for (const team of ["lions", "tigers", "hawks"]) {
      await registerTeamForTournament("tour", team);
    }
    await generateTournamentFixtures("tour", "2026-11-01T04:30:00.000Z");
    const [done, started, unplayed] = await ds.query("matches", [
      { field: "tournament_id", op: "==", value: "tour" },
    ]);
    const client = state.client as ReturnType<typeof serverClientFor>;
    await client
      .from("matches")
      .update({
        status: "completed",
        result_type: "win",
        winning_team_id: done!.team1_id as string,
      })
      .eq("id", done!.id);
    // Started, then put back to "scheduled": its innings keep it.
    await ds.insert("innings", [
      { id: "inn1", match_id: started!.id, team_id: started!.team1_id, innings_number: 1 },
    ]);
    await ds.insert("invitations", [
      { id: "inv1", scorer_match_ids: [unplayed!.id, "other"] },
    ]);

    expect(await deleteTournament("tour")).toEqual({ success: true });

    expect(await ds.getById("tournaments", "tour")).toBeNull();
    expect(await ds.getById("matches", unplayed!.id)).toBeNull();
    for (const kept of [done!, started!]) {
      expect(await ds.getById("matches", kept.id)).toMatchObject({
        tournament_id: null,
      });
    }
    expect(await ds.getById("invitations", "inv1")).toMatchObject({
      scorer_match_ids: ["other"],
    });
    expect(ds.all("tournament_standings")).toEqual([]);
    expect(ds.all("tournament_registrations")).toEqual([]);
  });
});
