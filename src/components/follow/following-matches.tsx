"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getFollowingFeed } from "~/app/follows/actions";
import { cardSurface } from "~/components/ds/card";
import { SectionHeader } from "~/components/ds/list";
import { MatchCard } from "~/components/matches/match-card";
import { useAuth } from "~/lib/auth";
import {
  isFollowedMatch,
  MAX_UPCOMING,
  type FollowingFeed,
} from "~/lib/follows/following-feed";
import {
  followingFeedQueryKey,
  followsQueryKey,
} from "~/lib/follows/use-follows";
import { useMatchesQuery } from "~/lib/hooks/useMatchQueries";
import type { Match } from "~/lib/match-types";

/**
 * The dashboard's "Following": live and upcoming matches of the teams,
 * players, matches and tournaments the user follows. Live ones come from
 * the dashboard's own live list (same query, no extra request); upcoming
 * ones from getFollowingFeed. Cards follow live_state like every list.
 */
export function FollowingMatches() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: live } = useMatchesQuery({ status: "live" });
  const { data: feed } = useQuery<FollowingFeed | null>({
    queryKey: followingFeedQueryKey(user?.id),
    queryFn: async () => {
      const res = await getFollowingFeed();
      if (res.error) throw new Error(res.error);
      // The follow buttons share what the user follows (no second read).
      if (res.data) {
        queryClient.setQueryData(followsQueryKey(user?.id), res.data.targets);
      }
      return res.data;
    },
    enabled: Boolean(user?.id),
    staleTime: 60 * 1000,
  });

  if (!user || !feed) return null;

  const liveFollowed = (live ?? []).filter((m) => isFollowedMatch(m, feed));
  const liveIds = new Set(liveFollowed.map((m) => m.id));
  const matches = [
    ...liveFollowed,
    ...(feed.upcoming as unknown as Match[]).filter((m) => !liveIds.has(m.id)),
  ].slice(0, MAX_UPCOMING);

  return (
    <section aria-labelledby="following-title" className="space-y-4">
      <SectionHeader
        title={<span id="following-title">Following</span>}
        description={
          matches.length > 0
            ? "Live and upcoming matches of what you follow"
            : undefined
        }
      />
      {matches.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              contextQuery="from=dashboard"
              canScore={false}
            />
          ))}
        </div>
      ) : (
        <p className={`${cardSurface} p-4 text-sm text-muted-foreground`}>
          {feed.targets.length > 0
            ? "Nothing live or coming up for what you follow."
            : "Follow a team, player or tournament from its page to see its matches here."}
        </p>
      )}
    </section>
  );
}
