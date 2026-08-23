import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("ignores falsy values", () => {
    expect(cn("foo", false && "bar", undefined, null)).toBe("foo");
  });

  it("dedupes conflicting tailwind classes, keeping the last", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("merges conditional expressions", () => {
    const isActive = true;
    expect(cn("btn", isActive && "btn-active")).toBe("btn btn-active");
  });
});

import { deriveShortName } from "./utils";

describe("deriveShortName", () => {
    it("takes the first three letters uppercased", () => {
        expect(deriveShortName("Riverside Warriors")).toBe("RIV");
    });

    it("ignores spaces and punctuation", () => {
        expect(deriveShortName("R.C. United")).toBe("RCU");
    });

    it("returns whatever exists for very short names", () => {
        expect(deriveShortName("FC")).toBe("FC");
    });

    it("handles empty strings", () => {
        expect(deriveShortName("")).toBe("");
    });
});
