"use client";

import { useEffect, useMemo, useState } from "react";
import { createObsBridge } from "~/components/overlay/obs-bridge";
import {
  useDelayed,
  useFreshMatch,
  useStageMatch,
} from "~/components/overlay/overlay-data";
import { ballsPerOverOf } from "~/components/overlay/overlay-kit";
import { OverlayStage } from "~/components/overlay/overlay-stage";
import type { LiveMatchState } from "~/components/overlay/types";
import {
  useOverlayLayers,
  useOverlayStateDoc,
  type ReplayRequest,
} from "~/components/overlay/use-overlay-state";
import { useLiveState } from "~/lib/hooks/useLiveState";
import type { Match } from "~/lib/match-types";
import type { SceneUrlParams } from "~/lib/overlay-state";

export type { LiveMatchState };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Longest wait for the producer state before drawing from the link alone. */
const STATE_WAIT_MS = 3000;

/** Longest `?delay=` (seconds). */
export const MAX_DELAY_SECONDS = 120;

interface OverlayClientProps {
  matchId: string;
  initial: LiveMatchState | null;
  match?: Match | null;
  /** The link's starting settings (`?theme=&layout=&sponsor=`). */
  params?: SceneUrlParams;
  /** Server clock when the page was rendered (ms). */
  serverNow?: number;
  /** Seconds to hold each score change (`?delay=`), when the video lags. */
  delaySeconds?: number;
  /** Safe-zone guides (`?safe=true`); G toggles them. */
  showSafeZone?: boolean;
  /** The link names no match. */
  notFound?: boolean;
}

/**
 * The OBS browser source: a transparent 1920x1080 page with the match's
 * score and what the control room puts on air. It follows two documents,
 * 1 read each per change: `live_state/{matchId}` (every ball) and
 * `overlay_state/{matchId}` (every producer command), plus the live
 * scorecard only while a scorecard is on screen, and reads the match again
 * when it or a squad changes (`useFreshMatch`). Nothing on it is a
 * control: setting up and producing happen on the match page and in the
 * control room.
 */
export function OverlayClient({
  matchId,
  initial,
  match = null,
  params,
  serverNow,
  delaySeconds = 0,
  showSafeZone: initialSafeZone = false,
  notFound = false,
}: OverlayClientProps) {
  const isRealMatch = UUID_REGEX.test(matchId);

  // Never paused: OBS may report a source on air as hidden.
  const live = useLiveState(matchId, {
    enabled: isRealMatch,
    pauseWhenHidden: false,
  });
  const delayMs = Math.min(Math.max(delaySeconds, 0), MAX_DELAY_SECONDS) * 1000;
  const state = useDelayed<LiveMatchState | null>(
    live.state ?? initial,
    delayMs,
  );

  const producer = useOverlayStateDoc(matchId, isRealMatch);
  // The match read again when it or a squad changes (player of the
  // match, Playing XI, settings such as balls per over).
  const freshMatch = useFreshMatch(matchId, match, live);
  // Replays through OBS (the browser source's API; nothing elsewhere).
  const replayScene = producer.doc?.scene.replayScene;
  const bridge = useMemo(
    () => createObsBridge({ replayScene: replayScene ?? "Replay" }),
    [replayScene],
  );
  useEffect(() => () => bridge.dispose(), [bridge]);
  const layers = useOverlayLayers({
    doc: producer.doc,
    loaded: !isRealMatch || producer.loaded,
    params,
    state,
    serverNow,
    ballsPerOver: ballsPerOverOf(freshMatch),
    onReplay: (item: ReplayRequest) =>
      void bridge.replay({ seconds: item.durationMs / 1000 }),
  });

  // Draw once the producer state is known (no flash of the wrong theme),
  // or after a short wait if it is slow to come.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setWaited(true), STATE_WAIT_MS);
    return () => clearTimeout(id);
  }, []);
  const ready = !isRealMatch || producer.loaded || waited;

  // Scorecards follow the live scorecard while one is on air, held for
  // `?delay=` like the score.
  const currentMatch = useStageMatch(
    matchId,
    freshMatch,
    { view: layers.view, card: layers.card },
    delayMs,
  );

  // Interact (OBS) or keyboard: Escape takes one-off graphics off here, G
  // shows the safe-zone guides for lining the source up.
  const [showSafeZone, setShowSafeZone] = useState(initialSafeZone);
  const { dismissSting, dismissStrap } = layers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismissSting();
        dismissStrap();
      } else if (e.key === "g" || e.key === "G") {
        setShowSafeZone((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissSting, dismissStrap]);

  return (
    <OverlayStage
      state={ready ? state : null}
      match={currentMatch}
      layers={layers}
      notFound={notFound && !state}
      showSafeZone={showSafeZone}
      onDismissSting={dismissSting}
      onDismissStrap={dismissStrap}
    />
  );
}
