/**
 * The match lists (home, /matches, dashboard): shared by the `getMatches`
 * server action and the browser hook `useMatchesQuery`, which runs it on
 * the browser's Firestore client (matches are publicly readable), so a list
 * costs the same reads and no server request.
 */

import type { QueryBuilder } from "~/lib/firebase/query-builder";
import { attachMatchTeams } from "~/lib/firebase/team-snapshot";
import type { SourceName } from "~/lib/firebase/types";

export interface MatchListFilters {
  status?: string;
  clubId?: string;
  limit?: number;
}

interface MatchListClient {
  from<T extends SourceName>(table: T): QueryBuilder<T>;
}

const COLUMNS = `
  *,
  innings(id, team_id, innings_number, total_runs, total_wickets, total_overs, is_completed)
`;

/** A fixture stays listed this long after its start time (if not started). */
const UPCOMING_GRACE_MS = 3 * 60 * 60 * 1000;
/** Of "all": the share of the limit given to the next fixtures. */
const ALL_UPCOMING_SHARE = 0.4;
const FINISHED = ["completed", "abandoned", "cancelled"];

/**
 * One list query (indexed: `status` and `scheduled_at`, with `club_id`).
 * Fixtures soonest first, from a little before `now`, so one that never
 * started does not lead the list for good; anything else latest first.
 */
function listQuery(
  db: MatchListClient,
  status: string | readonly string[],
  clubId: string | undefined,
  limit: number,
  now: Date,
) {
  let query = db.from("matches").select(COLUMNS);
  if (clubId) query = query.eq("club_id", clubId);
  if (status === "scheduled") {
    const since = new Date(now.getTime() - UPCOMING_GRACE_MS).toISOString();
    query = query
      .eq("status", "scheduled")
      .gte("scheduled_at", since)
      .order("scheduled_at", { ascending: true });
  } else {
    query =
      typeof status === "string"
        ? query.eq("status", status)
        : query.in("status", [...status]);
    query = query.order("scheduled_at", { ascending: false });
  }
  return query.limit(limit);
}

/**
 * At most `limit` (50) matches of `status`; throws on a query error. With
 * no status ("all"): every live match (up to `limit`), the next fixtures
 * and the latest results, so neither crowds the others out.
 */
export async function fetchMatchList(
  db: MatchListClient,
  filters?: MatchListFilters,
  now = new Date(),
) {
  const limit = filters?.limit ?? 50;
  const clubId = filters?.clubId;
  const upcoming = Math.round(limit * ALL_UPCOMING_SHARE);
  const queries = filters?.status
    ? [listQuery(db, filters.status, clubId, limit, now)]
    : [
        listQuery(db, "live", clubId, limit, now),
        listQuery(db, "scheduled", clubId, upcoming, now),
        listQuery(db, FINISHED, clubId, limit - upcoming, now),
      ];
  const results = await Promise.all(queries);
  const rows = results.flatMap(({ data, error }) => {
    if (error) throw new Error(error.message);
    return data ?? [];
  });
  // Team names / logos come from the match's snapshot (no team reads).
  return attachMatchTeams(db, rows);
}
