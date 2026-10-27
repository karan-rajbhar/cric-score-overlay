import { describe, expect, it } from "vitest";
import { makeMatch } from "~/test/factories";
import { matchParts, partFigures, partInWords } from "./match-players";

const match = makeMatch({
  team1_id: "t1",
  team2_id: "t2",
  team1: {
    id: "t1",
    name: "Lions",
    team_players: [
      { id: "x", team_id: "t1", user_id: "l1", user: { id: "l1", full_name: "Rahul Sharma" } },
    ],
  },
  team2: { id: "t2", name: "Tigers", team_players: [] },
  innings: [
    {
      id: "i1",
      match_id: "m1",
      innings_number: 1,
      team_id: "t1",
      batting_performances: [
        { user_id: "l1", runs_scored: 34, balls_faced: 22, is_out: true },
        { user_id: "l2", runs_scored: 10, balls_faced: 8, is_out: false, user: { id: "l2", full_name: "Arjun" } },
      ],
      bowling_performances: [
        { user_id: "t9", wickets_taken: 1, runs_conceded: 30, user: { id: "t9", full_name: "Dev" } },
      ],
      fall_of_wickets: [{ batsman_out_id: "l1", fielder_id: "t8", dismissal_type: "caught" }],
    },
    {
      id: "i2",
      match_id: "m1",
      innings_number: 2,
      team_id: "t2",
      batting_performances: [],
      bowling_performances: [
        { user_id: "l1", wickets_taken: 2, runs_conceded: 18 },
      ],
      fall_of_wickets: [],
    },
  ],
} as never);

describe("match parts", () => {
  it("lists everyone with a part, for the team they played for, with their figures", () => {
    const parts = matchParts(match);
    expect(parts.map((p) => [p.name, p.teamName])).toEqual([
      ["Rahul Sharma", "Lions"],
      ["Arjun", "Lions"],
      ["Dev", "Tigers"],
      ["Player", "Tigers"],
    ]);
    const rahul = parts[0]!;
    expect(partFigures(rahul)).toBe("34 (22) · 2/18");
    expect(partInWords(rahul)).toBe("34 runs and 2 wickets");
    expect(partFigures(parts[1]!)).toBe("10* (8)");
    expect(partFigures(parts[3]!)).toBe("1 ct");
    expect(partInWords(parts[3]!)).toBe("1 catch");
  });
});
