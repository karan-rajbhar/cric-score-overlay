"use client";

/**
 * {@link OverlayElement}: one element of the overlay, drawn by the stage's
 * package (or Standard where the package has none), with the package's
 * motion: an enter transition on mount, an exit before it leaves (it stays
 * mounted until the exit ends), and an update transition whenever its
 * `motionKey` changes while on air.
 */

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { MotionPreferenceContext, playMotion } from "./motion";
import { STANDARD_ELEMENTS } from "./standard";
import type {
  ElementMotion,
  OverlayElementId,
  OverlayElementProps,
  PackageElements,
} from "./types";

export interface OverlayStageContextValue {
  /** Every element's component: the package's over Standard's. */
  elements: PackageElements;
  motion: Partial<Record<OverlayElementId, ElementMotion>>;
}

export const OverlayStageContext = createContext<OverlayStageContextValue>({
  elements: STANDARD_ELEMENTS,
  motion: {},
});

/** Stacking of the canvas's layers when an element animates in its own layer. */
const LAYER: Partial<Record<OverlayElementId, number>> = {
  scoreBug: 20,
  sponsors: 20,
  ticker: 20,
  sting: 50,
};

const DEFAULT_LAYER = 40;

interface OverlayElementArgs<E extends OverlayElementId> {
  id: E;
  /** On air. Off with an exit motion: kept until the exit has played. */
  present: boolean;
  /** Needed while present; the last ones are kept for the exit. */
  props?: OverlayElementProps[E];
  /** A change while on air plays the element's update motion. */
  motionKey?: string | number | null;
}

export function OverlayElement<E extends OverlayElementId>({
  id,
  present,
  props,
  motionKey,
}: OverlayElementArgs<E>) {
  const { elements, motion } = useContext(OverlayStageContext);
  const Comp = elements[id] as ComponentType<OverlayElementProps[E]>;
  const spec = motion[id];
  if (!spec) {
    return present && props ? <Comp {...props} /> : null;
  }
  return (
    <MotionLayer
      id={id}
      Comp={Comp}
      spec={spec}
      present={present}
      props={props}
      motionKey={motionKey ?? null}
    />
  );
}

function MotionLayer<E extends OverlayElementId>({
  id,
  Comp,
  spec,
  present,
  props,
  motionKey,
}: {
  id: E;
  Comp: ComponentType<OverlayElementProps[E]>;
  spec: ElementMotion;
  present: boolean;
  props: OverlayElementProps[E] | undefined;
  motionKey: string | number | null;
}) {
  const { respectReducedMotion } = useContext(MotionPreferenceContext);
  const ref = useRef<HTMLDivElement>(null);
  // Mounted from the moment it is on air until its exit has played.
  const [mounted, setMounted] = useState(present && !!props);
  const [shown, setShown] = useState(props);
  if (present && props && !mounted) setMounted(true);
  if (present && props && props !== shown) setShown(props);

  // Enter on mount (the layout effect: before the first paint).
  useLayoutEffect(() => {
    if (mounted) playMotion(ref.current, spec.enter, respectReducedMotion);
    // Only when it mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Update while on air.
  const lastKey = useRef(motionKey);
  useEffect(() => {
    if (!mounted || !present || lastKey.current === motionKey) return;
    lastKey.current = motionKey;
    playMotion(ref.current, spec.update, respectReducedMotion);
  }, [motionKey, mounted, present, spec.update, respectReducedMotion]);

  // Exit, then unmount.
  useEffect(() => {
    if (present || !mounted) return;
    const anim = playMotion(ref.current, spec.exit, respectReducedMotion);
    if (anim) {
      let done = false;
      anim.onfinish = () => {
        done = true;
        setMounted(false);
      };
      return () => {
        if (!done) anim.cancel();
      };
    }
    const t = setTimeout(() => setMounted(false), 0);
    return () => clearTimeout(t);
  }, [present, mounted, spec.exit, respectReducedMotion]);

  if (!mounted || !shown) return null;
  return (
    <div
      ref={ref}
      data-element={id}
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: LAYER[id] ?? DEFAULT_LAYER }}
    >
      <Comp {...shown} />
    </div>
  );
}
