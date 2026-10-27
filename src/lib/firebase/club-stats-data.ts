import "server-only";
import { cache } from "react";
import { clubStatsRows, type ClubStatsRow } from "~/lib/club-stats-export";
import type { LeaderboardData } from "~/lib/leaderboard";
import { createServerClient } from "~/lib/firebase/server";
import { loadScopeLeaderboard, type ScopeMatch } from "./leaderboards";

export interface ClubStatsExport {
  club: { id: string; name: string; short_name: string | null };
  /** The club leaderboard the tabs and the combined rows come from. */
  data: LeaderboardData;
  rows: ClubStatsRow[];
  /** Matches that count towards the figures. */
  matches: number;
}

/**
 * The club's statistics for the downloads: the stored club leaderboard (8
 * shard reads) plus innings still in play, ranked by points. Null when
 * the club does not exist or is private to a viewer who is not a member
 * (the club page's own rule). Read once per request.
 */
export const loadClubStatsExport = cache(
  async (id: string): Promise<ClubStatsExport | null> => {
    const db = await createServerClient();
    const { data: club } = await db
      .from("clubs")
      .select("id, name, short_name, owner_id, is_public")
      .eq("id", id)
      .maybeSingle();
    if (!club) return null;

    if (club.is_public === false) {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) return null;
      if (user.id !== club.owner_id) {
        const { data: membership } = await db
          .from("club_memberships")
          .select("id")
          .eq("club_id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!membership) return null;
      }
    }

    const { data: matchRows } = await db
      .from("matches")
      .select("id, status")
      .eq("club_id", id);
    const live = (matchRows ?? []).filter((m) => m.status === "live");
    const liveMatches =
      live.length > 0
        ? (((
            await db
              .from("matches")
              .select("id, team1_id, team2_id, club_side, innings(*)")
              .in(
                "id",
                live.map((m) => m.id),
              )
          ).data ?? []) as unknown as ScopeMatch[])
        : [];
    const data = await loadScopeLeaderboard(db, "club", id, liveMatches);
    return {
      club: {
        id: club.id,
        name: club.name,
        short_name: club.short_name ?? null,
      },
      data,
      rows: clubStatsRows(data),
      matches: (matchRows ?? []).length,
    };
  },
);
