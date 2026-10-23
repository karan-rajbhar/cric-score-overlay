import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask-email";
import { isPlaceholderProfile, squadClaims } from "./squad-claims";

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("karan@gmail.com")).toBe("k…@gmail.com");
    expect(maskEmail("nope")).toBe("…");
  });
});

describe("squadClaims", () => {
  it("marks placeholders and pending invites, never accounts", () => {
    const claims = squadClaims(
      [
        { id: "p1", is_placeholder: true },
        { id: "p2", is_placeholder: true },
        { id: "legacy" },
        { id: "acct", is_placeholder: false },
        { id: "acct2" },
      ],
      [
        { id: "p1", email: "player.ravi.1234@players.local" },
        { id: "p2", email: "kiran@gmail.com" },
        { id: "legacy", email: "player.old.9999@players.local" },
        { id: "acct", email: "me@gmail.com" },
        { id: "acct2", email: "you@gmail.com" },
      ],
    );
    expect(claims).toEqual({
      p1: { state: "placeholder" },
      p2: { state: "invited", maskedEmail: "k…@gmail.com" },
      legacy: { state: "placeholder" },
    });
    expect(JSON.stringify(claims)).not.toContain("kiran@");
  });

  it("decides by the flag when it is set", () => {
    expect(isPlaceholderProfile(false, "x@players.local")).toBe(false);
    expect(isPlaceholderProfile(true, "real@gmail.com")).toBe(true);
    expect(isPlaceholderProfile(null, null)).toBe(true);
  });
});
