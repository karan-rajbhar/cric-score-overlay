import { describe, expect, it } from "vitest";
import {
  inningsOverNotice,
  isChaseInnings,
  OFFLINE_MATCH_OVER,
} from "./innings-notice";

describe("the innings-over banner", () => {
  it("knows which innings are chases (the match's and a super over's)", () => {
    expect([1, 2, 3, 4, 5].map(isChaseInnings)).toEqual([
      false,
      true,
      false,
      true,
      false,
    ]);
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

  it("offline, ends a first innings but never invents a third", () => {
    expect(
      inningsOverNotice({ isChase: false, isOffline: true, awaitingServer: false }),
    ).toMatchObject({ action: "end" });
    expect(
      inningsOverNotice({ isChase: true, isOffline: true, awaitingServer: false }),
    ).toEqual({ title: "Match over", text: OFFLINE_MATCH_OVER, action: null });
  });
});
