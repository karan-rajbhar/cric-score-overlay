import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "~/lib/firebase/server";
import { isJsonRequest, isSameOrigin, readCapped } from "~/lib/api-request";
import {
  MAX_REPLAY_BODY_BYTES,
  SUPPORTED_REPLAY_VERSIONS,
  type ReplayErrorCode,
  type ReplayErrorResponse,
  type ReplayResponse,
} from "~/lib/scoring-replay/protocol";
import { replayBatchSchemaV1 } from "~/lib/scoring-replay/schemas";
import { replayActions } from "./dispatch";

/**
 * POST /api/scoring/replay: the offline queue's replay of scoring actions
 * (contract and versioning in `~/lib/scoring-replay/protocol.ts`). A stable
 * URL, unlike server action ids, so a queue recorded on one build replays
 * on the next.
 *
 * Same auth as the server actions: the session cookie. Scoring rights are
 * checked per action by the scoring engine's transaction. The cookie is
 * SameSite=Lax, so the route also requires a same-origin `Origin` header
 * (the check Next.js applies to server actions) and a JSON body, which a
 * cross-site form cannot send.
 */

const NO_STORE = { "Cache-Control": "no-store" };

function fail(
  status: number,
  code: ReplayErrorCode,
  message: string,
  extra?: Partial<ReplayErrorResponse>,
) {
  const body: ReplayErrorResponse = { error: { code, message }, ...extra };
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return fail(
      403,
      "bad_origin",
      "Cross-origin replay requests are not allowed",
    );
  }
  if (!isJsonRequest(request)) {
    return fail(
      415,
      "unsupported_media_type",
      "Send the batch as application/json",
    );
  }
  const raw = await readCapped(request, MAX_REPLAY_BODY_BYTES);
  if (raw === null) {
    return fail(
      413,
      "payload_too_large",
      "Batch too large; send fewer actions",
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "invalid_json", "Body is not valid JSON");
  }

  const v = (body as { v?: unknown } | null)?.v;
  if (typeof v !== "number" || !SUPPORTED_REPLAY_VERSIONS.includes(v)) {
    return fail(
      400,
      "unsupported_version",
      `Replay format v${String(v)} is not supported by this server`,
      { supportedVersions: SUPPORTED_REPLAY_VERSIONS },
    );
  }
  // v1 is the only format so far; a v2 would be parsed (and its actions
  // dispatched) here alongside it.
  const parsed = replayBatchSchemaV1.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(
      400,
      "invalid_batch",
      issue
        ? `${issue.path.join(".") || "batch"}: ${issue.message}`
        : "Invalid batch",
    );
  }

  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) {
      return fail(
        401,
        "not_authenticated",
        "You must be logged in to sync scores",
      );
    }
    const batch = parsed.data;
    const { results, delta } = await replayActions(
      db,
      batch.matchId,
      batch.actions,
    );
    const response: ReplayResponse = { v: batch.v, results, delta };
    return NextResponse.json(response, { headers: NO_STORE });
  } catch (err) {
    console.error("replay: unexpected error:", err);
    return fail(500, "server_error", "Replay failed; try again");
  }
}
