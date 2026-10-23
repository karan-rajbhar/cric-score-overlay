"use client";

import { useEffect, useState } from "react";
import { getFirebaseDb } from "~/lib/firebase/client";
import { watchDoc } from "~/lib/firebase/realtime";
import type { LiveMatchState } from "~/components/overlay/types";
import type { Match } from "~/lib/match-types";
import { OverlayClient } from "../../[matchId]/overlay-client";

/** Mirrors `STREAM_CHANNELS` in `~/lib/overlay/channels` (server). */
const STREAM_CHANNELS = "stream_channels";

interface OverlayData {
  live: LiveMatchState | null;
  match: Match | null;
}

/**
 * The overlay's starting data for a match, from the stable
 * `/api/overlay/match/{id}` route (a page left open in OBS outlives
 * deploys, which would break a server action). Null when it is gone.
 */
async function loadOverlayData(
  matchId: string,
  signal: AbortSignal,
): Promise<OverlayData | null> {
  const res = await fetch(`/api/overlay/match/${encodeURIComponent(matchId)}`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) return null;
  return (await res.json()) as OverlayData;
}

/** The channel's match; `epoch` moves on every change (incl. off air). */
interface OnAir {
  matchId: string | null;
  epoch: number;
}

interface Shown extends OverlayData {
  matchId: string;
  epoch: number;
}

/**
 * Follows `stream_channels/{channelId}` (1 read, then 1 per switch) and
 * shows the existing overlay for its match. A switch keeps the previous
 * match on air until the next one has loaded, then swaps without a
 * reload; off air (or a missing channel / match) renders nothing.
 */
export function ChannelOverlay({
  channelId,
  layout,
  theme,
  sponsor,
  safeZone = false,
}: {
  channelId: string;
  layout?: string;
  theme?: string;
  sponsor?: string;
  safeZone?: boolean;
}) {
  const [onAir, setOnAir] = useState<OnAir>({ matchId: null, epoch: 0 });
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(
    () =>
      watchDoc<{ match_id?: string | null }>(
        getFirebaseDb(),
        STREAM_CHANNELS,
        channelId,
        {
          next: (doc) => {
            const matchId =
              typeof doc?.match_id === "string" && doc.match_id
                ? doc.match_id
                : null;
            setOnAir((prev) =>
              prev.matchId === matchId
                ? prev
                : { matchId, epoch: prev.epoch + 1 },
            );
          },
        },
        // An OBS source may report itself hidden while it is on air.
        { pauseWhenHiddenMs: null },
      ),
    [channelId],
  );

  useEffect(() => {
    const { matchId, epoch } = onAir;
    if (!matchId) return;
    const controller = new AbortController();
    loadOverlayData(matchId, controller.signal)
      .then((data) => {
        // A match that is gone takes the channel off air.
        if (!controller.signal.aborted) {
          setShown(data ? { matchId, epoch, ...data } : null);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          console.error("[overlay channel] could not load the match:", err);
        }
      });
    return () => controller.abort();
  }, [onAir]);

  // The current match once loaded, or the previous one while switching
  // straight from it; never a match from before an off-air spell.
  if (!onAir.matchId || !shown || shown.epoch < onAir.epoch - 1) return null;
  return (
    <OverlayClient
      key={`${shown.matchId}:${shown.epoch}`}
      matchId={shown.matchId}
      initial={shown.live}
      match={shown.match}
      initialLayout={layout}
      initialTheme={theme}
      initialControls={false}
      initialSponsor={sponsor}
      initialSafeZone={safeZone}
    />
  );
}
