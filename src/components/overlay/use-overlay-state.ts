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
  CLEARABLE_LAYERS,
  CUE_REPLAY_MS,
  OVERLAY_STATE_COLLECTION,
  parseOverlayState,
  sceneOf,
  strapOnAir,
  type OverlayCleared,
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

type Timer = ReturnType<typeof setTimeout>;

/** What the automatic rules have on air, per layer, over the producer's. */
interface AutoOnAir {
  strap: ActiveLowerThirdStrap | null;
  card: PresentationCardType | null;
  view: BroadcastViewId | null;
}
type AutoLayer = keyof AutoOnAir;
const NO_AUTO: AutoOnAir = { strap: null, card: null, view: null };

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
  /** The match's balls per over (`ballsPerOverOf`), for automatic straps. */
  ballsPerOver?: number;
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
  ballsPerOver = 6,
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
  const ballsPerOverRef = useRef(ballsPerOver);
  useEffect(() => {
    rulesRef.current = rules;
    onReplayRef.current = onReplay;
    ballsPerOverRef.current = ballsPerOver;
  });
  const [auto, setAuto] = useState<AutoOnAir>(NO_AUTO);
  const prevRow = useRef<LiveMatchState | null>(null);
  // Items not yet shown (a new moment replaces them) and, apart from them,
  // the timer that takes each layer's graphic off (replaced only with it).
  const queued = useRef<{ kind: AutoGraphic["kind"]; timer: Timer }[]>([]);
  const hideTimers = useRef<Partial<Record<AutoLayer, Timer>>>({});
  const putOnAir = useCallback(
    <L extends AutoLayer>(layer: L, value: AutoOnAir[L], ms: number) => {
      clearTimeout(hideTimers.current[layer]);
      setAuto((a) => ({ ...a, [layer]: value }));
      hideTimers.current[layer] = setTimeout(
        () => setAuto((a) => ({ ...a, [layer]: null })),
        ms,
      );
    },
    [],
  );
  useEffect(() => {
    if (!state) return;
    const prev = prevRow.current;
    prevRow.current = state;
    const items = autoGraphics(
      prev,
      state,
      rulesRef.current,
      ballsPerOverRef.current,
    );
    if (!items.length) return;
    for (const q of queued.current) clearTimeout(q.timer);
    queued.current = items.map((item) => ({
      kind: item.kind,
      timer: setTimeout(() => {
        if (item.kind === "sting") show(item.sting);
        else if (item.kind === "replay") onReplayRef.current?.(item);
        else if (item.kind === "strap") {
          putOnAir("strap", { ...item.strap, durationMs: -1 }, item.durationMs);
        } else if (item.kind === "card") {
          putOnAir("card", item.card, item.durationMs);
        } else putOnAir("view", item.view, item.durationMs);
      }, item.at),
    }));
  }, [state, show, putOnAir]);
  useEffect(
    () => () => {
      for (const q of queued.current) clearTimeout(q.timer);
      for (const t of Object.values(hideTimers.current)) clearTimeout(t);
    },
    [],
  );

  // Clear, Take off and Back to score bug take off what the overlay put up
  // by itself on that layer too, and what it still had queued there.
  const cleared = doc?.cleared;
  const seenCleared = useRef<OverlayCleared | null>(null);
  useEffect(() => {
    if (!loaded) return;
    const before = seenCleared.current;
    seenCleared.current = cleared ?? {};
    if (!before) return;
    const off = CLEARABLE_LAYERS.filter((l) => cleared?.[l] !== before[l]);
    if (!off.length) return;
    queued.current = queued.current.filter((q) => {
      const drop = (off as readonly string[]).includes(q.kind);
      if (drop) clearTimeout(q.timer);
      return !drop;
    });
    const layers = off.filter((l): l is AutoLayer => l !== "sting");
    for (const l of layers) clearTimeout(hideTimers.current[l]);
    setAuto((a) => ({
      ...a,
      ...Object.fromEntries(layers.map((l) => [l, null])),
    }));
    if (off.includes("sting")) setSting(null);
    // The stamps identify the change; `cleared` is a new object per read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, cleared?.view, cleared?.card, cleared?.strap, cleared?.sting]);

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
    strap: auto.strap ?? (strap ? { ...strap, durationMs: -1 } : null),
    card: auto.card ?? scene.card,
    view: auto.view ?? scene.view,
    snapshots: doc?.snapshots ?? null,
    hold: scene.hold,
    dismissSting: useCallback(() => setSting(null), []),
    dismissStrap: useCallback(() => {
      setStrap(null);
      setDismissedStrap(storedStrap?.id ?? null);
    }, [storedStrap?.id]),
  };
}
