"use server";

import type { DataSource } from "~/lib/firebase/datasource";
import { canProduceOverlay } from "~/lib/firebase/permissions";
import { createServerClient } from "~/lib/firebase/server";
import { serverDataSource } from "~/lib/firebase/server-ds";
import {
  createRemoteToken,
  remoteTokenStatus,
  revokeRemoteTokens,
  type RemoteTokenStatus,
} from "~/lib/overlay/remote-token";

/**
 * Stream Deck / Companion token of a match, for its producers (admins and
 * streamers): status, (re)generate (the token is returned once), revoke.
 */

type Result<T> = { data: T; error: null } | { data: null; error: string };

type Producer =
  | { ds: DataSource; userId: string; error?: undefined }
  | { error: string };

async function producer(matchId: string): Promise<Producer> {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "You must be logged in" };
  const ds = serverDataSource();
  if (!(await canProduceOverlay(ds, matchId, user.id))) {
    return { error: "Only this match's scorers and streamers can do that" };
  }
  return { ds, userId: user.id };
}

export async function getRemoteTokenStatus(
  matchId: string,
): Promise<Result<RemoteTokenStatus>> {
  const auth = await producer(matchId);
  if (auth.error !== undefined) return { data: null, error: auth.error };
  return { data: await remoteTokenStatus(auth.ds, matchId), error: null };
}

/** New token (revoking the previous one). Shown once: it is not stored. */
export async function generateRemoteToken(
  matchId: string,
): Promise<Result<{ token: string }>> {
  const auth = await producer(matchId);
  if (auth.error !== undefined) return { data: null, error: auth.error };
  try {
    const token = await createRemoteToken(auth.ds, matchId, auth.userId);
    return { data: { token }, error: null };
  } catch (err) {
    console.error(
      "generateRemoteToken failed:",
      err instanceof Error ? err.message : err,
    );
    return { data: null, error: "Could not create the token" };
  }
}

export async function revokeRemoteToken(
  matchId: string,
): Promise<Result<{ revoked: number }>> {
  const auth = await producer(matchId);
  if (auth.error !== undefined) return { data: null, error: auth.error };
  return {
    data: { revoked: await revokeRemoteTokens(auth.ds, matchId) },
    error: null,
  };
}
