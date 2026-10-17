/**
 * Tournament / club leaderboards from the stored accumulators
 * (`leaderboards/{scope}_{id}`, one read) plus the innings still in play.
 *
 * The stored document counts completed innings (it follows
 * player_matches). Innings not yet completed (live matches) are folded in
 * from their innings documents, so the page shows the same figures as when
 * it read every scorecard row, at the cost of the live matches' innings.
 */

import {
  leaderboardFromPlayers,
  type LeaderboardData,
  type LeaderboardPlayer,
} from "~/lib/leaderboard";
import { playerDirectory } from "./directory";
import type { QueryBuilder } from "./query-builder";
import { playerMatchDocs } from "./scorecard";
import { applyPlayerMatch, emptyAcc, leaderboardId } from "./stats.mjs";
import type { InningsRow, MatchesRow, TableName } from "./types";

interface LeaderboardClient {
  from<T extends TableName>(table: T): QueryBuilder<T>;
}

/** The match fields this needs (match lists already select them). */
export type ScopeMatch = Pick<MatchesRow, "id"> &
  Partial<Pick<MatchesRow, "team1_id" | "team2_id">> & {
    innings?: { is_completed?: boolean | null }[] | null;
  };

export async function loadScopeLeaderboard(
  db: LeaderboardClient,
  scope: "tournament" | "club",
  scopeId: string,
  matches: readonly ScopeMatch[],
): Promise<LeaderboardData> {
  const open = matches.filter((m) =>
    (m.innings ?? []).some((i) => i.is_completed === false),
  );
  const [{ data: board }, { data: openInnings }] = await Promise.all([
    db
      .from("leaderboards")
      .select("players")
      .eq("id", leaderboardId(scope, scopeId))
      .maybeSingle(),
    open.length
      ? db
          .from("innings")
          .select("*")
          .in(
            "match_id",
            open.map((m) => m.id),
          )
      : Promise.resolve({ data: [] as InningsRow[] }),
  ]);

  const players = structuredClone(
    (board?.players ?? {}) as Record<string, LeaderboardPlayer>,
  );
  const added = new Set<string>();
  for (const match of open) {
    const innings = ((openInnings ?? []) as InningsRow[]).filter(
      (i) => i.match_id === match.id,
    );
    const counted = new Set(
      playerMatchDocs(match, innings, "").map((d) => d.user_id),
    );
    const inPlay = innings
      .filter((i) => !i.is_completed)
      .map((i) => ({ ...i, is_completed: true }));
    for (const doc of playerMatchDocs(match, inPlay, "")) {
      let p = players[doc.user_id];
      if (!p) {
        p = { ...emptyAcc(), name: null, avatar_url: null };
        players[doc.user_id] = p;
        added.add(doc.user_id);
      }
      applyPlayerMatch(p, doc, 1);
      // The match is already counted for players of its completed innings.
      if (counted.has(doc.user_id)) p.m -= 1;
    }
  }
  if (added.size) {
    const names = await playerDirectory(
      db,
      open.flatMap((m) => [m.team1_id, m.team2_id]),
      added,
    );
    for (const id of added) {
      const u = names.get(id);
      players[id]!.name = u?.full_name ?? null;
      players[id]!.avatar_url = u?.avatar_url ?? null;
    }
  }
  return leaderboardFromPlayers(players);
}
