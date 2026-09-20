import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  joinClub,
  leaveClub,
  updateClub,
  removeMember,
  inviteClubMember,
  deleteSeason,
  removeHallOfFame,
  updateClubLogo,
  removeClubLogo,
  updateClubBanner,
  removeClubBanner,
} from "./actions";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockStorageFrom = vi.fn();

vi.mock("~/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
    rpc: mockRpc,
  })),
}));

vi.mock("~/lib/supabase/user-profile", () => ({
  ensureUserProfile: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Clubs Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("joinClub", () => {
    it("fails when unauthenticated", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await joinClub("club-1");
      expect(res).toEqual({ error: "You must be logged in to join a club" });
    });

    it("inserts membership successfully for logged in user", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-123" } },
      });
      const mockInsert = vi.fn().mockResolvedValueOnce({ error: null });
      mockFrom.mockReturnValueOnce({ insert: mockInsert });

      const res = await joinClub("club-1");
      expect(res).toEqual({ success: true });
      expect(mockInsert).toHaveBeenCalledWith({
        club_id: "club-1",
        user_id: "u-123",
        role: "member",
        status: "active",
      });
    });
  });

  describe("leaveClub", () => {
    it("fails when unauthenticated", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await leaveClub("club-1");
      expect(res).toEqual({ error: "You must be logged in" });
    });

    it("deletes membership for current user", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-123" } },
      });
      const mockEq2 = vi.fn().mockResolvedValueOnce({ error: null });
      const mockEq1 = vi.fn().mockReturnValueOnce({ eq: mockEq2 });
      const mockDelete = vi.fn().mockReturnValueOnce({ eq: mockEq1 });
      mockFrom.mockReturnValueOnce({ delete: mockDelete });

      const res = await leaveClub("club-1");
      expect(res).toEqual({ success: true });
    });
  });

  describe("updateClub", () => {
    it("fails when user is not authorized as club admin or owner", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-random" } },
      });

      // Mock checkClubAdminAuth: owner_id doesn't match and not admin membership
      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: { owner_id: "u-owner" },
      });
      const mockSelect = vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({ single: mockSingle }),
      });
      const mockMaybeSingle = vi.fn().mockResolvedValueOnce({ data: null });
      const mockMemEq3 = vi.fn().mockReturnValueOnce({ maybeSingle: mockMaybeSingle });
      const mockMemEq2 = vi.fn().mockReturnValueOnce({ eq: mockMemEq3 });
      const mockMemEq1 = vi.fn().mockReturnValueOnce({ eq: mockMemEq2 });
      const mockMemSelect = vi.fn().mockReturnValueOnce({ eq: mockMemEq1 });

      mockFrom
        .mockReturnValueOnce({ select: mockSelect })
        .mockReturnValueOnce({ select: mockMemSelect });

      const fd = new FormData();
      fd.set("name", "Updated Club Name");

      const res = await updateClub("club-1", fd);
      expect(res).toEqual({
        error: "You are not authorized to update this club",
      });
    });

    it("updates club when user is owner", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-owner" } },
      });

      // Mock owner check: user is owner
      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: { owner_id: "u-owner" },
      });
      const mockSelect = vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({ single: mockSingle }),
      });
      const mockUpdate = vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      });

      mockFrom
        .mockReturnValueOnce({ select: mockSelect })
        .mockReturnValueOnce({ update: mockUpdate });

      const fd = new FormData();
      fd.set("name", "New Club Name");
      fd.set("location", "London");

      const res = await updateClub("club-1", fd);
      expect(res).toEqual({ success: true });
    });
  });

  describe("removeMember", () => {
    it("prevents removing the club owner", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-owner" } },
      });

      // Mock checkClubAdminAuth: owner
      const mockOwnerSingle = vi.fn().mockResolvedValueOnce({
        data: { owner_id: "u-owner" },
      });
      const mockAdminSingle = vi.fn().mockResolvedValueOnce({
        data: { owner_id: "u-owner" },
      });

      // Target membership check: role is 'owner'
      const mockTargetSingle = vi.fn().mockResolvedValueOnce({
        data: { id: "mem-owner", role: "owner", user_id: "u-owner" },
        error: null,
      });

      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({ single: mockOwnerSingle }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({ single: mockAdminSingle }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({ single: mockTargetSingle }),
            }),
          }),
        });

      const res = await removeMember("club-1", "mem-owner");
      expect(res).toEqual({ error: "Cannot remove the club owner" });
    });
  });

  describe("inviteClubMember", () => {
    it("validates email formatting", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-owner" } },
      });

      // Mock checkClubAdminAuth: owner
      const mockOwnerSingle = vi.fn().mockResolvedValueOnce({
        data: { owner_id: "u-owner" },
      });
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({ single: mockOwnerSingle }),
        }),
      });

      const res = await inviteClubMember("club-1", "not-an-email");
      expect(res).toEqual({ error: "A valid email address is required" });
    });
  });

  describe("deleteSeason & removeHallOfFame", () => {
    it("deletes season when user is club admin", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-owner" } },
      });

      const mockOwnerSingle = vi.fn().mockResolvedValueOnce({
        data: { owner_id: "u-owner" },
      });
      const mockDelete = vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      });

      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({ single: mockOwnerSingle }),
          }),
        })
        .mockReturnValueOnce({ delete: mockDelete });

      const res = await deleteSeason("season-1", "club-1");
      expect(res).toEqual({ success: true });
    });

    it("removes hall of fame inductee when user is club admin", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-owner" } },
      });

      const mockOwnerSingle = vi.fn().mockResolvedValueOnce({
        data: { owner_id: "u-owner" },
      });
      const mockDelete = vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      });

      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({ single: mockOwnerSingle }),
          }),
        })
        .mockReturnValueOnce({ delete: mockDelete });

      const res = await removeHallOfFame("hof-1", "club-1");
      expect(res).toEqual({ success: true });
    });
  });

  describe("Club Branding: Logo & Banner Uploads", () => {
    const fakeLogo = new File(["test-image-content"], "logo.png", {
      type: "image/png",
    });
    const fakeBanner = new File(["test-banner-content"], "banner.jpg", {
      type: "image/jpeg",
    });

    it("rejects logo upload when unauthenticated", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await updateClubLogo("club-1", fakeLogo);
      expect(res).toEqual({ data: null, error: "You must be logged in" });
    });

    it("rejects logo upload when user is not admin or owner", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-random" } },
      });
      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: { owner_id: "u-owner" },
      });
      const mockMaybeSingle = vi.fn().mockResolvedValueOnce({ data: null });
      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({ single: mockSingle }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                eq: vi.fn().mockReturnValueOnce({ maybeSingle: mockMaybeSingle }),
              }),
            }),
          }),
        });

      const res = await updateClubLogo("club-1", fakeLogo);
      expect(res).toEqual({
        data: null,
        error: "You are not authorized to update this club's logo",
      });
    });

    it("uploads club logo successfully for authorized admin", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-owner" } },
      });
      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: { owner_id: "u-owner" },
      });
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({ single: mockSingle }),
        }),
      });

      const mockUpload = vi.fn().mockResolvedValueOnce({ error: null });
      const mockGetPublicUrl = vi.fn().mockReturnValueOnce({
        data: { publicUrl: "https://example.com/club-assets/club-1/logo.png" },
      });
      mockStorageFrom.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      const mockUpdate = vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      });
      mockFrom.mockReturnValueOnce({ update: mockUpdate });

      const res = await updateClubLogo("club-1", fakeLogo);
      expect(res.error).toBeNull();
      expect(res.data).toBe("https://example.com/club-assets/club-1/logo.png");
    });

    it("removes club logo successfully for authorized admin", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-owner" } },
      });
      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: { owner_id: "u-owner" },
      });
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({ single: mockSingle }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      });
      mockFrom.mockReturnValueOnce({ update: mockUpdate });

      const res = await removeClubLogo("club-1");
      expect(res).toEqual({ success: true, error: null });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ logo_url: null }),
      );
    });

    it("uploads club banner successfully for authorized admin", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-owner" } },
      });
      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: { owner_id: "u-owner" },
      });
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({ single: mockSingle }),
        }),
      });

      const mockUpload = vi.fn().mockResolvedValueOnce({ error: null });
      const mockGetPublicUrl = vi.fn().mockReturnValueOnce({
        data: { publicUrl: "https://example.com/club-assets/club-1/banner.jpg" },
      });
      mockStorageFrom.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      const mockUpdate = vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      });
      mockFrom.mockReturnValueOnce({ update: mockUpdate });

      const res = await updateClubBanner("club-1", fakeBanner);
      expect(res.error).toBeNull();
      expect(res.data).toBe("https://example.com/club-assets/club-1/banner.jpg");
    });

    it("removes club banner successfully for authorized admin", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "u-owner" } },
      });
      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: { owner_id: "u-owner" },
      });
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({ single: mockSingle }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      });
      mockFrom.mockReturnValueOnce({ update: mockUpdate });

      const res = await removeClubBanner("club-1");
      expect(res).toEqual({ success: true, error: null });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ banner_url: null }),
      );
    });
  });
});
