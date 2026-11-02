import { matchFormatLabel } from "~/lib/cricket";
/**
 * iCalendar (RFC 5545) feeds of fixtures: a team's, a tournament's or a
 * club's matches as VEVENTs, for calendar apps that subscribe to
 * `/api/calendar/<scope>/<id>.ics` (see that route).
 *
 * Pure functions: no reads, no clock (callers pass `now`).
 */

export interface CalendarMatch {
  id: string;
  title?: string | null;
  status?: string | null;
  match_format?: string | null;
  overs_per_innings?: number | null;
  venue?: string | null;
  scheduled_at?: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  result_description?: string | null;
  updated_at?: string | null;
  team1_snapshot?: { name?: string | null } | null;
  team2_snapshot?: { name?: string | null } | null;
}

export interface CalendarFeed {
  /** "Metropolitan Strikers": the calendar is named "<name> fixtures". */
  name: string;
  /** Public origin for match links, e.g. "https://cricscore.example". */
  origin: string;
  matches: CalendarMatch[];
  now: Date;
}

/** How often calendar apps should poll (they mostly poll less often). */
const REFRESH = "PT3H";
const MINUTE = 60_000;

/** Minutes per over for a duration estimate, both innings plus a break. */
const MINUTES_PER_OVER = 4.25;
const BREAK_MINUTES = 20;
const MIN_MINUTES = 60;
const MAX_MINUTES = 8 * 60;

function validDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `20240720T140000Z`: UTC date-time, no fractional seconds. */
export function icsDateTime(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapes TEXT values (RFC 5545 3.3.11). */
export function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/**
 * Folds a content line at 75 octets (RFC 5545 3.1), never inside a UTF-8
 * sequence: continuation lines start with one space.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    // The first line holds 75 octets; continuations 74 plus the space.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Planned length of a match from its overs, clamped to 1 to 8 hours. */
export function estimatedMinutes(oversPerInnings?: number | null): number {
  const overs = oversPerInnings && oversPerInnings > 0 ? oversPerInnings : 20;
  const minutes = Math.round(overs * 2 * MINUTES_PER_OVER + BREAK_MINUTES);
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, minutes));
}

function summaryOf(m: CalendarMatch): string {
  const title = m.title?.trim();
  const home = m.team1_snapshot?.name;
  const away = m.team2_snapshot?.name;
  const base = title || (home && away ? `${home} vs ${away}` : "Match");
  if (m.status === "abandoned") return `Abandoned: ${base}`;
  return base;
}

function descriptionOf(m: CalendarMatch, url: string): string {
  const lines: string[] = [];
  const format = matchFormatLabel(m);
  if (format !== "Match") lines.push(format);
  if (m.status === "completed" && m.result_description) {
    lines.push(m.result_description);
  }
  lines.push(url);
  return lines.join("\n");
}

/** One VEVENT, or null for a match without a valid start time. */
export function matchEventLines(
  m: CalendarMatch,
  origin: string,
  now: Date,
): string[] | null {
  const scheduled = validDate(m.scheduled_at);
  const actualStart = validDate(m.actual_start_time);
  const start = actualStart ?? scheduled;
  if (!start) return null;
  const actualEnd = validDate(m.actual_end_time);
  const end =
    actualEnd && actualEnd > start
      ? actualEnd
      : new Date(start.getTime() + estimatedMinutes(m.overs_per_innings) * MINUTE);
  const url = `${origin}/matches/${m.id}`;
  const host = origin.replace(/^[a-z]+:\/\//i, "").replace(/[:/].*$/, "");
  const modified = validDate(m.updated_at);
  const lines = [
    "BEGIN:VEVENT",
    `UID:match-${m.id}@${host || "cricscore"}`,
    `DTSTAMP:${icsDateTime(now)}`,
    `DTSTART:${icsDateTime(start)}`,
    `DTEND:${icsDateTime(end)}`,
    `SUMMARY:${icsText(summaryOf(m))}`,
  ];
  if (m.venue?.trim()) lines.push(`LOCATION:${icsText(m.venue.trim())}`);
  lines.push(`DESCRIPTION:${icsText(descriptionOf(m, url))}`);
  lines.push(`URL:${url}`);
  if (modified) lines.push(`LAST-MODIFIED:${icsDateTime(modified)}`);
  lines.push(
    `STATUS:${m.status === "abandoned" ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
  );
  return lines;
}

/** The whole calendar, CRLF-terminated and folded. */
export function buildCalendar(feed: CalendarFeed): string {
  const name = `${feed.name} fixtures`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CricScore//Fixtures//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(name)}`,
    `X-WR-CALDESC:${icsText(`Match times for ${feed.name} from CricScore`)}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH}`,
    `X-PUBLISHED-TTL:${REFRESH}`,
  ];
  const events = [...feed.matches].sort((a, b) =>
    (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""),
  );
  for (const m of events) {
    const event = matchEventLines(m, feed.origin, feed.now);
    if (event) lines.push(...event);
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** "metropolitan-strikers" for a download file name. */
export function calendarFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 60);
  return `${slug || "fixtures"}.ics`;
}
