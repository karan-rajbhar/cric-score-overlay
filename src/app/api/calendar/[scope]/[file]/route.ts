import { type NextRequest } from "next/server";
import { calendarFeed, FEED_TTL_SECONDS } from "~/lib/calendar/feed";
import { isCalendarScope } from "~/lib/calendar/fixtures";
import { calendarFileName } from "~/lib/calendar/ics";
import { createServerClient } from "~/lib/firebase/server";
import { originFromHeaders } from "~/lib/request-origin";

/**
 * GET /api/calendar/<team|tournament|club>/<id>.ics: that team's,
 * tournament's or club's fixtures as an iCalendar feed (public data, no
 * session needed), for calendar apps that subscribe to it (webcal://).
 *
 * Calendar apps poll every few hours; the CDN (`s-maxage`) and the server
 * instance (~/lib/calendar/feed) keep a feed for 15 minutes, so polls cost
 * Firestore reads at most once per 15 minutes per feed.
 */

type Params = { params: Promise<{ scope: string; file: string }> };

const CACHE_CONTROL = `public, max-age=${FEED_TTL_SECONDS}, s-maxage=${FEED_TTL_SECONDS}, stale-while-revalidate=3600`;
const FILE_RE = /^([\w-]{1,128})\.ics$/;

function text(status: number, body: string, cacheControl: string) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": cacheControl,
    },
  });
}

async function serve(request: NextRequest, { params }: Params, head: boolean) {
  const { scope, file } = await params;
  const id = FILE_RE.exec(file)?.[1];
  if (!isCalendarScope(scope) || !id) {
    return text(404, "Not found", "public, max-age=300");
  }
  try {
    const db = await createServerClient();
    const feed = await calendarFeed(
      db,
      scope,
      id,
      originFromHeaders(request.headers),
      new Date(),
    );
    if (!feed) return text(404, "Not found", "public, max-age=300");
    return new Response(head ? null : feed.body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${calendarFileName(feed.name)}"`,
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (err) {
    console.error("Calendar feed failed:", err);
    return text(503, "Calendar unavailable, try again later", "no-store");
  }
}

export async function GET(request: NextRequest, context: Params) {
  return serve(request, context, false);
}

export async function HEAD(request: NextRequest, context: Params) {
  return serve(request, context, true);
}
