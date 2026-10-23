"use client";

/**
 * The lower third on air: which package element draws it (by strap type),
 * and its timer. Also the hold screen and the held-score hook.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { winPredictorFromLive } from "~/lib/win-predictor";
import { OV, OverlayFrame, type OverlayThemeProps } from "./overlay-kit";
import { OverlayElement } from "./packages/element";
import type { BreakKind, OverlayElementId } from "./packages/types";
import { strapAvailable, strapText } from "./strap-views";
import type {
  ActiveLowerThirdStrap,
  LayoutMode,
  LiveMatchState,
  LowerThirdStrapType,
} from "./types";

export { strapAvailable, strapText };

interface LowerThirdStrapsProps extends OverlayThemeProps {
  strap: ActiveLowerThirdStrap | null;
  state: LiveMatchState;
  /** The stage's match (squads with photos, balls per over); no extra read. */
  match?: Match | null;
  layout: LayoutMode;
  onDismiss: () => void;
}

const BREAKS: Partial<Record<LowerThirdStrapType, BreakKind>> = {
  drinks: "drinks",
  rain_delay: "rain_delay",
  timeout: "timeout",
  innings_break: "innings_break",
  powerplay: "powerplay",
};

/** The package element that draws a strap type. */
export function strapElementOf(
  strap: ActiveLowerThirdStrap,
  state: LiveMatchState,
): OverlayElementId {
  switch (strap.type) {
    case "batsman":
    case "last_wicket":
      return "batterLowerThird";
    case "bowler":
      return "bowlerLowerThird";
    case "new_batter":
      return "newBatter";
    case "new_bowler":
      return "newBowler";
    case "partnership":
      return "partnership";
    case "target":
      return "chase";
    case "over_end":
      return "thisOver";
    case "win_predictor":
      return winPredictorFromLive(state)?.kind === "projection"
        ? "projectedScore"
        : "winPredictor";
    default:
      return BREAKS[strap.type] ? "breakStrap" : "message";
  }
}

/** The element's props for a strap (`layout` and the rest come from the stage). */
function strapProps(strap: ActiveLowerThirdStrap) {
  return {
    strap,
    slot: strap.type === "last_wicket" ? ("last_out" as const) : ("striker" as const),
    variant: "strap" as const,
    kind: BREAKS[strap.type] ?? ("drinks" as BreakKind),
  };
}

/**
 * A "single" message replaces the score bar while it is up. Wiring
 * (overlay-client): `showBug && !strapHidesScoreBug(activeStrap)`.
 */
export function strapHidesScoreBug(
  strap: ActiveLowerThirdStrap | null,
): boolean {
  return strap?.type === "message" && strap.form === "single";
}

function useAutoDismiss(
  strap: ActiveLowerThirdStrap | null,
  onDismiss: () => void,
) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });
  const strapId = strap?.id;
  const isInfinite = strap?.durationMs === -1 || strap?.durationMs === 0;
  const duration =
    strap?.durationMs && strap.durationMs > 0 ? strap.durationMs : 8000;
  useEffect(() => {
    if (!strapId || isInfinite) return;
    const timer = setTimeout(() => onDismissRef.current(), duration);
    return () => clearTimeout(timer);
  }, [strapId, duration, isInfinite]);
}

const STRAP_ELEMENTS: readonly OverlayElementId[] = [
  "batterLowerThird",
  "bowlerLowerThird",
  "newBatter",
  "newBowler",
  "partnership",
  "chase",
  "thisOver",
  "winPredictor",
  "projectedScore",
  "breakStrap",
  "message",
];

export function LowerThirdStraps({
  strap,
  state,
  match = null,
  layout,
  onDismiss,
  theme = "standard",
  customColors = null,
}: LowerThirdStrapsProps) {
  useAutoDismiss(strap, onDismiss);
  const shown = strap && strap.type !== "none" ? strap : null;
  const element = shown ? strapElementOf(shown, state) : null;
  const base = { state, match, snapshots: null, theme, customColors, layout };
  return (
    <>
      {STRAP_ELEMENTS.map((id) => (
        <OverlayElement
          key={id}
          id={id}
          present={element === id}
          motionKey={shown?.id}
          props={
            element === id && shown
              ? ({ ...base, ...strapProps(shown) } as never)
              : undefined
          }
        />
      ))}
    </>
  );
}

// ---- holding the overlay during a correction -------------------------------

export type HoldMode = "black" | "clean" | "card";

/**
 * While a scorer corrects the score (NV Play's holding options): "black"
 * covers the picture, "clean" shows no graphics, "card" shows a holding
 * card over the picture. Wiring (overlay-client): render `<HoldScreen>`
 * when `overlay_state.hold` is set and skip every other graphic for
 * "black" / "clean"; pass graphics `useHeldState(state, hold)` so the
 * score stays as it was until the hold ends.
 */
export function HoldScreen({
  mode,
  message = "Score being updated",
  theme,
  customColors,
}: OverlayThemeProps & { mode: HoldMode | null; message?: string }) {
  if (!mode || mode === "clean") return null;
  if (mode === "black") {
    return (
      <div
        aria-label="Holding"
        className="pointer-events-none fixed inset-0 z-[60] bg-black"
      />
    );
  }
  return (
    <OverlayFrame
      state={null}
      theme={theme}
      customColors={customColors}
      className="pointer-events-none fixed inset-x-0 bottom-[40px] z-[60] flex justify-center px-12"
    >
      <div
        className={cn(
          "flex h-[5.5rem] w-full max-w-[110rem] items-center rounded-lg px-8 text-[2rem] font-semibold",
          OV.bar,
          OV.shadow,
        )}
      >
        {message}
      </div>
    </OverlayFrame>
  );
}

/** The live row frozen while `held` (graphics keep showing the old score). */
export function useHeldState<T>(state: T, held: boolean): T {
  const [frozen, setFrozen] = useState<T>(state);
  if (!held && frozen !== state) setFrozen(state);
  return held ? frozen : state;
}

/** Strap types the producer can pick, with labels (control room). */
export const STRAP_OPTIONS: Array<{ type: LowerThirdStrapType; label: ReactNode }> = [
  { type: "batsman", label: "Striker" },
  { type: "bowler", label: "Bowler" },
  { type: "partnership", label: "Partnership" },
  { type: "target", label: "Chase" },
  { type: "last_wicket", label: "Last wicket" },
  { type: "powerplay", label: "Powerplay" },
  { type: "win_predictor", label: "Win predictor" },
  { type: "commentary", label: "Commentary" },
  { type: "drinks", label: "Drinks" },
  { type: "timeout", label: "Timeout" },
  { type: "rain_delay", label: "Rain" },
  { type: "innings_break", label: "Innings break" },
];
