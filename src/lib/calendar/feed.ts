/**
 * A calendar feed's body, kept for FEED_TTL_SECONDS per server instance so
 * calendar apps polling a popular feed do not multiply Firestore reads
 * (the CDN caches it as long, see the route's Cache-Control).
 */

import type { ServerClient } from "~/lib/firebase/server-client";
import { buildCalendar } from "./ics";
import { loadCalendarFixtures, type CalendarScope } from "./fixtures";

export const FEED_TTL_SECONDS = 15 * 60;
const MAX_CACHED = 300;

export interface Feed {
  body: string;
  name: string;
}

const cache = new Map<string, Feed & { expires: number }>();

/** For tests: forget cached feeds. */
export function clearFeedCache(): void {
  cache.clear();
}

/**
 * The feed, from this instance's cache when fresh. Null when the team /
 * tournament / club does not exist. A failed read serves the last body
 * (calendar apps drop every event when a refresh fails).
 */
export async function calendarFeed(
  db: Pick<ServerClient, "from">,
  scope: CalendarScope,
  id: string,
  origin: string,
  now: Date,
): Promise<Feed | null> {
  const key = `${origin}|${scope}|${id}`;
  const hit = cache.get(key);
  if (hit && hit.expires > now.getTime()) return hit;
  try {
    const fixtures = await loadCalendarFixtures(db, scope, id, now);
    if (!fixtures) return null;
    const feed: Feed = {
      name: fixtures.name,
      body: buildCalendar({ ...fixtures, origin, now }),
    };
    cache.delete(key);
    if (cache.size >= MAX_CACHED) {
      // Oldest first (insertion order).
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { ...feed, expires: now.getTime() + FEED_TTL_SECONDS * 1000 });
    return feed;
  } catch (err) {
    if (hit) return hit;
    throw err;
  }
}
