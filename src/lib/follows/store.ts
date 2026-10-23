/**
 * What a user follows: one server-only document per user,
 * `follows/{userId}` = { user_id, targets: ["team:<id>", "match:<id>", ...],
 * updated_at }, oldest first.
 *
 * - The follow buttons and the dashboard read it once (1 read) per user.
 * - Push notifications find the followers of a match, its teams and its
 *   tournament with an `array-contains` query each (see followerIds).
 * - Rules deny every client read and write (a user's follows are theirs
 *   alone); server actions read and write it with the Admin SDK.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { DataSource } from "~/lib/firebase/datasource";

export const FOLLOWS = "follows";

export const FOLLOW_KINDS = ["team", "player", "match", "tournament"] as const;
export type FollowKind = (typeof FOLLOW_KINDS)[number];

/** The collection that holds each kind of followed thing. */
export const FOLLOW_TABLE: Record<FollowKind, string> = {
  team: "teams",
  player: "users",
  match: "matches",
  tournament: "tournaments",
};

/** Upper bound on targets per user; old match follows make room first. */
export const MAX_FOLLOWS = 300;
/** Keys looked up per notification: a match, two teams, a tournament. */
const MAX_FANOUT_KEYS = 8;

const ID_RE = /^[\w-]{1,128}$/;

export interface FollowsDoc {
  id: string;
  user_id: string;
  targets: string[];
  updated_at: string;
}

export class FollowLimitError extends Error {
  constructor() {
    super(`You can follow up to ${MAX_FOLLOWS} teams, players and tournaments`);
    this.name = "FollowLimitError";
  }
}

export function isFollowKind(value: unknown): value is FollowKind {
  return (FOLLOW_KINDS as readonly unknown[]).includes(value);
}

export function isFollowId(value: unknown): value is string {
  return typeof value === "string" && ID_RE.test(value);
}

/** "team:<id>". */
export function followKey(kind: FollowKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseFollowKey(
  key: string,
): { kind: FollowKind; id: string } | null {
  const at = key.indexOf(":");
  const kind = key.slice(0, at);
  const id = key.slice(at + 1);
  return at > 0 && isFollowKind(kind) && isFollowId(id) ? { kind, id } : null;
}

/** The ids followed of one kind, oldest first. */
export function idsOfKind(targets: readonly string[], kind: FollowKind): string[] {
  const out: string[] = [];
  for (const key of targets) {
    const parsed = parseFollowKey(key);
    if (parsed?.kind === kind) out.push(parsed.id);
  }
  return out;
}

/**
 * The targets after following / unfollowing `key`. Following past
 * MAX_FOLLOWS drops the oldest match follows (matches end; teams do not),
 * and fails when there are none to drop.
 */
export function nextTargets(
  current: readonly string[],
  key: string,
  follow: boolean,
): string[] {
  const without = current.filter((k) => k !== key);
  if (!follow) return without;
  const next = [...without, key];
  while (next.length > MAX_FOLLOWS) {
    const oldestMatch = next.findIndex(
      (k, i) => i < next.length - 1 && k.startsWith("match:"),
    );
    if (oldestMatch < 0) throw new FollowLimitError();
    next.splice(oldestMatch, 1);
  }
  return next;
}

/** The user's targets (1 read; none stored: []). */
export async function readFollows(
  ds: DataSource,
  userId: string,
): Promise<string[]> {
  const doc = (await ds.getById(FOLLOWS, userId)) as FollowsDoc | null;
  return Array.isArray(doc?.targets) ? doc.targets.filter((k) => typeof k === "string") : [];
}

/** The Admin Firestore behind a data source, if any (else: tests). */
function firestoreOf(ds: DataSource): Firestore | null {
  let cur: unknown = ds;
  for (let depth = 0; cur && depth < 5; depth += 1) {
    const fs = (cur as { firestore?: Firestore }).firestore;
    if (fs) return fs;
    cur = (cur as { inner?: unknown }).inner;
  }
  return null;
}

/**
 * Follows or unfollows `key` for the user and returns the new targets
 * (1 read + 1 write, in a transaction so two taps cannot lose one).
 */
export async function setFollowTarget(
  ds: DataSource,
  userId: string,
  key: string,
  follow: boolean,
  now = new Date(),
): Promise<string[]> {
  const fs = firestoreOf(ds);
  const updatedAt = now.toISOString();
  if (fs) {
    const ref = fs.collection(FOLLOWS).doc(userId);
    return fs.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = (snap.data()?.targets as string[] | undefined) ?? [];
      const targets = nextTargets(current, key, follow);
      tx.set(ref, { user_id: userId, targets, updated_at: updatedAt });
      return targets;
    });
  }
  const existing = (await ds.getById(FOLLOWS, userId)) as FollowsDoc | null;
  const targets = nextTargets(existing?.targets ?? [], key, follow);
  if (existing) {
    await ds.update(FOLLOWS, userId, { targets, updated_at: updatedAt });
  } else {
    await ds.insert(FOLLOWS, [
      { id: userId, user_id: userId, targets, updated_at: updatedAt },
    ]);
  }
  return targets;
}

/**
 * Users following any of `keys` (a match, its two teams, its tournament):
 * one `array-contains` query per key, in parallel; reads = the follower
 * documents, at least 1 per query. Single-field array index, no composite.
 */
export async function followerIds(
  ds: DataSource,
  keys: readonly string[],
): Promise<string[]> {
  const unique = Array.from(new Set(keys)).slice(0, MAX_FANOUT_KEYS);
  const results = await Promise.all(
    unique.map((key) =>
      ds.query(FOLLOWS, [{ field: "targets", op: "array-contains", value: key }]),
    ),
  );
  const ids = new Set<string>();
  for (const docs of results) for (const d of docs) ids.add(d.id);
  return [...ids];
}
