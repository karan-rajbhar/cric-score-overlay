import { describe, expect, it } from "vitest";
import { battingWithCrease, bowlingWithBowler } from "./ball-docs";

const entry = (
  id: string,
  pos: number,
  over: Partial<Parameters<typeof battingWithCrease>[0][number]> = {},
) => ({
  user_id: id,
  batting_position: pos,
  runs_scored: 0,
  balls_faced: 0,
  minutes_batted: 0,
  fours: 0,
  sixes: 0,
  is_out: false,
  dismissal_type: null,
  bowler_id: null,
  fielder_id: null,
  is_current_batsman: false,
  is_striker: false,
  ...over,
});

describe("battingWithCrease", () => {
  it("appends newcomers at the next positions", () => {
    const next = battingWithCrease(
      [entry("a", 1, { is_out: true, balls_faced: 4 }), entry("b", 2, { is_current_batsman: true, balls_faced: 3 })],
      "c",
      "b",
    )!;
    expect(next.map((b) => [b.user_id, b.batting_position, b.is_striker])).toEqual([
      ["a", 1, false],
      ["b", 2, false],
      ["c", 3, true],
    ]);
  });

  it("drops a wrong pick corrected before they faced a ball", () => {
    const batting = [
      entry("a", 1, { is_out: true, balls_faced: 10 }),
      entry("b", 2, { is_current_batsman: true, balls_faced: 8 }),
      // Picked by mistake as the new batter.
      entry("x", 3, { is_current_batsman: true, is_striker: true }),
    ];
    const next = battingWithCrease(batting, "y", "b")!;
    expect(next.map((b) => [b.user_id, b.batting_position])).toEqual([
      ["a", 1],
      ["b", 2],
      ["y", 3],
    ]);
  });

  it("keeps a batter who left the crease after something happened to them", () => {
    const batting = [
      entry("b", 2, { is_current_batsman: true, balls_faced: 1 }),
      entry("r", 3, { dismissal_type: "retired_hurt" }),
      entry("n", 4, { is_current_batsman: true, runs_scored: 1 }),
    ];
    const next = battingWithCrease(batting, "b", "z")!;
    expect(next.map((b) => b.user_id)).toEqual(["b", "r", "n", "z"]);
    expect(next.find((b) => b.user_id === "n")!.is_current_batsman).toBe(false);
  });

  it("is null when nothing changes", () => {
    const batting = [
      entry("a", 1, { is_current_batsman: true, is_striker: true }),
      entry("b", 2, { is_current_batsman: true }),
    ];
    expect(battingWithCrease(batting, "a", "b")).toBeNull();
    expect(bowlingWithBowler([{ user_id: "w", overs_bowled: 0, balls_bowled: 0, runs_conceded: 0, wickets_taken: 0, maidens: 0, wides: 0, no_balls: 0, is_current_bowler: true }], "w")).toBeNull();
  });
});
