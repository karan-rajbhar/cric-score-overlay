import { NextResponse, type NextRequest } from "next/server";

/**
 * Core Web Vitals from real visits (`WebVitalsReporter`): each one is
 * written to the server log as a structured INFO entry, which App Hosting
 * forwards to Cloud Logging (query `jsonPayload.source="web-vitals"`), so
 * slow taps on the scoring screen (INP) or slow loads (LCP) show up in the
 * field, not only in lab tests. Nothing is stored. Only the metric, its
 * value and the page path (no query string) are kept.
 *
 * The reporter sends a visit's metrics together (`{ metrics: [...] }`, up
 * to MAX_METRICS); a single metric object (the earlier format) is still
 * accepted.
 */

const MAX_BODY_BYTES = 4 * 1024;
const MAX_METRICS = 10;
const METRICS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);
const RATINGS = new Set(["good", "needs-improvement", "poor"]);

interface Metric {
  name: string;
  value: number;
  rating: string;
  path?: unknown;
  navigationType?: unknown;
}

function isKnownMetric(
  m: Record<string, unknown>,
): m is Record<string, unknown> & Metric {
  return (
    typeof m.name === "string" &&
    METRICS.has(m.name) &&
    typeof m.value === "number" &&
    Number.isFinite(m.value) &&
    typeof m.rating === "string" &&
    RATINGS.has(m.rating)
  );
}

/** The log entry for one metric, or null when it is not a known metric. */
function entryOf(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const m = body as Record<string, unknown>;
  if (!isKnownMetric(m)) return null;
  const { name, value, rating, path, navigationType } = m;
  return {
    severity: "INFO",
    source: "web-vitals",
    message: `[web-vitals] ${name} ${rating}`,
    metric: name,
    value: Math.round(value * 1000) / 1000,
    rating,
    path: typeof path === "string" ? path.split("?")[0]!.slice(0, 200) : null,
    navigationType:
      typeof navigationType === "string" ? navigationType.slice(0, 30) : null,
  };
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const batch =
    body && typeof body === "object" && "metrics" in body
      ? (body as { metrics: unknown }).metrics
      : [body];
  if (!Array.isArray(batch) || batch.length > MAX_METRICS) {
    return NextResponse.json({ error: "invalid_metric" }, { status: 400 });
  }
  const entries = batch
    .map(entryOf)
    .filter((e): e is Record<string, unknown> => e !== null);
  if (!entries.length) {
    return NextResponse.json({ error: "invalid_metric" }, { status: 400 });
  }
  for (const entry of entries) console.info(JSON.stringify(entry));
  return new NextResponse(null, { status: 204 });
}
