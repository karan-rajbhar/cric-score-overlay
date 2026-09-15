import { getMatch, getLiveMatchState } from "~/app/matches/queries";
import { OverlayClient } from "./overlay-client";
import { DEMO_MATCH_STATE, DEMO_MATCH_DETAILS } from "./demo-data";
import type { LiveMatchState } from "~/components/overlay/types";
import type { Match } from "~/lib/match-types";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{
    layout?: string;
    theme?: string;
    controls?: string;
    sponsor?: string;
  }>;
}) {
  const { matchId } = await params;
  const initialParams = await searchParams;

  if (matchId === "test") {
    return (
      <OverlayClient
        matchId={matchId}
        initial={DEMO_MATCH_STATE}
        match={DEMO_MATCH_DETAILS}
        initialLayout={initialParams?.layout}
        initialTheme={initialParams?.theme}
        initialControls={initialParams?.controls !== "false"}
        initialSponsor={initialParams?.sponsor}
      />
    );
  }

  let data = null;
  let match = null;

  if (UUID_REGEX.test(matchId)) {
    const [liveResult, matchResult] = await Promise.all([
      getLiveMatchState(matchId),
      getMatch(matchId),
    ]);
    data = (liveResult.data as LiveMatchState) ?? null;
    match = (matchResult.data as Match) ?? null;
  }

  return (
    <OverlayClient
      matchId={matchId}
      initial={data}
      match={match}
      initialLayout={initialParams?.layout}
      initialTheme={initialParams?.theme}
      initialControls={initialParams?.controls !== "false"}
      initialSponsor={initialParams?.sponsor}
    />
  );
}
