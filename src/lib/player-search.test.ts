import { describe, expect, it } from "vitest";
import { foundPlayerHint, nameMatches, teammatesOf } from "./player-search";

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

  it("matches typed words to the starts of the name's words", () => {
    expect(nameMatches("Rahul Sharma", "rah")).toBe(true);
    expect(nameMatches("Rahul Sharma", "rah sh")).toBe(true);
    expect(nameMatches("Rahul Sharma", "sharma")).toBe(true);
    expect(nameMatches("Rahul Sharma", "hul")).toBe(false);
    expect(nameMatches("Rahul Sharma", "rahul k")).toBe(false);
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
