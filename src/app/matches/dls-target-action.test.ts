import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerClient } from "~/lib/firebase/server";
import { refreshLiveState } from "~/lib/firebase/live-sync";
import { updateDlsTarget } from "./mutations";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/match-cache", () => ({ invalidateMatchCache: vi.fn() }));
vi.mock("~/lib/firebase/live-sync", () => ({ refreshLiveState: vi.fn() }));
vi.mock("~/lib/firebase/server", () => ({ createServerClient: vi.fn() }));

const docs: Record<string, Record<string, unknown>> = {
  matches: {
    created_by: "u1",
    match_admins: [],
    overs_per_innings: 20,
    balls_per_over: 6,
  },
  innings: { match_id: "m1", innings_number: 2, total_balls: 36 },
};

/** A client whose reads return `docs` and whose updates are recorded. */
function client() {
  const updates: { table: string; patch: Record<string, unknown> }[] = [];
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    c.eq = () => c;
    c.single = async () => result;
    c.then = (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
    return c;
  };
  vi.mocked(createServerClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
    },
    from: (table: string) => ({
      select: () => chain({ data: docs[table] ?? null, error: null }),
      update: (patch: Record<string, unknown>) => {
        updates.push({ table, patch });
        return chain({ error: null });
      },
    }),
  } as never);
  return updates;
}

describe("updateDlsTarget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the revised target on the innings and the revision on the match", async () => {
    const updates = client();
    const res = await updateDlsTarget("m1", "inn-2", 98, 12);
    expect(res).toEqual({ success: true, error: null });
    expect(updates).toEqual([
      { table: "innings", patch: { target_runs: 98 } },
      {
        table: "matches",
        patch: {
          dls_revision: { innings_number: 2, target_runs: 98, overs: 12 },
        },
      },
    ]);
    expect(refreshLiveState).toHaveBeenCalled();
  });

  it("refuses overs the chase has already used or the match does not have", async () => {
    let updates = client();
    // 36 balls bowled: 6 overs are gone.
    expect((await updateDlsTarget("m1", "inn-2", 60, 6)).error).toMatch(
      /more than the overs already bowled/,
    );
    expect((await updateDlsTarget("m1", "inn-2", 60, 25)).error).toMatch(
      /from 1 to 20/,
    );
    expect(updates).toEqual([]);
    updates = client();
    expect((await updateDlsTarget("m1", "inn-2", 0, 12)).error).toMatch(
      /at least 1 run/,
    );
    expect(updates).toEqual([]);
  });
});
