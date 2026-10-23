import { NextResponse, type NextRequest } from "next/server";
import { serverDataSource } from "~/lib/firebase/server-ds";
import { sendProducerCommand } from "~/lib/overlay/commands";
import { remoteRateLimiter } from "~/lib/overlay/rate-limit";
import { isRemoteAction, remoteCommandFor } from "~/lib/overlay/remote-actions";
import { tokenIdOf, verifyRemoteToken } from "~/lib/overlay/remote-token";

/**
 * Stream Deck / Bitfocus Companion remote: `POST`
 * `/api/overlay/remote/{token}/{action}` (Companion's Generic HTTP module)
 * sends one of a fixed set of producer commands (`remote-actions.ts`) to
 * the token's match overlay.
 *
 * - The token is the credential (no session, no CORS headers): 1 read to
 *   check it, hashes compared in constant time (`remote-token.ts`), then
 *   1 write to the match's `overlay_state` (`sendProducerCommand`).
 * - At most 5 requests per second per token (per server instance), counted
 *   before the read, so a stuck button costs nothing.
 * - Nothing here logs the token or the request URL.
 */

const NO_STORE = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
};

function fail(
  status: number,
  code: string,
  message: string,
  extra: Record<string, string> = {},
) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status, headers: { ...NO_STORE, ...extra } },
  );
}

type Context = { params: Promise<{ token: string; action: string }> };

async function handle(_request: NextRequest, { params }: Context) {
  const { token, action } = await params;
  const tokenId = tokenIdOf(token);
  if (!tokenId) return fail(401, "invalid_token", "Unknown or revoked token");
  if (!isRemoteAction(action)) {
    return fail(404, "unknown_action", "Unknown action");
  }
  if (!remoteRateLimiter.allow(tokenId)) {
    return fail(429, "rate_limited", "Too many requests", {
      "Retry-After": "1",
    });
  }

  const ds = serverDataSource();
  let matchId: string | null;
  try {
    matchId = await verifyRemoteToken(ds, token);
  } catch (err) {
    console.error(
      "[overlay remote] token check failed:",
      err instanceof Error ? err.name : "error",
    );
    return fail(500, "internal", "Could not check the token");
  }
  if (!matchId) return fail(401, "invalid_token", "Unknown or revoked token");

  try {
    // Into the match's overlay_state, as the control room's commands go.
    if (!(await sendProducerCommand(matchId, remoteCommandFor(action)))) {
      return fail(400, "unsupported_action", "The overlay cannot show this");
    }
    return NextResponse.json({ ok: true, action }, { headers: NO_STORE });
  } catch (err) {
    console.error(
      `[overlay remote] ${action} failed for match ${matchId}:`,
      err instanceof Error ? err.message : err,
    );
    return fail(500, "internal", "Could not send the command");
  }
}

export const POST = handle;

/**
 * Link checkers and previews (which GET or HEAD a pasted URL): answer
 * without sending anything. There is no GET, so a preview never fires a
 * graphic.
 */
export async function GET(_request: NextRequest, _context: Context) {
  return new Response(null, {
    status: 405,
    headers: { ...NO_STORE, Allow: "POST, HEAD" },
  });
}

export function HEAD() {
  return new Response(null, { status: 204, headers: NO_STORE });
}
