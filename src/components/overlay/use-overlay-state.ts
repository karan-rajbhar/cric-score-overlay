"use client";

/**
 * The overlay's producer state on the client:
 *
 * - {@link useOverlayStateDoc}: one listener on `overlay_state/{matchId}`
 *   (1 read on load, 1 per producer command), never paused (OBS may report
 *   a source on air as hidden).
 * - {@link useOverlayLayers}: what that state and the live score put on
 *   air besides the score: the scene, the lower third, the event card and
 *   any automatic card or view (`autoGraphics` on each new live row, under
 *   the automatic rules), plus replays for the OBS bridge.
 *
 * The OBS overlay and the control room's preview both use them, so the
 * preview shows what the overlay received, not what the producer clicked.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getFirebaseDb } from "~/lib/firebase/client";
import { watchDoc, type DocWatchStatus } from "~/lib/firebase/realtime";
import {
  autoRulesIn,
  CUE_REPLAY_MS,
  OVERLAY_STATE_COLLECTION,
  parseOverlayState,
  sceneOf,
  strapOnAir,
  type OverlayScene,
  type OverlayStateDoc,
  type SceneUrlParams,
} from "~/lib/overlay-state";
import { autoGraphics, type AutoGraphic } from "./auto-graphics";
import { playStingSound, stingFor } from "./stings";
import type {
  ActiveEventSting,
  ActiveLowerThirdStrap,
  BroadcastViewId,
  LiveMatchState,
  OverlaySnapshots,
  PresentationCardType,
} from "./types";
import type { HoldMode } from "~/lib/overlay-state";

export interface OverlayStateSnapshot {
  doc: OverlayStateDoc | null;
  /** The first snapshot has arrived (the doc may still be missing). */
  loaded: boolean;
  status: DocWatchStatus | "idle";
}

const IDLE: OverlayStateSnapshot = { doc: null, loaded: false, status: "idle" };

/** Follow `overlay_state/{matchId}`; `enabled: false` attaches nothing. */
export function useOverlayStateDoc(
  matchId: string,
  enabled: boolean,
): OverlayStateSnapshot {
  const [snap, setSnap] = useState<OverlayStateSnapshot>(IDLE);
  useEffect(() => {
    if (!enabled) return;
    return watchDoc<Record<string, unknown>>(
      getFirebaseDb(),
      OVERLAY_STATE_COLLECTION,
      matchId,
      {
        next: (data) =>
          setSnap((s) => ({
            ...s,
            doc: parseOverlayState(data),
            loaded: true,
          })),
        status: (status) => setSnap((s) => ({ ...s, status })),
      },
      { pauseWhenHiddenMs: null },
    );
  }, [matchId, enabled]);
  return enabled ? snap : IDLE;
}

export interface OverlayLayers {
  scene: OverlayScene;
  sting: ActiveEventSting | null;
  strap: ActiveLowerThirdStrap | null;
  card: PresentationCardType;
  /** The suite view on air (an automatic one over the producer's); null: the score bug. */
  view?: BroadcastViewId | null;
  /** Data the control room sent for the standings / leaders cards. */
  snapshots?: OverlaySnapshots | null;
  /** Holding while the score is corrected. */
  hold?: HoldMode | null;
}

/** A replay the automatic rules ask for (`obs-bridge.ts` plays it). */
export type ReplayRequest = Extract<AutoGraphic, { kind: "replay" }>;

export interface OverlayLayersOptions {
  doc: OverlayStateDoc | null;
  /** Whether `doc` is the stored state yet (false before the first read). */
  loaded?: boolean;
  /** The link's starting settings (`?theme=&layout=&sponsor=`). */
  params?: SceneUrlParams;
  /** Latest score: event-card wording and automatic cards. */
  state: LiveMatchState | null;
  /**
   * Server clock (ms) when the page was rendered, so a lower third or
   * event card stored with the server's time is judged against it.
   */
  serverNow?: number;
  /** Never play sounds (previews). */
  muted?: boolean;
  /** Replays the automatic rules ask for (the OBS overlay only). */
  onReplay?: (item: ReplayRequest) => void;
}

export interface OverlayLayersResult extends OverlayLayers {
  dismissSting: () => void;
  dismissStrap: () => void;
}

export function useOverlayLayers({
  doc,
  loaded = true,
  params = {},
  state,
  serverNow,
  muted = false,
  onReplay,
}: OverlayLayersOptions): OverlayLayersResult {
  const scene = sceneOf(params, doc?.scene);
  const [sting, setSting] = useState<ActiveEventSting | null>(null);

  // Server time minus this device's, estimated once (a later estimate
  // would include the time since rendering).
  const offset = useRef<number | null>(null);
  const serverTime = useCallback(() => {
    offset.current ??= serverNow !== undefined ? serverNow - Date.now() : 0;
    return Date.now() + offset.current;
  }, [serverNow]);

  const latest = useRef({ scene, muted });
  useEffect(() => {
    latest.current = { scene, muted };
  });
  const show = useCallback((next: ActiveEventSting) => {
    const { scene: s, muted: m } = latest.current;
    if (s.sound && !m) playStingSound(next.type, s.volume);
    setSting(next);
  }, []);

  // The producer's event card: each cue once; one already in the stored
  // state when the overlay loads only if it is a few seconds old.
  const seenCue = useRef<string | null | undefined>(undefined);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const cue = doc?.cue ?? null;
  useEffect(() => {
    if (!loaded) return;
    const first = seenCue.current === undefined;
    const id = cue?.id ?? null;
    if (id === seenCue.current) return;
    seenCue.current = id;
    if (!cue) return;
    if (first && serverTime() - cue.at > CUE_REPLAY_MS) return;
    show(stingFor(cue.kind, stateRef.current, cue.id));
  }, [loaded, cue, serverTime, show]);

  // Automatic graphics for each new live row (never the first snapshot:
  // `autoGraphics` treats it as history; an undo or edit has no events).
  const rules = autoRulesIn(doc);
  const rulesRef = useRef(rules);
  const onReplayRef = useRef(onReplay);
  useEffect(() => {
    rulesRef.current = rules;
    onReplayRef.current = onReplay;
  });
  const [autoStrap, setAutoStrap] = useState<ActiveLowerThirdStrap | null>(
    null,
  );
  const [autoCard, setAutoCard] = useState<PresentationCardType | null>(null);
  const [autoView, setAutoView] = useState<BroadcastViewId | null>(null);
  const prevRow = useRef<LiveMatchState | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!state) return;
    const prev = prevRow.current;
    prevRow.current = state;
    const items = autoGraphics(prev, state, rulesRef.current);
    if (!items.length) return;
    // A new moment replaces whatever the last one still had queued.
    for (const t of pending.current) clearTimeout(t);
    pending.current = [];
    const later = (ms: number, fn: () => void) =>
      pending.current.push(setTimeout(fn, ms));
    for (const item of items) {
      later(item.at, () => {
        if (item.kind === "sting") show(item.sting);
        else if (item.kind === "replay") onReplayRef.current?.(item);
        else if (item.kind === "strap") {
          setAutoStrap({ ...item.strap, durationMs: -1 });
          later(item.durationMs, () => setAutoStrap(null));
        } else if (item.kind === "card") {
          setAutoCard(item.card);
          later(item.durationMs, () => setAutoCard(null));
        } else {
          setAutoView(item.view);
          later(item.durationMs, () => setAutoView(null));
        }
      });
    }
  }, [state, show]);
  useEffect(
    () => () => {
      for (const t of pending.current) clearTimeout(t);
    },
    [],
  );

  // The lower third: on air until its time is up or it is taken off here.
  const storedStrap = doc?.strap ?? null;
  const [dismissedStrap, setDismissedStrap] = useState<string | null>(null);
  const [strap, setStrap] = useState<ActiveLowerThirdStrap | null>(null);
  useEffect(() => {
    const onAir = strapOnAir(doc, serverTime());
    const visible = onAir && onAir.id !== dismissedStrap ? onAir : null;
    // Deferred: keeps the effect free of synchronous cascades.
    const set = setTimeout(() => setStrap(visible), 0);
    if (!visible) return () => clearTimeout(set);
    const duration = visible.durationMs ?? 8000;
    if (duration <= 0) return () => clearTimeout(set);
    const left = Math.max(0, visible.at + duration - serverTime());
    const clear = setTimeout(() => setStrap(null), left);
    return () => {
      clearTimeout(set);
      clearTimeout(clear);
    };
    // storedStrap identifies the strap; doc changes with every command.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedStrap?.id, storedStrap?.at, dismissedStrap, serverTime]);

  return {
    scene,
    sting,
    // The strap shown keeps its stored timing out of the component's way;
    // an automatic one goes over the producer's while it lasts.
    strap: autoStrap ?? (strap ? { ...strap, durationMs: -1 } : null),
    card: autoCard ?? scene.card,
    view: autoView ?? scene.view,
    snapshots: doc?.snapshots ?? null,
    hold: scene.hold,
    dismissSting: useCallback(() => setSting(null), []),
    dismissStrap: useCallback(() => {
      setStrap(null);
      setDismissedStrap(storedStrap?.id ?? null);
    }, [storedStrap?.id]),
  };
}
