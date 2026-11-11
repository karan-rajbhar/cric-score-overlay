import { describe, expect, it } from "vitest";
import {
  cardDate,
  dateRange,
  fullDateTime,
  shortDate,
  timeOfDay,
} from "./dates";

const now = new Date(2026, 10, 11);

describe("dates", () => {
  it("writes a card date with the year only when it is not this year", () => {
    expect(cardDate(new Date(2026, 9, 24), now)).toBe("Sat 24 Oct");
    expect(cardDate(new Date(2024, 7, 10), now)).toBe("Sat 10 Aug 2024");
  });

  it("writes a short date with the year, day before month", () => {
    expect(shortDate("2024-06-01")).toBe("1 Jun 2024");
    expect(shortDate("2024-07-20T14:00:00")).toBe("20 Jul 2024");
  });

  it("reads a bare calendar day as that day, not midnight UTC", () => {
    expect(shortDate("2024-07-15")).toBe("15 Jul 2024");
  });

  it("writes a range with the year once when both ends share it", () => {
    expect(dateRange("2024-07-15", "2024-08-30")).toBe("15 Jul to 30 Aug 2024");
    expect(dateRange("2025-12-28", "2026-01-04")).toBe(
      "28 Dec 2025 to 4 Jan 2026",
    );
    expect(dateRange("2024-07-15", null)).toBe("From 15 Jul 2024");
    expect(dateRange(null, null)).toBe("");
  });

  it("writes times on the 24-hour clock and the full form for details", () => {
    expect(timeOfDay(new Date(2024, 7, 10, 19, 30))).toBe("19:30");
    expect(fullDateTime(new Date(2024, 7, 10, 19, 30))).toBe(
      "Saturday 10 August 2024, 19:30",
    );
  });

  it("gives nothing for a missing or broken date", () => {
    expect(cardDate(null)).toBe("");
    expect(shortDate("not a date")).toBe("");
  });
});
