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
import { MemoryDataSource } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { refreshLiveState } from "~/lib/firebase/live-sync";
import { rescheduleMatch } from "./reschedule";

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
  vi.clearAllMocks();
  ds = new MemoryDataSource({
    users: [{ id: "owner" }, { id: "co" }, { id: "stranger" }],
    matches: [
      {
        id: "m1",
        status: "scheduled",
        created_by: "owner",
        match_admins: ["owner", "co"],
        scheduled_at: "2026-11-01T04:30:00.000Z",
        venue: "Oval",
      },
      { id: "m2", status: "live", created_by: "owner", match_admins: ["owner"] },
    ],
  });
});

const input = {
  scheduledAt: "2026-11-02T09:00:00.000Z",
  venue: "  Park ground ",
  umpire1Name: "Dar",
  umpire2Name: "",
};

describe("rescheduleMatch", () => {
  it("moves a scheduled match for its creator", async () => {
    signIn("owner");
    expect(await rescheduleMatch("m1", input)).toEqual({ error: null });
    expect(await ds.getById("matches", "m1")).toMatchObject({
      scheduled_at: "2026-11-02T09:00:00.000Z",
      venue: "Park ground",
      umpire1_name: "Dar",
      umpire2_name: null,
    });
    expect(refreshLiveState).toHaveBeenCalledWith(expect.anything(), "m1");
  });

  it("refuses co-scorers and strangers", async () => {
    for (const id of ["co", "stranger"]) {
      signIn(id);
      expect((await rescheduleMatch("m1", input)).error).toMatch(
        /can reschedule it/,
      );
    }
    expect(await ds.getById("matches", "m1")).toMatchObject({ venue: "Oval" });
  });

  it("refuses a match that has started", async () => {
    signIn("owner");
    expect(await rescheduleMatch("m2", input)).toEqual({
      error: "Only a match that has not started can be rescheduled",
    });
  });

  it("refuses a missing date", async () => {
    signIn("owner");
    expect(await rescheduleMatch("m1", { scheduledAt: "" })).toEqual({
      error: "Pick a date and time",
    });
  });
});
