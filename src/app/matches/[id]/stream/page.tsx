import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ScreenBar } from "~/components/ds/screen";
import { StreamSetup } from "~/components/overlay/stream-setup";
import type { LiveMatchState } from "~/components/overlay/types";
import { getLiveMatchState, getMatch } from "~/app/matches/queries";
import { canProduceOverlay } from "~/lib/firebase/permissions";
import { createServerClient } from "~/lib/firebase/server";
import { requestOrigin } from "~/lib/match-share-server";
import type { Match } from "~/lib/match-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stream this match",
  robots: { index: false, follow: false },
};

/**
 * Whether the signed-in user (if any) may run this match's graphics: its
 * admins and streamers (`canProduceOverlay`).
 */
async function canProduce(matchId: string): Promise<boolean> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return false;
    return await canProduceOverlay(db, matchId, user.id);
  } catch {
    return false;
  }
}

async function loadStreamPage(id: string) {
  const [matchResult, liveResult, producer, origin] = await Promise.all([
    getMatch(id),
    getLiveMatchState(id),
    canProduce(id),
    requestOrigin(),
  ]);
  return { matchResult, liveResult, producer, origin, serverNow: Date.now() };
}

/**
 * Putting a match's score on a live stream, step by step: the streaming
 * tool, the look, the overlay link (with a QR code for phones), a test,
 * and who runs the graphics.
 */
export default async function StreamMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { matchResult, liveResult, producer, origin, serverNow } =
    await loadStreamPage(id);
  const match = (matchResult.data as Match | null) ?? null;
  if (!match) notFound();

  // Always the clean link: what is on air comes from the control room.
  const overlayUrl = `${origin}/overlay/${id}`;
  const qrDataUrl = await QRCode.toDataURL(overlayUrl, {
    margin: 4,
    width: 264,
    errorCorrectionLevel: "M",
    color: { dark: "#181745", light: "#ffffff" },
  }).catch(() => null);

  return (
    <div className="space-y-4">
      <ScreenBar
        title="Stream this match"
        backHref={`/matches/${id}`}
        backLabel="Back to the match"
      />
      <p className="mx-auto max-w-3xl text-sm text-muted-foreground [text-wrap:pretty]">
        {match.title}: add the live score to your stream. It updates by itself
        after every ball.
      </p>
      <StreamSetup
        matchId={id}
        overlayUrl={overlayUrl}
        qrDataUrl={qrDataUrl}
        canProduce={producer}
        state={(liveResult.data as LiveMatchState | null) ?? null}
        match={match}
        serverNow={serverNow}
      />
    </div>
  );
}
