import { describe, expect, it } from "vitest";
import {
  buildCalendar,
  calendarFileName,
  estimatedMinutes,
  foldLine,
  icsDateTime,
  icsText,
  matchEventLines,
  type CalendarMatch,
} from "./ics";

const NOW = new Date("2024-08-01T09:30:00.000Z");
const ORIGIN = "https://cricscore.example";

const fixture: CalendarMatch = {
  id: "m1",
  title: "Strikers vs Warriors, Final; day 1",
  status: "scheduled",
  match_format: "T20",
  overs_per_innings: 20,
  venue: "Central Park, Ground 2",
  scheduled_at: "2024-08-10T19:30:00+05:30",
};

const unfold = (ics: string) => ics.replace(/\r\n /g, "");

describe("icsDateTime", () => {
  it("writes UTC without separators or milliseconds", () => {
    expect(icsDateTime(new Date("2024-07-20T14:05:09.123Z"))).toBe(
      "20240720T140509Z",
    );
  });
});

describe("icsText", () => {
  it("escapes backslashes, separators and newlines", () => {
    expect(icsText("a\\b; c, d\ne")).toBe("a\\\\b\\; c\\, d\\ne");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Short")).toBe("SUMMARY:Short");
  });

  it("folds at 75 octets without splitting a multi-byte character", () => {
    const line = `SUMMARY:${"é".repeat(80)}`;
    const folded = foldLine(line);
    const encoder = new TextEncoder();
    for (const part of folded.split("\r\n")) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

describe("estimatedMinutes", () => {
  it("scales with overs and stays between 1 and 8 hours", () => {
    expect(estimatedMinutes(20)).toBe(190);
    expect(estimatedMinutes(5)).toBe(63);
    expect(estimatedMinutes(1)).toBe(60);
    expect(estimatedMinutes(50)).toBe(445);
    expect(estimatedMinutes(90)).toBe(480);
    expect(estimatedMinutes(null)).toBe(190);
  });
});

describe("matchEventLines", () => {
  it("converts the start to UTC and estimates the end from the overs", () => {
    const lines = matchEventLines(fixture, ORIGIN, NOW)!;
    expect(lines).toContain("DTSTART:20240810T140000Z");
    expect(lines).toContain("DTEND:20240810T171000Z");
    expect(lines).toContain("UID:match-m1@cricscore.example");
    expect(lines).toContain("DTSTAMP:20240801T093000Z");
    expect(lines).toContain(
      "SUMMARY:Strikers vs Warriors\\, Final\\; day 1",
    );
    expect(lines).toContain("LOCATION:Central Park\\, Ground 2");
    expect(lines).toContain(`URL:${ORIGIN}/matches/m1`);
    expect(lines).toContain("STATUS:CONFIRMED");
  });

  it("uses the actual times of a finished match and adds its result", () => {
    const lines = matchEventLines(
      {
        ...fixture,
        status: "completed",
        actual_start_time: "2024-08-10T14:15:00.000Z",
        actual_end_time: "2024-08-10T17:45:00.000Z",
        result_description: "Strikers won by 12 runs",
      },
      ORIGIN,
      NOW,
    )!;
    expect(lines).toContain("DTSTART:20240810T141500Z");
    expect(lines).toContain("DTEND:20240810T174500Z");
    expect(lines.find((l) => l.startsWith("DESCRIPTION:"))).toBe(
      `DESCRIPTION:T20 · 20 overs\\nStrikers won by 12 runs\\n${ORIGIN}/matches/m1`,
    );
  });

  it("marks an abandoned match cancelled", () => {
    const lines = matchEventLines(
      { ...fixture, status: "abandoned" },
      ORIGIN,
      NOW,
    )!;
    expect(lines).toContain("STATUS:CANCELLED");
    expect(lines.find((l) => l.startsWith("SUMMARY:"))).toMatch(
      /^SUMMARY:Abandoned: /,
    );
  });

  it("names the teams when the match has no title", () => {
    const lines = matchEventLines(
      {
        ...fixture,
        title: null,
        team1_snapshot: { name: "Strikers" },
        team2_snapshot: { name: "Warriors" },
      },
      ORIGIN,
      NOW,
    )!;
    expect(lines).toContain("SUMMARY:Strikers vs Warriors");
  });

  it("skips a match without a start time", () => {
    expect(
      matchEventLines({ ...fixture, scheduled_at: null }, ORIGIN, NOW),
    ).toBeNull();
    expect(
      matchEventLines({ ...fixture, scheduled_at: "not a date" }, ORIGIN, NOW),
    ).toBeNull();
  });
});

describe("buildCalendar", () => {
  it("wraps the events in order with CRLF line endings", () => {
    const ics = buildCalendar({
      name: "Metropolitan Strikers",
      origin: ORIGIN,
      now: NOW,
      matches: [
        { ...fixture, id: "late", scheduled_at: "2024-09-01T10:00:00.000Z" },
        { ...fixture, id: "early", scheduled_at: "2024-07-01T10:00:00.000Z" },
        { ...fixture, id: "undated", scheduled_at: null },
      ],
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    const flat = unfold(ics);
    expect(flat).toContain("X-WR-CALNAME:Metropolitan Strikers fixtures");
    expect(flat.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(flat.indexOf("match-early@")).toBeLessThan(
      flat.indexOf("match-late@"),
    );
  });
});

describe("calendarFileName", () => {
  it("slugs the name", () => {
    expect(calendarFileName("Metropolitan Strikers 2024!")).toBe(
      "metropolitan-strikers-2024.ics",
    );
    expect(calendarFileName("***")).toBe("fixtures.ics");
  });
});
