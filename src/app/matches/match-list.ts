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

/** Latest first, at most `limit` (50) matches; throws on a query error. */
export async function fetchMatchList(
  db: MatchListClient,
  filters?: MatchListFilters,
) {
  let query = db
    .from("matches")
    .select(
      `
        *,
        innings(id, team_id, innings_number, total_runs, total_wickets, total_overs, is_completed)
      `,
    )
    .order("scheduled_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.clubId) query = query.eq("club_id", filters.clubId);
  query = query.limit(filters?.limit ?? 50);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  // Team names / logos come from the match's snapshot (no team reads).
  return attachMatchTeams(db, data ?? []);
}
