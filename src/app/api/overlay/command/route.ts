import { NextResponse, type NextRequest } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { isJsonRequest, isSameOrigin, readCapped } from "~/lib/api-request";
import { getAdminFirestore } from "~/lib/firebase/admin";
import {
  BROADCAST_COLLECTION,
  BROADCAST_TTL_MS,
} from "~/lib/firebase/config";
import { createServerClient } from "~/lib/firebase/server";
import { canProduceOverlay } from "~/lib/firebase/permissions"; // streamers

/**
 * POST /api/overlay/command: a control room command for a match's overlay
 * (`{ matchId, payload: ProducerCommand }`), appended to
 * `broadcasts/overlay_control_{matchId}/messages`, where the overlay
 * listens. Browsers cannot write there (firestore.rules), so only an admin
 * of that match can drive its overlay, as only they can open its control
 * room. Same-origin JSON with the session cookie, like the replay route.
 */

const MAX_BODY_BYTES = 16 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

const commandSchema = z.object({
  // Part of a document path: no "/".
  matchId: z.string().regex(/^[\w-]{1,128}$/),
  payload: z.object({ type: z.string().min(1).max(64) }).passthrough(),
});

function fail(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: NO_STORE },
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return fail(403, "bad_origin", "Cross-origin requests are not allowed");
  }
  if (!isJsonRequest(request)) {
    return fail(415, "unsupported_media_type", "Send application/json");
  }
  const raw = await readCapped(request, MAX_BODY_BYTES);
  if (raw === null) return fail(413, "payload_too_large", "Command too large");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "invalid_json", "Body is not valid JSON");
  }
  const parsed = commandSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid_command", "Invalid command");
  const { matchId, payload } = parsed.data;

  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return fail(401, "not_authenticated", "Sign in again");
    // Admins of the match and its streamers (canProduceOverlay).
    const isAdmin = await canProduceOverlay(db, matchId, user.id);
    if (!isAdmin) {
      return fail(403, "not_authorized", "Not an admin of this match");
    }

    await getAdminFirestore()
      .collection(BROADCAST_COLLECTION)
      .doc(`overlay_control_${matchId}`)
      .collection("messages")
      .add({
        event: "command",
        payload,
        ts: FieldValue.serverTimestamp(),
        expires_at: Timestamp.fromMillis(Date.now() + BROADCAST_TTL_MS),
      });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    console.error("overlay command failed:", err);
    return fail(500, "internal", "Could not send the command");
  }
}
