/**
 * Stream channels: one fixed overlay link per club ground or camera
 * position (`/overlay/channel/{id}`), so OBS keeps one browser source and
 * producers switch the match it shows.
 *
 * `stream_channels/{id}`: `{ club_id | owner_id, name, match_id }`. Club
 * admins create, rename and delete their club's channels; a user without a
 * club keeps personal ones (`owner_id`). A producer of a match (admin or
 * streamer, `canProduceOverlay`) puts it on air on their personal channels
 * and on the channels of its club (or its tournament's club); club admins
 * on any of their club's channels.
 *
 * The overlay listens to the channel doc: 1 read on load, 1 per switch.
 */

import type { DataSource } from "~/lib/firebase/datasource";
import { newId } from "~/lib/firebase/query-builder";
import {
  canProduceOverlay,
  isClubAdmin,
} from "~/lib/firebase/rpc/auth-helpers";
import type {
  MatchesRow,
  StreamChannelsRow,
  TournamentsRow,
} from "~/lib/firebase/types";
import type { StreamChannel } from "./channel-link";

export { channelPath, type StreamChannel } from "./channel-link";

export const STREAM_CHANNELS = "stream_channels";
export const MAX_CHANNEL_NAME = 60;
/** Channels per club, or per user for personal ones. */
export const MAX_CHANNELS = 20;

/** A refusal or bad input, with a message to show as is. */
export class ChannelError extends Error {}

function toChannel(row: StreamChannelsRow): StreamChannel {
  return {
    id: row.id,
    name: row.name,
    club_id: row.club_id ?? null,
    owner_id: row.owner_id ?? null,
    match_id: row.match_id ?? null,
  };
}

function byName(a: StreamChannel, b: StreamChannel): number {
  return a.name.localeCompare(b.name);
}

export function cleanChannelName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!name) throw new ChannelError("Give the channel a name");
  if (name.length > MAX_CHANNEL_NAME) {
    throw new ChannelError(
      `Keep the name under ${MAX_CHANNEL_NAME} characters`,
    );
  }
  return name;
}

async function channelOf(
  ds: DataSource,
  channelId: string,
): Promise<StreamChannelsRow> {
  const row = (await ds.getById(
    STREAM_CHANNELS,
    channelId,
  )) as unknown as StreamChannelsRow | null;
  if (!row) throw new ChannelError("Channel not found");
  return row;
}

/** Club admins for a club's channel; the owner for a personal one. */
export async function canManageChannel(
  ds: DataSource,
  channel: Pick<StreamChannelsRow, "club_id" | "owner_id">,
  userId: string,
): Promise<boolean> {
  if (channel.club_id) return isClubAdmin(ds, channel.club_id, userId);
  return Boolean(channel.owner_id) && channel.owner_id === userId;
}

/** The clubs a match belongs to: its own and its tournament's. */
async function clubsOfMatch(
  ds: DataSource,
  match: Pick<MatchesRow, "club_id" | "tournament_id">,
): Promise<string[]> {
  const clubs = new Set<string>();
  if (match.club_id) clubs.add(match.club_id);
  if (match.tournament_id) {
    const t = (await ds.getById(
      "tournaments",
      match.tournament_id,
    )) as unknown as TournamentsRow | null;
    if (t?.club_id) clubs.add(t.club_id);
  }
  return [...clubs];
}

async function queryChannels(
  ds: DataSource,
  field: "club_id" | "owner_id",
  value: string,
): Promise<StreamChannel[]> {
  const rows = (await ds.query(STREAM_CHANNELS, [
    { field, op: "==", value },
  ])) as unknown as StreamChannelsRow[];
  return rows.map(toChannel).sort(byName);
}

export function listClubChannels(
  ds: DataSource,
  clubId: string,
): Promise<StreamChannel[]> {
  return queryChannels(ds, "club_id", clubId);
}

export function listPersonalChannels(
  ds: DataSource,
  userId: string,
): Promise<StreamChannel[]> {
  return queryChannels(ds, "owner_id", userId);
}

/** A club channel (club admins) or, without `clubId`, a personal one. */
export async function createChannel(
  ds: DataSource,
  userId: string,
  input: { clubId?: string | null; name: unknown },
): Promise<StreamChannel> {
  const name = cleanChannelName(input.name);
  const clubId = input.clubId || null;
  if (clubId && !(await isClubAdmin(ds, clubId, userId))) {
    throw new ChannelError("Only club admins can add the club's channels");
  }
  const existing = clubId
    ? await listClubChannels(ds, clubId)
    : await listPersonalChannels(ds, userId);
  if (existing.length >= MAX_CHANNELS) {
    throw new ChannelError(`There can be up to ${MAX_CHANNELS} channels`);
  }
  const now = new Date().toISOString();
  const row: StreamChannelsRow = {
    id: newId(),
    club_id: clubId,
    owner_id: clubId ? null : userId,
    name,
    match_id: null,
    created_by: userId,
    created_at: now,
    updated_at: now,
  };
  await ds.insert(STREAM_CHANNELS, [{ ...row }]);
  return toChannel(row);
}

export async function renameChannel(
  ds: DataSource,
  userId: string,
  channelId: string,
  rawName: unknown,
): Promise<StreamChannel> {
  const name = cleanChannelName(rawName);
  const row = await channelOf(ds, channelId);
  if (!(await canManageChannel(ds, row, userId))) {
    throw new ChannelError("You cannot change this channel");
  }
  await ds.update(STREAM_CHANNELS, channelId, {
    name,
    updated_at: new Date().toISOString(),
  });
  return toChannel({ ...row, name });
}

/** Deleting a channel takes its overlay link off air for good. */
export async function deleteChannel(
  ds: DataSource,
  userId: string,
  channelId: string,
): Promise<void> {
  const row = await channelOf(ds, channelId);
  if (!(await canManageChannel(ds, row, userId))) {
    throw new ChannelError("You cannot delete this channel");
  }
  await ds.delete(STREAM_CHANNELS, channelId);
}

/**
 * Channels a producer of the match may put it on: those of the match's
 * clubs, then their personal ones. Empty for anyone who cannot produce it.
 */
export async function listChannelsForMatch(
  ds: DataSource,
  userId: string,
  matchId: string,
): Promise<StreamChannel[]> {
  const match = (await ds.getById(
    "matches",
    matchId,
  )) as unknown as MatchesRow | null;
  if (!match || !(await canProduceOverlay(ds, matchId, userId, match))) {
    return [];
  }
  const lists = await Promise.all([
    ...(await clubsOfMatch(ds, match)).map((c) => listClubChannels(ds, c)),
    listPersonalChannels(ds, userId),
  ]);
  return lists.flat();
}

/**
 * Puts `matchId` on air on the channel, or takes the channel off air
 * (`null`). Switching rewrites only the channel doc (1 write); the
 * overlay listening there swaps match without a reload.
 */
export async function setChannelMatch(
  ds: DataSource,
  userId: string,
  channelId: string,
  matchId: string | null,
): Promise<StreamChannel> {
  const row = await channelOf(ds, channelId);
  const manages = await canManageChannel(ds, row, userId);

  if (matchId) {
    const match = (await ds.getById(
      "matches",
      matchId,
    )) as unknown as MatchesRow | null;
    if (!match) throw new ChannelError("Match not found");
    if (!(await canProduceOverlay(ds, matchId, userId, match))) {
      throw new ChannelError("Only this match's scorers and streamers can");
    }
    const allowed =
      manages ||
      (row.club_id !== null &&
        (await clubsOfMatch(ds, match)).includes(row.club_id));
    if (!allowed) {
      throw new ChannelError("This channel belongs to another club");
    }
  } else if (
    !manages &&
    !(row.match_id && (await canProduceOverlay(ds, row.match_id, userId)))
  ) {
    throw new ChannelError("You cannot take this channel off air");
  }

  if ((row.match_id ?? null) !== matchId) {
    await ds.update(STREAM_CHANNELS, channelId, {
      match_id: matchId,
      updated_at: new Date().toISOString(),
    });
  }
  return toChannel({ ...row, match_id: matchId });
}
