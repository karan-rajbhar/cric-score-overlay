import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  checkUsernameAvailability,
  updateUsername,
  getPlayerByIdOrHandle,
} from "./actions";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("~/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
      updateUser: mockUpdateUser,
    },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Players Actions - Username and Handle Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkUsernameAvailability", () => {
    it("returns error for invalid username format without calling database", async () => {
      const res = await checkUsernameAvailability("ab");
      expect(res.available).toBe(false);
      expect(res.error).toContain("at least 3 characters");
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("returns error for reserved words without calling database", async () => {
      const res = await checkUsernameAvailability("admin");
      expect(res.available).toBe(false);
      expect(res.error).toContain("reserved");
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("checks availability via RPC for valid handles", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u-1" } } });
      mockRpc.mockResolvedValueOnce({
        data: { available: true },
        error: null,
      });

      const res = await checkUsernameAvailability("karan_cricketer");
      expect(res.available).toBe(true);
      expect(res.cleanUsername).toBe("karan_cricketer");
      expect(mockRpc).toHaveBeenCalledWith("check_username_available", {
        p_username: "karan_cricketer",
        p_current_user_id: "u-1",
      });
    });

    it("reports taken when RPC returns available = false", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u-2" } } });
      mockRpc.mockResolvedValueOnce({
        data: { available: false, error: "This username is already taken" },
        error: null,
      });

      const res = await checkUsernameAvailability("taken_handle");
      expect(res.available).toBe(false);
      expect(res.error).toContain("already taken");
    });
  });

  describe("updateUsername", () => {
    it("fails when unauthenticated", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });

      const res = await updateUsername("valid_handle");
      expect(res.success).toBe(false);
      expect(res.error).toContain("signed in");
    });

    it("fails when handle format is invalid", async () => {
      const res = await updateUsername("_invalid_");
      expect(res.success).toBe(false);
      expect(res.error).toContain("underscore");
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("successfully updates username via RPC", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u-1" } } });
      mockRpc.mockResolvedValueOnce({
        data: { ok: true, username: "new_handle" },
        error: null,
      });

      const res = await updateUsername("@new_handle");
      expect(res.success).toBe(true);
      expect(res.username).toBe("new_handle");
      expect(mockRpc).toHaveBeenCalledWith("update_own_username", {
        p_username: "new_handle",
      });
    });

    it("returns error message when username is already taken", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u-1" } } });
      mockRpc.mockResolvedValueOnce({
        data: { ok: false, error: "This username is already taken" },
        error: null,
      });

      const res = await updateUsername("already_taken");
      expect(res.success).toBe(false);
      expect(res.error).toBe("This username is already taken");
    });
  });

  describe("getPlayerByIdOrHandle", () => {
    it("queries by id when input is a valid UUID", async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
        data: { id: "550e8400-e29b-41d4-a716-446655440000", full_name: "Test" },
      });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValueOnce({ select: mockSelect });

      const res = await getPlayerByIdOrHandle(
        "550e8400-e29b-41d4-a716-446655440000",
      );
      expect(res?.full_name).toBe("Test");
      expect(mockEq).toHaveBeenCalledWith(
        "id",
        "550e8400-e29b-41d4-a716-446655440000",
      );
    });

    it("queries by username when input is a handle (e.g. @karan)", async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
        data: { id: "u-1", username: "karan", full_name: "Karan" },
      });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValueOnce({ select: mockSelect });

      const res = await getPlayerByIdOrHandle("@karan");
      expect(res?.username).toBe("karan");
      expect(mockEq).toHaveBeenCalledWith("username", "karan");
    });
  });
});
