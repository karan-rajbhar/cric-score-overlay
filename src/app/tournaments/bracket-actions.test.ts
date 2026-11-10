import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const state: { ds: unknown; userId: string | null } = { ds: null, userId: null };
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
import { createNextRound, previewNextRound } from "./bracket-actions";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

// The seed's knockout tournament: 3 confirmed teams, organised by user 2.
const KNOCKOUT = "850e8400-e29b-41d4-a716-446655440002";
const ORGANISER = "550e8400-e29b-41d4-a716-446655440002";

let ds: MemoryDataSource;

async function knockoutMatches() {
  return (await ds.query("matches", [
    { field: "tournament_id", op: "==", value: KNOCKOUT },
  ])).filter((m) => m.stage === "knockout");
}

beforeEach(() => {
  ds = new MemoryDataSource(seed);
  state.ds = ds;
  state.userId = ORGANISER;
});

describe("bracket actions", () => {
  it("previews and creates the first round with a bye, then the final", async () => {
    const preview = await previewNextRound(KNOCKOUT);
    expect(preview.error).toBeNull();
    expect(preview.data).toMatchObject({
      kind: "knockout",
      label: "First round",
      byes: [expect.any(String)],
    });
    expect(preview.data!.matches).toHaveLength(1);
    // Nothing written by a preview.
    expect(await knockoutMatches()).toHaveLength(0);

    const created = await createNextRound(KNOCKOUT);
    expect(created).toEqual({ data: { count: 1, label: "First round" }, error: null });
    const [first] = await knockoutMatches();
    expect(first).toMatchObject({
      stage: "knockout",
      round: 1,
      status: "scheduled",
      tournament_id: KNOCKOUT,
      match_admins: [ORGANISER],
    });
    expect(String(first!.title)).toMatch(/^First round: .+ vs .+$/);
    // The day after the tournament's latest fixture (5 Sep 2024).
    expect(first!.scheduled_at).toBe("2024-09-06T10:00:00.000Z");
    expect(first!.team1_snapshot).toMatchObject({ name: expect.any(String) });

    // Not before the first round has a result.
    expect((await previewNextRound(KNOCKOUT)).data?.kind).toBe("waiting");
    expect((await createNextRound(KNOCKOUT)).error).toMatch(/still to finish/);

    await ds.update("matches", first!.id, {
      status: "completed",
      winning_team_id: first!.team2_id,
      result_type: "win",
    });
    const final = await createNextRound(KNOCKOUT);
    expect(final).toEqual({ data: { count: 1, label: "Final" }, error: null });
    const ko = await knockoutMatches();
    const finalMatch = ko.find((m) => m.round === 2)!;
    expect([finalMatch.team1_id, finalMatch.team2_id]).toContain(first!.team2_id);
    expect([finalMatch.team1_id, finalMatch.team2_id]).not.toContain(first!.team1_id);
  });

  it("is for the organiser only", async () => {
    state.userId = "550e8400-e29b-41d4-a716-446655440003";
    expect((await previewNextRound(KNOCKOUT)).error).toBe(
      "Only tournament organisers can create rounds",
    );
    state.userId = null;
    expect((await createNextRound(KNOCKOUT)).error).toBe("You must be logged in");
  });

  it("explains why a league gets no rounds", async () => {
    const league = await previewNextRound("850e8400-e29b-41d4-a716-446655440001", {});
    expect(league.error).toBe("Only tournament organisers can create rounds");
    state.userId = "550e8400-e29b-41d4-a716-446655440001";
    const res = await previewNextRound("850e8400-e29b-41d4-a716-446655440001");
    expect(res.data).toMatchObject({ kind: "invalid" });
  });
});

describe("a created round", () => {
  it("takes the tournament's rules and starts at the organiser's chosen time", async () => {
    // The seed's ODI knockout keeps its overs in custom_overs only.
    expect((await createNextRound(KNOCKOUT, {}, "not a date")).error).toBe(
      "Pick the first match's day and time",
    );
    const first = "2026-12-10T04:30:00.000Z"; // 10:00 in India
    expect((await createNextRound(KNOCKOUT, {}, first)).error).toBeNull();
    const [created] = await knockoutMatches();
    expect(created).toMatchObject({
      match_format: "ODI",
      overs_per_innings: 50,
      wickets_per_innings: 10,
      scheduled_at: first,
    });
  });

  it("is not created once the tournament is over", async () => {
    await ds.update("tournaments", KNOCKOUT, { status: "completed" });
    expect((await createNextRound(KNOCKOUT)).error).toBe("This tournament is over");
    expect(await knockoutMatches()).toHaveLength(0);
  });
});

const MIXED = "850e8400-e29b-41d4-a716-4466554400aa";

/** Innings summary entry: team, innings number, runs / wickets off balls. */
const inn = (
  team: string,
  n: number,
  runs: number,
  wkts: number,
  balls: number,
  target: number | null = null,
) => ({
  team_id: team,
  innings_number: n,
  total_runs: runs,
  total_wickets: wkts,
  total_balls: balls,
  target_runs: target,
});

/**
 * A mixed tournament of six teams with its group stage created. Seeds are
 * dealt in a snake: group A is t1, t4, t5; group B t2, t3, t6. Returns a
 * way to record a group match's result.
 */
async function mixedCupGroups() {
  const ids = ["t1", "t2", "t3", "t4", "t5", "t6"];
  await ds.insert("tournaments", [
    { id: MIXED, name: "Mixed cup", tournament_format: "mixed", created_by: ORGANISER },
  ]);
  await ds.insert(
    "teams",
    ids.map((id) => ({ id, name: id.toUpperCase(), created_by: ORGANISER })),
  );
  await ds.insert(
    "tournament_registrations",
    ids.map((id, i) => ({
      id: `r-${id}`,
      tournament_id: MIXED,
      team_id: id,
      status: "confirmed",
      registered_at: `2026-01-0${i + 1}T00:00:00.000Z`,
    })),
  );
  expect((await createNextRound(MIXED, { groupCount: 2 })).error).toBeNull();
  const groupMatches = (
    await ds.query("matches", [{ field: "tournament_id", op: "==", value: MIXED }])
  ).filter((m) => m.stage === "group");
  const between = (a: string, b: string) =>
    groupMatches.find(
      (m) =>
        (m.team1_id === a && m.team2_id === b) ||
        (m.team1_id === b && m.team2_id === a),
    )!;
  return (a: string, b: string, winner: string, extra: Record<string, unknown> = {}) =>
    ds.update("matches", between(a, b).id, {
      status: "completed",
      result_type: "win",
      winning_team_id: winner,
      ...extra,
    });
}

describe("group net run rate", () => {
  it("counts a DLS chase at its revised overs", async () => {
    const result = await mixedCupGroups();
    // Group A goes round in a circle, so net run rate decides it. t1 beat t4
    // on DLS: 180/6, then t4 110/7 chasing 121 in 12 overs.
    await result("t1", "t4", "t1", {
      dls_revision: { innings_number: 2, target_runs: 121, overs: 12 },
      innings_summary: [inn("t1", 1, 180, 6, 120), inn("t4", 2, 110, 7, 72, 121)],
    });
    await result("t4", "t5", "t4", {
      innings_summary: [inn("t4", 1, 150, 5, 120), inn("t5", 2, 140, 5, 120, 151)],
    });
    await result("t5", "t1", "t5", {
      innings_summary: [inn("t5", 1, 150, 5, 120), inn("t1", 2, 145, 5, 120, 151)],
    });
    await result("t2", "t3", "t2");
    await result("t2", "t6", "t2");
    await result("t3", "t6", "t3");

    // Charging t1 the 20 overs of its innings (not t4's target off 12)
    // would put t4 top of group A.
    const preview = await previewNextRound(MIXED, { qualifiersPerGroup: 1 });
    expect(preview.data).toMatchObject({
      label: "Final",
      matches: [{ home: "T1", away: "T2" }],
    });
  });
});
