import { describe, expect, it } from "vitest";
import { isAtInningsBreak } from "./innings-break";

const chase = { id: "i2", innings_number: 2, total_balls: 0 };
const base = {
  status: "live",
  innings: chase,
  strikerId: null,
  nonStrikerId: null,
  startedInningsId: null,
};

describe("isAtInningsBreak", () => {
  it("is the break once the next innings is open and untouched", () => {
    expect(isAtInningsBreak(base)).toBe(true);
  });

  it("ends when the scorer starts it, a batter is in, or a ball is bowled", () => {
    expect(isAtInningsBreak({ ...base, startedInningsId: "i2" })).toBe(false);
    expect(isAtInningsBreak({ ...base, strikerId: "a" })).toBe(false);
    expect(isAtInningsBreak({ ...base, innings: { ...chase, total_balls: 1 } })).toBe(false);
  });

  it("is never the first innings, nor a match not in play", () => {
    expect(isAtInningsBreak({ ...base, innings: { ...chase, innings_number: 1 } })).toBe(false);
    expect(isAtInningsBreak({ ...base, status: "completed" })).toBe(false);
    expect(isAtInningsBreak({ ...base, innings: null })).toBe(false);
  });
});
