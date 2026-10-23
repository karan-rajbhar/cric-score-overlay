import { NextResponse, type NextRequest } from "next/server";
import { getLiveMatchState, getMatch } from "~/app/matches/queries";

/**
 * GET /api/overlay/match/{matchId}: what `/overlay/{matchId}` renders
 * with (`live_state` row and match details, both public), for the channel
 * overlay when its channel switches match. A stable route rather than a
 * server action, since an OBS source stays open across deploys. Reads as
 * the overlay page does: `live_state` and the match, each cached briefly.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;
  if (!UUID.test(matchId)) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: NO_STORE },
    );
  }
  const [live, match] = await Promise.all([
    getLiveMatchState(matchId),
    getMatch(matchId),
  ]);
  if (!live.data || !match.data) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json(
    // The server's clock: the overlay judges stored graphics by it.
    { live: live.data, match: match.data, serverNow: Date.now() },
    { headers: NO_STORE },
  );
}
