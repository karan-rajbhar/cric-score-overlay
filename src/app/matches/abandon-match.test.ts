/**
 * `abandonMatch` (End the match early) over the in-memory store: which
 * matches it takes, and the result it leaves.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/match-cache", () => ({ invalidateMatchCache: vi.fn() }));
vi.mock("~/lib/push/notify", () => ({
  notifyFollowersAfter: vi.fn(),
  matchEventOf: vi.fn(),
  inningsEndEventOf: vi.fn(),
}));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import type { AppUser } from "~/lib/firebase/auth-types";
import { MemoryDataSource } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { abandonMatch } from "./mutations";

let ds: MemoryDataSource;

const lions = { id: "t1", name: "Lions", short_name: "LIO", logo_url: null };
const tigers = { id: "t2", name: "Tigers", short_name: "TIG", logo_url: null };

function matchDoc(fields: Record<string, unknown>) {
  return {
    id: "m1",
    title: "Lions vs Tigers",
    team1_id: "t1",
    team2_id: "t2",
    team1_snapshot: lions,
    team2_snapshot: tigers,
    created_by: "u1",
    match_admins: ["u1"],
    ...fields,
  };
}

beforeEach(() => {
  ds = new MemoryDataSource({ users: [{ id: "u1", full_name: "Asha" }] });
  state.client = serverClientFor({
    ds,
    db: null,
    getUser: async () =>
      ({ id: "u1", email: null, phone: null, user_metadata: {} }) as AppUser,
  });
});

const stored = () => ds.getById("matches", "m1");

describe("abandonMatch", () => {
  it("refuses a match that has already finished, and keeps its result", async () => {
    const won = matchDoc({
      status: "completed",
      result_type: "win",
      winning_team_id: "t1",
      win_margin: 12,
      win_margin_type: "runs",
      result_description: "Lions won by 12 runs",
    });
    await ds.insert("matches", [won]);
    const res = await abandonMatch("m1", {
      reason: "Rain / Inclement Weather",
      resultType: "no_result",
    });
    expect(res).toEqual({
      success: false,
      error: "This match has already ended",
    });
    expect(await stored()).toMatchObject({
      status: "completed",
      result_type: "win",
      winning_team_id: "t1",
      win_margin: 12,
    });

    await ds.update("matches", "m1", { status: "abandoned" });
    expect(
      (await abandonMatch("m1", { reason: "Rain", resultType: "abandoned" }))
        .error,
    ).toBe("This match has already ended");
  });
});

describe("abandonMatch's result", () => {
  it("names the side a match is awarded to", async () => {
    await ds.insert("matches", [matchDoc({ status: "live" })]);
    expect(
      await abandonMatch("m1", {
        reason: "Match Forfeited / Walkover",
        resultType: "win",
        winningTeamId: "t2",
        notes: "Lions could not field a side",
      }),
    ).toEqual({ success: true, error: null });
    expect(await stored()).toMatchObject({
      status: "abandoned",
      result_type: "win",
      winning_team_id: "t2",
      win_margin: null,
      win_margin_type: null,
      result_description:
        "Match awarded to Tigers: Match Forfeited / Walkover. Lions could not field a side",
    });
  });

  it("refuses a win without one of the two sides", async () => {
    await ds.insert("matches", [matchDoc({ status: "live" })]);
    for (const winningTeamId of [null, "someone-else"]) {
      expect(
        (
          await abandonMatch("m1", {
            reason: "Match Forfeited / Walkover",
            resultType: "win",
            winningTeamId,
          })
        ).error,
      ).toBe("Choose the side the match is awarded to");
    }
    expect((await stored())?.status).toBe("live");
  });

  it("leaves no winner on a match with no result", async () => {
    await ds.insert("matches", [
      matchDoc({ status: "scheduled", winning_team_id: "t1" }),
    ]);
    await abandonMatch("m1", {
      reason: "Rain / Inclement Weather",
      resultType: "no_result",
    });
    expect(await stored()).toMatchObject({
      status: "abandoned",
      result_type: "no_result",
      winning_team_id: null,
      result_description: "Match abandoned: Rain / Inclement Weather",
    });
  });
});
