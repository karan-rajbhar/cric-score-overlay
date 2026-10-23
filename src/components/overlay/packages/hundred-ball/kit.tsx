"use client";

/**
 * Hundred-ball building blocks: flat colour blocks butted together on an
 * ink slab (6px seams), a stacked darker slab behind for depth, the 45°
 * corner cut, caps labels, giant monospaced figures and the set squares.
 * Every graphic places itself on the 1920x1080 canvas inside the 5%
 * title-safe inset (96 x 54).
 */

import {
  useContext,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "~/lib/utils";
import type { LayoutMode } from "../../types";
import { AnimatedNumber, MotionPreferenceContext } from "../motion";
import { tokenKind, type TokenKind } from "./balls";
import s from "./hundred-ball.module.css";

// ---- canvas -----------------------------------------------------------------

/** Title-safe inset on the 1920x1080 canvas (5%). */
export const SAFE = { x: 96, y: 54 } as const;
/** Gap between blocks: the ink seam. */
export const SEAM = 6;
/** Hero row height of the bug (lower thirds match it). */
export const HERO_H = 136;
/** Height the bottom bug takes, tabs included (cards keep clear of it). */
export const BUG_RESERVE = 300;

export const FONT = {
  display: "var(--pkg-font-display, ui-monospace, monospace)",
  text: "var(--pkg-font-text, system-ui, sans-serif)",
  figures: "var(--pkg-font-figures, ui-monospace, monospace)",
  stencil: "var(--font-hb-stencil), var(--pkg-font-display, sans-serif)",
} as const;

// ---- tones ------------------------------------------------------------------

export type Tone =
  | "ink"
  | "ink2"
  | "paper"
  | "paper2"
  | "volt"
  | "t1"
  | "t2"
  | "four"
  | "six"
  | "wicket"
  | "free";

const COLOURED = new Set<Tone>(["volt", "t1", "t2", "four", "six", "wicket", "free"]);

/** A tone's fill and text (the fill as a colour, so the sheen layers on top). */
export function toneStyle(tone: Tone): CSSProperties {
  switch (tone) {
    case "ink":
      return { backgroundColor: "var(--hb-ink)", color: "#ffffff" };
    case "ink2":
      return { backgroundColor: "var(--hb-ink2)", color: "#ffffff" };
    case "paper":
      return { backgroundColor: "var(--hb-paper)", color: "var(--hb-ink)" };
    case "paper2":
      return { backgroundColor: "var(--hb-paper2)", color: "var(--hb-ink)" };
    default:
      return { backgroundColor: `var(--hb-${tone})`, color: `var(--hb-${tone}-fg)` };
  }
}

/** Secondary text on a tone. */
export function mutedOn(tone: Tone): string {
  if (tone === "ink" || tone === "ink2") return "var(--hb-ink-muted)";
  if (tone === "paper" || tone === "paper2") return "var(--hb-paper-muted)";
  return `var(--hb-${tone}-muted)`;
}

/** The darker tone stacked behind a slab of this tone. */
export function deepOf(tone: Tone): string {
  if (COLOURED.has(tone)) return `var(--hb-${tone}-deep)`;
  return "#000000";
}

/** The tone of team 1 / team 2 (team 1's when unknown). */
export const sideTone = (side: 1 | 2 | null | undefined): Tone =>
  side === 2 ? "t2" : "t1";

/** A team tone's colour that reads on ink (bars, edges). */
export const popOf = (tone: Tone) =>
  COLOURED.has(tone) ? `var(--hb-${tone}-pop)` : "#ffffff";

// ---- motion -----------------------------------------------------------------

export type Build =
  | "wipeRight"
  | "wipeLeft"
  | "wipeUp"
  | "wipeDown"
  | "rise"
  | "slideLeft"
  | "slideRight"
  | "pop"
  | "slam"
  | "growX"
  | "growY"
  | "fade";

/** Class and style for a staggered build (`delay`, `duration` in ms). */
export function build(
  kind: Build | null | undefined,
  delay = 0,
  duration?: number,
): { className?: string; style?: CSSProperties } {
  if (!kind) return {};
  return {
    className: cn(s.anim, s[kind]),
    style: {
      "--d": `${delay}ms`,
      ...(duration ? { "--t": `${duration}ms` } : {}),
    } as CSSProperties,
  };
}

// ---- roots ------------------------------------------------------------------

/**
 * A graphic's root on the canvas: fixed, never interactive, in the
 * package's display face. Previews honouring reduced motion stop its builds.
 */
export function Root({
  className,
  style,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const { respectReducedMotion } = useContext(MotionPreferenceContext);
  return (
    <div
      {...rest}
      data-hb=""
      className={cn(
        "pointer-events-none fixed select-none antialiased",
        respectReducedMotion && s.still,
        className,
      )}
      style={{ fontFamily: FONT.display, ...style }}
    >
      {children}
    </div>
  );
}

/** Where lower thirds sit for each score bug layout. */
export function lowerAnchor(layout: LayoutMode): {
  style: CSSProperties;
  /** The edge it grows from (its builds come from there). */
  from: "left" | "right" | "centre";
} {
  switch (layout) {
    case "top":
      return { style: { left: SAFE.x, bottom: SAFE.y }, from: "left" };
    case "broadcast":
      // Above the crease strip in the bottom centre.
      return {
        style: { left: "50%", bottom: SAFE.y + 72 + 18, transform: "translateX(-50%)" },
        from: "centre",
      };
    case "compact":
      // The stage lifts straps 60px over a compact bug; this one sits
      // beside it instead, level with its foot.
      return { style: { right: SAFE.x, bottom: SAFE.y - 60 }, from: "right" };
    default:
      // Beside the bug, bottom right, level with its foot.
      return { style: { right: SAFE.x, bottom: SAFE.y }, from: "right" };
  }
}

/** Full-frame cards: centred above the bug's corner. */
export function CardStage({
  children,
  testId,
}: {
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Root
      data-testid={testId}
      className="inset-x-0 flex items-center justify-center"
      style={{ top: SAFE.y + 8, bottom: BUG_RESERVE }}
    >
      {children}
    </Root>
  );
}

// ---- blocks -----------------------------------------------------------------

/**
 * A slab: blocks on an ink plate (the seams), a darker copy stacked behind
 * (offset 8px) and a soft shadow; the corner cut on the leading edge.
 */
export function Slab({
  deep = "#000000",
  cut = "right",
  enter = "wipeRight",
  delay = 0,
  duration,
  column = false,
  className,
  style,
  innerClassName,
  children,
}: {
  deep?: string;
  cut?: "right" | "left" | "none";
  enter?: Build | null;
  delay?: number;
  duration?: number;
  column?: boolean;
  className?: string;
  style?: CSSProperties;
  innerClassName?: string;
  children: ReactNode;
}) {
  const b = build(enter, delay, duration);
  const cutClass = cut === "right" ? s.cut : cut === "left" ? s.cutLeft : null;
  return (
    <div className={cn("relative", s.lift, className)} style={style}>
      <div className={cn("relative", b.className)} style={b.style}>
        <div
          aria-hidden="true"
          className={cn("absolute inset-0", cutClass)}
          style={{ background: deep, transform: "translate(8px, 8px)" }}
        />
        <div
          className={cn(
            "relative flex",
            column && "flex-col",
            cutClass,
            innerClassName,
          )}
          style={{ background: "var(--hb-ink)", gap: SEAM }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** One flat colour block (light top edge, darker foot). */
export function Block({
  tone,
  enter,
  delay = 0,
  duration,
  className,
  style,
  children,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  tone: Tone;
  enter?: Build | null;
  delay?: number;
  duration?: number;
  children?: ReactNode;
}) {
  const b = build(enter, delay, duration);
  const paper = tone === "paper" || tone === "paper2";
  return (
    <div
      {...rest}
      className={cn(
        "relative overflow-hidden",
        paper ? s.paperSheen : s.sheen,
        b.className,
        className,
      )}
      style={{ ...toneStyle(tone), ...b.style, ...style }}
    >
      {children}
    </div>
  );
}

/** Content that rises into its block (the block clips it). */
export function Reveal({
  delay = 0,
  duration,
  kind = "rise",
  className,
  children,
}: {
  delay?: number;
  duration?: number;
  kind?: Build;
  className?: string;
  children: ReactNode;
}) {
  const b = build(kind, delay, duration);
  return (
    <span className={cn("block min-w-0 overflow-hidden", className)}>
      <span className={cn("block min-w-0", b.className)} style={b.style}>
        {children}
      </span>
    </span>
  );
}

/** A caps label: "BALLS LEFT". */
export function Label({
  children,
  className,
  style,
  color,
  size = 20,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className={cn("block truncate font-bold uppercase leading-none", className)}
      style={{
        fontFamily: FONT.display,
        fontSize: size,
        letterSpacing: "0.06em",
        fontStretch: "87.5%",
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** A name in caps, set tight. */
export function Name({
  children,
  size = 40,
  className,
  style,
}: {
  children: ReactNode;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn("block truncate font-extrabold uppercase", className)}
      style={{
        fontFamily: FONT.display,
        fontSize: size,
        lineHeight: 1.05,
        letterSpacing: "-0.02em",
        fontStretch: "75%",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** A giant figure; rolls when it changes. */
export function Fig({
  value,
  size = 104,
  className,
  style,
  roll = true,
}: {
  value: ReactNode;
  size?: number;
  className?: string;
  style?: CSSProperties;
  roll?: boolean;
}) {
  return (
    <span
      className={cn("inline-block whitespace-nowrap font-extrabold tabular-nums", className)}
      style={{
        fontFamily: FONT.figures,
        fontSize: size,
        lineHeight: 0.8,
        letterSpacing: "-0.05em",
        fontStretch: "87.5%",
        ...style,
      }}
    >
      {roll ? <AnimatedNumber value={value} durationMs={460} /> : value}
    </span>
  );
}

/** Two figures joined by a short dash: 142-5, 1-18 (each one rolls). */
export function PairFig({
  a,
  b,
  label,
  size = 96,
  className,
}: {
  a: number | null | undefined;
  b: number | null | undefined;
  /** What a screen reader hears: "142 for 5". */
  label: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-baseline whitespace-nowrap", className)}
      role="img"
      aria-label={label}
    >
      <Fig value={a ?? 0} size={size} />
      <span
        aria-hidden="true"
        className="inline-block font-extrabold"
        style={{
          fontFamily: FONT.figures,
          fontSize: size,
          lineHeight: 0.8,
          transform: "scaleX(0.5)",
          margin: "0 -0.16em",
        }}
      >
        -
      </span>
      <Fig value={b ?? 0} size={size} />
    </span>
  );
}

/** Runs-wickets: 142-5. */
export function ScoreFig({
  runs,
  wickets,
  size = 96,
  className,
}: {
  runs: number | null | undefined;
  wickets: number | null | undefined;
  size?: number;
  className?: string;
}) {
  return (
    <PairFig
      a={runs}
      b={wickets}
      size={size}
      className={className}
      label={`${runs ?? 0} for ${wickets ?? 0}`}
    />
  );
}

/** A bowler's wickets-runs: 1-18. */
export function BowlingFig({
  wickets,
  runs,
  size = 84,
}: {
  wickets: number | null | undefined;
  runs: number | null | undefined;
  size?: number;
}) {
  return (
    <PairFig
      a={wickets}
      b={runs}
      size={size}
      label={`${wickets ?? 0} for ${runs ?? 0}`}
    />
  );
}

/** Sentence text (messages, captions). */
export function Text({
  children,
  size = 24,
  className,
  style,
}: {
  children: ReactNode;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn("block font-medium", className)}
      style={{ fontFamily: FONT.text, fontSize: size, lineHeight: 1.25, ...style }}
    >
      {children}
    </span>
  );
}

/** A team's crest: its logo, else its code. */
export function Crest({
  logo,
  code,
  size = 40,
}: {
  logo?: string | null;
  code: string;
  size?: number;
}) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt=""
        className="h-full w-full object-contain"
        style={{ filter: "drop-shadow(0 2px 2px rgb(0 0 0 / 0.25))" }}
      />
    );
  }
  return (
    <span
      className="block truncate text-center font-extrabold uppercase leading-none"
      style={{
        fontFamily: FONT.display,
        fontSize: size,
        letterSpacing: "-0.03em",
        fontStretch: "87.5%",
      }}
    >
      {code}
    </span>
  );
}

/** A small tab above a slab: "NEEDS 24 FROM 15 BALLS", "FREE HIT". */
export function Tab({
  tone,
  children,
  delay = 0,
  className,
  cut = "right",
  enter = "wipeRight",
}: {
  tone: Tone;
  children: ReactNode;
  delay?: number;
  className?: string;
  cut?: "right" | "left";
  enter?: Build;
}) {
  const b = build(enter, delay, 380);
  return (
    <div className={cn("relative", s.lift, b.className)} style={b.style}>
      <div
        className={cn(
          "flex h-12 items-center gap-3 px-5",
          cut === "right" ? s.cut : s.cutLeft,
          tone === "paper" || tone === "paper2" ? s.paperSheen : s.sheen,
          className,
        )}
        style={{ ...toneStyle(tone), "--cut": "14px" } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

// ---- deliveries ---------------------------------------------------------------

const TOKEN_TONE: Record<TokenKind, CSSProperties> = {
  dot: { background: "var(--hb-ink3)", color: "rgb(255 255 255 / 0.82)" },
  run: { background: "var(--hb-paper)", color: "var(--hb-ink)" },
  four: { background: "var(--hb-four)", color: "var(--hb-four-fg)" },
  six: { background: "var(--hb-six)", color: "var(--hb-six-fg)" },
  wicket: { background: "var(--hb-wicket)", color: "var(--hb-wicket-fg)" },
  extra: { background: "var(--hb-free)", color: "var(--hb-free-fg)" },
};

const SPOKEN: Record<TokenKind, string> = {
  dot: "dot ball",
  run: "runs",
  four: "four",
  six: "six",
  wicket: "wicket",
  extra: "extra",
};

/**
 * The set's deliveries as squares (a dot is a dot, extras amber, fours
 * blue, sixes magenta, wickets red), then outlined squares for the legal
 * balls still to come.
 */
export function SetSquares({
  tokens,
  open,
  size = 30,
  gap = 6,
  delay = 0,
  className,
}: {
  tokens: readonly string[];
  open: number;
  size?: number;
  gap?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <ol
      aria-label="This set"
      className={cn("flex items-center", className)}
      style={{ gap }}
    >
      {tokens.map((t, i) => {
        const kind = tokenKind(t);
        const label = kind === "dot" ? "•" : t;
        const b = build("pop", delay + i * 50, 360);
        return (
          <li
            key={`${i}-${t}`}
            className={cn(
              "flex shrink-0 items-center justify-center font-extrabold leading-none",
              b.className,
            )}
            style={{
              ...TOKEN_TONE[kind],
              ...b.style,
              height: size,
              minWidth: size,
              paddingInline: label.length > 1 ? Math.round(size * 0.18) : 0,
              fontFamily: FONT.figures,
              fontSize: Math.round(size * (label.length > 2 ? 0.42 : 0.56)),
              fontStretch: "75%",
              boxShadow: "inset 0 -3px 0 rgb(0 0 0 / 0.18)",
            }}
          >
            <span aria-hidden="true">{label}</span>
            <span className="sr-only">
              {kind === "run" || kind === "extra" ? `${t} ${SPOKEN[kind]}` : SPOKEN[kind]}
            </span>
          </li>
        );
      })}
      {Array.from({ length: open }, (_, i) => (
        <li
          key={`open-${i}`}
          aria-hidden="true"
          className="shrink-0"
          style={{
            height: size,
            width: size,
            boxShadow: "inset 0 0 0 3px rgb(255 255 255 / 0.3)",
          }}
        />
      ))}
    </ol>
  );
}

/** A thin progress bar: balls bowled of the innings. */
export function BallBar({
  value,
  max,
  color = "var(--hb-volt)",
  height = 8,
  className,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      aria-hidden="true"
      className={cn("w-full", className)}
      style={{ height, background: "rgb(255 255 255 / 0.14)" }}
    >
      <div
        className="h-full"
        style={{
          width: `${pct}%`,
          background: color,
          transition: "width 600ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </div>
  );
}

/** A keyed flash over a block whose figure changed. */
export function Flash({
  on,
  color = "#ffffff",
}: {
  on: string | number;
  color?: string;
}) {
  return (
    <span
      key={on}
      aria-hidden="true"
      className={s.flash}
      style={{ "--flash": color } as CSSProperties}
    />
  );
}

/** The CSS module (stings and tickers use its sequences directly). */
export const styles = s;
