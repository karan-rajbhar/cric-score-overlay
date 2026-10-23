"use server";

import { adminDataSource } from "~/lib/admin-data-source";
import { createServerClient } from "~/lib/firebase/server";
import { followingFeed, type FollowingFeed } from "~/lib/follows/following-feed";
import {
  FOLLOW_TABLE,
  FollowLimitError,
  followKey,
  isFollowId,
  isFollowKind,
  readFollows,
  setFollowTarget,
} from "~/lib/follows/store";

/**
 * Follows are written only here (Admin SDK); firestore.rules deny every
 * client read and write of `follows/*`.
 */

async function signedInUserId(): Promise<string | null> {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  return user?.id ?? null;
}

/** What the signed-in user follows ("team:<id>", ...): 1 read, none signed out. */
export async function getMyFollows(): Promise<{
  data: string[];
  error: string | null;
}> {
  try {
    const userId = await signedInUserId();
    if (!userId) return { data: [], error: null };
    return { data: await readFollows(adminDataSource(), userId), error: null };
  } catch (err) {
    console.error("getMyFollows failed:", err);
    return { data: [], error: "Could not load what you follow" };
  }
}

/**
 * Follow or unfollow a team, player, match or tournament. Following checks
 * that it exists (1 read); either way 1 read + 1 write of the follows doc.
 */
export async function setFollow(
  kind: string,
  id: string,
  follow: boolean,
): Promise<{ data: string[] | null; error: string | null }> {
  if (!isFollowKind(kind) || !isFollowId(id) || typeof follow !== "boolean") {
    return { data: null, error: "Invalid request" };
  }
  try {
    const userId = await signedInUserId();
    if (!userId) return { data: null, error: "Sign in to follow" };
    const ds = adminDataSource();
    if (follow && !(await ds.getById(FOLLOW_TABLE[kind], id))) {
      return { data: null, error: "Not found" };
    }
    const targets = await setFollowTarget(
      ds,
      userId,
      followKey(kind, id),
      follow,
    );
    return { data: targets, error: null };
  } catch (err) {
    if (err instanceof FollowLimitError) {
      return { data: null, error: err.message };
    }
    console.error("setFollow failed:", err);
    return { data: null, error: "Could not update what you follow" };
  }
}

/**
 * The dashboard's "Following" list: what the user follows and the upcoming
 * fixtures for it (live matches come from the dashboard's live list).
 */
export async function getFollowingFeed(): Promise<{
  data: FollowingFeed | null;
  error: string | null;
}> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { data: null, error: null };
    const targets = await readFollows(adminDataSource(), user.id);
    if (targets.length === 0) {
      return {
        data: { targets, matchIds: [], teamIds: [], tournamentIds: [], upcoming: [] },
        error: null,
      };
    }
    return { data: await followingFeed(db, targets, new Date()), error: null };
  } catch (err) {
    console.error("getFollowingFeed failed:", err);
    return { data: null, error: "Could not load the matches you follow" };
  }
}
