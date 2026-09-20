import { describe, expect, it } from "vitest";
import {
  cleanHandle,
  formatHandle,
  validateUsername,
} from "./username";

describe("username.ts - Handle Formatting and Validation", () => {
  describe("cleanHandle", () => {
    it("strips leading @ symbol and trims whitespace", () => {
      expect(cleanHandle("@karan")).toBe("karan");
      expect(cleanHandle("  @karan_rajbhar  ")).toBe("karan_rajbhar");
      expect(cleanHandle("%40karan")).toBe("karan");
    });

    it("converts uppercase characters to lowercase", () => {
      expect(cleanHandle("@KaranRajbhar")).toBe("karanrajbhar");
    });

    it("returns empty string for null or empty input", () => {
      expect(cleanHandle(null)).toBe("");
      expect(cleanHandle(undefined)).toBe("");
      expect(cleanHandle("   ")).toBe("");
    });
  });

  describe("formatHandle", () => {
    it("formats username with leading @", () => {
      expect(formatHandle("karan")).toBe("@karan");
      expect(formatHandle("@karan")).toBe("@karan");
      expect(formatHandle("karan_rajbhar")).toBe("@karan_rajbhar");
    });

    it("returns fallback if username is empty", () => {
      expect(formatHandle(null, "No handle")).toBe("No handle");
      expect(formatHandle("", "")).toBe("");
    });
  });

  describe("validateUsername", () => {
    it("accepts valid usernames", () => {
      expect(validateUsername("karan")).toEqual({
        isValid: true,
        cleanUsername: "karan",
      });
      expect(validateUsername("karan_rajbhar")).toEqual({
        isValid: true,
        cleanUsername: "karan_rajbhar",
      });
      expect(validateUsername("player_07")).toEqual({
        isValid: true,
        cleanUsername: "player_07",
      });
      expect(validateUsername("@cool_cricketer")).toEqual({
        isValid: true,
        cleanUsername: "cool_cricketer",
      });
    });

    it("rejects handles shorter than 3 characters", () => {
      const res = validateUsername("ab");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("at least 3 characters");
    });

    it("rejects handles longer than 30 characters", () => {
      const longName = "a".repeat(31);
      const res = validateUsername(longName);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("cannot exceed 30 characters");
    });

    it("rejects handles starting or ending with an underscore", () => {
      const startRes = validateUsername("_karan");
      expect(startRes.isValid).toBe(false);
      expect(startRes.error).toContain("cannot start or end with an underscore");

      const endRes = validateUsername("karan_");
      expect(endRes.isValid).toBe(false);
      expect(endRes.error).toContain("cannot start or end with an underscore");
    });

    it("rejects special characters, spaces, and hyphens", () => {
      expect(validateUsername("karan rajbhar").isValid).toBe(false);
      expect(validateUsername("karan-rajbhar").isValid).toBe(false);
      expect(validateUsername("karan.rajbhar").isValid).toBe(false);
      expect(validateUsername("karan!").isValid).toBe(false);
    });

    it("rejects reserved usernames", () => {
      for (const reserved of ["admin", "api", "dashboard", "matches", "cricscore"]) {
        const res = validateUsername(reserved);
        expect(res.isValid).toBe(false);
        expect(res.error).toContain("reserved");
      }
    });
  });
});
