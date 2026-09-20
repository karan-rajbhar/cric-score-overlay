import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  updateTournament,
  deleteTournament,
  refreshTournamentStandings,
} from "./actions";

const mockGetUser = vi.fn();
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

vi.mock("~/lib/supabase/user-profile", () => ({
  ensureUserProfile: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Tournament Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateTournament", () => {
    it("fails when user is unauthenticated", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await updateTournament("t-1", new FormData());
      expect(res).toEqual({ error: "You must be logged in" });
    });

    it("fails when user is not tournament creator or club admin", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-random" } },
      });

      // Mock checkTournamentAdminAuth: created_by is different and no club
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: { created_by: "u-creator", club_id: null },
            }),
          }),
        }),
      });

      const res = await updateTournament("t-1", new FormData());
      expect(res).toEqual({
        error:
          "Only tournament organizers or club admins can edit this tournament",
      });
    });

    it("updates tournament when user is tournament creator", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-creator" } },
      });

      // Mock checkTournamentAdminAuth: created_by matches user
      const mockTournCheck = vi.fn().mockResolvedValueOnce({
        data: { created_by: "u-creator", club_id: "club-1" },
      });
      // Mock fetch currentTourn
      const mockTournClub = vi.fn().mockResolvedValueOnce({
        data: { club_id: "club-1" },
      });
      const mockUpdate = vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      });

      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({ single: mockTournCheck }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({ single: mockTournClub }),
          }),
        })
        .mockReturnValueOnce({ update: mockUpdate });

      const fd = new FormData();
      fd.set("name", "Summer Super Cup");
      fd.set("tournament_format", "league");
      fd.set("venue", "Lord's");

      const res = await updateTournament("t-1", fd);
      expect(res).toEqual({ success: true });
    });
  });

  describe("deleteTournament", () => {
    it("deletes tournament when user is authorized", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-creator" } },
      });

      // Mock checkTournamentAdminAuth
      const mockTournCheck = vi.fn().mockResolvedValueOnce({
        data: { created_by: "u-creator", club_id: "club-1" },
      });
      const mockTournData = vi.fn().mockResolvedValueOnce({
        data: { club_id: "club-1" },
      });
      const mockDelete = vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      });

      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({ single: mockTournCheck }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({ single: mockTournData }),
          }),
        })
        .mockReturnValueOnce({ delete: mockDelete });

      const res = await deleteTournament("t-1");
      expect(res).toEqual({ success: true });
    });
  });

  describe("refreshTournamentStandings", () => {
    it("calls recalculate_tournament_standings RPC for authorized user", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-creator" } },
      });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: { created_by: "u-creator", club_id: null },
            }),
          }),
        }),
      });

      mockRpc.mockResolvedValueOnce({ error: null });

      const res = await refreshTournamentStandings("t-1");
      expect(res).toEqual({ success: true });
      expect(mockRpc).toHaveBeenCalledWith(
        "recalculate_tournament_standings",
        { p_tournament_id: "t-1" }
      );
    });
  });
});
