/**
 * Push subscriptions, server only: `push_subscriptions/{sha256(endpoint)}`
 * = { user_id, endpoint, p256dh, auth, created_at, updated_at }. Rules deny
 * every client read and write; the endpoint is a capability URL.
 *
 * Endpoints must belong to a known browser push service, so the server
 * never posts to an address a client made up.
 */

import { createHash } from "node:crypto";
import { chunk, type DataSource } from "~/lib/firebase/datasource";

export const PUSH_SUBSCRIPTIONS = "push_subscriptions";
/** Devices kept per user; the oldest goes first. */
export const MAX_DEVICES = 10;

const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
];
const PUSH_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

export interface PushSubscriptionDoc {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return (
    PUSH_HOSTS.includes(host) ||
    PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

const B64URL = /^[A-Za-z0-9_-]+$/;

/** A browser's `PushSubscription.toJSON()`, validated; null when unusable. */
export function parseSubscription(value: unknown): SubscriptionInput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof v.endpoint === "string" ? v.endpoint : "";
  const p256dh = typeof v.keys?.p256dh === "string" ? v.keys.p256dh : "";
  const auth = typeof v.keys?.auth === "string" ? v.keys.auth : "";
  if (endpoint.length > 2048 || !isAllowedPushEndpoint(endpoint)) return null;
  if (!B64URL.test(p256dh) || Buffer.from(p256dh, "base64url").length !== 65) {
    return null;
  }
  if (!B64URL.test(auth) || Buffer.from(auth, "base64url").length !== 16) {
    return null;
  }
  return { endpoint, p256dh, auth };
}

export function subscriptionId(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

/**
 * Stores (or moves to this user) a device's subscription: 1 read, 1 write,
 * plus the user's devices (reads) and a delete when over MAX_DEVICES.
 */
export async function saveSubscription(
  ds: DataSource,
  userId: string,
  sub: SubscriptionInput,
  now = new Date(),
): Promise<void> {
  const id = subscriptionId(sub.endpoint);
  const at = now.toISOString();
  const existing = (await ds.getById(PUSH_SUBSCRIPTIONS, id)) as
    | PushSubscriptionDoc
    | null;
  if (existing) {
    await ds.update(PUSH_SUBSCRIPTIONS, id, {
      user_id: userId,
      p256dh: sub.p256dh,
      auth: sub.auth,
      updated_at: at,
    });
    return;
  }
  const devices = (await ds.query(PUSH_SUBSCRIPTIONS, [
    { field: "user_id", op: "==", value: userId },
  ])) as unknown as PushSubscriptionDoc[];
  const oldest = [...devices]
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    .slice(0, Math.max(0, devices.length - (MAX_DEVICES - 1)));
  for (const d of oldest) await ds.delete(PUSH_SUBSCRIPTIONS, d.id);
  await ds.insert(PUSH_SUBSCRIPTIONS, [
    { id, user_id: userId, ...sub, created_at: at, updated_at: at },
  ]);
}

/** Removes a device's subscription if it is this user's (1 read, 1 delete). */
export async function removeSubscription(
  ds: DataSource,
  userId: string,
  endpoint: string,
): Promise<boolean> {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  const id = subscriptionId(endpoint);
  const existing = (await ds.getById(PUSH_SUBSCRIPTIONS, id)) as
    | PushSubscriptionDoc
    | null;
  if (!existing || existing.user_id !== userId) return false;
  await ds.delete(PUSH_SUBSCRIPTIONS, id);
  return true;
}

/** Every device of these users (`user_id in`, 30 per query). */
export async function subscriptionsOfUsers(
  ds: DataSource,
  userIds: readonly string[],
): Promise<PushSubscriptionDoc[]> {
  const out: PushSubscriptionDoc[] = [];
  for (const group of chunk(Array.from(new Set(userIds)), 30)) {
    const docs = await ds.query(PUSH_SUBSCRIPTIONS, [
      { field: "user_id", op: "in", value: group },
    ]);
    out.push(...(docs as unknown as PushSubscriptionDoc[]));
  }
  return out;
}
