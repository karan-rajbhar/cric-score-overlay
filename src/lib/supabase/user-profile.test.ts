import { describe, expect, it, vi } from "vitest";
import { ensureUserProfile } from "./user-profile";
import type { SupabaseClient, User } from "@supabase/supabase-js";

describe("ensureUserProfile", () => {
  it("does nothing when user is missing or has no id", async () => {
    const mockSupabase = {
      rpc: vi.fn(),
      from: vi.fn(),
    } as unknown as SupabaseClient;

    await ensureUserProfile(mockSupabase, null as unknown as User);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("returns early when RPC succeeds", async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn(),
    } as unknown as SupabaseClient;

    const user = { id: "user-123", email: "test@example.com" } as User;
    await ensureUserProfile(mockSupabase, user);

    expect(mockSupabase.rpc).toHaveBeenCalledWith("ensure_own_profile");
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("falls back to check existing user by id when RPC fails", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: "user-123" },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      }),
    });
    const mockFrom = vi.fn().mockReturnValue({
      select: mockSelect,
    });

    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ error: { message: "RPC error" } }),
      from: mockFrom,
    } as unknown as SupabaseClient;

    const user = { id: "user-123", email: "test@example.com" } as User;
    await ensureUserProfile(mockSupabase, user);

    expect(mockSupabase.rpc).toHaveBeenCalledWith("ensure_own_profile");
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockSelect).toHaveBeenCalledWith("id");
  });

  it("remaps user ID when email already exists under different ID", async () => {
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({
      eq: mockUpdateEq,
    });

    let selectCallCount = 0;
    const mockFrom = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockImplementation(() => ({
          maybeSingle: vi.fn().mockImplementation(async () => {
            selectCallCount++;
            if (selectCallCount === 1) {
              // lookup by id returns null
              return { data: null, error: null };
            }
            // lookup by email returns old id
            return { data: { id: "old-seeded-id" }, error: null };
          }),
        })),
      })),
      update: mockUpdate,
    }));

    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ error: { message: "fail" } }),
      from: mockFrom,
    } as unknown as SupabaseClient;

    const user = {
      id: "auth-uuid-new",
      email: "seeded@example.com",
    } as User;

    await ensureUserProfile(mockSupabase, user);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "auth-uuid-new",
      }),
    );
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "old-seeded-id");
  });

  it("inserts new user if neither id nor email exists", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockImplementation(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      insert: mockInsert,
    }));

    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ error: { message: "fail" } }),
      from: mockFrom,
    } as unknown as SupabaseClient;

    const user = {
      id: "new-user-id",
      email: "newuser@example.com",
      user_metadata: { full_name: "New Player" },
    } as unknown as User;

    await ensureUserProfile(mockSupabase, user);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "new-user-id",
        email: "newuser@example.com",
        full_name: "New Player",
      }),
    );
  });
});
