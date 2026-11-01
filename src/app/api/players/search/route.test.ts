// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const getUser = vi.fn();
const db = { auth: { getUser } };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: vi.fn(async () => db),
}));
const searchPlayers = vi.fn();
vi.mock("~/lib/firebase/search-players", () => ({
  searchPlayers: (...args: unknown[]) => searchPlayers(...args),
}));

import { GET } from "./route";

const request = (query: string) =>
  ({
    nextUrl: new URL(`https://cricscore.example.com/api/players/search${query}`),
  }) as unknown as NextRequest;

describe("GET /api/players/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    searchPlayers.mockResolvedValue({
      data: { players: [{ id: "p1", name: "Rahul" }], more: false },
      error: null,
    });
  });

  it("refuses a visitor who is not signed in, without reading anything", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(request("?q=rahul"));
    expect(res.status).toBe(401);
    expect(searchPlayers).not.toHaveBeenCalled();
  });

  it("answers with the players found, never cached", async () => {
    const res = await GET(request("?q=%20%40rahul_s%20"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({
      players: [{ id: "p1", name: "Rahul" }],
      more: false,
    });
    expect(searchPlayers).toHaveBeenCalledWith(db, "@rahul_s");
  });

  it("caps the text searched", async () => {
    await GET(request(`?q=${"x".repeat(500)}`));
    expect(searchPlayers.mock.calls[0]?.[1]).toHaveLength(100);
  });

  it("answers 500 when the search fails, so it cannot read as nobody found", async () => {
    searchPlayers.mockResolvedValue({ data: null, error: "index missing" });
    const res = await GET(request("?q=rahul"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Player search failed" });
  });
});
