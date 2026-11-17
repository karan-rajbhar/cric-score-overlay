/**
 * One way to write a date or a time (`/design#spec-dates`): day before
 * month, the month as a word, the year only when it is not this year (or
 * always, where a record needs it). Shown in the viewer's time zone.
 *
 * - `cardDate`: "Sat 25 Oct", "Sat 10 Aug 2024" (cards and rows)
 * - `shortDate`: "20 Jul 2024" (tables, records, "Joined ...")
 * - `dateRange`: "15 Jul to 30 Aug 2024", "28 Dec 2025 to 4 Jan 2026"
 * - `timeOfDay`: "19:30"
 * - `fullDateTime`: "Saturday 10 August 2024, 19:30"
 *
 * Each takes an optional time zone. Without one they use the runtime's: in
 * the browser that is the viewer's own, which is what a page should show,
 * but on the server it is UTC. Server-rendered pages therefore show times
 * through `LocalDate` / `useDisplayTimeZone` (`~/components/ds/local-date`),
 * which render in `SERVER_TIME_ZONE` on the server and in the viewer's zone
 * once the page is in the browser.
 */

type DateInput = string | number | Date | null | undefined;

/**
 * The zone a page is rendered in before the browser takes over (and for
 * readers without JavaScript): the app's home, where nearly every match is
 * played. The browser then shows the viewer's own zone.
 */
export const SERVER_TIME_ZONE = "Asia/Kolkata";

/** A bare "2024-07-15" names a calendar day, the same day in every zone. */
const isCalendarDay = (value: DateInput) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** The zone to format `value` in: none for a calendar day. */
const zoneOf = (value: DateInput, zone?: string) =>
  zone && !isCalendarDay(value) ? { timeZone: zone } : {};

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  // A bare "2024-07-15" is a calendar day, not midnight UTC.
  if (typeof value === "string" && isCalendarDay(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const sameYear = (date: Date, now: Date, tz: { timeZone?: string }) => {
  const year = (d: Date) => d.toLocaleDateString("en-GB", { year: "numeric", ...tz });
  return year(date) === year(now);
};

/** "Sat 25 Oct", with the year when it is not this year. */
export function cardDate(
  value: DateInput,
  now = new Date(),
  zone?: string,
): string {
  const date = toDate(value);
  if (!date) return "";
  const tz = zoneOf(value, zone);
  // Built in parts: en-GB puts a comma after the weekday when the year
  // is there ("Sat, 10 Aug 2024").
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short", ...tz });
  const day = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear(date, now, tz) ? {} : { year: "numeric" }),
    ...tz,
  });
  return `${weekday} ${day}`;
}

/** "20 Jul 2024": always with the year. */
export function shortDate(value: DateInput, zone?: string): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...zoneOf(value, zone),
  });
}

/** "15 Jul to 30 Aug 2024": the year once, when both ends share it. */
export function dateRange(start: DateInput, end: DateInput): string {
  const from = toDate(start);
  const to = toDate(end);
  if (!from && !to) return "";
  if (!from) return `Until ${shortDate(to)}`;
  if (!to) return `From ${shortDate(from)}`;
  const first =
    from.getFullYear() === to.getFullYear()
      ? from.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : shortDate(from);
  return `${first} to ${shortDate(to)}`;
}

/** "19:30". */
export function timeOfDay(value: DateInput, zone?: string): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    ...zoneOf(value, zone),
  });
}

/** "Saturday 10 August 2024, 19:30". */
export function fullDateTime(value: DateInput, zone?: string): string {
  const date = toDate(value);
  if (!date) return "";
  const tz = zoneOf(value, zone);
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long", ...tz });
  const day = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...tz,
  });
  return `${weekday} ${day}, ${timeOfDay(value, zone)}`;
}

/** "Saturday 10 August", with the year when it is not this year. */
export function longDate(
  value: DateInput,
  now = new Date(),
  zone?: string,
): string {
  const date = toDate(value);
  if (!date) return "";
  const tz = zoneOf(value, zone);
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long", ...tz });
  const day = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    ...(sameYear(date, now, tz) ? {} : { year: "numeric" }),
    ...tz,
  });
  return `${weekday} ${day}`;
}

/** A fixture still listed this long after its start time without starting. */
export const LATE_AFTER_MS = 3 * 60 * 60 * 1000;

/**
 * Whether a scheduled match's start time has passed without it starting
 * (M3, M17, `/design#spec-fixture-late`): it is "Not started", no longer
 * "Upcoming". A few minutes late is still upcoming.
 */
export function isLateFixture(
  match: { status?: string | null; scheduled_at?: string | null },
  now = new Date(),
): boolean {
  if (match.status !== "scheduled" || !match.scheduled_at) return false;
  const start = toDate(match.scheduled_at);
  return Boolean(start && now.getTime() - start.getTime() > 15 * 60 * 1000);
}
