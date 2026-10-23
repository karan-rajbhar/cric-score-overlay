import type { Metadata } from "next";
import { getMatch, getLiveMatchState } from "~/app/matches/queries";
import { TransparentPage } from "~/components/overlay/transparent-page";
import { OverlayClient } from "./overlay-client";
import { DEMO_MATCH_STATE, DEMO_MATCH_DETAILS } from "./demo-data";
import type { LiveMatchState } from "~/components/overlay/types";
import type { Match } from "~/lib/match-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stream overlay",
  robots: { index: false, follow: false },
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The score and match to start from (2 server reads, the live state cached
 * for a few seconds), and the server's clock when they were read.
 */
async function loadOverlay(matchId: string): Promise<{
  data: LiveMatchState | null;
  match: Match | null;
  notFound: boolean;
  serverNow: number;
}> {
  if (!UUID_REGEX.test(matchId)) {
    return { data: null, match: null, notFound: true, serverNow: Date.now() };
  }
  const [liveResult, matchResult] = await Promise.all([
    getLiveMatchState(matchId),
    getMatch(matchId),
  ]);
  return {
    data: (liveResult.data as LiveMatchState) ?? null,
    match: (matchResult.data as Match) ?? null,
    // Only a match that is not there; a read that failed may recover.
    notFound: liveResult.error === "Match not found",
    serverNow: Date.now(),
  };
}

export default async function OverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{
    layout?: string;
    theme?: string;
    sponsor?: string;
    safe?: string;
    delay?: string;
  }>;
}) {
  const { matchId } = await params;
  const query = await searchParams;
  const linkParams = {
    layout: query.layout,
    theme: query.theme,
    sponsor: query.sponsor,
  };
  const delaySeconds = Number(query.delay ?? 0) || 0;
  const showSafeZone = query.safe === "true";

  if (matchId === "test") {
    return (
      <>
        <TransparentPage />
        <OverlayClient
          matchId={matchId}
          initial={DEMO_MATCH_STATE}
          match={DEMO_MATCH_DETAILS}
          params={linkParams}
          showSafeZone={showSafeZone}
        />
      </>
    );
  }

  const { data, match, notFound, serverNow } = await loadOverlay(matchId);

  return (
    <>
      <TransparentPage />
      <OverlayClient
        matchId={matchId}
        initial={data}
        match={match}
        params={linkParams}
        serverNow={serverNow}
        delaySeconds={delaySeconds}
        showSafeZone={showSafeZone}
        notFound={notFound}
      />
    </>
  );
}
