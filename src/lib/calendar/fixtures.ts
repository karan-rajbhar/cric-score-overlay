/**
 * The matches a calendar feed lists: a team's, a tournament's or a club's,
 * from 30 days back onwards (recent results stay visible, older ones drop
 * off). Each query is indexed (`<field> ==`, `scheduled_at >=`, ordered by
 * `scheduled_at`, limited: past the limit the furthest fixtures drop off),
 * see firestore.indexes.json.
 *
 * Reads: 1 (the team / tournament / club) + the matches returned (at most
 * MAX_MATCHES per query; a team runs one query per side).
 */

import type { ServerClient } from "~/lib/firebase/server-client";
import type { CalendarMatch } from "./ics";

export const CALENDAR_SCOPES = ["team", "tournament", "club"] as const;
export type CalendarScope = (typeof CALENDAR_SCOPES)[number];

export const LOOKBACK_DAYS = 30;
export const MAX_MATCHES = 150;

const COLUMNS = `
  id, title, status, match_format, overs_per_innings, venue, scheduled_at,
  actual_start_time, actual_end_time, result_description, updated_at,
  team1_snapshot, team2_snapshot
`;

const SCOPE_TABLE = {
  team: "teams",
  tournament: "tournaments",
  club: "clubs",
} as const;

/** Match fields that tie a match to each scope (a team has two). */
const SCOPE_FIELDS: Record<CalendarScope, readonly string[]> = {
  team: ["team1_id", "team2_id"],
  tournament: ["tournament_id"],
  club: ["club_id"],
};

export function isCalendarScope(value: string): value is CalendarScope {
  return (CALENDAR_SCOPES as readonly string[]).includes(value);
}

export interface CalendarFixtures {
  name: string;
  matches: CalendarMatch[];
}

/** Null when the team / tournament / club does not exist. */
export async function loadCalendarFixtures(
  db: Pick<ServerClient, "from">,
  scope: CalendarScope,
  id: string,
  now: Date,
): Promise<CalendarFixtures | null> {
  const since = new Date(
    now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const [owner, ...sides] = await Promise.all([
    db.from(SCOPE_TABLE[scope]).select("id, name").eq("id", id).maybeSingle(),
    ...SCOPE_FIELDS[scope].map((field) =>
      db
        .from("matches")
        .select(COLUMNS)
        .eq(field, id)
        .gte("scheduled_at", since)
        .order("scheduled_at", { ascending: true })
        .limit(MAX_MATCHES),
    ),
  ]);
  const row = owner.data as { name?: string | null } | null;
  if (owner.error || !row) return null;
  const byId = new Map<string, CalendarMatch>();
  for (const side of sides) {
    if (side.error) throw new Error(side.error.message);
    for (const m of (side.data ?? []) as unknown as CalendarMatch[]) {
      byId.set(m.id, m);
    }
  }
  return { name: row.name?.trim() || "CricScore", matches: [...byId.values()] };
}
