import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isJsonRequest, isSameOrigin, readCapped } from "~/lib/api-request";
import { sendProducerCommand } from "~/lib/overlay/commands";
import { overlayPatchOf, type OverlayCommandInput } from "~/lib/overlay-state";
import { createServerClient } from "~/lib/firebase/server";
import { canProduceOverlay } from "~/lib/firebase/permissions";

/**
 * POST /api/overlay/command: a control room command for a match's overlay
 * (`{ matchId, payload: ProducerCommand }`), merged into
 * `overlay_state/{matchId}` (`~/lib/overlay-state`), which the overlay
 * listens to, through `sendProducerCommand` (as the Stream Deck remote
 * does). Browsers cannot write there (firestore.rules), so only those who
 * may run the match's graphics (`canProduceOverlay`: its admins and
 * streamers) can drive its overlay. Same-origin JSON with the session
 * cookie, like the replay route.
 */

const MAX_BODY_BYTES = 16 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

const commandSchema = z.object({
  // Part of a document path: no "/".
  matchId: z.string().regex(/^[\w-]{1,128}$/),
  payload: z
    .object({
      type: z.string().min(1).max(64),
      // Stored as `last_command_id`: the control room's confirmation.
      id: z.string().max(64).optional(),
    })
    .passthrough(),
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
  // Refuse what the overlay would ignore, so "on air" is never a no-op.
  const command = payload as OverlayCommandInput;
  if (!overlayPatchOf(command, Date.now())) {
    return fail(
      400,
      "invalid_command",
      "The overlay does not know this command",
    );
  }

  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return fail(401, "not_authenticated", "Sign in again");
    // Admins of the match and its streamers (canProduceOverlay).
    const mayProduce = await canProduceOverlay(db, matchId, user.id);
    if (!mayProduce) {
      return fail(
        403,
        "not_authorized",
        "Not a scorer or streamer of this match",
      );
    }

    if (!(await sendProducerCommand(matchId, command))) {
      return fail(
        400,
        "invalid_command",
        "The overlay does not know this command",
      );
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    console.error("overlay command failed:", err);
    return fail(500, "internal", "Could not send the command");
  }
}
