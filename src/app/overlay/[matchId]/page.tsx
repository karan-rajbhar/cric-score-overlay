import { createServerClient } from "~/lib/supabase/server";
import { OverlayClient } from "./overlay-client";
import { DEMO_MATCH_STATE } from "./demo-data";

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
        initialLayout={initialParams?.layout}
        initialTheme={initialParams?.theme}
        initialControls={initialParams?.controls !== "false"}
        initialSponsor={initialParams?.sponsor}
      />
    );
  }

  let data = null;
  if (UUID_REGEX.test(matchId)) {
    const supabase = await createServerClient();
    const result = await supabase
      .from("live_match_state")
      .select("*")
      .eq("match_id", matchId)
      .single();
    data = result.data;
  }

  return (
    <OverlayClient
      matchId={matchId}
      initial={data}
      initialLayout={initialParams?.layout}
      initialTheme={initialParams?.theme}
      initialControls={initialParams?.controls !== "false"}
      initialSponsor={initialParams?.sponsor}
    />
  );
}
