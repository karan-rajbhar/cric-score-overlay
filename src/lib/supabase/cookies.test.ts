import { describe, expect, it, beforeEach } from "vitest";
import {
  SUPABASE_AUTH_COOKIE_NAME,
  resolveAuthCookies,
  migrateLegacyBrowserCookies,
  type SimpleCookie,
} from "./cookies";

describe("cookies.ts - Supabase Auth Cookie Resolution & Migration", () => {
  describe("resolveAuthCookies", () => {
    it("returns cookies untouched when standard auth cookie exists", () => {
      const input: SimpleCookie[] = [
        { name: SUPABASE_AUTH_COOKIE_NAME, value: "standard-token-value" },
        { name: "theme", value: "dark" },
      ];

      const result = resolveAuthCookies(input);
      expect(result).toEqual(input);
    });

    it("returns cookies untouched when chunked standard auth cookie exists", () => {
      const input: SimpleCookie[] = [
        { name: `${SUPABASE_AUTH_COOKIE_NAME}.0`, value: "chunk-0" },
        { name: `${SUPABASE_AUTH_COOKIE_NAME}.1`, value: "chunk-1" },
      ];

      const result = resolveAuthCookies(input);
      expect(result).toEqual(input);
    });

    it("maps legacy sb-127-auth-token to standardized name", () => {
      const input: SimpleCookie[] = [
        { name: "sb-127-auth-token", value: "local-dev-jwt" },
        { name: "csrf_token", value: "xyz" },
      ];

      const result = resolveAuthCookies(input);
      expect(result).toContainEqual({
        name: SUPABASE_AUTH_COOKIE_NAME,
        value: "local-dev-jwt",
      });
      expect(result).toContainEqual({
        name: "csrf_token",
        value: "xyz",
      });
    });

    it("maps chunked tunnel cookies (e.g. Cloudflare tunnel) to standardized chunks", () => {
      const input: SimpleCookie[] = [
        {
          name: "sb-austin-term-murphy-bradford-auth-token.0",
          value: "tunnel-chunk-0",
        },
        {
          name: "sb-austin-term-murphy-bradford-auth-token.1",
          value: "tunnel-chunk-1",
        },
      ];

      const result = resolveAuthCookies(input);
      expect(result).toContainEqual({
        name: `${SUPABASE_AUTH_COOKIE_NAME}.0`,
        value: "tunnel-chunk-0",
      });
      expect(result).toContainEqual({
        name: `${SUPABASE_AUTH_COOKIE_NAME}.1`,
        value: "tunnel-chunk-1",
      });
    });

    it("maps code verifier cookie to standardized name", () => {
      const input: SimpleCookie[] = [
        {
          name: "sb-preview-host-auth-token-code-verifier",
          value: "pkce-verifier-123",
        },
      ];

      const result = resolveAuthCookies(input);
      expect(result).toContainEqual({
        name: `${SUPABASE_AUTH_COOKIE_NAME}-code-verifier`,
        value: "pkce-verifier-123",
      });
    });

    it("does nothing when no auth cookies exist", () => {
      const input: SimpleCookie[] = [
        { name: "theme", value: "light" },
        { name: "sessionId", value: "abc" },
      ];

      const result = resolveAuthCookies(input);
      expect(result).toEqual(input);
    });
  });

  describe("migrateLegacyBrowserCookies", () => {
    beforeEach(() => {
      // Clear document.cookie in jsdom environment
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.slice(0, eqPos).trim() : cookie.trim();
        if (name) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
      }
    });

    it("migrates legacy cookies into standardized cookies", () => {
      document.cookie =
        "sb-austin-term-murphy-bradford-auth-token.0=val0; path=/";
      document.cookie =
        "sb-austin-term-murphy-bradford-auth-token.1=val1; path=/";

      migrateLegacyBrowserCookies();

      expect(document.cookie).toContain(`${SUPABASE_AUTH_COOKIE_NAME}.0=val0`);
      expect(document.cookie).toContain(`${SUPABASE_AUTH_COOKIE_NAME}.1=val1`);
    });

    it("does not overwrite if standard cookie already exists", () => {
      document.cookie = `${SUPABASE_AUTH_COOKIE_NAME}=existing-standard; path=/`;
      document.cookie = "sb-127-auth-token=legacy-token; path=/";

      migrateLegacyBrowserCookies();

      expect(document.cookie).toContain(
        `${SUPABASE_AUTH_COOKIE_NAME}=existing-standard`,
      );
    });
  });
});
