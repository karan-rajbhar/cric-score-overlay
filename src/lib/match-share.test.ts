import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Doc } from "./firebase/datasource";
import { matchShareSummary, type ShareMatch } from "./match-share";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;
const byStatus = (status: string) =>
  seed.matches!.find((m) => m.status === status) as unknown as ShareMatch;

describe("matchShareSummary", () => {
  it("puts the live score and the chase in the preview", () => {
    const s = matchShareSummary(byStatus("live"));
    expect(s.title).toBe(
      "Riverside Titans vs Metropolitan Strikers — 108/3 (13.4 ov)",
    );
    expect(s.status).toBe("Live");
    expect(s.sides[0]).toMatchObject({
      score: "146/9",
      overs: "20.0",
      batting: false,
      note: "Innings closed",
    });
    expect(s.sides[1]).toMatchObject({
      score: "108/3",
      overs: "13.4",
      batting: true,
      note: "Batting now",
    });
    expect(s.footer).toBe("Metropolitan Strikers need 39 runs from 38 balls");
    expect(s.description).toBe(
      "Riverside Titans 146/9 (20.0 ov), Metropolitan Strikers 108/3 (13.4 ov). Metropolitan Strikers need 39 runs from 38 balls",
    );
  });

  it("uses the result for a finished match", () => {
    const s = matchShareSummary(byStatus("completed"));
    expect(s.title).toBe(
      "Metropolitan Strikers vs Riverside Warriors — Metropolitan Strikers won by 16 runs",
    );
    expect(s.status).toBe("Result");
    expect(s.footer).toBe("Metropolitan Strikers won by 16 runs");
    expect(s.sides.map((x) => x.note)).toEqual(["", ""]);
  });

  it("shows teams only before the start, and changes version with the score", () => {
    const base = byStatus("live");
    const scheduled = matchShareSummary({
      ...base,
      status: "scheduled",
      innings_summary: [],
    });
    expect(scheduled.title).toBe("Riverside Titans vs Metropolitan Strikers");
    expect(scheduled.sides.map((x) => x.score)).toEqual([null, null]);
    expect(scheduled.sides.map((x) => x.note)).toEqual([
      "Yet to bat",
      "Yet to bat",
    ]);

    const next = {
      ...base,
      innings_summary: base.innings_summary!.map((i) =>
        i.is_completed
          ? i
          : { ...i, total_runs: (i.total_runs ?? 0) + 4, total_balls: 83 },
      ),
    };
    expect(matchShareSummary(next).version).not.toBe(
      matchShareSummary(base).version,
    );
  });

  it("falls back when team snapshots are missing", () => {
    const s = matchShareSummary({
      id: "m",
      status: "scheduled",
      team1_id: "a",
      team2_id: "b",
    } as ShareMatch);
    expect(s.title).toBe("Team 1 vs Team 2");
  });
});
