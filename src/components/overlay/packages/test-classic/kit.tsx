"use client";

/**
 * The Test classic package's building blocks: the palette (navy, ivory,
 * gold leaf, claret, varnished wood), the panels (bevelled navy bars,
 * ivory cards, gold rules), the crest roundel, figures, the "this over"
 * tray and the full-screen card shell. Every element sits in a
 * {@link TcRoot}, which brings the fonts and the motion keyframes.
 *
 * Grid: the 1920x1080 canvas with a 5% title-safe inset (96px at the
 * sides, 54px top and bottom); one corner radius (4px) and a 4px spacing
 * step throughout.
 */

import {
  useContext,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "~/lib/utils";
import { MotionPreferenceContext } from "../motion";
import { CrestSlot, overSlotsLeft, type DeliveryKind, type OverBall } from "../shared";
import { SAFE } from "../shared/layout";

export { SAFE };

// ---- palette -------------------------------------------------------------

/** The package's colours (also its CSS variables, see `index.tsx`). */
export const TC = {
  navyHi: "#1d3964",
  navy: "#10254a",
  navyLo: "#0a1a35",
  navyDeep: "#06122a",
  ivoryHi: "#fdf9ef",
  ivory: "#f3ecda",
  ivoryLo: "#e9dfc6",
  ivoryLine: "#d3c5a1",
  ink: "#13203b",
  inkMuted: "#5a5140",
  gold: "#c9a24c",
  goldText: "#e6ca80",
  goldDeep: "#725519",
  claret: "#8f1e2d",
  claretHi: "#a8283a",
  forest: "#1f5a3d",
  wood: "#3b2416",
  woodLo: "#21130a",
} as const;

/** Gold leaf: a metallic band for rules, frames and the sheen. */
export const GOLD_LEAF =
  "linear-gradient(90deg, #8a6a28 0%, #d6b462 16%, #f4e3a8 30%, #c39a44 50%, #9b7731 68%, #e2c67c 86%, #a8843a 100%)";

/** Gold leaf for lettering (vertical: lit from above). */
export const GOLD_TYPE =
  "linear-gradient(180deg, #f7e7b0 0%, #e2c47a 45%, #c49c48 70%, #e9d08e 100%)";

export const RADIUS = 4;

/** The drop under every panel: deep and soft, like a set piece. */
export const DROP =
  "0 16px 40px rgba(3, 9, 22, 0.45), 0 4px 10px rgba(3, 9, 22, 0.32)";

/** The same drop as a filter (for shapes built from several panels). */
export const DROP_FILTER =
  "drop-shadow(0 12px 22px rgba(3, 9, 22, 0.42)) drop-shadow(0 3px 5px rgba(3, 9, 22, 0.3))";

/** A bevelled navy bar (lit from above, a dark lower lip). */
export const NAVY: CSSProperties = {
  background: `linear-gradient(180deg, ${TC.navyHi} 0%, ${TC.navy} 46%, ${TC.navyLo} 100%)`,
  boxShadow:
    "inset 0 1px 0 rgba(255, 255, 255, 0.16), inset 0 -2px 0 rgba(0, 0, 0, 0.32)",
  color: TC.ivory,
};

/** The deeper navy for wells and second tiers. */
export const NAVY_DEEP: CSSProperties = {
  background: `linear-gradient(180deg, ${TC.navyLo} 0%, ${TC.navyDeep} 100%)`,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
  color: TC.ivory,
};

/** An ivory panel: card bodies and the context strip. */
export const IVORY: CSSProperties = {
  background: `linear-gradient(180deg, ${TC.ivoryHi} 0%, ${TC.ivory} 62%, ${TC.ivoryLo} 100%)`,
  boxShadow:
    "inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(110, 90, 50, 0.22)",
  color: TC.ink,
};

/** Varnished wood for the honours board. */
export const WOOD: CSSProperties = {
  backgroundColor: TC.wood,
  backgroundImage: [
    "repeating-linear-gradient(92deg, rgba(255,235,200,0.035) 0 2px, transparent 2px 9px)",
    "repeating-linear-gradient(88deg, rgba(0,0,0,0.12) 0 1px, transparent 1px 23px)",
    `linear-gradient(180deg, #4a2e1c 0%, ${TC.wood} 40%, ${TC.woodLo} 100%)`,
  ].join(", "),
  boxShadow:
    "inset 0 1px 0 rgba(255, 230, 190, 0.18), inset 0 -3px 0 rgba(0, 0, 0, 0.4)",
  color: TC.goldText,
};

/** The package's faces (set on the stage root from `fonts.ts`), with fallbacks. */
export const SERIF = 'var(--pkg-font-display, Baskerville, Georgia, serif)';
export const SANS = 'var(--pkg-font-text, "Arial Narrow", sans-serif)';

/** Lining, tabular figures. */
export const FIGS: CSSProperties = {
  fontVariantNumeric: "lining-nums tabular-nums",
};


// ---- motion ----------------------------------------------------------------

const EASE = "cubic-bezier(0.22, 0.8, 0.2, 1)";

/**
 * The keyframes behind the `tc-a-*` classes: wipes, rises, the gold rule
 * drawing from the left, the sheen across gold, bars growing. Delays come
 * from `--tc-d` (staggered reveals). A preview with reduced motion turns
 * them off; the OBS output always plays them.
 */
const KEYFRAMES = `
@keyframes tc-wipe { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes tc-wipe-c { from { clip-path: inset(0 50% 0 50%); } to { clip-path: inset(0 0 0 0); } }
@keyframes tc-wipe-up { from { clip-path: inset(100% 0 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes tc-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes tc-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes tc-rule { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes tc-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes tc-grow-y { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes tc-ball { from { opacity: 0; transform: scale(0.55); } to { opacity: 1; transform: none; } }
@keyframes tc-sheen { 0% { transform: translateX(-130%) skewX(-18deg); opacity: 1; } 92% { opacity: 1; } 100% { transform: translateX(340%) skewX(-18deg); opacity: 0; } }
@keyframes tc-track { from { opacity: 0; letter-spacing: 0.6em; } to { opacity: 1; letter-spacing: var(--tc-track, 0.16em); } }
@keyframes tc-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes tc-crawl { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.tc-a-crawl { animation: tc-crawl var(--tc-crawl, 40s) linear infinite; animation-delay: var(--tc-d, 0ms); }
.tc-a-wipe { animation: tc-wipe 620ms ${EASE} both; animation-delay: var(--tc-d, 0ms); }
.tc-a-wipe-c { animation: tc-wipe-c 560ms ${EASE} both; animation-delay: var(--tc-d, 0ms); }
.tc-a-wipe-up { animation: tc-wipe-up 480ms ${EASE} both; animation-delay: var(--tc-d, 0ms); }
.tc-a-rise { animation: tc-rise 480ms ${EASE} both; animation-delay: var(--tc-d, 0ms); }
.tc-a-fade { animation: tc-fade 420ms ease-out both; animation-delay: var(--tc-d, 0ms); }
.tc-a-rule { transform-origin: left center; animation: tc-rule 700ms ${EASE} both; animation-delay: var(--tc-d, 0ms); }
.tc-a-rule-c { transform-origin: center; animation: tc-rule 700ms ${EASE} both; animation-delay: var(--tc-d, 0ms); }
.tc-a-grow { transform-origin: left center; animation: tc-grow 700ms ${EASE} both; animation-delay: var(--tc-d, 0ms); }
.tc-a-grow-r { transform-origin: right center; animation: tc-grow 700ms ${EASE} both; animation-delay: var(--tc-d, 0ms); }
.tc-a-grow-y { transform-origin: center bottom; animation: tc-grow-y 620ms ${EASE} both; animation-delay: var(--tc-d, 0ms); }
.tc-a-ball { animation: tc-ball 360ms ${EASE} both; animation-delay: var(--tc-d, 0ms); }
.tc-a-sheen { animation: tc-sheen 1300ms cubic-bezier(0.45, 0, 0.25, 1) both; animation-delay: var(--tc-d, 0ms); }
.tc-a-track { animation: tc-track 760ms ${EASE} both; animation-delay: var(--tc-d, 0ms); }
.tc-a-draw { stroke-dasharray: 1; animation: tc-draw 1100ms ${EASE} both; animation-delay: var(--tc-d, 0ms); }
@media (prefers-reduced-motion: reduce) {
  [data-tc-preview] [class*="tc-a-"] { animation: none !important; }
}
`;

/** `--tc-d` for a staggered reveal. */
export const delay = (ms: number): CSSProperties =>
  ({ "--tc-d": `${ms}ms` }) as CSSProperties;

/**
 * The root of every Test classic element: fonts, keyframes and the
 * preview's motion preference. Positions belong to the children (fixed,
 * on the canvas).
 */
export function TcRoot({
  children,
  className,
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const { respectReducedMotion } = useContext(MotionPreferenceContext);
  return (
    <div
      {...rest}
      data-tc-root=""
      data-tc-preview={respectReducedMotion ? "" : undefined}
      className={cn("pointer-events-none select-none", className)}
      style={{ fontFamily: SANS, ...style }}
    >
      <style href="tc-keyframes" precedence="tc">
        {KEYFRAMES}
      </style>
      {children}
    </div>
  );
}

// ---- local time ----------------------------------------------------------

/** Local time of an ISO date on the client (null on the server: no zone). */
export function useLocalStart(iso: string | null | undefined): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => startText(iso),
    () => null,
  );
}
const noopSubscribe = () => () => {};

export function startText(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return at.toDateString() === new Date().toDateString()
    ? time
    : `${at.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

// ---- pieces ----------------------------------------------------------------

/** A gold-leaf rule, drawn in from the left (or centre). */
export function GoldRule({
  height = 3,
  className,
  style,
  from = "left",
  d = 0,
  sheen = false,
}: {
  height?: number;
  className?: string;
  style?: CSSProperties;
  from?: "left" | "centre";
  d?: number;
  sheen?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden",
        from === "left" ? "tc-a-rule" : "tc-a-rule-c",
        className,
      )}
      style={{ height, background: GOLD_LEAF, ...delay(d), ...style }}
    >
      {sheen && <Sheen d={d + 500} />}
    </div>
  );
}

/** A band of light crossing a gold or lit surface once. */
export function Sheen({ d = 0, opacity = 0.75 }: { d?: number; opacity?: number }) {
  return (
    <span
      aria-hidden="true"
      className="tc-a-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3"
      style={{
        background: `linear-gradient(90deg, transparent 0%, rgba(255, 248, 225, ${opacity}) 50%, transparent 100%)`,
        ...delay(d),
      }}
    />
  );
}

/** A small tracked label in the condensed sans ("PARTNERSHIP"). */
export function Label({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap text-[1.0625rem] font-semibold uppercase leading-none tracking-[0.15em]",
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

/** A figure in the serif, lining and tabular. */
export function Fig({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn("font-bold leading-none", className)}
      style={{ fontFamily: SERIF, ...FIGS, ...style }}
    >
      {children}
    </span>
  );
}

/**
 * A team's crest in a gold-ringed roundel: the match's own logo, else a
 * monogram in the serif (the shared crest slot's fallback).
 */
export function Crest({
  logoUrl,
  code,
  name,
  size = 48,
  colour,
}: {
  logoUrl?: string | null;
  code?: string | null;
  name?: string | null;
  size?: number;
  /** The team colour, as the roundel's field. */
  colour?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        padding: 2,
        background: GOLD_LEAF,
        boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
      }}
    >
      <CrestSlot
        logo={logoUrl}
        name={name}
        code={code || (name ?? "").slice(0, 3).toUpperCase()}
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
        style={{
          background: logoUrl
            ? TC.ivoryHi
            : `radial-gradient(circle at 35% 30%, ${colour ?? TC.navyHi} 0%, ${TC.navyLo} 100%)`,
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.35)",
        }}
        imgClassName="h-[78%] w-[78%] object-contain"
        textClassName="font-bold leading-none"
        textStyle={{
          fontFamily: SERIF,
          color: TC.ivoryHi,
          fontSize: Math.round(size * 0.34),
          letterSpacing: "0.02em",
        }}
      />
    </span>
  );
}

const BALL_STYLE: Record<DeliveryKind, CSSProperties> = {
  dot: {
    background: "rgba(243, 236, 218, 0.14)",
    color: TC.ivory,
    boxShadow: "inset 0 0 0 1.5px rgba(243, 236, 218, 0.55)",
  },
  run: {
    background: `linear-gradient(180deg, ${TC.ivoryHi}, ${TC.ivoryLo})`,
    color: TC.ink,
  },
  four: {
    background: "linear-gradient(180deg, #2c7550, #1a4a32)",
    color: "#ffffff",
    boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.35)",
  },
  six: {
    background: GOLD_TYPE,
    color: TC.ink,
  },
  wicket: {
    background: `linear-gradient(180deg, ${TC.claretHi}, #6d1622)`,
    color: "#ffffff",
    boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.3)",
  },
  extra: {
    background: "rgba(243, 236, 218, 0.92)",
    color: TC.claret,
  },
  event: {
    background: "transparent",
    color: TC.ivory,
    boxShadow: "inset 0 0 0 1.5px rgba(243, 236, 218, 0.4)",
  },
};

/**
 * This over's deliveries as roundels: dots as a quiet ring, fours in
 * green, sixes in gold, wickets in claret, extras and events named.
 * Empty slots for the legal balls still to come as faint rings. A new
 * ball drops in.
 */
export function BallTray({
  balls,
  ballsPerOver = 6,
  size = 34,
  className,
  light = false,
}: {
  balls: readonly OverBall[];
  ballsPerOver?: number;
  size?: number;
  className?: string;
  /** On an ivory ground: dots, runs, extras and empty slots in ink. */
  light?: boolean;
}) {
  const empty = overSlotsLeft(balls, ballsPerOver);
  return (
    <ol aria-label="This over" className={cn("flex items-center gap-2", className)}>
      {balls.map((b, i) => {
        const label = b.kind === "dot" ? "•" : b.label;
        const style: CSSProperties =
          light && (b.kind === "dot" || b.kind === "event")
            ? { background: "transparent", color: TC.ink, boxShadow: `inset 0 0 0 1.5px ${TC.inkMuted}` }
            : light && b.kind === "extra"
              ? { background: TC.claret, color: "#ffffff" }
              : light && b.kind === "run"
                ? { background: TC.navy, color: TC.ivoryHi }
                : BALL_STYLE[b.kind];
        return (
          <li
            key={i}
            className="tc-a-ball flex shrink-0 items-center justify-center rounded-full font-semibold leading-none"
            style={{
              height: size,
              minWidth: size,
              padding: label.length > 1 ? "0 8px" : 0,
              fontSize: label.length > 1 ? size * 0.44 : size * 0.52,
              ...FIGS,
              ...style,
              ...delay(i * 50),
            }}
          >
            <span aria-hidden="true">{label}</span>
            <span className="sr-only">{spoken(b)}</span>
          </li>
        );
      })}
      {Array.from({ length: empty }, (_, i) => (
        <li
          key={`slot-${i}`}
          aria-hidden="true"
          className="shrink-0 rounded-full"
          style={{
            width: size,
            height: size,
            boxShadow: `inset 0 0 0 1.5px ${light ? "rgba(90,81,64,0.35)" : "rgba(243,236,218,0.22)"}`,
          }}
        />
      ))}
    </ol>
  );
}

function spoken(b: OverBall): string {
  switch (b.kind) {
    case "dot":
      return "dot ball";
    case "four":
    case "six":
    case "wicket":
      return b.kind;
    default:
      return b.token;
  }
}

/**
 * A full-screen card: a navy head (tracked label, serif title, figures on
 * the right) over a gold rule, an ivory body, an optional navy foot.
 * Centred on the canvas inside the title-safe area.
 */
export function CardShell({
  eyebrow,
  title,
  aside,
  children,
  foot,
  width = 1200,
  bodyClassName,
  crest,
  label,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  foot?: ReactNode;
  width?: number;
  bodyClassName?: string;
  /** A crest beside the title. */
  crest?: ReactNode;
  /** The card's accessible name. */
  label?: string;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ padding: `${SAFE.y}px ${SAFE.x}px` }}
    >
      <section
        aria-label={label}
        className="tc-a-wipe-up flex max-h-full w-full flex-col overflow-hidden"
        style={{ maxWidth: width, borderRadius: RADIUS, boxShadow: DROP }}
      >
        <header className="relative flex items-center gap-6 px-10 py-6" style={NAVY}>
          {crest}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <Label
                className="tc-a-fade block truncate"
                style={{ color: TC.goldText, ...delay(160) }}
              >
                {eyebrow}
              </Label>
            )}
            <h2
              className="tc-a-rise mt-3 truncate text-balance text-[2.5rem] font-bold leading-[1.1]"
              style={{ fontFamily: SERIF, ...delay(120) }}
            >
              {title}
            </h2>
          </div>
          {aside && (
            <div className="tc-a-fade shrink-0 text-right" style={delay(260)}>
              {aside}
            </div>
          )}
        </header>
        <GoldRule d={200} sheen />
        {children && (
          <div className={cn("min-h-0 px-10 py-7", bodyClassName)} style={IVORY}>
            {children}
          </div>
        )}
        {foot && (
          <div
            className="flex items-center gap-6 px-10 py-3.5 text-[1.25rem]"
            style={NAVY_DEEP}
          >
            {foot}
          </div>
        )}
      </section>
    </div>
  );
}

/** A labelled figure for ivory cards: label above, figure below. */
export function Stat({
  label,
  value,
  className,
  big = false,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  big?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label style={{ color: TC.inkMuted }}>{label}</Label>
      <Fig className={big ? "text-[2.75rem]" : "text-[2rem]"}>{value}</Fig>
    </div>
  );
}

/** The team colour stripe on the left of a bar. */
export function Stripe({ colour, width = 8 }: { colour: string; width?: number }) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 self-stretch"
      style={{
        width,
        background: `linear-gradient(180deg, ${colour} 0%, ${colour} 100%)`,
        boxShadow: "inset -1px 0 0 rgba(0,0,0,0.3), inset 1px 0 0 rgba(255,255,255,0.18)",
      }}
    />
  );
}

/** A thin vertical divider on a navy bar. */
export function Divider({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("w-px shrink-0 self-stretch", className)}
      style={{
        background:
          "linear-gradient(180deg, transparent, rgba(243,236,218,0.28) 20%, rgba(243,236,218,0.28) 80%, transparent)",
      }}
    />
  );
}
