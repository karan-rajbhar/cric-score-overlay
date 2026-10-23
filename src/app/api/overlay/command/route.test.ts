// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));

const add = vi.fn();
const docIds: string[] = [];
vi.mock("~/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: (id: string) => {
        docIds.push(id);
        return { collection: () => ({ add }) };
      },
    }),
  }),
}));

import { POST } from "./route";

const HOST = "cricscore.example.com";

function request(
  body: unknown,
  headers: Record<string, string | null> = {},
): NextRequest {
  const h = new Headers({
    "Content-Type": "application/json",
    Host: HOST,
    Origin: `https://${HOST}`,
  });
  for (const [k, v] of Object.entries(headers)) {
    if (v === null) h.delete(k);
    else h.set(k, v);
  }
  return new Request(`https://${HOST}/api/overlay/command`, {
    method: "POST",
    headers: h,
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

const command = { matchId: "match-1", payload: { type: "PANIC_CLEAR" } };

describe("POST /api/overlay/command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    docIds.length = 0;
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    rpc.mockResolvedValue({ data: true, error: null });
  });

  it("appends a match admin's command to that match's overlay channel", async () => {
    const res = await POST(request(command));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("can_produce_overlay", {
      p_match_id: "match-1",
      p_user_id: "u1",
    });
    expect(docIds).toEqual(["overlay_control_match-1"]);
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "command",
        payload: { type: "PANIC_CLEAR" },
      }),
    );
  });

  it("refuses anyone who is not an admin of the match", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST(request(command))).status).toBe(403);
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request(command))).status).toBe(401);
    expect(add).not.toHaveBeenCalled();
  });

  it("refuses cross-origin, non-JSON and malformed requests", async () => {
    expect(
      (await POST(request(command, { Origin: "https://evil.example" }))).status,
    ).toBe(403);
    expect(
      (await POST(request(command, { "Content-Type": "text/plain" }))).status,
    ).toBe(415);
    // A match id that would leave the document path.
    expect(
      (await POST(request({ ...command, matchId: "a/b" }))).status,
    ).toBe(400);
    expect(add).not.toHaveBeenCalled();
  });
});
