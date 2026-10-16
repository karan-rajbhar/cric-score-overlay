import { describe, expect, it, vi } from "vitest";
import { ensureUserProfile } from "./user-profile";
import type { AppUser } from "./auth-types";

type Client = Parameters<typeof ensureUserProfile>[0];

const baseUser = (overrides: Partial<AppUser>): AppUser => ({
  id: "user-123",
  email: "test@example.com",
  phone: null,
  user_metadata: {},
  ...overrides,
});

describe("ensureUserProfile", () => {
  it("does nothing when user is missing or has no id", async () => {
    const client = { rpc: vi.fn(), from: vi.fn() } as unknown as Client;

    await ensureUserProfile(client, null);
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns early when the profile routine succeeds", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn(),
    } as unknown as Client;

    await ensureUserProfile(client, baseUser({}));

    expect(client.rpc).toHaveBeenCalledWith("ensure_own_profile");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("falls back to checking the profile by id when the routine fails", async () => {
    const mockMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "user-123" }, error: null });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
    });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    const client = {
      rpc: vi.fn().mockResolvedValue({ error: { message: "RPC error" } }),
      from: mockFrom,
    } as unknown as Client;

    await ensureUserProfile(client, baseUser({}));

    expect(client.rpc).toHaveBeenCalledWith("ensure_own_profile");
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockSelect).toHaveBeenCalledWith("id");
  });

  it("re-maps the profile id when the email already exists under another id", async () => {
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

    let selectCallCount = 0;
    const mockFrom = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockImplementation(() => ({
          maybeSingle: vi.fn().mockImplementation(async () => {
            selectCallCount++;
            if (selectCallCount === 1) return { data: null, error: null };
            return { data: { id: "old-seeded-id" }, error: null };
          }),
        })),
      })),
      update: mockUpdate,
    }));
    const client = {
      rpc: vi.fn().mockResolvedValue({ error: { message: "fail" } }),
      from: mockFrom,
    } as unknown as Client;

    await ensureUserProfile(
      client,
      baseUser({ id: "auth-uuid-new", email: "seeded@example.com" }),
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "auth-uuid-new" }),
    );
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "old-seeded-id");
  });

  it("inserts a new profile if neither id nor email exists", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockImplementation(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      insert: mockInsert,
    }));
    const client = {
      rpc: vi.fn().mockResolvedValue({ error: { message: "fail" } }),
      from: mockFrom,
    } as unknown as Client;

    await ensureUserProfile(
      client,
      baseUser({
        id: "new-user-id",
        email: "newuser@example.com",
        user_metadata: { full_name: "New Player" },
      }),
    );

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "new-user-id",
        email: "newuser@example.com",
        full_name: "New Player",
      }),
    );
  });
});
