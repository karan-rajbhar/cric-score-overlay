import { describe, expect, it } from "vitest";
import { endedByDate } from "./rules";

describe("endedByDate (T12)", () => {
  const today = new Date("2026-11-11T12:00:00");

  it("is true once the end date has passed and nobody closed it", () => {
    expect(endedByDate({ status: "ongoing", end_date: "2024-08-30" }, today)).toBe(true);
    expect(endedByDate({ status: "upcoming", end_date: "2026-11-10" }, today)).toBe(true);
  });

  it("is false on the last day itself, and for a closed one", () => {
    expect(endedByDate({ status: "ongoing", end_date: "2026-11-11" }, today)).toBe(false);
    expect(endedByDate({ status: "completed", end_date: "2024-08-30" }, today)).toBe(false);
    expect(endedByDate({ status: "cancelled", end_date: "2024-08-30" }, today)).toBe(false);
    expect(endedByDate({ status: "ongoing", end_date: null }, today)).toBe(false);
  });
});
