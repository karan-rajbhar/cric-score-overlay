import { describe, expect, it } from "vitest";
import {
  localDateTimeToIso,
  toLocalDateTimeInput,
  todayLocalDateInput,
} from "./local-datetime";

describe("local date and time inputs", () => {
  it("round-trips a local date and time through ISO", () => {
    const iso = localDateTimeToIso("2026-10-20", "15:30")!;
    expect(iso).toBe(new Date("2026-10-20T15:30").toISOString());
    expect(toLocalDateTimeInput(iso)).toBe("2026-10-20T15:30");
  });

  it("refuses missing or malformed parts", () => {
    expect(localDateTimeToIso("", "10:00")).toBeNull();
    expect(localDateTimeToIso("2026-10-20", "")).toBeNull();
    expect(toLocalDateTimeInput(null)).toBe("");
    expect(toLocalDateTimeInput("not a date")).toBe("");
  });

  it("formats today in local time", () => {
    expect(todayLocalDateInput(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
