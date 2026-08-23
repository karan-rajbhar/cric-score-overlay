import { createServerClient } from "~/lib/supabase/server";
import { OverlayClient } from "./overlay-client";

export const dynamic = "force-dynamic";

export default async function OverlayPage({
    params,
}: {
    params: Promise<{ matchId: string }>;
}) {
    const { matchId } = await params;
    const supabase = await createServerClient();

    const { data } = await supabase
        .from("live_match_state")
        .select("*")
        .eq("match_id", matchId)
        .single();

    return <OverlayClient matchId={matchId} initial={data} />;
}
