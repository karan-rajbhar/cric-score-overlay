// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

import { MemoryDataSource } from "~/lib/firebase/datasource";

const state: { ds: MemoryDataSource } = { ds: new MemoryDataSource() };
vi.mock("~/lib/firebase/server-ds", () => ({
  serverDataSource: () => state.ds,
}));
const sendProducerCommand = vi.fn(async () => true);
vi.mock("~/lib/overlay/commands", () => ({
  sendProducerCommand: (...args: unknown[]) =>
    sendProducerCommand(...(args as [])),
}));

import { remoteRateLimiter } from "~/lib/overlay/rate-limit";
import {
  createRemoteToken,
  revokeRemoteTokens,
} from "~/lib/overlay/remote-token";
import { GET, HEAD, POST } from "./route";

const HOST = "cricscore.example.com";

function call(
  method: "GET" | "POST",
  token: string,
  action: string,
): Promise<Response> {
  const req = new Request(
    `https://${HOST}/api/overlay/remote/${token}/${action}`,
    { method },
  ) as unknown as NextRequest;
  const handler = method === "GET" ? GET : POST;
  return handler(req, { params: Promise.resolve({ token, action }) });
}

describe("/api/overlay/remote/[token]/[action]", () => {
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    remoteRateLimiter.reset();
    state.ds = new MemoryDataSource({
      live_state: [{ id: "m1", innings_number: 2 }],
    });
    token = await createRemoteToken(state.ds, "m1", "u1");
  });

  it("sends the action's command to the token's match; GET sends nothing", async () => {
    const res = await call("POST", token, "four");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, action: "four" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(sendProducerCommand).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ type: "TRIGGER_STING", stingType: "four" }),
    );

    const calls = vi.mocked(sendProducerCommand).mock.calls.length;
    expect((await call("GET", token, "scorebar-hide")).status).toBe(405);
    expect(sendProducerCommand).toHaveBeenCalledTimes(calls);
  });

  it("puts up the scorecard card with only the token read", async () => {
    const before = state.ds.billedReads;
    expect((await call("POST", token, "batting-card")).status).toBe(200);
    expect(state.ds.billedReads - before).toBe(1); // the token
    expect(sendProducerCommand).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ type: "SHOW_CARD", card: "scorecard" }),
    );
  });

  it("answers 400 when the overlay does not take the command", async () => {
    sendProducerCommand.mockResolvedValueOnce(false);
    expect((await call("POST", token, "next-sponsor")).status).toBe(400);
  });

  it("refuses bad, unknown and revoked tokens", async () => {
    expect((await call("POST", "nope", "four")).status).toBe(401);
    const [id, secret] = token.split(".") as [string, string];
    const wrong = `${id}.${secret.slice(0, -1)}${secret.endsWith("A") ? "B" : "A"}`;
    expect((await call("POST", wrong, "four")).status).toBe(401);
    expect((await call("POST", token, "launch")).status).toBe(404);

    await revokeRemoteTokens(state.ds, "m1");
    expect((await call("POST", token, "four")).status).toBe(401);
    expect(sendProducerCommand).not.toHaveBeenCalled();
  });

  it("allows 5 requests a second per token, before reading anything", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await call("POST", token, "six")).status).toBe(200);
    }
    const reads = state.ds.billedReads;
    const limited = await call("POST", token, "six");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("1");
    expect(state.ds.billedReads).toBe(reads);
    expect(sendProducerCommand).toHaveBeenCalledTimes(5);
  });

  it("answers HEAD (link previews) without sending anything", async () => {
    const res = HEAD();
    expect(res.status).toBe(204);
    expect(sendProducerCommand).not.toHaveBeenCalled();
  });

  it("never logs the token", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    sendProducerCommand.mockRejectedValueOnce(new Error("firestore down"));
    expect((await call("POST", token, "clear")).status).toBe(500);
    const logged = JSON.stringify(errors.mock.calls);
    expect(logged).not.toContain(token);
    expect(logged).not.toContain(token.split(".")[1]);
  });
});
