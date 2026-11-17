"use client";

import { useSyncExternalStore } from "react";
import {
  SERVER_TIME_ZONE,
  cardDate,
  fullDateTime,
  longDate,
  shortDate,
  timeOfDay,
} from "~/lib/dates";

const noSubscription = () => () => {};

/**
 * The time zone to format a time in: the viewer's own (undefined: the
 * browser's) once the page is in the browser. The server cannot know it, so
 * while it renders, and while the browser hydrates that HTML, both use
 * `SERVER_TIME_ZONE`; React then renders again in the viewer's zone. So a
 * server-rendered page never shows the server's UTC, and hydration never
 * meets text that differs.
 */
export function useDisplayTimeZone(): string | undefined {
  return useSyncExternalStore(
    noSubscription,
    () => undefined,
    () => SERVER_TIME_ZONE,
  );
}

type DateValue = string | number | null | undefined;

const FORMATS = {
  /** "19:30" */
  time: (v: DateValue, zone?: string) => timeOfDay(v, zone),
  /** "20 Jul 2024" */
  short: (v: DateValue, zone?: string) => shortDate(v, zone),
  /** "Sat 25 Oct" */
  card: (v: DateValue, zone?: string) => cardDate(v, undefined, zone),
  /** "Saturday 10 August" */
  long: (v: DateValue, zone?: string) => longDate(v, undefined, zone),
  /** "Saturday 10 August 2024, 19:30" */
  full: (v: DateValue, zone?: string) => fullDateTime(v, zone),
  /** "20 Jul 2024, 19:30" */
  shortTime: (v: DateValue, zone?: string) =>
    [shortDate(v, zone), timeOfDay(v, zone)].filter(Boolean).join(", "),
  /** "Sat 25 Oct, 19:30" */
  cardTime: (v: DateValue, zone?: string) =>
    [cardDate(v, undefined, zone), timeOfDay(v, zone)]
      .filter(Boolean)
      .join(", "),
} as const;

export type LocalDateFormat = keyof typeof FORMATS;

/**
 * A date or time in the viewer's time zone, for pages the server renders
 * (see `useDisplayTimeZone`). Client components that need the text itself
 * (an aria-label) call the hook and pass its zone to `~/lib/dates`.
 */
export function LocalDate({
  value,
  format,
  className,
}: {
  value: DateValue;
  format: LocalDateFormat;
  className?: string;
}) {
  const zone = useDisplayTimeZone();
  const text = FORMATS[format](value, zone);
  if (!text) return null;
  return (
    <time
      dateTime={typeof value === "string" ? value : undefined}
      className={className}
    >
      {text}
    </time>
  );
}
