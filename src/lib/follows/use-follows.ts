"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getMyFollows, setFollow } from "~/app/follows/actions";
import { useAuth } from "~/lib/auth";
import { followKey, type FollowKind } from "./store";

export const followsQueryKey = (userId: string | null | undefined) =>
  ["follows", userId ?? "anon"] as const;

/** Query key of the dashboard's "Following" list (a "matches" list). */
export const followingFeedQueryKey = (userId: string | null | undefined) =>
  ["matches", "following", userId ?? "anon"] as const;

/** What the signed-in user follows: 1 read per session (5 minute cache). */
export function useMyFollows() {
  const { user } = useAuth();
  return useQuery<string[]>({
    queryKey: followsQueryKey(user?.id),
    queryFn: async () => {
      const res = await getMyFollows();
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
  });
}

/** Follow state of one team, player, match or tournament, and a toggle. */
export function useFollow(kind: FollowKind, id: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: targets, isLoading } = useMyFollows();
  const [pending, setPending] = useState(false);
  const following = (targets ?? []).includes(followKey(kind, id));

  const toggle = useCallback(async (): Promise<{
    following: boolean;
    error: string | null;
  }> => {
    setPending(true);
    try {
      const res = await setFollow(kind, id, !following);
      if (res.error || !res.data) {
        return { following, error: res.error ?? "Could not update" };
      }
      queryClient.setQueryData(followsQueryKey(user?.id), res.data);
      void queryClient.invalidateQueries({
        queryKey: followingFeedQueryKey(user?.id),
      });
      return { following: !following, error: null };
    } finally {
      setPending(false);
    }
  }, [kind, id, following, queryClient, user?.id]);

  return {
    signedIn: Boolean(user),
    loading: Boolean(user) && isLoading,
    following,
    pending,
    toggle,
  };
}
