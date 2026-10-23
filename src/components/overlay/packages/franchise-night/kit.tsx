"use client";

/**
 * Franchise night's building blocks: the glass and team-colour surfaces,
 * the crest and photo slots, ball chips, kickers, the card and lower-third
 * frames, and the package's keyframes (one `<style>` React hoists once).
 *
 * Geometry: a 1920x1080 canvas with a 5% title-safe inset (96 px left and
 * right, 54 px top and bottom). Every panel uses the same chamfer, every
 * wedge the same slant.
 */

import { useContext, type CSSProperties, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import { withAlpha } from "../../overlay-themes";
import { MotionPreferenceContext, motionAllowed } from "../motion";
import { initialsOf, monogramOf, overBall, overSlotsLeft, type OverBall } from "../shared/derive";
import { SAFE, SAFE_WIDTH, lowerThirdBottom } from "../shared/layout";
import { AvatarSlot, CrestSlot } from "../shared/slots";
import { FN, type TeamTone } from "./theme";

// ---- grid -------------------------------------------------------------------

export { SAFE, SAFE_WIDTH };
/** The score bug's height (bar and rate strip) above its bottom edge. */
export const BUG_HEIGHT = 140;
/** Where lower thirds sit: clear of the score bug. */
export const LOWER_BOTTOM = lowerThirdBottom(BUG_HEIGHT);
/** The one chamfer and the one slant. */
export const CUT = 16;
export const SLANT = 22;

export const chamfer = (px = CUT) =>
  `polygon(${px}px 0, 100% 0, 100% calc(100% - ${px}px), calc(100% - ${px}px) 100%, 0 100%, 0 ${px}px)`;
/** A wedge whose right edge leans (left-anchored team blocks). */
export const slantRight = (px = SLANT) =>
  `polygon(0 0, 100% 0, calc(100% - ${px}px) 100%, 0 100%)`;
/** A wedge whose left edge leans (right-anchored team blocks). */
export const slantLeft = (px = SLANT) =>
  `polygon(${px}px 0, 100% 0, 100% 100%, 0 100%)`;
/** Both edges lean (kickers, chips of text). */
export const slantBoth = (px = 12) =>
  `polygon(${px}px 0, 100% 0, calc(100% - ${px}px) 100%, 0 100%)`;

// ---- surfaces ---------------------------------------------------------------

/** The gloss over every surface: a lit top half with a soft horizon. */
const GLOSS =
  "linear-gradient(180deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.045) 47%, rgba(255,255,255,0) 53%, rgba(0,0,0,0.12) 100%)";

/** Dark glass, optionally lit from one side by a team colour. */
export function glass(light?: { tone: TeamTone; from?: string; strength?: number }): CSSProperties {
  const mood = light
    ? `radial-gradient(ellipse 70% 140% at ${light.from ?? "0% 50%"}, ${withAlpha(light.tone.light, light.strength ?? 0.32)} 0%, transparent 70%), `
    : "";
  return {
    background: `${GLOSS}, ${mood}linear-gradient(180deg, ${FN.glassTop} 0%, ${FN.glassMid} 55%, ${FN.glassLow} 100%)`,
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.7)",
    color: FN.white,
  };
}

/** A darker glass for strips under a panel. */
export function deepGlass(): CSSProperties {
  return {
    background: `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 50%), linear-gradient(180deg, #0b0e17 0%, ${FN.ink} 100%)`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
    color: FN.white,
  };
}

/** A team-colour wedge: lit edge, the colour, its shadowed end, gloss. */
export function wedge(tone: TeamTone, angle = 105): CSSProperties {
  return {
    background: `${GLOSS}, linear-gradient(${angle}deg, ${tone.light} 0%, ${tone.base} 44%, ${tone.deep} 100%)`,
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.35)",
    color: tone.text,
  };
}

/** The gold of kickers, the target and the striker mark. */
export function goldFill(): CSSProperties {
  return {
    background: `linear-gradient(180deg, #ffe08a 0%, ${FN.gold} 45%, ${FN.goldDeep} 100%)`,
    // A dark edge keeps gold apart from a yellow or white side's colour.
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 0 0 1.5px rgba(28,19,0,0.35)",
    color: FN.goldText,
  };
}

/** A gold rule (the separator under card headers and over strips). */
export function GoldRule({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-[3px] w-full", className)}
      style={{
        background: `linear-gradient(90deg, transparent 0%, ${FN.goldDeep} 8%, ${FN.gold} 50%, ${FN.goldDeep} 92%, transparent 100%)`,
        ...style,
      }}
    />
  );
}

/** Drop shadow for clipped shapes (box-shadow is clipped with them). */
export const LIFT: CSSProperties = {
  filter: "drop-shadow(0 14px 22px rgba(0,0,0,0.5)) drop-shadow(0 2px 4px rgba(0,0,0,0.45))",
};

// ---- type -------------------------------------------------------------------

/** Condensed caps for names and titles. */
export const DISPLAY = "fn-display";
/** Figures: heavy, tabular. */
export const FIGURE = "fn-figure";
/** Labels and running text. */
export const TEXT = "fn-text";

// ---- motion -----------------------------------------------------------------

const CSS = `
.fn-root{font-family:var(--pkg-font-text);font-stretch:87.5%;font-variation-settings:"wdth" 87.5;color:#fff;-webkit-font-smoothing:antialiased}
.fn-display{font-family:var(--pkg-font-display);font-stretch:75%;font-variation-settings:"wdth" 75;font-weight:800;text-transform:uppercase;letter-spacing:.01em;line-height:1}
.fn-figure{font-family:var(--pkg-font-figures);font-stretch:87.5%;font-variation-settings:"wdth" 87.5;font-weight:800;font-variant-numeric:tabular-nums lining-nums;line-height:1}
.fn-text{font-family:var(--pkg-font-text);font-stretch:87.5%;font-variation-settings:"wdth" 87.5}
.fn-italic{font-style:italic}
@keyframes fn-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes fn-slide{from{opacity:0;transform:translateX(-36px)}to{opacity:1;transform:none}}
@keyframes fn-slide-r{from{opacity:0;transform:translateX(36px)}to{opacity:1;transform:none}}
@keyframes fn-wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes fn-wipe-c{from{clip-path:inset(0 50% 0 50%)}to{clip-path:inset(0 0 0 0)}}
@keyframes fn-sheen{0%{transform:translateX(-160%) skewX(-22deg);opacity:0}15%{opacity:1}100%{transform:translateX(560%) skewX(-22deg);opacity:0}}
@keyframes fn-pop{0%{opacity:0;transform:scale(1.9);filter:blur(10px)}55%{opacity:1;transform:scale(.95);filter:blur(0)}75%{transform:scale(1.03)}100%{opacity:1;transform:scale(1)}}
@keyframes fn-shard{0%{transform:translateX(-140%)}100%{transform:translateX(0)}}
@keyframes fn-shard-r{0%{transform:translateX(140%)}100%{transform:translateX(0)}}
@keyframes fn-grow-x{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes fn-grow-y{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes fn-draw{from{stroke-dashoffset:var(--fn-len,3000)}to{stroke-dashoffset:0}}
@keyframes fn-crawl{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes fn-flash{0%{opacity:.85}100%{opacity:0}}
@keyframes fn-ring{0%{transform:scale(.4);opacity:.9}100%{transform:scale(2.6);opacity:0}}
.fn-a-rise{animation:fn-rise 520ms cubic-bezier(.16,1,.3,1) both;animation-delay:var(--fn-d,0ms)}
.fn-a-slide{animation:fn-slide 520ms cubic-bezier(.16,1,.3,1) both;animation-delay:var(--fn-d,0ms)}
.fn-a-slide-r{animation:fn-slide-r 520ms cubic-bezier(.16,1,.3,1) both;animation-delay:var(--fn-d,0ms)}
.fn-a-wipe{animation:fn-wipe 560ms cubic-bezier(.16,1,.3,1) both;animation-delay:var(--fn-d,0ms)}
.fn-a-wipe-c{animation:fn-wipe-c 640ms cubic-bezier(.16,1,.3,1) both;animation-delay:var(--fn-d,0ms)}
.fn-a-pop{animation:fn-pop 620ms cubic-bezier(.2,.9,.2,1) both;animation-delay:var(--fn-d,0ms)}
.fn-a-shard{animation:fn-shard 460ms cubic-bezier(.16,1,.3,1) both;animation-delay:var(--fn-d,0ms)}
.fn-a-shard-r{animation:fn-shard-r 460ms cubic-bezier(.16,1,.3,1) both;animation-delay:var(--fn-d,0ms)}
.fn-a-grow-x{transform-origin:left center;animation:fn-grow-x 700ms cubic-bezier(.16,1,.3,1) both;animation-delay:var(--fn-d,0ms)}
.fn-a-grow-y{transform-origin:center bottom;transform-box:fill-box;animation:fn-grow-y 600ms cubic-bezier(.16,1,.3,1) both;animation-delay:var(--fn-d,0ms)}
.fn-a-draw{stroke-dasharray:var(--fn-len,3000);animation:fn-draw 1200ms cubic-bezier(.45,0,.2,1) both;animation-delay:var(--fn-d,0ms)}
.fn-a-sheen{animation:fn-sheen 1100ms cubic-bezier(.4,0,.2,1) both;animation-delay:var(--fn-d,250ms)}
.fn-a-flash{animation:fn-flash 700ms ease-out both;animation-delay:var(--fn-d,0ms)}
.fn-a-ring{animation:fn-ring 900ms cubic-bezier(.16,1,.3,1) both;animation-delay:var(--fn-d,0ms)}
.fn-a-crawl{animation:fn-crawl var(--fn-crawl,40s) linear infinite}
[data-fn-still] .fn-a-rise,[data-fn-still] .fn-a-slide,[data-fn-still] .fn-a-slide-r,[data-fn-still] .fn-a-wipe,[data-fn-still] .fn-a-wipe-c,[data-fn-still] .fn-a-pop,[data-fn-still] .fn-a-shard,[data-fn-still] .fn-a-shard-r,[data-fn-still] .fn-a-grow-x,[data-fn-still] .fn-a-grow-y,[data-fn-still] .fn-a-draw,[data-fn-still] .fn-a-crawl{animation:none}
[data-fn-still] .fn-a-sheen,[data-fn-still] .fn-a-flash,[data-fn-still] .fn-a-ring{display:none}
`;

/**
 * The package's keyframes and type classes, hoisted into the head once
 * (React dedupes by `href`).
 */
export function FnStyles() {
  return (
    <style href="franchise-night-styles" precedence="medium">
      {CSS}
    </style>
  );
}

/** Whether inner animations may play (previews honour reduced motion). */
export function useInnerMotion(): boolean {
  const { respectReducedMotion } = useContext(MotionPreferenceContext);
  return motionAllowed(respectReducedMotion);
}

/** A delay for staggered reveals. */
export const delay = (ms: number): CSSProperties =>
  ({ "--fn-d": `${ms}ms` }) as CSSProperties;

/**
 * Every element's root: the package's styles, its fonts and, in a
 * reduced-motion preview, no inner animation.
 */
export function FnRoot({
  className,
  style,
  children,
  ...rest
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const animate = useInnerMotion();
  return (
    <div
      {...rest}
      data-fn-still={animate ? undefined : ""}
      className={cn("fn-root pointer-events-none select-none", className)}
      style={style}
    >
      <FnStyles />
      {children}
    </div>
  );
}

/** A one-shot light sweep across a surface (TV gloss on arrival). */
export function Sheen({ at = 250, width = "18%" }: { at?: number; width?: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <span
        className="fn-a-sheen absolute inset-y-[-20%] left-0 block"
        style={{
          ...delay(at),
          width,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0) 100%)",
        }}
      />
    </span>
  );
}

// ---- crests and photos -------------------------------------------------------

/**
 * A team's crest: its logo on a disc in its colour with a metal ring, or
 * its code when it has no logo (or the logo fails to load).
 */
export function Crest({
  logo,
  code,
  name,
  tone,
  size = 72,
  className,
}: {
  logo?: string | null;
  code: string;
  /** The team's name: its initials stand in for a missing logo. */
  name?: string | null;
  tone: TeamTone;
  size?: number;
  className?: string;
}) {
  const mark = monogramOf(name, code);
  return (
    <CrestSlot
      logo={logo}
      name={name}
      code={code}
      className={cn("relative flex shrink-0 items-center justify-center rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 34% 28%, ${tone.light} 0%, ${tone.base} 52%, ${tone.deep} 100%)`,
        boxShadow: `inset 0 0 0 ${Math.max(2, size / 28)}px rgba(255,255,255,0.85), inset 0 0 0 ${Math.max(4, size / 14)}px ${tone.deep}, inset 0 ${size / 9}px ${size / 6}px rgba(255,255,255,0.18), 0 ${size / 14}px ${size / 7}px rgba(0,0,0,0.5)`,
        color: tone.text,
      }}
      imgClassName="object-contain"
      imgStyle={{ width: "64%", height: "64%" }}
      textClassName={DISPLAY}
      textStyle={{
        fontSize: `${Math.max(0.875, (size * (mark.length > 2 ? 0.3 : 0.38)) / 16)}rem`,
      }}
    />
  );
}

/** A head-and-shoulders silhouette for a player without a photo. */
function Silhouette({ tone }: { tone: TeamTone }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMax meet"
      className="absolute inset-x-0 bottom-0 h-[86%] w-full"
    >
      <defs>
        <linearGradient id={`fn-sil-${tone.base.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="36" r="19" fill={`url(#fn-sil-${tone.base.slice(1)})`} />
      <path
        d="M10 100 C12 74 28 60 50 60 C72 60 88 74 90 100 Z"
        fill={`url(#fn-sil-${tone.base.slice(1)})`}
      />
    </svg>
  );
}

/**
 * The photo slot of a lower third: the player's photo on their team's
 * colour, else a silhouette (never a broken image). Initials sit on the
 * silhouette when asked.
 */
export function PlayerSlot({
  url,
  name,
  tone,
  width,
  height,
  initials = false,
  className,
  style,
}: {
  url?: string | null;
  name?: string | null;
  tone: TeamTone;
  width: number;
  height: number;
  initials?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <AvatarSlot
      url={url}
      name={name}
      className={cn("relative block shrink-0 overflow-hidden", className)}
      style={{
        width,
        height,
        background: `repeating-linear-gradient(120deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 14px), radial-gradient(ellipse at 50% 30%, ${tone.light} 0%, ${tone.base} 50%, ${tone.deep} 100%)`,
        ...style,
      }}
      imgClassName="absolute inset-0 h-full w-full object-cover object-top"
      fallback={
        <>
          <Silhouette tone={tone} />
          {initials && name && (
            <span
              className={cn(DISPLAY, "absolute inset-x-0 bottom-[12%] text-center")}
              style={{ fontSize: `${(width * 0.26) / 16}rem`, color: tone.text, opacity: 0.9 }}
            >
              {initialsOf(name)}
            </span>
          )}
        </>
      }
    >
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.28) 100%)",
        }}
      />
    </AvatarSlot>
  );
}

// ---- small pieces -----------------------------------------------------------

/** A slanted label: gold by default, red for wickets, a team's colour. */
export function Kicker({
  children,
  tone = "gold",
  team,
  size = "md",
  className,
  style,
}: {
  children: ReactNode;
  tone?: "gold" | "wicket" | "team" | "glass";
  team?: TeamTone;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
}) {
  const fill: CSSProperties =
    tone === "gold"
      ? goldFill()
      : tone === "wicket"
        ? {
            background: `linear-gradient(180deg, #ff6b78 0%, ${FN.wicket} 50%, #b3101f 100%)`,
            color: FN.white,
          }
        : tone === "team" && team
          ? wedge(team, 90)
          : { ...deepGlass(), boxShadow: `inset 0 0 0 1px ${FN.line}` };
  const pad = size === "lg" ? "0.3rem 1.5rem" : size === "sm" ? "0.15rem 0.85rem" : "0.22rem 1.1rem";
  const font = size === "lg" ? "1.5rem" : size === "sm" ? "1rem" : "1.125rem";
  return (
    <span
      className={cn(DISPLAY, "inline-flex shrink-0 items-center whitespace-nowrap", className)}
      style={{
        ...fill,
        clipPath: slantBoth(size === "lg" ? 14 : 10),
        padding: pad,
        fontSize: font,
        letterSpacing: "0.08em",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Each delivery kind's chip colours. */
export const CHIP_FILL: Record<OverBall["kind"], { bg: string; fg: string }> = {
  // Steel with a dark figure: as legible as a run, still plainly a dot.
  dot: { bg: "#9aa3b8", fg: "#0b0d14" },
  run: { bg: "#f4f6fb", fg: "#10131d" },
  four: { bg: "#1670e0", fg: FN.white },
  six: { bg: "#9b2ff0", fg: FN.white },
  wicket: { bg: "#e3263a", fg: FN.white },
  extra: { bg: FN.extra, fg: "#1c1000" },
  event: { bg: "#3a4157", fg: FN.white },
};

/** One delivery of the over: a glossy disc by outcome ("nb+2b" as it is). */
export function BallChip({
  token,
  size = 40,
  className,
  style,
}: {
  token: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const chip = overBall(token);
  const fill = CHIP_FILL[chip.kind];
  const long = chip.label.length > 2;
  const longer = chip.label.length > 3;
  return (
    <span
      className={cn(FIGURE, "relative flex shrink-0 items-center justify-center rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 25%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 45%), ${fill.bg}`,
        boxShadow:
          "inset 0 -2px 3px rgba(0,0,0,0.35), 0 2px 5px rgba(0,0,0,0.45)",
        color: fill.fg,
        fontSize: `${(size * (longer ? 0.28 : long ? 0.36 : 0.48)) / 16}rem`,
        letterSpacing: longer ? "-0.02em" : undefined,
        ...style,
      }}
    >
      {chip.label}
    </span>
  );
}

/** An empty slot of the over. */
export function BallSlot({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.16), inset 0 2px 6px rgba(0,0,0,0.6)`,
        background: "rgba(0,0,0,0.25)",
      }}
    />
  );
}

/** This over's deliveries, then empty slots for the legal balls still to come. */
export function OverTray({
  tokens,
  slots = 6,
  size = 40,
  gap = 8,
  animate = true,
}: {
  tokens: readonly string[];
  /** Balls per over (0: no empty slots). */
  slots?: number;
  size?: number;
  gap?: number;
  animate?: boolean;
}) {
  const empty = slots > 0 ? overSlotsLeft(tokens.map(overBall), slots) : 0;
  return (
    <ol aria-label="This over" className="flex items-center" style={{ gap }}>
      {tokens.map((t, i) => (
        <li
          key={`${i}-${t}`}
          className={animate ? "fn-a-rise" : undefined}
          style={animate ? delay(120 + i * 60) : undefined}
        >
          <BallChip token={t} size={size} />
        </li>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <li key={`slot-${i}`} aria-hidden="true">
          <BallSlot size={size} />
        </li>
      ))}
    </ol>
  );
}

/** A labelled figure: small caps label over a big number. */
export function Stat({
  label,
  value,
  size = "md",
  accent = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  size?: "sm" | "md" | "lg";
  accent?: boolean;
  className?: string;
}) {
  const fs = size === "lg" ? "2.75rem" : size === "sm" ? "1.625rem" : "2.125rem";
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <span
        className={cn(TEXT, "whitespace-nowrap font-semibold uppercase")}
        style={{ fontSize: "1rem", letterSpacing: "0.08em", color: accent ? FN.gold : FN.muted }}
      >
        {label}
      </span>
      <span className={cn(FIGURE, "mt-1 whitespace-nowrap")} style={{ fontSize: fs }}>
        {value}
      </span>
    </div>
  );
}

// ---- frames -----------------------------------------------------------------

/**
 * A full-screen card: header (team-colour wedge with crest, kicker,
 * title; a figure on the right) over a gold rule, then the glass body.
 * Centred inside title safe.
 */
export function CardFrame({
  kicker,
  title,
  aside,
  tone,
  crest,
  width = 1240,
  footer,
  children,
  bodyClassName,
  label,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  tone: TeamTone;
  crest?: { logo?: string | null; code: string; name?: string | null } | null;
  width?: number;
  footer?: ReactNode;
  children?: ReactNode;
  bodyClassName?: string;
  /** An accessible name for the card. */
  label?: string;
}) {
  return (
    <FnRoot className="fixed inset-0 z-40 flex items-center justify-center" style={{ padding: `${SAFE.y}px ${SAFE.x}px` }}>
      <section aria-label={label} style={{ ...LIFT, width, maxWidth: SAFE_WIDTH }}>
        <div style={{ clipPath: chamfer(22) }} className="relative">
          <header
            className="fn-a-wipe relative flex items-center gap-6 overflow-hidden"
            style={{ ...wedge(tone, 100), minHeight: 116, padding: "18px 40px 18px 32px" }}
          >
            {crest && (
              <Crest logo={crest.logo} code={crest.code} name={crest.name} tone={tone} size={84} className="fn-a-rise" />
            )}
            <div className="min-w-0 flex-1">
              {kicker && (
                <div className="fn-a-slide" style={delay(120)}>
                  <Kicker size="sm">{kicker}</Kicker>
                </div>
              )}
              <h2
                className={cn(DISPLAY, "fn-a-slide mt-2 truncate")}
                style={{ ...delay(180), fontSize: "3.25rem", color: tone.text }}
              >
                {title}
              </h2>
            </div>
            {aside && (
              <div className="fn-a-slide-r shrink-0 text-right" style={delay(220)}>
                {aside}
              </div>
            )}
            <Sheen at={420} />
          </header>
          <GoldRule />
          {children && (
            <div className={cn("relative", bodyClassName)} style={{ ...glass({ tone, from: "0% 0%", strength: 0.18 }), padding: "24px 40px 28px" }}>
              {children}
            </div>
          )}
          {footer && (
            <div className="relative" style={{ ...deepGlass(), padding: "14px 40px" }}>
              {footer}
            </div>
          )}
        </div>
      </section>
    </FnRoot>
  );
}

/** A lower third's position: left, inside title safe, above the bug. */
export function LowerFrame({
  children,
  width,
  bottom = LOWER_BOTTOM,
  label,
  ...rest
}: {
  children: ReactNode;
  width?: number;
  bottom?: number;
  label?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <FnRoot
      {...rest}
      aria-label={label}
      className="fixed z-30"
      style={{ left: SAFE.x, bottom, width, maxWidth: SAFE_WIDTH }}
    >
      <div style={LIFT}>{children}</div>
    </FnRoot>
  );
}

/** Rows of a card's table: subtle stripes, hairlines. */
export function rowStyle(i: number, highlight = false): CSSProperties {
  return {
    background: highlight
      ? `linear-gradient(90deg, ${withAlpha(FN.gold, 0.22)} 0%, ${withAlpha(FN.gold, 0.06)} 60%, transparent 100%)`
      : i % 2 === 0
        ? "rgba(255,255,255,0.045)"
        : "transparent",
    boxShadow: highlight ? `inset 4px 0 0 ${FN.gold}` : `inset 0 -1px 0 rgba(255,255,255,0.06)`,
  };
}

/** Column heads of a card's table. */
export function TableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(TEXT, "whitespace-nowrap px-3 pb-2 text-right font-semibold uppercase", className)}
      style={{ fontSize: "1rem", letterSpacing: "0.08em", color: FN.muted }}
    >
      {children}
    </th>
  );
}
