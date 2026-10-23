import { describe, expect, it } from "vitest";
import {
  playerMilestones,
  type MilestoneBatting,
  type MilestoneBowling,
} from "./milestones";

const bat = (
  match: string,
  runs: number,
  balls: number,
  isOut = true,
  date = `2024-07-${match.padStart(2, "0")}T10:00:00.000Z`,
): MilestoneBatting => ({
  match_id: match,
  runs_scored: runs,
  balls_faced: balls,
  is_out: isOut,
  created_at: date,
  match: { id: match, title: `Match ${match}` },
});

const bowl = (
  match: string,
  wickets: number,
  runs: number,
  overs = 4,
): MilestoneBowling => ({
  match_id: match,
  wickets_taken: wickets,
  runs_conceded: runs,
  overs_bowled: overs,
  created_at: `2024-07-${match.padStart(2, "0")}T10:00:00.000Z`,
  match: { id: match, title: `Match ${match}` },
});

describe("playerMilestones", () => {
  it("counts hundreds and fifties separately", () => {
    const m = playerMilestones(
      [bat("1", 104, 61, false), bat("2", 52, 38), bat("3", 49, 30), bat("4", 100, 70)],
      [],
    );
    expect(m.hundreds).toBe(2);
    expect(m.fifties).toBe(1);
    expect(m.milestones.map((x) => x.figure)).toEqual(["100", "52", "104*"]);
    expect(m.milestones[2]).toMatchObject({
      kind: "hundred",
      label: "Hundred",
      detail: "(61 balls)",
      matchId: "1",
      matchTitle: "Match 1",
    });
  });

  it("counts 3 and 5 wicket hauls separately", () => {
    const m = playerMilestones(
      [],
      [bowl("1", 5, 23), bowl("2", 3, 30, 3.4), bowl("3", 4, 18), bowl("4", 2, 10)],
    );
    expect(m.fiveWickets).toBe(1);
    expect(m.threeWickets).toBe(2);
    expect(m.milestones.map((x) => `${x.label} ${x.figure} ${x.detail}`)).toEqual([
      "3 wickets 4/18 (4 overs)",
      "3 wickets 3/30 (3.4 overs)",
      "5 wickets 5/23 (4 overs)",
    ]);
  });

  it("picks the best innings: runs, then not out, then fewer balls", () => {
    expect(
      playerMilestones([bat("1", 40, 30), bat("2", 40, 35, false)], [])
        .bestBatting,
    ).toMatchObject({ figure: "40*", matchId: "2" });
    expect(
      playerMilestones([bat("1", 40, 30), bat("2", 40, 25)], []).bestBatting,
    ).toMatchObject({ figure: "40", matchId: "2", detail: "(25 balls)" });
  });

  it("picks the best spell: wickets, then fewer runs", () => {
    expect(
      playerMilestones([], [bowl("1", 2, 20), bowl("2", 2, 12), bowl("3", 1, 2)])
        .bestBowling,
    ).toMatchObject({ figure: "2/12", matchId: "2" });
  });

  it("has no best figures without runs or wickets", () => {
    const m = playerMilestones([bat("1", 0, 2)], [bowl("1", 0, 30)]);
    expect(m.bestBatting).toBeNull();
    expect(m.bestBowling).toBeNull();
    expect(m.milestones).toEqual([]);
  });

  it("dates a milestone by its match when known", () => {
    const m = playerMilestones(
      [
        {
          ...bat("1", 60, 40),
          match: { id: "1", title: "Final", scheduled_at: "2024-09-01T10:00:00Z" },
        },
      ],
      [],
    );
    expect(m.milestones[0]!.date).toBe("2024-09-01T10:00:00Z");
  });
});
