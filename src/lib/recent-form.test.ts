import { describe, expect, it } from "vitest";
import { recentBatting, recentBowling } from "./recent-form";

describe("recentBatting", () => {
  it("lists the newest innings first, marks not outs and 50s", () => {
    const out = recentBatting(
      [
        { match_id: "a", runs_scored: 12, balls_faced: 9, is_out: false, created_at: "2026-01-01" },
        { match_id: "b", runs_scored: 64, balls_faced: 40, is_out: true, created_at: "2026-03-01" },
      ],
      5,
    );
    expect(out.map((e) => e.figure)).toEqual(["64", "12*"]);
    expect(out[0]?.notable).toBe(true);
    expect(out[1]?.detail).toBe("9 balls");
  });

  it("keeps only the last n", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      match_id: `m${i}`,
      runs_scored: i,
      balls_faced: 1,
      is_out: true,
      created_at: `2026-01-0${i + 1}`,
    }));
    expect(recentBatting(rows, 5)).toHaveLength(5);
  });
});

describe("recentBowling", () => {
  it("skips spells with no balls and shows wickets/runs", () => {
    const out = recentBowling([
      { match_id: "a", balls_bowled: 0, runs_conceded: 0, wickets_taken: 0, created_at: "2026-02-01" },
      { match_id: "b", balls_bowled: 22, runs_conceded: 24, wickets_taken: 3, created_at: "2026-01-01" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ figure: "3/24", detail: "3.4 overs", notable: true });
  });
});
