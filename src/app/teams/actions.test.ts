import { describe, expect, it, vi, beforeEach } from "vitest";
import { createTeamQuick } from "./actions";

// Mock Supabase server client
const mockGetUser = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("~/lib/supabase/server", () => ({
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
