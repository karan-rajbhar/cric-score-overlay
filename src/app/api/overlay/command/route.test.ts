// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));

/** Writes to `overlay_state/{id}`: (collection, id, data, options). */
const set = vi.fn();
vi.mock("~/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        set: (data: unknown, options: unknown) =>
          set(name, id, data, options),
      }),
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
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    rpc.mockResolvedValue({ data: true, error: null });
  });

  it("merges a match admin's command into that match's overlay state", async () => {
    const res = await POST(request(command));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("can_produce_overlay", {
      p_match_id: "match-1",
      p_user_id: "u1",
    });
    expect(set).toHaveBeenCalledTimes(1);
    const [collection, id, data, options] = set.mock.calls[0]!;
    expect([collection, id]).toEqual(["overlay_state", "match-1"]);
    // Clearing takes the cards, the lower third and the event card off.
    expect(data).toMatchObject({
      match_id: "match-1",
      scene: { view: null, card: "none" },
      strap: null,
      cue: null,
    });
    expect(options.mergeFields).toEqual(
      expect.arrayContaining([
        "version",
        "last_command_id",
        "scene.view",
        "scene.card",
        "strap",
        "cue",
      ]),
    );
  });

  it("changes only what the command sets, and names it for the control room", async () => {
    const res = await POST(
      request({
        matchId: "match-1",
        payload: { type: "SET_THEME", theme: "standard", id: "c1" },
      }),
    );
    expect(res.status).toBe(200);
    const [, , data, options] = set.mock.calls[0]!;
    expect(data).toMatchObject({
      last_command_id: "c1",
      scene: { theme: "standard" },
    });
    // The layout, colours... stay as they were.
    expect(options.mergeFields).toContain("scene.theme");
    expect(options.mergeFields).not.toContain("scene");
    expect(options.mergeFields).not.toContain("strap");

    // An event card becomes the cue, stamped with the server's time.
    set.mockClear();
    await POST(
      request({
        matchId: "match-1",
        payload: { type: "TRIGGER_STING", stingType: "six", id: "c2" },
      }),
    );
    expect(set.mock.calls[0]![2]).toMatchObject({
      cue: { id: "c2", kind: "six", at: expect.any(Number) },
    });
  });

  it("refuses commands the overlay would ignore", async () => {
    for (const payload of [
      { type: "TRIGGER_STING", stingType: "<script>" },
      { type: "SHOW_STRAP", strap: { type: "nonsense" } },
      { type: "MADE_UP" },
    ]) {
      const res = await POST(request({ matchId: "match-1", payload }));
      expect(res.status).toBe(400);
    }
    expect(set).not.toHaveBeenCalled();
  });

  it("refuses anyone who is not an admin of the match", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST(request(command))).status).toBe(403);
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request(command))).status).toBe(401);
    expect(set).not.toHaveBeenCalled();
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
    expect(set).not.toHaveBeenCalled();
  });
});
