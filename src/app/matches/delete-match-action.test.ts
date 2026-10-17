import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { invalidateMatchCache } from "~/lib/match-cache";
import { createServerClient } from "~/lib/firebase/server";
import { deleteMatch } from "./mutations";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/match-cache", () => ({ invalidateMatchCache: vi.fn() }));
vi.mock("~/lib/firebase/server", () => ({ createServerClient: vi.fn() }));

function client(
  user: { id: string } | null,
  rpcResult: { data: unknown; error: { message: string } | null },
) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  vi.mocked(createServerClient).mockResolvedValueOnce({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc,
  } as never);
  return rpc;
}

const result = {
  match_id: "m1",
  already_deleted: false,
  tournament_id: "t1",
  club_id: "c1",
  removed: { innings: 2, overs: 40, player_matches: 22, invitations_updated: 0 },
};

describe("deleteMatch server action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses signed-out users without calling the procedure", async () => {
    const rpc = client(null, { data: null, error: null });
    const res = await deleteMatch("m1", "A vs B");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/signed in/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes the server's refusal on as a readable message", async () => {
    client({ id: "u1" }, { data: null, error: { message: "not_authorized" } });
    const res = await deleteMatch("m1", "A vs B");
    expect(res).toMatchObject({ success: false });
    expect(res.error).toMatch(/match creator, a club admin or the tournament/);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("explains a typed name that does not match", async () => {
    client(
      { id: "u1" },
      { data: null, error: { message: "confirm_title_mismatch" } },
    );
    const res = await deleteMatch("m1", "nope");
    expect(res.error).toBe("The name you typed does not match this match");
  });

  it("deletes, logs, revalidates and points at the tournament", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const rpc = client({ id: "u1" }, { data: result, error: null });
    const res = await deleteMatch("m1", "A vs B");
    expect(rpc).toHaveBeenCalledWith("delete_match", {
      p_match_id: "m1",
      p_confirm_title: "A vs B",
    });
    expect(res).toEqual({
      success: true,
      error: null,
      redirectTo: "/tournaments/t1",
    });
    expect(invalidateMatchCache).toHaveBeenCalledWith("m1");
    const paths = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/matches/m1",
        "/matches",
        "/tournaments/t1",
        "/clubs/c1",
        "/players",
      ]),
    );
    const logged = JSON.parse(String(info.mock.calls[0]![0]));
    expect(logged).toMatchObject({
      event: "match_deleted",
      matchId: "m1",
      uid: "u1",
    });
    info.mockRestore();
  });
});
