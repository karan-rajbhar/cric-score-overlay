import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ensureUserProfile } from "./user-profile";
import type { AppUser } from "./auth-types";
import { MemoryDataSource } from "./datasource";
import { serverClientFor } from "./server-client";

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

  it("leaves a profile made ahead of sign-up for the profile routine to re-map", async () => {
    // The routine stopped half way through re-mapping a placeholder: the
    // squad names the account already, the profile is still the old one.
    const ds = new MemoryDataSource({
      users: [{ id: "old-seeded-id", full_name: "Ravi", is_placeholder: true }],
      users_private: [{ id: "old-seeded-id", email: "seeded@example.com" }],
      teams: [{ id: "t1", name: "Lions", created_by: "cap" }],
      team_players: [{ id: "tp", team_id: "t1", user_id: "auth-uuid-new" }],
    });
    const user = baseUser({ id: "auth-uuid-new", email: "seeded@example.com" });
    const server = serverClientFor({ ds, db: null, getUser: async () => user });
    const failing = {
      ...server,
      rpc: async () => ({ data: null, error: { message: "deadline exceeded" } }),
    };

    await ensureUserProfile(failing, user);
    // Nothing re-keyed by hand (the references would not follow).
    for (const table of ["users", "users_private"]) {
      expect(ds.all(table).map((d) => d.id)).toEqual(["old-seeded-id"]);
    }

    // The routine, next time, finishes the re-map.
    await ensureUserProfile(server, user);
    expect(ds.all("users").map((d) => [d.id, d.full_name])).toEqual([
      ["auth-uuid-new", "Ravi"],
    ]);
    expect(ds.all("users_private")).toMatchObject([
      { id: "auth-uuid-new", email: "seeded@example.com" },
    ]);
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

    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "new-user-id", full_name: "New Player" }),
    );
    expect(mockInsert.mock.calls[0]?.[0]).not.toHaveProperty("email");
    expect(mockFrom).toHaveBeenCalledWith("users_private");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "new-user-id",
        email: "newuser@example.com",
      }),
    );
  });
});
