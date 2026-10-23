// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const getUser = vi.fn();
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));
const state: { ds: unknown } = { ds: null };
vi.mock("~/lib/admin-data-source", () => ({ adminDataSource: () => state.ds }));

import { MemoryDataSource } from "~/lib/firebase/datasource";
import { PUSH_SUBSCRIPTIONS, subscriptionId } from "~/lib/push/subscriptions";
import { DELETE, POST } from "./route";

const HOST = "cricscore.example.com";
const PUBLIC_KEY =
  "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
const PRIVATE_KEY = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/device1";
const SUBSCRIPTION = {
  endpoint: ENDPOINT,
  expirationTime: null,
  keys: {
    p256dh:
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
    auth: "BTBZMqHH6r4Tts7J_aSIgg",
  },
};

function request(
  method: string,
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
  return new Request(`https://${HOST}/api/push/subscription`, {
    method,
    headers: h,
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

let ds: MemoryDataSource;

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", PUBLIC_KEY);
  vi.stubEnv("VAPID_PRIVATE_KEY", PRIVATE_KEY);
  ds = new MemoryDataSource({});
  state.ds = ds;
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("/api/push/subscription", () => {
  it("stores the signed-in user's device, and forgets it", async () => {
    const saved = await POST(request("POST", SUBSCRIPTION));
    expect(saved.status).toBe(200);
    expect(await ds.getById(PUSH_SUBSCRIPTIONS, subscriptionId(ENDPOINT))).toMatchObject({
      user_id: "u1",
      endpoint: ENDPOINT,
    });
    const removed = await DELETE(request("DELETE", { endpoint: ENDPOINT }));
    expect(await removed.json()).toEqual({ ok: true, removed: true });
    expect(await ds.getById(PUSH_SUBSCRIPTIONS, subscriptionId(ENDPOINT))).toBeNull();
  });

  it("refuses cross-site requests, unknown push services and signed-out users", async () => {
    expect((await POST(request("POST", SUBSCRIPTION, { Origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(request("POST", SUBSCRIPTION, { "Content-Type": "text/plain" }))).status).toBe(415);
    expect(
      (await POST(request("POST", { ...SUBSCRIPTION, endpoint: "https://evil.example/x" }))).status,
    ).toBe(400);
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request("POST", SUBSCRIPTION))).status).toBe(401);
  });

  it("is off without VAPID keys", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect((await POST(request("POST", SUBSCRIPTION))).status).toBe(404);
  });
});
