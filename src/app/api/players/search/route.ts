import { NextResponse, type NextRequest } from "next/server";
import { searchPlayers } from "~/lib/firebase/search-players";
import { createServerClient } from "~/lib/firebase/server";

/**
 * GET /api/players/search?q=: existing players for the "add a player"
 * boxes. A stable URL, unlike server action ids, so a scoring screen left
 * open across a deploy can still search. Only signed-in users add players,
 * so only they spend the reads. Profiles are public; no contact details.
 */

const NO_STORE = { "Cache-Control": "no-store" };
/** Longer than any name; the rest could not match a stored key anyway. */
const MAX_QUERY_LENGTH = 100;

export async function GET(request: NextRequest) {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to search players" },
      { status: 401, headers: NO_STORE },
    );
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
  const clubId = request.nextUrl.searchParams.get("club");
  const { data, error } = await searchPlayers(db, query, { clubId });
  if (error || !data) {
    console.error("Error searching players:", error);
    return NextResponse.json(
      { error: "Player search failed" },
      { status: 500, headers: NO_STORE },
    );
  }
  return NextResponse.json(data, { headers: NO_STORE });
}
