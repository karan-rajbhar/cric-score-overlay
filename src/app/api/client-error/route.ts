import { NextResponse, type NextRequest } from "next/server";
import { readCapped } from "~/lib/api-request";
import { RateLimiter } from "~/lib/overlay/rate-limit";

/**
 * Browser error reports (src/lib/report-error.ts). Each one is written to the
 * server log as a structured ERROR entry, which App Hosting forwards to Cloud
 * Logging next to server errors; a log-based alert emails on new errors.
 * Nothing is stored. Inputs are size-capped (the body is read no further
 * than the cap) and trimmed, and each instance logs at most 60 reports a
 * minute, so the route can't be used to flood the logs.
 */

const MAX_BODY_BYTES = 8 * 1024;
const LIMITS = { message: 500, stack: 4000, url: 500, digest: 100, kind: 40 };
const reports = new RateLimiter(60, 60_000);

function clip(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, max)
    : undefined;
}

export async function POST(request: NextRequest) {
  const raw = await readCapped(request, MAX_BODY_BYTES);
  if (raw === null) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const message = clip(body.message, LIMITS.message);
  if (!message) {
    return NextResponse.json({ error: "missing_message" }, { status: 400 });
  }
  if (!reports.allow("all")) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  console.error(
    JSON.stringify({
      severity: "ERROR",
      source: "client",
      message: `[client] ${message}`,
      kind: clip(body.kind, LIMITS.kind),
      stack: clip(body.stack, LIMITS.stack),
      url: clip(body.url, LIMITS.url),
      digest: clip(body.digest, LIMITS.digest),
      userAgent: clip(request.headers.get("user-agent"), 300),
    }),
  );
  return new NextResponse(null, { status: 204 });
}
