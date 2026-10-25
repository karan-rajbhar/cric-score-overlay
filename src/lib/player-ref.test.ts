import { describe, expect, it } from "vitest";
import {
  legacyHandleOf,
  parsePlayerRef,
  playerLookup,
  playerPath,
} from "./player-ref";

describe("parsePlayerRef", () => {
  it.each([
    "w4RVc8WK0UbGVm8jb2O1iUoGv1S2", // Firebase uid
    "2c70e49a-3260-49dd-9966-e7cf8fbd09b8", // UUID
    "Some_Future-Id.42",
  ])("uses %s as an id, exactly as written", (id) => {
    expect(parsePlayerRef(id)).toEqual({ kind: "id", id });
  });

  it("reads @name as a lower-cased handle", () => {
    expect(parsePlayerRef("%40Karan_R")).toEqual({
      kind: "handle",
      handle: "karan_r",
    });
    expect(playerLookup(parsePlayerRef("@karan")!)).toEqual({
      column: "username",
      value: "karan",
    });
  });

  it("rejects junk", () => {
    expect(parsePlayerRef("@a")).toBeNull();
    expect(parsePlayerRef("@bad name")).toBeNull();
    expect(parsePlayerRef("%E0%A4%A")).toBeNull();
    expect(parsePlayerRef("a/b")).toBeNull();
    expect(parsePlayerRef("")).toBeNull();
  });
});

describe("legacyHandleOf", () => {
  it("names the handle behind a bare /players/karan", () => {
    expect(legacyHandleOf(parsePlayerRef("Karan")!)).toBe("karan");
    expect(legacyHandleOf(parsePlayerRef("@karan")!)).toBeNull();
  });
});

describe("playerPath", () => {
  it("prefers the handle and round-trips the id", () => {
    expect(playerPath({ id: "x", username: "karan" })).toBe("/players/@karan");
    const path = playerPath({ id: "w4RVc8WK0UbGVm8jb2O1iUoGv1S2" });
    expect(parsePlayerRef(path.split("/")[2]!)).toEqual({
      kind: "id",
      id: "w4RVc8WK0UbGVm8jb2O1iUoGv1S2",
    });
  });
});
