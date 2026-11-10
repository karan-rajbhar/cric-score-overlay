import "server-only";
import { after } from "next/server";
import { adminDataSource } from "~/lib/admin-data-source";
import type { DataSource } from "~/lib/firebase/datasource";
import { followKey, followerIds } from "~/lib/follows/store";
import {
  PUSH_SUBSCRIPTIONS,
  subscriptionsOfUsers,
  type PushSubscriptionDoc,
} from "./subscriptions";
import {
  sendWebPush,
  vapidKeysFromEnv,
  type SendResult,
  type VapidKeys,
} from "./web-push";

/**
 * Push notifications to the followers of a match, its teams and its
 * tournament, on structural changes only: the match starting, an innings
 * break, the result (or abandonment). Never per delivery.
 *
 * Cost per event (push configured): 1 read of the match, 1 read + 1 write
 * of `push_log/{matchId}` (so an undo and redo does not notify twice), one
 * `array-contains` query per followed key (3 or 4; reads = followers, at
 * least 1 each), 1 query per 30 followers for their devices (reads =
 * devices, at least 1), and a delete per expired device. With push off, or
 * for any other change, nothing at all.
 */

export const PUSH_LOG = "push_log";
const CONCURRENCY = 10;
/** Seconds a push service keeps an undelivered message. */
const TTL_SECONDS = 6 * 60 * 60;

export type MatchEvent = "started" | "innings_break" | "result" | "abandoned";

/**
 * The scoring reply fields this needs (ScoringState). The reply describes
 * the match's current innings, which after an innings break is the next
 * one (the engine opens it in the same commit), so its totals are never
 * the ended innings': those come from the match's `innings_summary`.
 */
export interface EventState {
  match_completed?: boolean | null;
  /** The current innings is closed and no other was opened. */
  innings_completed?: boolean | null;
  /** A delivery ended the innings: `current_innings` is the next one. */
  innings_break?: boolean | null;
  current_innings?: number | null;
  result_description?: string | null;
}

/** The structural event a scoring reply reports, if any. */
export function matchEventOf(
  state: EventState | null | undefined,
): MatchEvent | null {
  if (!state) return null;
  if (state.match_completed) return "result";
  if (state.innings_completed || state.innings_break) return "innings_break";
  return null;
}

/**
 * The event of a reply to "End innings". That reply carries no flag of its
 * own (only a delivery's has `innings_break`) and describes the innings
 * the engine opened next, so unless the match is over it is the break.
 */
export function inningsEndEventOf(
  state: EventState | null | undefined,
): MatchEvent | null {
  if (!state) return null;
  return matchEventOf(state) ?? "innings_break";
}

interface SummaryEntry {
  team_id?: string | null;
  innings_number?: number | null;
  total_runs?: number | null;
  total_wickets?: number | null;
  total_balls?: number | null;
  is_completed?: boolean | null;
  target_runs?: number | null;
}

export interface MatchDoc {
  id: string;
  title?: string | null;
  team1_id?: string | null;
  team2_id?: string | null;
  tournament_id?: string | null;
  team1_snapshot?: { name?: string | null } | null;
  team2_snapshot?: { name?: string | null } | null;
  toss_winner_team_id?: string | null;
  toss_decision?: string | null;
  result_description?: string | null;
  balls_per_over?: number | null;
  innings_summary?: SummaryEntry[] | null;
}

export interface MatchMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
  /** Sent once per match: "started", "innings_break:1", "result". */
  key: string;
}

function oversText(balls: number, perOver: number): string {
  const whole = Math.floor(balls / perOver);
  const rest = balls % perOver;
  const overs = rest ? `${whole}.${rest}` : String(whole);
  return `${overs} ${overs === "1" ? "over" : "overs"}`;
}

type Base = Pick<MatchMessage, "title" | "url" | "tag">;

function sideName(match: MatchDoc, side: 1 | 2): string {
  const snapshot = side === 1 ? match.team1_snapshot : match.team2_snapshot;
  return snapshot?.name ?? `Team ${side}`;
}

/** The name of team `id` in this match, and its opponent's. */
function sidesOf(
  match: MatchDoc,
  id: string | null | undefined,
): { name: string | null; other: string | null } {
  if (id && id === match.team1_id) {
    return { name: sideName(match, 1), other: sideName(match, 2) };
  }
  if (id && id === match.team2_id) {
    return { name: sideName(match, 2), other: sideName(match, 1) };
  }
  return { name: null, other: null };
}

function startedMessage(match: MatchDoc, base: Base): MatchMessage {
  const toss = sidesOf(match, match.toss_winner_team_id).name;
  const decision = match.toss_decision === "bowl" ? "bowl" : "bat";
  return {
    ...base,
    key: "started",
    body: toss
      ? `Match started. ${toss} won the toss and chose to ${decision}.`
      : "Match started.",
  };
}

/**
 * The number of the innings that ended. A reply is about the innings the
 * engine opened next, so the one before it ended; only a reply flagged
 * `innings_completed` is about the ended innings itself. Without a reply:
 * the latest completed innings of the summary.
 */
function endedInningsNumber(
  summary: SummaryEntry[],
  state?: EventState | null,
): number {
  const current = state?.current_innings ?? 0;
  if (current > 0 && state?.innings_completed) return current;
  if (current > 1) return current - 1;
  const completed = summary.filter((e) => e.is_completed);
  return Math.max(0, ...completed.map((e) => e.innings_number ?? 0));
}

function inningsBreakMessage(
  match: MatchDoc,
  base: Base,
  state?: EventState | null,
): MatchMessage {
  const summary = match.innings_summary ?? [];
  const number = endedInningsNumber(summary, state);
  const key = `innings_break:${number}`;
  const entry = summary.find((e) => e.innings_number === number);
  if (!entry) return { ...base, key, body: "Innings break." };
  const runs = entry.total_runs ?? 0;
  const perOver =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const overs = oversText(entry.total_balls ?? 0, perOver);
  const score = `${runs}/${entry.total_wickets ?? 0} (${overs})`;
  const { name, other } = sidesOf(match, entry.team_id);
  // The next innings' own target; a first innings always sets one.
  const next = summary.find((e) => e.innings_number === number + 1);
  const target = next?.target_runs ?? (number === 1 ? runs + 1 : null);
  const chase =
    target != null && other ? ` ${other} need ${target} to win.` : "";
  return {
    ...base,
    key,
    body: `Innings break. ${name ? `${name} ${score}` : score}.${chase}`,
  };
}

export function matchMessage(
  match: MatchDoc,
  event: MatchEvent,
  state?: EventState | null,
): MatchMessage {
  const base: Base = {
    title: `${sideName(match, 1)} vs ${sideName(match, 2)}`,
    url: `/matches/${match.id}`,
    tag: `match-${match.id}`,
  };
  switch (event) {
    case "started":
      return startedMessage(match, base);
    case "innings_break":
      return inningsBreakMessage(match, base, state);
    case "abandoned":
      return { ...base, key: "abandoned", body: "Match abandoned." };
    case "result":
      return {
        ...base,
        key: "result",
        body:
          state?.result_description ??
          match.result_description ??
          "Match finished.",
      };
  }
}

/** "m" plus the match id without dashes: <= 32 URL-safe characters. */
function topicOf(matchId: string): string {
  return `m${matchId.replace(/[^A-Za-z0-9_-]/g, "")}`.slice(0, 32);
}

export interface NotifyDeps {
  keys: VapidKeys;
  state?: EventState | null;
  send?: typeof sendWebPush;
  now?: Date;
}

export interface NotifyResult {
  sent: number;
  removed: number;
  skipped?: "no_match" | "already_sent" | "no_followers";
}

async function inBatches<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

export async function notifyMatchEvent(
  ds: DataSource,
  matchId: string,
  event: MatchEvent,
  deps: NotifyDeps,
): Promise<NotifyResult> {
  const match = (await ds.getById("matches", matchId)) as MatchDoc | null;
  if (!match) return { sent: 0, removed: 0, skipped: "no_match" };
  const message = matchMessage(match, event, deps.state);

  const log = (await ds.getById(PUSH_LOG, matchId)) as {
    sent?: string[];
  } | null;
  const sent = Array.isArray(log?.sent) ? log.sent : [];
  if (sent.includes(message.key)) {
    return { sent: 0, removed: 0, skipped: "already_sent" };
  }
  const now = (deps.now ?? new Date()).toISOString();
  if (log) {
    await ds.update(PUSH_LOG, matchId, {
      sent: [...sent, message.key].slice(-20),
      updated_at: now,
    });
  } else {
    await ds.insert(PUSH_LOG, [
      { id: matchId, sent: [message.key], updated_at: now },
    ]);
  }

  const keys = [
    followKey("match", matchId),
    ...(match.team1_id ? [followKey("team", match.team1_id)] : []),
    ...(match.team2_id ? [followKey("team", match.team2_id)] : []),
    ...(match.tournament_id
      ? [followKey("tournament", match.tournament_id)]
      : []),
  ];
  const users = await followerIds(ds, keys);
  if (users.length === 0) return { sent: 0, removed: 0, skipped: "no_followers" };
  const devices = await subscriptionsOfUsers(ds, users);

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url,
    tag: message.tag,
  });
  const send = deps.send ?? sendWebPush;
  const results = await inBatches(
    devices,
    CONCURRENCY,
    async (d: PushSubscriptionDoc): Promise<SendResult | null> => {
      try {
        return await send(d, payload, deps.keys, {
          ttl: TTL_SECONDS,
          topic: topicOf(matchId),
          urgency: "normal",
        });
      } catch (err) {
        console.error("push send failed:", err);
        return null;
      }
    },
  );
  let delivered = 0;
  let removed = 0;
  for (let i = 0; i < devices.length; i += 1) {
    const r = results[i];
    if (r?.gone) {
      await ds.delete(PUSH_SUBSCRIPTIONS, devices[i]!.id);
      removed += 1;
    } else if (r && r.status >= 200 && r.status < 300) {
      delivered += 1;
    }
  }
  return { sent: delivered, removed };
}

/**
 * Notifies followers after the response is sent (`after`), so scoring is
 * never slowed by it. A no-op, with no reads, when push is not configured
 * (no VAPID keys) or `event` is null (an ordinary delivery).
 */
export function notifyFollowersAfter(
  matchId: string,
  event: MatchEvent | null,
  state?: EventState | null,
): void {
  if (!event) return;
  const keys = vapidKeysFromEnv();
  if (!keys) return;
  const run = async () => {
    try {
      await notifyMatchEvent(adminDataSource(), matchId, event, { keys, state });
    } catch (err) {
      console.error("notifyMatchEvent failed:", err);
    }
  };
  try {
    after(run);
  } catch {
    // Outside a request (scripts): run now, unawaited.
    void run();
  }
}
