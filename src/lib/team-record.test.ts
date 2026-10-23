import { describe, expect, it } from "vitest";
import { teamRecordOf } from "./team-record";

describe("teamRecordOf", () => {
  it("counts finished matches only, so played adds up", () => {
    const record = teamRecordOf(
      [
        { status: "completed", winning_team_id: "t1" },
        { status: "completed", winning_team_id: "t2" },
        { status: "completed", winning_team_id: null }, // tie
        { status: "abandoned", winning_team_id: null },
        { status: "scheduled", winning_team_id: null },
        { status: "live", winning_team_id: null },
      ],
      "t1",
    );
    expect(record).toEqual({
      played: 4,
      won: 1,
      lost: 1,
      noWinner: 2,
      winRate: 50,
    });
    expect(record.played).toBe(record.won + record.lost + record.noWinner);
  });

  it("has no win rate before a decided match", () => {
    expect(teamRecordOf([{ status: "scheduled" }], "t1")).toMatchObject({
      played: 0,
      winRate: null,
    });
  });
});
