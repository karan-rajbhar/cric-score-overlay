// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
const verifyIdToken = vi.fn();
vi.mock("~/lib/firebase/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/firebase/session")>()),
  verifyIdToken: (token: string) => verifyIdToken(token),
  createSessionCookie: async () => "session-cookie",
}));
vi.mock("~/lib/firebase/admin", () => ({
  getAdminAuth: () => ({ deleteUser: vi.fn(async () => undefined) }),
  getAdminFirestore: () => ({}),
}));
vi.mock("~/lib/firebase/datasource-admin", () => ({
  AdminDataSource: class {
    getById = async () => ({ id: "u1" });
  },
}));
vi.mock("~/lib/firebase/derived-fields", () => ({
  derivedFieldsDataSource: (ds: unknown) => ds,
}));
vi.mock("~/lib/firebase/rpc/access", () => ({
  canSignIn: async () => true,
  acceptInvitations: async () => undefined,
}));
vi.mock("~/lib/firebase/rpc/profiles", () => ({
  ensureOwnProfile: async () => undefined,
}));

import { streamedRequest } from "~/test/streamed-request";
import { POST } from "./route";

const URL = "http://localhost:3005/api/auth/session";
const SAME_SITE = {
  "Content-Type": "application/json",
  Origin: "http://localhost:3005",
  Host: "localhost:3005",
};

function post(body: string, headers: Record<string, string> = SAME_SITE) {
  return POST(
    new Request(URL, { method: "POST", headers, body }) as unknown as NextRequest,
  );
}

describe("POST /api/auth/session", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    verifyIdToken.mockResolvedValue({
      uid: "u1",
      email: "a@example.com",
      email_verified: true,
    });
  });

  it("exchanges an ID token for the session cookie", async () => {
    const res = await post(JSON.stringify({ idToken: "token" }));
    expect(res.status).toBe(200);
    expect(verifyIdToken).toHaveBeenCalledWith("token");
    expect(res.cookies.get("cric_session")?.value).toBe("session-cookie");
  });

  it("stops reading a streamed body once it passes the cap", async () => {
    const { request, pulled } = streamedRequest(URL, { headers: SAME_SITE });
    expect((await POST(request)).status).toBe(413);
    expect(pulled()).toBeLessThan(40);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("refuses a cross-site post, which could sign the browser in as someone else", async () => {
    const body = JSON.stringify({ idToken: "token" });
    const cases: [Record<string, string>, number][] = [
      [{ ...SAME_SITE, Origin: "https://evil.example" }, 403],
      [{ "Content-Type": "application/json", Host: "localhost:3005" }, 403],
      [{ ...SAME_SITE, Origin: "null" }, 403],
      // What a cross-site form can send.
      [{ ...SAME_SITE, "Content-Type": "application/x-www-form-urlencoded" }, 415],
      [{ ...SAME_SITE, "Content-Type": "text/plain" }, 415],
    ];
    for (const [headers, status] of cases) {
      const res = await post(body, headers);
      expect(res.status).toBe(status);
      expect(res.cookies.get("cric_session")).toBeUndefined();
    }
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("takes the forwarded host behind the hosting proxy", async () => {
    const res = await post(JSON.stringify({ idToken: "token" }), {
      "Content-Type": "application/json",
      Origin: "https://cricscore.example",
      Host: "internal:8080",
      "X-Forwarded-Host": "cricscore.example",
    });
    expect(res.status).toBe(200);
  });

  it("refuses a missing token or a body that is not JSON", async () => {
    expect((await post("{}")).status).toBe(400);
    expect((await post("{not json")).status).toBe(400);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});
