import { NextResponse, type NextRequest } from "next/server";

/**
 * Core Web Vitals from real visits (`WebVitalsReporter`): each one is
 * written to the server log as a structured INFO entry, which App Hosting
 * forwards to Cloud Logging (query `jsonPayload.source="web-vitals"`), so
 * slow taps on the scoring screen (INP) or slow loads (LCP) show up in the
 * field, not only in lab tests. Nothing is stored. Only the metric, its
 * value and the page path (no query string) are kept.
 */

const MAX_BODY_BYTES = 2 * 1024;
const METRICS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);
const RATINGS = new Set(["good", "needs-improvement", "poor"]);

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { name, value, rating, path, navigationType } = body;
  if (
    typeof name !== "string" ||
    !METRICS.has(name) ||
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    typeof rating !== "string" ||
    !RATINGS.has(rating)
  ) {
    return NextResponse.json({ error: "invalid_metric" }, { status: 400 });
  }

  console.info(
    JSON.stringify({
      severity: "INFO",
      source: "web-vitals",
      message: `[web-vitals] ${name} ${rating}`,
      metric: name,
      value: Math.round(value * 1000) / 1000,
      rating,
      path:
        typeof path === "string" ? path.split("?")[0]!.slice(0, 200) : null,
      navigationType:
        typeof navigationType === "string" ? navigationType.slice(0, 30) : null,
    }),
  );
  return new NextResponse(null, { status: 204 });
}
