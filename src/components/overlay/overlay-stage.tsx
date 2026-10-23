"use client";

/**
 * Everything the broadcast overlay draws on its 1920x1080 transparent
 * canvas: the score bug (or the graphics-suite view / presentation card
 * the producer put up), lower thirds, event cards, the corner watermark
 * and the ticker. Nothing here is a control: what is drawn goes on air.
 *
 * Rendered by the OBS overlay page and, scaled down, by the control room's
 * preview (positions are `fixed`; inside the preview's transformed canvas
 * that means the canvas, not the window).
 */

import type { Match } from "~/lib/match-types";
import { BroadcastSuiteOverlay } from "./broadcast-suite-overlay";
import { EventStings } from "./event-stings";
import {
  HoldScreen,
  LowerThirdStraps,
  strapHidesScoreBug,
  useHeldState,
} from "./lower-third-straps";
import { OverlayElement } from "./packages/element";
import { OverlayPackageScope } from "./packages/registry";
import { PresentationCards } from "./presentation-cards";
import { overlayPhaseOf } from "./score-bug";
import type { LiveMatchState } from "./types";
import type { OverlayLayers } from "./use-overlay-state";

export {
  inningsLabel,
  overlayPhaseOf,
  sidesOf,
  type OverlayPhase,
} from "./score-bug";

/** `list` starting at item `from` (wrapping round). */
function rotate<T>(list: T[], from: number): T[] {
  if (list.length < 2) return list;
  const at = ((from % list.length) + list.length) % list.length;
  return [...list.slice(at), ...list.slice(0, at)];
}

export interface OverlayStageProps {
  /** Latest score; null while there is none to show. */
  state: LiveMatchState | null;
  match: Match | null;
  layers: OverlayLayers;
  /** The link names no match: a small note instead of a blank source. */
  notFound?: boolean;
  /** 1920x1080 action / title safe guides (setting up only). */
  showSafeZone?: boolean;
  onDismissSting: () => void;
  onDismissStrap: () => void;
  /** A preview (control room, setup): honours prefers-reduced-motion. */
  preview?: boolean;
}

export function OverlayStage({
  state: liveState,
  match,
  layers,
  notFound = false,
  showSafeZone = false,
  onDismissSting,
  onDismissStrap,
  preview = false,
}: OverlayStageProps) {
  const { scene } = layers;
  const hold = layers.hold ?? null;
  // While the score is corrected, graphics keep the score they had.
  const state = useHeldState(liveState, hold !== null);
  const theme = { theme: scene.theme, customColors: scene.customColors };

  if (!state) {
    return (
      <div className="pointer-events-none fixed inset-0 select-none bg-transparent font-sans">
        {notFound && (
          <p className="absolute bottom-6 left-6 rounded-md bg-black/80 px-4 py-2 text-base text-white">
            This overlay link does not match a CricScore match. Copy it again
            from the match page.
          </p>
        )}
      </div>
    );
  }

  // Black and clean holds show nothing but themselves.
  if (hold === "black" || hold === "clean") {
    return (
      <div
        data-hold={hold}
        className="pointer-events-none fixed inset-0 select-none overflow-hidden bg-transparent"
      >
        <HoldScreen mode={hold} {...theme} />
      </div>
    );
  }

  const view = layers.view === undefined ? scene.view : layers.view;
  // A graphics-suite view replaces the bug (and draws its own when it is a
  // lower third); a single-line message stands in for it.
  const suite = view !== null;
  const bugShown =
    scene.showBug && !suite && !strapHidesScoreBug(layers.strap);
  // Lower thirds sit just above the score bug.
  const strapLift = !bugShown
    ? 0
    : scene.layout === "compact"
      ? 60 + scene.marginOffsetPx
      : scene.layout === "top"
        ? 0
        : scene.marginOffsetPx;

  const base = {
    state,
    match,
    snapshots: layers.snapshots ?? null,
    layout: scene.layout,
    ...theme,
  };

  return (
    <OverlayPackageScope
      theme={scene.theme}
      customColors={scene.customColors}
      state={state}
      respectReducedMotion={preview}
    >
      <div
        data-phase={overlayPhaseOf(state)}
        className="pointer-events-none fixed inset-0 select-none overflow-hidden bg-transparent font-sans"
      >
        <EventStings
          sting={layers.sting}
          state={state}
          onDismiss={onDismissSting}
          {...theme}
        />

        <PresentationCards
          card={layers.card}
          state={state}
          match={match}
          {...theme}
        />

        {/* Lifted clear of the score bug: a transformed box is where its
            fixed-position strap is placed. */}
        <div
          className="pointer-events-none fixed inset-0"
          style={{ transform: `translateY(-${strapLift}px)` }}
        >
          <LowerThirdStraps
            strap={layers.strap}
            state={state}
            layout={scene.layout}
            onDismiss={onDismissStrap}
            {...theme}
          />
        </div>

        {/* Only with sponsors to show: the bug already names the event. */}
        <OverlayElement
          // "Next sponsor" starts the rotation over from the next one.
          key={scene.sponsorIndex}
          id="sponsors"
          present={scene.sponsors.length > 0}
          props={{
            ...base,
            sponsors: rotate(scene.sponsors, scene.sponsorIndex),
            title: state.tournament_name ?? state.title,
          }}
        />

        <OverlayElement
          id="ticker"
          present={scene.tickerVisible && !!scene.tickerText.trim()}
          motionKey={scene.tickerText}
          props={{ ...base, text: scene.tickerText }}
        />

        {hold === "card" && <HoldScreen mode="card" {...theme} />}

        {showSafeZone && (
          <div
            className="pointer-events-none fixed inset-0 z-50"
            role="img"
            aria-label="Safe-zone guides: action safe 90 percent, title safe 80 percent"
          >
            <div className="absolute inset-[5%] border border-dashed border-amber-400/60 p-2 text-sm text-amber-300">
              Action safe (90%)
            </div>
            <div className="absolute inset-[10%] border border-dashed border-sky-400/60 p-2 text-sm text-sky-300">
              Title safe (80%)
            </div>
          </div>
        )}

        {scene.showBug && suite && (
          <BroadcastSuiteOverlay
            state={state}
            match={match}
            activeView={view}
            snapshots={layers.snapshots}
            sponsor={scene.sponsor}
            {...theme}
          />
        )}
        <OverlayElement
          id="scoreBug"
          present={bugShown && hold !== "card"}
          motionKey={`${state.total_runs}/${state.total_wickets}`}
          props={{
            ...base,
            sponsor: scene.sponsor,
            marginOffsetPx: scene.marginOffsetPx,
            phase: overlayPhaseOf(state),
          }}
        />
      </div>
    </OverlayPackageScope>
  );
}
