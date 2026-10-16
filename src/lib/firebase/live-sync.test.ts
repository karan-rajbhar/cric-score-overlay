import { describe, expect, it, vi } from "vitest";
import { refreshLiveMatchesFor, refreshLiveState } from "./live-sync";
import type { ServerClient } from "./server";

function client(liveByField: Record<string, string[]>) {
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  const from = vi.fn(() => {
    const filters: Record<string, string> = {};
    const builder = {
      select: () => builder,
      eq: (field: string, value: string) => {
        filters[field] = value;
        return builder;
      },
      then: (resolve: (r: { data: Array<{ id: string }> }) => void) => {
        const field = Object.keys(filters).find((f) => f !== "status")!;
        resolve({
          data: (liveByField[`${field}=${filters[field]}`] ?? []).map((id) => ({
            id,
          })),
        });
      },
    };
    return builder;
  });
  return { db: { rpc, from } as unknown as ServerClient, rpc };
}

describe("live-sync", () => {
  it("rebuilds live_state through the server rpc", async () => {
    const { db, rpc } = client({});
    await refreshLiveState(db, "m1");
    expect(rpc).toHaveBeenCalledWith("refresh_live_state", { p_match_id: "m1" });
  });

  it("never throws when the rebuild fails", async () => {
    const { db, rpc } = client({});
    rpc.mockRejectedValueOnce(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(refreshLiveState(db, "m1")).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });

  it("refreshes each live match of a team once", async () => {
    const { db, rpc } = client({
      "team1_id=t1": ["m1"],
      "team2_id=t1": ["m2", "m1"],
    });
    await refreshLiveMatchesFor(db, { teamId: "t1" });
    expect(rpc.mock.calls.map((c) => (c as unknown[])[1])).toEqual([
      { p_match_id: "m1" },
      { p_match_id: "m2" },
    ]);
  });
});
