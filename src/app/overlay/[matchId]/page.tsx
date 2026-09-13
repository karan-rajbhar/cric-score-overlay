import { createServerClient } from "~/lib/supabase/server";
import { OverlayClient } from "./overlay-client";

export const dynamic = "force-dynamic";

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
  const supabase = await createServerClient();

  const { data } = await supabase
    .from("live_match_state")
    .select("*")
    .eq("match_id", matchId)
    .single();

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
