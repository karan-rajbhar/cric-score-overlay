import { describe, expect, it } from "vitest";
import {
  inningsOverNotice,
  isChaseInnings,
  nextInningsOnDevice,
  OFFLINE_MATCH_OVER,
} from "./innings-notice";

describe("the innings-over banner", () => {
  it("knows which innings are chases (the match's and a super over's)", () => {
    expect([1, 2, 3, 4, 5].map((n) => isChaseInnings(null, n))).toEqual([
      false,
      true,
      false,
      true,
      false,
    ]);
  });

  it("in a two-innings match, only the fourth innings is the chase", () => {
    const test = { innings_per_side: 2 };
    expect([1, 2, 3, 4].map((n) => isChaseInnings(test, n))).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it("opens the next innings on the device as the server does", () => {
    const base = { team1_id: "A", team2_id: "B", innings_per_side: 2 };
    const inn = (n: number, team: string, runs: number) => ({
      id: `i${n}`,
      innings_number: n,
      team_id: team,
      total_runs: runs,
    });
    // After the first innings: no target, the other side bats.
    expect(
      nextInningsOnDevice({ ...base, innings: [inn(1, "A", 300)] } as never, 1, 300),
    ).toEqual({ teamId: "B", target: null });
    // After the second: the side that batted first, still no target.
    expect(
      nextInningsOnDevice(
        { ...base, innings: [inn(1, "A", 300), inn(2, "B", 250)] } as never,
        2,
        250,
      ),
    ).toEqual({ teamId: "A", target: null });
    // After the third: the chase, the lead plus one.
    expect(
      nextInningsOnDevice(
        {
          ...base,
          innings: [inn(1, "A", 300), inn(2, "B", 250), inn(3, "A", 150)],
        } as never,
        3,
        150,
      ),
    ).toEqual({ teamId: "B", target: 201 });
    // Behind after the third (a follow-on that failed): won by an innings.
    expect(
      nextInningsOnDevice(
        {
          ...base,
          innings: [inn(1, "A", 400), inn(2, "B", 150), inn(3, "B", 200)],
        } as never,
        3,
        200,
      ),
    ).toBeNull();
    // A limited-overs match: the chase after the first innings.
    expect(
      nextInningsOnDevice(
        { team1_id: "A", team2_id: "B", innings: [inn(1, "A", 160)] } as never,
        1,
        160,
      ),
    ).toEqual({ teamId: "B", target: 161 });
  });

  it("asks for nothing while the server opens the next innings", () => {
    expect(
      inningsOverNotice({ isChase: false, isOffline: false, awaitingServer: true }),
    ).toEqual({
      title: "Innings over",
      text: "Saving the last ball. The next innings opens after it.",
      action: null,
    });
    expect(
      inningsOverNotice({ isChase: true, isOffline: false, awaitingServer: true }),
    ).toMatchObject({ title: "Match over", action: null });
  });

  it("offline, offers End innings after a ball it could not save yet", () => {
    // The server that would open the next innings cannot be reached: the
    // scorer ends the innings on the device (the screen stops waiting).
    expect(
      inningsOverNotice({ isChase: false, isOffline: true, awaitingServer: true }),
    ).toEqual({
      title: "Innings over",
      text: "End the innings to start the next one.",
      action: "end",
    });
  });

  it("offline, ends a first innings but never invents a third", () => {
    expect(
      inningsOverNotice({ isChase: false, isOffline: true, awaitingServer: false }),
    ).toMatchObject({ action: "end" });
    expect(
      inningsOverNotice({ isChase: true, isOffline: true, awaitingServer: false }),
    ).toEqual({ title: "Match over", text: OFFLINE_MATCH_OVER, action: null });
  });
});
