import { describe, expect, it } from "vitest";
import {
  foundPlayerHint,
  playerMatches,
  sameNamePlayer,
  teammatesOf,
  typedHandle,
  whyNotAddable,
} from "./player-search";

describe("existing player suggestions", () => {
  it("says who someone is in a few words", () => {
    expect(foundPlayerHint({ id: "a", name: "A", teams: ["Lions"] })).toBe(
      "Plays for Lions",
    );
    expect(
      foundPlayerHint({ id: "a", name: "A", teams: ["Lions", "Tigers"] }),
    ).toBe("Plays for Lions, Tigers");
    // A regular of sides made each day: a count, not a list of names.
    expect(
      foundPlayerHint({
        id: "a",
        name: "A",
        teams: ["27 Oct A", "26 Oct B", "25 Oct A"],
      }),
    ).toBe("In 3 of your teams");
    expect(foundPlayerHint({ id: "a", name: "A", matches: 42 })).toBe(
      "42 matches",
    );
    expect(foundPlayerHint({ id: "a", name: "A", matches: 1 })).toBe("1 match");
    expect(
      foundPlayerHint({ id: "a", name: "A", username: "rahul", matches: 0 }),
    ).toBe("@rahul · No matches yet");
  });

  it("matches like the server: word starts in any order, or part of a name", () => {
    const rahul = { name: "Rahul Sharma", username: "rahul_s" };
    expect(playerMatches("rah", rahul)).toBe(true);
    expect(playerMatches("rah sh", rahul)).toBe(true);
    expect(playerMatches("sharma rahul", rahul)).toBe(true);
    expect(playerMatches("sharma", rahul)).toBe(true);
    expect(playerMatches("hul", rahul)).toBe(true);
    expect(playerMatches("rahul k", rahul)).toBe(false);
    expect(playerMatches("rahul sharma", { name: "Rahul Kumar Sharma" })).toBe(
      true,
    );
    expect(playerMatches("jose", { name: "José Patel" })).toBe(true);
    // Names outside the search keys' alphabet still match as typed.
    expect(playerMatches("राहुल", { name: "राहुल शर्मा" })).toBe(true);
  });

  it('"@" looks at usernames only', () => {
    const rahul = { name: "Rahul Sharma", username: "r_sharma" };
    expect(playerMatches("@r_shar", rahul)).toBe(true);
    expect(playerMatches("@R_SHAR", rahul)).toBe(true);
    expect(playerMatches("@rahul", rahul)).toBe(false);
    expect(playerMatches("@rahul", { name: "Rahul Sharma" })).toBe(false);
    expect(playerMatches("r_shar", rahul)).toBe(true);
  });

  it("says who is a member of the club being added to", () => {
    expect(
      foundPlayerHint({ id: "a", name: "A", clubMember: true, matches: 3 }),
    ).toBe("Club member · 3 matches");
  });

  it("finds someone of exactly the name being added", () => {
    const rahul = { id: "r", name: "Rahul Sharma" };
    expect(sameNamePlayer("  rahul   SHARMA ", [rahul])).toBe(rahul);
    expect(sameNamePlayer("Rahul", [rahul])).toBeNull();
    expect(sameNamePlayer("", [rahul])).toBeNull();
  });

  it("reads a typed username", () => {
    expect(typedHandle("  @Rahul_S ")).toBe("rahul_s");
    expect(typedHandle("@")).toBe("");
    expect(typedHandle("Rahul")).toBeNull();
  });

  it("refuses only who cannot play for the team today", () => {
    const p = { id: "a", name: "A" };
    expect(whyNotAddable(p, "Lions")).toBeNull();
    // A squad is a standing roster: the other side's is no reason.
    expect(whyNotAddable({ ...p, teams: ["Tigers"] }, "Lions")).toBeNull();
    expect(
      whyNotAddable({ ...p, teams: ["Tigers"], playedFor: "Tigers" }, "Lions"),
    ).toBe("Played for Tigers");
    expect(whyNotAddable({ ...p, teams: ["Lions"] }, "Lions")).toBe(
      "Already in Lions",
    );
    expect(
      whyNotAddable({ ...p, unavailable: "Already in this match" }, "Lions"),
    ).toBe("Already in this match");
  });

  it("lists each teammate once with every team they are in", () => {
    expect(
      teammatesOf([
        { name: "Lions", players: [{ id: "p1", name: "Rahul" }] },
        {
          name: "Tigers",
          players: [
            { id: "p1", name: "Rahul" },
            { id: "p2", name: "Arjun" },
          ],
        },
        { name: "Hawks" },
      ]),
    ).toEqual([
      { id: "p1", name: "Rahul", teams: ["Lions", "Tigers"] },
      { id: "p2", name: "Arjun", teams: ["Tigers"] },
    ]);
  });
});
