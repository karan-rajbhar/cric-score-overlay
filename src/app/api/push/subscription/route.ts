import { NextResponse, type NextRequest } from "next/server";
import { adminDataSource } from "~/lib/admin-data-source";
import { isJsonRequest, isSameOrigin, readCapped } from "~/lib/api-request";
import { createServerClient } from "~/lib/firebase/server";
import {
  parseSubscription,
  removeSubscription,
  saveSubscription,
} from "~/lib/push/subscriptions";
import { vapidKeysFromEnv } from "~/lib/push/web-push";

/**
 * This device's push subscription, for the signed-in user:
 * POST `PushSubscription.toJSON()` stores it, DELETE `{ endpoint }` forgets
 * it (turning notifications off, signing out). A stable route rather than a
 * server action, so a page from before a deploy can still sign out cleanly.
 * Same-origin JSON with the session cookie, like /api/overlay/command;
 * `push_subscriptions` is server-only (rules deny every client access).
 */

const MAX_BODY_BYTES = 4 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

function reply(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

async function readJson(
  request: NextRequest,
): Promise<{ body: unknown } | { error: NextResponse }> {
  if (!isSameOrigin(request)) {
    return { error: reply(403, { error: "bad_origin" }) };
  }
  if (!isJsonRequest(request)) {
    return { error: reply(415, { error: "unsupported_media_type" }) };
  }
  const raw = await readCapped(request, MAX_BODY_BYTES);
  if (raw === null) return { error: reply(413, { error: "payload_too_large" }) };
  try {
    return { body: JSON.parse(raw) };
  } catch {
    return { error: reply(400, { error: "invalid_json" }) };
  }
}

async function signedInUserId(): Promise<string | null> {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  return user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const read = await readJson(request);
  if ("error" in read) return read.error;
  if (!vapidKeysFromEnv()) return reply(404, { error: "push_not_configured" });
  const sub = parseSubscription(read.body);
  if (!sub) return reply(400, { error: "invalid_subscription" });
  try {
    const userId = await signedInUserId();
    if (!userId) return reply(401, { error: "not_authenticated" });
    await saveSubscription(adminDataSource(), userId, sub);
    return reply(200, { ok: true });
  } catch (err) {
    console.error("save push subscription failed:", err);
    return reply(500, { error: "internal" });
  }
}

export async function DELETE(request: NextRequest) {
  const read = await readJson(request);
  if ("error" in read) return read.error;
  const endpoint = (read.body as { endpoint?: unknown } | null)?.endpoint;
  if (typeof endpoint !== "string") {
    return reply(400, { error: "invalid_endpoint" });
  }
  try {
    const userId = await signedInUserId();
    if (!userId) return reply(401, { error: "not_authenticated" });
    const removed = await removeSubscription(adminDataSource(), userId, endpoint);
    return reply(200, { ok: true, removed });
  } catch (err) {
    console.error("remove push subscription failed:", err);
    return reply(500, { error: "internal" });
  }
}
