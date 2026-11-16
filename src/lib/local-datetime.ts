/**
 * Values for `<input type="datetime-local">` / `type="date"`, which work in
 * the device's local time while the app stores ISO timestamps (UTC).
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-20T15:30" in local time, or "" for a missing / bad value. */
export function toLocalDateTimeInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2026-10-20" for today in local time. */
export function todayLocalDateInput(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * An ISO timestamp for a local date ("2026-10-20") at a local time
 * ("10:00"), or null when either is missing or invalid.
 */
export function localDateTimeToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "Sunday" for a date field's value ("2026-11-22"); "" when it is not a date. */
export function weekdayOf(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { weekday: "long" });
}
