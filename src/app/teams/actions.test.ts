import { describe, expect, it, vi, beforeEach } from "vitest";
import { createTeamQuick } from "./actions";

// Mock the server data client
const mockGetUser = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("~/lib/firebase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("~/lib/firebase/live-sync", () => ({
  refreshLiveMatchesFor: vi.fn(),
}));

describe("createTeamQuick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an error if user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await createTeamQuick("Test Team");
    expect(result).toEqual({
      data: null,
      error: "You must be logged in to create a team",
    });
  });

  it("returns an error if team name is empty or only whitespace", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-abc", email: "user@test.com" } },
      error: null,
    });
    mockRpc.mockResolvedValue({ error: null });

    const result = await createTeamQuick("   ");
    expect(result).toEqual({
      data: null,
      error: "Team name is required",
    });
  });

  it("ensures user profile and inserts team successfully", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-abc", email: "user@test.com" } },
      error: null,
    });
    mockRpc.mockResolvedValue({ error: null });

    const teamRecord = {
      id: "team-123",
      name: "Super Strikers",
      short_name: "SS",
      club_id: null,
    };

    mockSingle.mockResolvedValue({ data: teamRecord, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const result = await createTeamQuick("Super Strikers", "SS");

    // Profile ensure RPC should have been called
    expect(mockRpc).toHaveBeenCalledWith("ensure_own_profile");

    // Team insert should have been called with user.id as created_by
    expect(mockFrom).toHaveBeenCalledWith("teams");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Super Strikers",
        short_name: "SS",
        created_by: "user-abc",
        team_type: "club",
      }),
    );
    expect(result).toEqual({
      data: teamRecord,
      error: null,
    });
  });
});

describe("createPlayerQuick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if user is not authenticated", async () => {
    const { createPlayerQuick } = await import("./actions");
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await createPlayerQuick("team-1", "Virat Kohli");
    expect(result).toEqual({
      data: null,
      error: "You must be logged in to add players",
    });
  });

  it("calls create_team_player rpc and returns new player data", async () => {
    const { createPlayerQuick } = await import("./actions");
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-scorer", email: "scorer@test.com" } },
      error: null,
    });
    mockRpc
      .mockResolvedValueOnce({ error: null }) // ensure_own_profile
      .mockResolvedValueOnce({
        data: { user_id: "user-new", full_name: "Virat Kohli", jersey_number: null },
        error: null,
      });

    const result = await createPlayerQuick("team-1", "Virat Kohli");
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      user_id: "user-new",
      full_name: "Virat Kohli",
      jersey_number: null,
    });
    expect(mockRpc).toHaveBeenCalledWith("create_team_player", {
      p_team_id: "team-1",
      p_full_name: "Virat Kohli",
    });
  });
});

describe("squad changes refresh live matches of the team", () => {
  /** A query builder whose every call chains; reads resolve `row`. */
  function chain(row: unknown, error: unknown = null) {
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "insert", "update", "delete"]) {
      builder[m] = () => builder;
    }
    builder.single = async () => ({ data: row, error: null });
    builder.maybeSingle = async () => ({ data: row, error: null });
    builder.then = (resolve: (r: unknown) => void) =>
      resolve({ data: null, error });
    return builder;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "captain", email: "c@test.com" } },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: null, error: null });
    // The caller created the team (may manage it); writes succeed.
    mockFrom.mockImplementation(() => chain({ created_by: "captain" }));
  });

  it("after adding, removing or re-roling a player and quick-adding one", async () => {
    const { refreshLiveMatchesFor } = await import("~/lib/firebase/live-sync");
    const actions = await import("./actions");

    expect(await actions.addPlayerToTeam("t1", "p1")).toEqual({
      success: true,
    });
    expect(await actions.updatePlayerRole("t1", "p1", "captain")).toEqual({
      success: true,
    });
    expect(await actions.removePlayerFromTeam("t1", "p1")).toEqual({
      success: true,
    });
    mockRpc.mockImplementation(async (name: string) =>
      name === "create_team_player"
        ? { data: { user_id: "p2", full_name: "New" }, error: null }
        : { data: null, error: null },
    );
    expect((await actions.createPlayerQuick("t1", "New")).error).toBeNull();

    const calls = vi.mocked(refreshLiveMatchesFor).mock.calls;
    expect(calls.map((c) => c[1])).toEqual([
      { teamId: "t1" },
      { teamId: "t1" },
      { teamId: "t1" },
      { teamId: "t1" },
    ]);
  });

  it("not when the change fails", async () => {
    const { refreshLiveMatchesFor } = await import("~/lib/firebase/live-sync");
    const actions = await import("./actions");
    mockFrom.mockImplementation(() =>
      chain({ created_by: "captain" }, { message: "boom" }),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await actions.addPlayerToTeam("t1", "p1")).toEqual({
      error: "boom",
    });
    expect(await actions.removePlayerFromTeam("t1", "p1")).toEqual({
      error: "boom",
    });
    expect(refreshLiveMatchesFor).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

