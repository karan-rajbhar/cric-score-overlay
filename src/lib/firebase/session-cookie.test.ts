import { describe, expect, it } from "vitest";
import {
  LEGACY_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  sessionCookieValue,
} from "./session-cookie";

describe("session cookie", () => {
  it("reads the current name first, then the pre-prefix one", () => {
    const store = new Map([
      [LEGACY_SESSION_COOKIE_NAME, "old"],
      [SESSION_COOKIE_NAME, "new"],
    ]);
    expect(sessionCookieValue((n) => store.get(n))).toBe("new");
    const legacyOnly = new Map([[LEGACY_SESSION_COOKIE_NAME, "old"]]);
    expect(sessionCookieValue((n) => legacyOnly.get(n))).toBe("old");
    expect(sessionCookieValue(() => undefined)).toBeUndefined();
  });

  it("is __Host- prefixed only where it can be Secure", () => {
    expect(SESSION_COOKIE_NAME).toBe(
      process.env.NODE_ENV === "production"
        ? "__Host-cric_session"
        : "cric_session",
    );
  });
});
