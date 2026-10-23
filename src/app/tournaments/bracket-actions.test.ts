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
