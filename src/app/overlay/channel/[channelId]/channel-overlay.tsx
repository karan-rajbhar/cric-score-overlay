"use client";

import { useEffect, useState } from "react";
import { getFirebaseDb } from "~/lib/firebase/client";
import { watchDoc } from "~/lib/firebase/realtime";
import {
  loadOverlayData,
  type OverlayData,
} from "~/components/overlay/overlay-data";
import { OverlayClient } from "../../[matchId]/overlay-client";

/** Mirrors `STREAM_CHANNELS` in `~/lib/overlay/channels` (server). */
const STREAM_CHANNELS = "stream_channels";

/** Wait before trying a failed load again: 2 s, doubling, at most 30 s. */
const retryDelay = (attempt: number) => Math.min(30_000, 2_000 * 2 ** attempt);

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
 * The overlay data of the channel's match, loaded on each switch; a failed
 * load is tried again, and whatever was loaded before stays meanwhile.
 */
function useLoadedMatch(onAir: OnAir): Shown | null {
  const [shown, setShown] = useState<Shown | null>(null);
  useEffect(() => {
    const { matchId, epoch } = onAir;
    if (!matchId) return;
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = (attempt: number) => {
      loadOverlayData(matchId, controller.signal)
        .then((data) => {
          // A match that is gone takes the channel off air.
          if (!controller.signal.aborted) {
            setShown(data ? { matchId, epoch, ...data } : null);
          }
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          console.error("[overlay channel] could not load the match:", err);
          retry = setTimeout(() => load(attempt + 1), retryDelay(attempt));
        });
    };
    load(0);
    return () => {
      controller.abort();
      clearTimeout(retry);
    };
  }, [onAir]);
  return shown;
}

/**
 * Follows `stream_channels/{channelId}` (1 read, then 1 per switch) and
 * shows the match overlay (`OverlayClient`: `live_state`, 1 read per ball,
 * and `overlay_state`) for its match. A switch keeps the previous match on
 * air until the next one has loaded (a failed load is tried again, from
 * 2 s up to every 30 s), then swaps without a reload; off air (or a
 * missing channel / match) renders nothing.
 */
export function ChannelOverlay({
  channelId,
  layout,
  theme,
  sponsor,
  safeZone = false,
  delaySeconds = 0,
}: {
  channelId: string;
  layout?: string;
  theme?: string;
  sponsor?: string;
  safeZone?: boolean;
  /** `?delay=`: seconds to hold each score change. */
  delaySeconds?: number;
}) {
  const [onAir, setOnAir] = useState<OnAir>({ matchId: null, epoch: 0 });

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

  const shown = useLoadedMatch(onAir);

  // The current match once loaded, or the previous one while switching
  // straight from it; never a match from before an off-air spell.
  if (!onAir.matchId || !shown || shown.epoch < onAir.epoch - 1) return null;
  return (
    <OverlayClient
      key={`${shown.matchId}:${shown.epoch}`}
      matchId={shown.matchId}
      initial={shown.live}
      match={shown.match}
      params={{ layout, theme, sponsor }}
      serverNow={shown.serverNow}
      delaySeconds={delaySeconds}
      showSafeZone={safeZone}
    />
  );
}
