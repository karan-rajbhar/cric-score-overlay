"use client";

/**
 * Summer bash's shared pieces: the frame every element sits in, team and
 * neon plates, crests and player photos (initials when there is no photo
 * or it fails to load), ball chips, card shells and the placement of
 * lower thirds and cards on the 1920x1080 canvas (5% title-safe inset).
 */

import {
  useContext,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "~/lib/utils";
import { OverlayFrame } from "../../overlay-kit";
import type { LayoutMode, LiveMatchState } from "../../types";
import { AnimatedNumber, MotionPreferenceContext } from "../motion";
import { AvatarSlot, CrestSlot, lowerThirdBottom, SAFE } from "../shared";
import s from "./summer-bash.module.css";

export { s };

// ---- canvas grid -------------------------------------------------------------

/** Title-safe inset (the shared 5% of 1920 x 1080). */
export const SAFE_X = SAFE.x;
export const SAFE_Y = SAFE.y;
/** The bottom score bug: main row and ribbon. */
export const BUG_ROW = 96;
export const BUG_RIBBON = 44;
export const BUG_GAP = 8;
export const BUG_HEIGHT = BUG_ROW + BUG_GAP + BUG_RIBBON;
/** The compact score bug's width. */
export const COMPACT_W = 468;

/** Where a lower third's foot sits for a score bug layout. */
export function lowerThirdPlace(layout: LayoutMode): {
  bottom: number;
  left: number;
} {
  if (layout === "top") return { bottom: SAFE_Y, left: SAFE_X };
  if (layout === "compact") {
    return { bottom: SAFE_Y, left: SAFE_X + COMPACT_W + 28 };
  }
  return { bottom: lowerThirdBottom(BUG_HEIGHT, 26), left: SAFE_X };
}

// ---- motion preference -----------------------------------------------------

const reduceQuery = "(prefers-reduced-motion: reduce)";

function subscribeReduce(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(reduceQuery);
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}

/** Motion off: a preview under reduced motion (the OBS output always moves). */
export function useStill(): boolean {
  const { respectReducedMotion } = useContext(MotionPreferenceContext);
  const reduce = useSyncExternalStore(
    subscribeReduce,
    () =>
      typeof window !== "undefined" && !!window.matchMedia
        ? window.matchMedia(reduceQuery).matches
        : false,
    () => false,
  );
  return respectReducedMotion && reduce;
}

/** The themed root of every Summer bash element. */
export function Frame({
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
} & React.HTMLAttributes<HTMLDivElement>) {
  const still = useStill();
  return (
    <OverlayFrame
      state={state}
      {...rest}
      style={style}
      className={cn(
        "pointer-events-none text-white",
        s.text,
        still && s.still,
        className,
      )}
    >
      {children}
    </OverlayFrame>
  );
}

// ---- sides -------------------------------------------------------------------

export type SideKey = "t1" | "t2" | "bat" | "bowl";

/** Plate, text and glow variables of a side for the pieces inside. */
export function sideStyle(side: SideKey): CSSProperties {
  return {
    "--plate": `var(--sb-${side})`,
    "--plate-text": `var(--sb-${side}-text)`,
    "--glow": `var(--sb-${side}-glow)`,
    "--haze": `var(--sb-${side}-haze)`,
    "--edge": `var(--sb-${side}-glow)`,
    "--frame": `var(--sb-${side}-glow)`,
    "--frame-haze": `var(--sb-${side}-haze)`,
  } as CSSProperties;
}

/** A neon colour for plates and edges. */
export type NeonKey = "magenta" | "cyan" | "lime" | "yellow" | "orange" | "red";

export function neonStyle(neon: NeonKey): CSSProperties {
  return {
    "--neon": `var(--sb-${neon})`,
    "--edge": `var(--sb-${neon})`,
    "--glow": `var(--sb-${neon})`,
    "--frame": `var(--sb-${neon})`,
    "--haze": `var(--sb-${neon}-haze)`,
    "--frame-haze": `var(--sb-${neon}-haze)`,
  } as CSSProperties;
}

/** Side 1 / 2 of a team name in this match (null: neither). */
export function sideOfName(
  state: LiveMatchState,
  name: string | null | undefined,
): "t1" | "t2" | null {
  if (!name) return null;
  if (name === state.team1_name) return "t1";
  if (name === state.team2_name) return "t2";
  return null;
}

/** A stagger delay for `--d`. */
export const delay = (ms: number): CSSProperties =>
  ({ "--d": `${Math.round(ms)}ms` }) as CSSProperties;

// ---- names and figures -----------------------------------------------------

export { initialsOf } from "../shared";

/** Name size for the plate: long names step down before they truncate. */
export function nameSize(name: string, base = 46): number {
  const n = name.length;
  if (n <= 14) return base;
  if (n <= 18) return Math.round(base * 0.86);
  if (n <= 22) return Math.round(base * 0.74);
  return Math.round(base * 0.66);
}

/** A figure that rolls when it changes. */
export function Num({
  value,
  className,
}: {
  value: ReactNode;
  className?: string;
}) {
  return <AnimatedNumber value={value} className={className} />;
}

// ---- crests and photos -------------------------------------------------------

/**
 * A team's crest: its logo on a lit disc, else the initials of its name
 * (else its code), in the side's colour with a neon ring.
 */
export function Crest({
  side,
  code,
  name,
  logo,
  size = 64,
  className,
}: {
  side: SideKey;
  code: string;
  name?: string | null;
  logo?: string | null;
  size?: number;
  className?: string;
}) {
  const inset = Math.max(3, size * 0.06);
  return (
    <span
      style={{ ...sideStyle(side), width: size, height: size }}
      className={cn("relative flex shrink-0 items-center justify-center rounded-full", className)}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 210deg, var(--glow), #fff 18%, var(--glow) 36%, var(--glow) 70%, #fff 84%, var(--glow))",
          boxShadow: "0 0 18px var(--haze)",
        }}
      />
      <CrestSlot
        logo={logo}
        name={name}
        code={code}
        className={cn(s.team, "absolute flex items-center justify-center overflow-hidden rounded-full")}
        style={{ inset }}
        imgClassName="relative z-10 h-full w-full object-contain"
        textClassName={cn(s.display, "relative z-10 leading-none")}
        textStyle={{ fontSize: size * 0.25 }}
      />
    </span>
  );
}

/**
 * A player's photo in an angled frame with the side's glow, or their
 * initials on the side's plate (never a broken image).
 */
export function Photo({
  url,
  name,
  side,
  size = 160,
  className,
}: {
  url?: string | null;
  name: string | null | undefined;
  side: SideKey;
  size?: number;
  className?: string;
}) {
  const clip = `polygon(${size * 0.16}px 0, 100% 0, ${size * 0.84}px 100%, 0 100%)`;
  return (
    <span
      style={{ ...sideStyle(side), width: size, height: size }}
      className={cn("relative block shrink-0", s.lift, className)}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{ clipPath: clip, background: "var(--glow)" }}
      />
      <AvatarSlot
        url={url}
        name={name}
        className={cn(s.team, "absolute flex items-center justify-center")}
        style={{ inset: 4, clipPath: clip }}
        imgClassName="relative z-10 h-full w-full object-cover"
        textClassName={cn(s.display, "relative z-10 leading-none")}
        textStyle={{ fontSize: size * 0.34 }}
      />
    </span>
  );
}

// ---- ball chips ----------------------------------------------------------------

type ChipKind = "dot" | "run" | "four" | "six" | "wicket" | "extra";

export function chipOf(token: string): { kind: ChipKind; label: string } {
  if (token === "W") return { kind: "wicket", label: "W" };
  if (/wd|nb|lb|b\d|^b$/.test(token)) return { kind: "extra", label: token };
  if (token === "4") return { kind: "four", label: "4" };
  if (token === "6") return { kind: "six", label: "6" };
  if (token === "0") return { kind: "dot", label: "•" };
  return { kind: "run", label: token };
}

const CHIP_STYLE: Record<ChipKind, CSSProperties> = {
  dot: {
    background: "linear-gradient(180deg, #3a2580, #22124f)",
    color: "#d9d0ff",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
  },
  run: {
    background: "linear-gradient(180deg, #ffffff, #d9d0ff)",
    color: "#0b0620",
    boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.15)",
  },
  four: {
    background: "linear-gradient(180deg, #8ff4ff, var(--sb-cyan))",
    color: "#0b0620",
    boxShadow: "0 0 14px var(--sb-cyan)",
  },
  six: {
    background: "linear-gradient(180deg, #ff8fd0, var(--sb-magenta))",
    color: "#0b0620",
    boxShadow: "0 0 14px var(--sb-magenta)",
  },
  wicket: {
    background: "linear-gradient(180deg, #ff7f95, var(--sb-red))",
    color: "#0b0620",
    boxShadow: "0 0 14px var(--sb-red)",
  },
  extra: {
    background: "linear-gradient(180deg, #ffc27a, var(--sb-orange))",
    color: "#0b0620",
    boxShadow: "0 0 10px rgba(255,138,31,0.6)",
  },
};

/** This over's deliveries as neon chips, with empty slots to the over's end. */
export function BallChips({
  tokens,
  slots = 6,
  size = 34,
  stagger = true,
  className,
}: {
  tokens: readonly string[];
  slots?: number;
  size?: number;
  stagger?: boolean;
  className?: string;
}) {
  const empty = Math.max(0, slots - tokens.length);
  return (
    <ol
      aria-label="This over"
      className={cn("flex items-center", className)}
      style={{ gap: size * 0.2 }}
    >
      {tokens.map((t, i) => {
        const chip = chipOf(t);
        const long = chip.label.length > 1;
        return (
          <li
            key={i}
            className={cn(
              s.figures,
              stagger && s.pop,
              "flex shrink-0 items-center justify-center rounded-full font-extrabold leading-none",
            )}
            style={{
              ...CHIP_STYLE[chip.kind],
              ...(stagger ? delay(260 + i * 70) : {}),
              height: size,
              minWidth: size,
              padding: long ? `0 ${size * 0.2}px` : 0,
              fontSize: size * (long ? 0.4 : 0.5),
            }}
          >
            {chip.label}
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
            border: "2px dashed rgba(217, 208, 255, 0.4)",
          }}
        />
      ))}
    </ol>
  );
}

// ---- plates and cards ----------------------------------------------------------

/** A small slanted neon tag: "Batting", "Powerplay". */
export function Tag({
  children,
  neon = "magenta",
  side,
  className,
  style,
}: {
  children: ReactNode;
  neon?: NeonKey;
  side?: SideKey;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        ...(side ? sideStyle(side) : neonStyle(neon)),
        "--k": "12px",
        ...style,
      } as CSSProperties}
      className={cn(
        side ? s.team : s.neon,
        s.slant,
        s.label,
        "inline-flex h-9 shrink-0 items-center px-6 text-[1.125rem] leading-none",
        className,
      )}
    >
      <span className="relative z-10 truncate">{children}</span>
    </span>
  );
}

/**
 * A full-screen card's placement: centred across the frame and in the
 * band above the score bug, so the bug stays readable under it.
 */
export function CardPlace({
  state,
  children,
}: {
  state: LiveMatchState;
  children: ReactNode;
}) {
  return (
    <Frame
      state={state}
      className="fixed inset-x-0 z-40 flex items-center justify-center text-white"
      style={{
        top: SAFE_Y,
        bottom: SAFE_Y + BUG_ROW + BUG_GAP + BUG_RIBBON + 20,
        paddingLeft: SAFE_X,
        paddingRight: SAFE_X,
      }}
    >
      {children}
    </Frame>
  );
}

/** A card title's size: long titles step down to stay on one line. */
export function titleSize(title: ReactNode): number {
  const n = typeof title === "string" ? title.length : 16;
  if (n <= 20) return 40;
  if (n <= 28) return 34;
  if (n <= 36) return 29;
  return 25;
}

/**
 * A card: a slanted title plate over glass with a neon frame. `side`
 * colours the frame and the plate (a team's card); else magenta.
 */
export function Card({
  eyebrow,
  title,
  aside,
  side,
  neon = "magenta",
  width,
  children,
  className,
  bodyClassName,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  side?: SideKey | null;
  neon?: NeonKey;
  width: number;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const colour = side ? sideStyle(side) : neonStyle(neon);
  return (
    <section
      style={{ ...colour, width, maxWidth: "100%" }}
      className={cn(s.card, "overflow-hidden", className)}
    >
      <header className="relative flex items-stretch">
        <div
          style={{ "--k": "34px" } as CSSProperties}
          className={cn(
            side ? s.team : s.neon,
            s.slantStart,
            s.inLeft,
            "relative flex min-w-0 max-w-[78%] flex-col justify-center py-4 pl-9 pr-16",
          )}
        >
          <span className={s.streak} style={delay(520)} />
          {eyebrow && (
            <span
              className={cn(
                s.label,
                "relative z-10 truncate text-[1.125rem] leading-tight opacity-90",
              )}
            >
              {eyebrow}
            </span>
          )}
          <h2
            className={cn(
              s.display,
              "relative z-10 truncate uppercase leading-[1.15]",
            )}
            style={{ fontSize: titleSize(title) }}
          >
            {title}
          </h2>
        </div>
        {aside && (
          <div
            className={cn(
              s.inRight,
              "ml-auto flex shrink-0 items-center justify-end py-3 pl-6 pr-9 text-right",
            )}
            style={delay(160)}
          >
            {aside}
          </div>
        )}
      </header>
      {children && (
        <div className={cn("relative px-9 pb-7 pt-5", bodyClassName)}>
          {children}
        </div>
      )}
    </section>
  );
}

/** A score for a card's aside: "159/7" over "20 overs". */
export function AsideScore({
  score,
  detail,
}: {
  score: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <span className="leading-none">
      <span
        className={cn(s.figures, "block text-[3rem] leading-none")}
        style={{ textShadow: "0 0 18px var(--haze)" }}
      >
        {score}
      </span>
      {detail && (
        <span
          className={cn(s.label, "mt-2 block text-[1rem] text-[color:var(--sb-mist)]")}
        >
          {detail}
        </span>
      )}
    </span>
  );
}

/** Column heads for card tables, on the rows' grid. */
export function Heads({
  cols,
  template,
}: {
  cols: Array<{ label: string; className?: string }>;
  template: string;
}) {
  return (
    <div
      className={cn(
        s.label,
        "grid items-end gap-x-4 border-b-2 border-[color:var(--edge)] px-4 pb-2 text-[1rem] text-[color:var(--sb-mist)]",
      )}
      style={{ gridTemplateColumns: template }}
    >
      {cols.map((c, i) => (
        <span key={i} className={c.className}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

/** A labelled stat tile: big figure, small label. */
export function StatTile({
  label,
  value,
  neon,
  className,
  style,
}: {
  label: string;
  value: ReactNode;
  neon?: NeonKey;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{ ...(neon ? neonStyle(neon) : {}), ...style }}
      className={cn(
        neon ? s.neon : s.glass,
        "flex min-w-0 flex-col items-center justify-center rounded-[4px] px-4 py-2.5",
        className,
      )}
    >
      <span className={cn(s.figures, "relative z-10 text-[2rem] leading-none")}>
        {value}
      </span>
      <span
        className={cn(
          s.label,
          "relative z-10 mt-1.5 text-[0.9375rem] leading-none",
          neon ? "" : "text-[color:var(--sb-mist)]",
        )}
      >
        {label}
      </span>
    </div>
  );
}
