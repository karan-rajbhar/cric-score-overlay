import { afterEach, describe, expect, it, vi } from "vitest";

async function cookieModule(nodeEnv: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  return import("./session-cookie");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session cookie", () => {
  it("reads only the __Host- name in production", async () => {
    const { SESSION_COOKIE_NAME, sessionCookieValue } =
      await cookieModule("production");
    expect(SESSION_COOKIE_NAME).toBe("__Host-cric_session");
    const store = new Map([
      ["cric_session", "old"],
      ["__Host-cric_session", "new"],
    ]);
    expect(sessionCookieValue((n) => store.get(n))).toBe("new");
    // The pre-prefix name, which any host or subdomain can set, gives no
    // session.
    const legacyOnly = new Map([["cric_session", "old"]]);
    expect(sessionCookieValue((n) => legacyOnly.get(n))).toBeUndefined();
    expect(sessionCookieValue(() => undefined)).toBeUndefined();
  });

  it("is plain on http dev servers, where a Secure cookie cannot be set", async () => {
    const { SESSION_COOKIE_NAME, sessionCookieValue } =
      await cookieModule("development");
    expect(SESSION_COOKIE_NAME).toBe("cric_session");
    const store = new Map([["cric_session", "dev"]]);
    expect(sessionCookieValue((n) => store.get(n))).toBe("dev");
  });
});
