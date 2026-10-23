"use client";

/**
 * World event's building blocks: the element root (font, stylesheet,
 * colours, reduced motion in previews), team crests, figures that roll,
 * ball chips, tabs, the full-screen card and the lower-third frame.
 *
 * Canvas: 1920x1080 with a 5% safe inset (96px at the sides, 54px top and
 * bottom). Lower thirds sit at the left safe edge, clear of the score bug.
 */

import {
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "~/lib/utils";
import { useStageStyle } from "../palette-context";
import { AnimatedNumber, MotionPreferenceContext } from "../motion";
import type { LayoutMode, LiveMatchState } from "../../types";
import { monogramOf, overBall, overSlotsLeft } from "../shared/derive";
import { FULL_FRAME, lowerThirdAnchor, SAFE, SAFE_WIDTH } from "../shared/layout";
import { useImageFallback } from "../shared/slots";
import { WORLD_EVENT_CSS } from "./styles";
import { sideVars, worldEventVars } from "./theme";

/** The score bug's height with the tabs above it (bottom layouts). */
export const BUG_HEIGHT = 132;
/** Room for a lower third's own tab above its frame. */
const LOWER_GAP = 34;

/** The stylesheet, hoisted and de-duplicated by React. */
export function WeStyles() {
  return (
    <style href="overlay-world-event" precedence="default">
      {WORLD_EVENT_CSS}
    </style>
  );
}

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribeReduce(fn: () => void) {
  const mq =
    typeof window !== "undefined" ? window.matchMedia?.(REDUCE) : undefined;
  mq?.addEventListener?.("change", fn);
  return () => mq?.removeEventListener?.("change", fn);
}

const reduceNow = () =>
  typeof window !== "undefined" && !!window.matchMedia?.(REDUCE)?.matches;

/** True in a preview that should not animate (reduced motion). */
function useStill(): boolean {
  const { respectReducedMotion } = useContext(MotionPreferenceContext);
  const reduce = useSyncExternalStore(subscribeReduce, reduceNow, () => false);
  return respectReducedMotion && reduce;
}

/**
 * Every element's root: the package's font and stylesheet, its colours
 * (the stage's, or computed for an element drawn on its own) and no
 * entrance animations in a reduced-motion preview.
 */
export function Root({
  state,
  className,
  style,
  children,
  ...rest
}: {
  state: LiveMatchState | null;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style">) {
  const stage = useStageStyle();
  const still = useStill();
  const vars =
    stage ??
    (worldEventVars({ state, theme: "world-event", customColors: null }) as CSSProperties);
  return (
    <div
      {...rest}
      data-we=""
      data-we-still={still ? "" : undefined}
      className={cn("we pointer-events-none fixed select-none", className)}
      style={{ ...vars, ...style }}
    >
      <WeStyles />
      {children}
    </div>
  );
}

/** A team that is neither side of this match (standings, fixtures). */
const NEUTRAL: CSSProperties = {
  ["--we-side" as string]: "#33219a",
  ["--we-side-hi" as string]: "#4b38c0",
  ["--we-side-deep" as string]: "#140a4f",
  ["--we-side-text" as string]: "#ffffff",
  ["--we-side-light" as string]: "#33219a",
  ["--we-side-dark" as string]: "#7d6cf0",
};

/** A side's colour variables for a subtree (null: a neutral tone). */
export const side = (n: 1 | 2 | null): CSSProperties =>
  n === null ? NEUTRAL : (sideVars(n) as CSSProperties);

/** Entrance delay for staggered pieces. */
export const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/** A figure that rolls when it changes. */
export function Fig({
  value,
  className,
}: {
  value: ReactNode;
  className?: string;
}) {
  return <AnimatedNumber value={value} variant="roll" durationMs={380} className={className} />;
}

/** "142-4" (the world feed's runs-wickets) with each part rolling on its own. */
export function ScoreFig({
  runs,
  wickets,
  className,
  slashClassName,
}: {
  runs: number | null | undefined;
  wickets: number | null | undefined;
  className?: string;
  slashClassName?: string;
}) {
  return (
    <span className={cn("we-fig inline-flex items-baseline", className)}>
      <Fig value={runs ?? 0} />
      <span className={cn("px-[0.06em] opacity-80", slashClassName)}>-</span>
      <Fig value={wickets ?? 0} />
    </span>
  );
}

/** A team crest: its logo on white, or its monogram on its colour (a logo that fails to load too). */
export function Crest({
  n,
  logo,
  code,
  name,
  size = 72,
  className,
  style,
}: {
  n: 1 | 2 | null;
  logo?: string | null;
  code: string;
  name?: string | null;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const img = useImageFallback(logo);
  const text = monogramOf(name, code);
  return (
    <span
      aria-hidden="true"
      data-crest=""
      className={cn("we-crest", img.show && "we-crest-logo", className)}
      style={{ ...side(n), width: size, height: size, ...style }}
    >
      {img.show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo!} alt="" onError={img.onError} />
      ) : (
        <span
          className="we-x leading-none"
          style={{ fontSize: Math.max(15, Math.round(size * (text.length > 3 ? 0.24 : 0.3))) }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

/** A chip's text: none for a dot ball (its ring shows it), "2+wd" as "2wd". */
export function ballLabel(token: string): string {
  if (token === "0") return "";
  return token.replace(/^(\d)\+(wd|nb)$/, "$1$2");
}

/** This over's deliveries, then empty slots up to a full over. */
export function Balls({
  tokens,
  slots = 6,
  size = 40,
  stagger = 0,
  className,
}: {
  tokens: readonly string[];
  slots?: number;
  size?: number;
  /** Entrance delay of the first chip (ms); 0 for none. */
  stagger?: number;
  className?: string;
}) {
  const empty = overSlotsLeft(tokens.map(overBall), slots);
  return (
    <ol aria-label="This over" className={cn("flex items-center", className)} style={{ gap: Math.round(size * 0.2) }}>
      {tokens.map((t, i) => (
        <li
          key={i}
          className={cn("we-ball", `we-ball-${overBall(t).kind}`, stagger > 0 && "we-a-pop")}
          style={{
            minWidth: size,
            height: size,
            padding: `0 ${Math.round(size * 0.18)}px`,
            fontSize: Math.round(size * (ballLabel(t).length > 2 ? 0.36 : 0.48)),
            ...(stagger > 0 ? delay(stagger + i * 60) : {}),
          }}
        >
          {ballLabel(t) || <span className="sr-only">dot</span>}
        </li>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <li
          key={`slot-${i}`}
          aria-hidden="true"
          className="we-ball we-ball-slot"
          style={{ width: size, height: size }}
        />
      ))}
    </ol>
  );
}

/** The event tab: a slanted accent label. */
export function Tab({
  children,
  tone = "accent",
  className,
  style,
}: {
  children: ReactNode;
  tone?: "accent" | "night" | "paper" | "gold" | "team" | "mint" | "red";
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn(
        "we-label we-cut-r inline-flex h-[38px] items-center whitespace-nowrap pl-5 pr-9",
        `we-${tone}`,
        className,
      )}
      style={{ ["--we-cut" as string]: "16px", ...style }}
    >
      {children}
    </span>
  );
}

export interface Stat {
  label: string;
  value: ReactNode;
}

/** Labelled figures in a row of cells (lower thirds, cards). */
export function StatCells({
  stats,
  className,
  start = 0,
  dark = true,
}: {
  stats: Stat[];
  className?: string;
  /** Entrance delay of the first cell (ms). */
  start?: number;
  dark?: boolean;
}) {
  return (
    <dl className={cn("flex items-stretch", className)}>
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={cn(
            "we-a-rise flex min-w-0 flex-col justify-center px-6",
            i > 0 && "border-l",
            dark ? "we-hair" : "we-hair-ink",
          )}
          style={delay(start + i * 50)}
        >
          <dt className={cn("we-label leading-none", dark ? "we-muted" : "we-ink-muted")}>{s.label}</dt>
          <dd className="we-fig mt-1.5 text-[30px] leading-none">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Where a lower third sits for the score bug's layout: above the bar, at
 * the bottom of title safe under a top bar, beside the corner card.
 */
export function lowerPlacement(layout: LayoutMode): CSSProperties {
  if (layout === "top") return { left: SAFE.x, bottom: SAFE.y, maxWidth: SAFE_WIDTH };
  if (layout === "compact") return { right: SAFE.x, bottom: SAFE.y, maxWidth: SAFE_WIDTH };
  return lowerThirdAnchor(BUG_HEIGHT, LOWER_GAP);
}

/** A full-screen card, centred in the safe area. */
export function CardFrame({
  state,
  eyebrow,
  title,
  aside,
  crest,
  footer,
  width = 1440,
  bodyClassName,
  children,
  testId,
}: {
  state: LiveMatchState | null;
  eyebrow?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  /** A crest or team mark beside the title. */
  crest?: ReactNode;
  footer?: ReactNode;
  width?: number;
  bodyClassName?: string;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <Root
      state={state}
      data-testid={testId}
      className="flex items-center justify-center"
      style={FULL_FRAME}
    >
      <section className="we-lift relative w-full" style={{ maxWidth: width }}>
        {eyebrow && (
          <div className="absolute -top-[38px] left-0 z-10">
            <Tab className="we-a-drop" style={delay(260)}>
              {eyebrow}
            </Tab>
          </div>
        )}
        <header className="we-night we-a-wipe-r flex min-h-[120px] items-center gap-6 px-10 py-5">
          {crest}
          <h2 className="we-x we-trunc min-w-0 flex-1 text-[50px] leading-[1.05]">{title}</h2>
          {aside && <div className="shrink-0 text-right">{aside}</div>}
        </header>
        <div className="we-accent we-a-grow-x h-[6px]" style={delay(200)} />
        {children && (
          <div
            className={cn("we-paper we-on-paper we-a-wipe-down px-10 py-6", bodyClassName)}
            style={delay(160)}
          >
            {children}
          </div>
        )}
        {footer && (
          <footer className="we-night2 we-a-fade flex min-h-[56px] items-center gap-8 px-10 py-3 text-[22px]" style={delay(420)}>
            {footer}
          </footer>
        )}
      </section>
    </Root>
  );
}

/** The lower-third frame: placed for the layout, wiping in from its edge. */
export function LowerFrame({
  state,
  layout,
  width = 1180,
  children,
  testId,
  className,
}: {
  state: LiveMatchState | null;
  layout: LayoutMode;
  width?: number;
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <Root
      state={state}
      data-testid={testId}
      className={cn("flex flex-col items-start", className)}
      style={{ ...lowerPlacement(layout), width }}
    >
      {children}
    </Root>
  );
}

/**
 * Which of `count` items is up, moving on every `ms` (the score bug's
 * rotating context line). Always 0 with one item or none.
 */
export function useRotation(count: number, ms = 7000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [count, ms]);
  return count > 0 ? tick % count : 0;
}

/**
 * A start time in the viewer's zone ("7:30 pm", or "Sat 1 Nov, 9:30 am"
 * on another day), formatted after hydration (the server has no zone).
 */
export function useLocalTime(iso: string | null | undefined): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!iso) return;
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return;
    const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const value =
      at.toDateString() === new Date().toDateString()
        ? time
        : `${at.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
    // A timer, not a synchronous set: keeps the effect free of cascades.
    const id = setTimeout(() => setText(value), 0);
    return () => clearTimeout(id);
  }, [iso]);
  return text;
}
