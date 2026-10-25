import { describe, expect, it } from "vitest";
import { summarizeHeadToHead } from "./head-to-head";

const m = (
  id: string,
  status: string,
  winner: string | null = null,
  at: string | null = null,
) => ({ id, status, winning_team_id: winner, scheduled_at: at });

describe("summarizeHeadToHead", () => {
  it("counts finished matches only and keeps live / upcoming out of the record", () => {
    const s = summarizeHeadToHead(
      [
        m("up", "scheduled", null, "2026-12-01"),
        m("live", "live", null, "2026-10-20"),
        m("a", "completed", "t1", "2026-05-01"),
        m("b", "completed", "t2", "2026-04-01"),
        m("tie", "completed", null, "2026-03-01"),
        m("x", "abandoned"),
        m("y", "cancelled"),
      ],
      "t1",
      "t2",
    );
    expect(s.completed.map((r) => r.id)).toEqual(["a", "b", "tie"]);
    expect([s.team1Wins, s.team2Wins, s.others]).toEqual([1, 1, 1]);
    // live first, then upcoming; abandoned / cancelled in neither list
    expect(s.open.map((r) => r.id)).toEqual(["live", "up"]);
  });

  it("reports a winning run of two or more, broken by a tie or the other side", () => {
    const run = (ids: Array<[string, string | null]>) =>
      summarizeHeadToHead(
        ids.map(([id, w]) => m(id, "completed", w)),
        "t1",
        "t2",
      ).streak;
    expect(
      run([
        ["a", "t1"],
        ["b", "t1"],
        ["c", "t1"],
        ["d", "t2"],
      ]),
    ).toEqual({
      teamId: "t1",
      count: 3,
    });
    expect(
      run([
        ["a", "t1"],
        ["b", "t2"],
      ]),
    ).toBeNull();
    expect(
      run([
        ["a", null],
        ["b", "t1"],
        ["c", "t1"],
      ]),
    ).toBeNull();
    expect(run([])).toBeNull();
  });

  it("handles a pair with only an unfinished match", () => {
    const s = summarizeHeadToHead([m("live", "live")], "t1", "t2");
    expect(s.completed).toEqual([]);
    expect(s.open).toHaveLength(1);
    expect(s.streak).toBeNull();
  });

  it("counts the viewed match once finished, but never lists it as still to come", () => {
    const rows = [
      m("cur", "completed", "t1", "2026-06-01"),
      m("old", "completed", "t2", "2026-05-01"),
      m("live", "live", null, "2026-07-01"),
    ];
    const done = summarizeHeadToHead(rows, "t1", "t2", "cur");
    expect(done.completed.map((r) => r.id)).toEqual(["cur", "old"]);
    expect([done.team1Wins, done.team2Wins]).toEqual([1, 1]);
    expect(done.open.map((r) => r.id)).toEqual(["live"]);

    const viewingLive = summarizeHeadToHead(rows, "t1", "t2", "live");
    expect(viewingLive.open).toEqual([]);
    expect(viewingLive.completed).toHaveLength(2);
  });
});
