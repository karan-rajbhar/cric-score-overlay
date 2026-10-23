"use server";

import { isClubAdmin } from "~/lib/firebase/rpc/auth-helpers";
import { createServerClient } from "~/lib/firebase/server";
import { serverDataSource } from "~/lib/firebase/server-ds";
import {
  ChannelError,
  createChannel,
  deleteChannel,
  listChannelsForMatch,
  listClubChannels,
  renameChannel,
  setChannelMatch,
} from "~/lib/overlay/channels";
import type { StreamChannel } from "~/lib/overlay/channel-link";

/**
 * Stream channel server actions (`~/lib/overlay/channels`): club admins
 * manage their club's channels, producers put a match on one.
 */

type Result<T> = { data: T; error: null } | { data: null; error: string };

async function run<T>(
  work: (userId: string) => Promise<T>,
): Promise<Result<T>> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { data: null, error: "You must be logged in" };
    return { data: await work(user.id), error: null };
  } catch (err) {
    if (err instanceof ChannelError) return { data: null, error: err.message };
    console.error("stream channel action failed:", err);
    return { data: null, error: "Something went wrong" };
  }
}

export async function getClubStreamChannels(
  clubId: string,
): Promise<Result<StreamChannel[]>> {
  return run(async (userId) => {
    const ds = serverDataSource();
    if (!(await isClubAdmin(ds, clubId, userId))) {
      throw new ChannelError("Only club admins can manage channels");
    }
    return listClubChannels(ds, clubId);
  });
}

/** A club channel, or a personal one when `clubId` is null. */
export async function createStreamChannel(
  clubId: string | null,
  name: string,
): Promise<Result<StreamChannel>> {
  return run((userId) =>
    createChannel(serverDataSource(), userId, { clubId, name }),
  );
}

export async function renameStreamChannel(
  channelId: string,
  name: string,
): Promise<Result<StreamChannel>> {
  return run((userId) =>
    renameChannel(serverDataSource(), userId, channelId, name),
  );
}

export async function deleteStreamChannel(
  channelId: string,
): Promise<Result<true>> {
  return run(async (userId) => {
    await deleteChannel(serverDataSource(), userId, channelId);
    return true as const;
  });
}

/** Channels the caller may put this match on (club ones, then personal). */
export async function getStreamChannelsForMatch(
  matchId: string,
): Promise<Result<StreamChannel[]>> {
  return run((userId) =>
    listChannelsForMatch(serverDataSource(), userId, matchId),
  );
}

/** Puts the match on air on the channel, or takes it off (`null`). */
export async function putMatchOnChannel(
  channelId: string,
  matchId: string | null,
): Promise<Result<StreamChannel>> {
  return run((userId) =>
    setChannelMatch(serverDataSource(), userId, channelId, matchId),
  );
}
