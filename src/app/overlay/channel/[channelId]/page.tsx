import type { Metadata } from "next";
import { TransparentPage } from "~/components/overlay/transparent-page";
import { ChannelOverlay } from "./channel-overlay";

/**
 * A stream channel's fixed overlay link (OBS browser source): shows the
 * overlay of whatever match the channel is on, and nothing (a transparent
 * page) when it is off air. Everything happens in the browser: the channel
 * doc listener (1 read, 1 per switch) and the overlay's own `live_state`
 * listener; this page reads nothing.
 */

export const metadata: Metadata = { title: "Overlay channel" };

export default async function ChannelOverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{
    layout?: string;
    theme?: string;
    sponsor?: string;
    safe?: string;
    delay?: string;
  }>;
}) {
  const { channelId } = await params;
  const query = await searchParams;
  // Part of a document path: anything else is never on air.
  if (!/^[\w-]{1,128}$/.test(channelId)) return <TransparentPage />;
  return (
    <>
      <TransparentPage />
      <ChannelOverlay
        channelId={channelId}
        layout={query.layout}
        theme={query.theme}
        sponsor={query.sponsor}
        safeZone={query.safe === "true"}
        delaySeconds={Number(query.delay ?? 0) || 0}
      />
    </>
  );
}
