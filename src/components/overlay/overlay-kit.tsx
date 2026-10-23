"use client";

/**
 * Shared pieces of the broadcast overlay: the themed frame every graphic
 * sits in, team badges, the ball track, card shells and small figures.
 * Colours come from the `--ov-*` variables of `overlay-themes.ts`; type is
 * the condensed broadcast face (`font-score` on /overlay), sentence case,
 * `tabular-nums` for figures, long names truncated.
 */

import type { CSSProperties, ReactNode } from "react";
import { BallChip } from "~/components/ds/ball";
import { overBallChip } from "~/components/matches/match-live-panel";
import { cn } from "~/lib/utils";
import {
  overlayPalette,
  overlayThemeVars,
  type CustomColours,
} from "./overlay-themes";
import type { LiveMatchState } from "./types";

/** Class sets reading the theme variables (kept in a .tsx for Tailwind). */
export const OV = {
  bar: "bg-[color:var(--ov-bar)] text-[color:var(--ov-bar-text)]",
  barMuted: "text-[color:var(--ov-bar-muted)]",
  panel: "bg-[color:var(--ov-panel)] text-[color:var(--ov-panel-text)]",
  panelMuted: "text-[color:var(--ov-panel-muted)]",
  card: "bg-[color:var(--ov-card)] text-[color:var(--ov-card-text)]",
  cardMuted: "text-[color:var(--ov-card-muted)]",
  cardLine: "border-[color:var(--ov-card-line)]",
  accent: "bg-[color:var(--ov-accent)] text-[color:var(--ov-accent-text)]",
  accentText: "text-[color:var(--ov-accent)]",
  line: "border-[color:var(--ov-line)]",
  shadow: "shadow-[var(--ov-shadow)]",
  team1: "bg-[color:var(--ov-team1)] text-[color:var(--ov-team1-text)]",
  team2: "bg-[color:var(--ov-team2)] text-[color:var(--ov-team2-text)]",
} as const;

/** "12.3" from a ball count. */
export function oversText(
  balls: number | null | undefined,
  ballsPerOver = 6,
): string {
  const b = Math.max(0, balls ?? 0);
  return `${Math.floor(b / ballsPerOver)}.${b % ballsPerOver}`;
}

/** Strike rate to one decimal, or null before a ball is faced. */
export function strikeRateText(
  runs: number | null | undefined,
  balls: number | null | undefined,
): string | null {
  return balls && balls > 0 ? (((runs ?? 0) * 100) / balls).toFixed(1) : null;
}

/** Economy to two decimals, or null before a ball is bowled. */
export function economyText(
  runs: number | null | undefined,
  balls: number | null | undefined,
): string | null {
  return balls && balls > 0 ? (((runs ?? 0) * 6) / balls).toFixed(2) : null;
}

/** A team's short code: its own, else the first three letters. */
export function teamCode(
  short: string | null | undefined,
  name: string | null | undefined,
): string {
  if (short) return short;
  return (name ?? "").slice(0, 3).toUpperCase();
}

/** Which side (1 / 2) the batting team is, by name; null when unknown. */
export function battingSide(state: LiveMatchState): 1 | 2 | null {
  const bat = state.batting_team_name;
  if (!bat) return null;
  if (bat === state.team1_name) return 1;
  if (bat === state.team2_name) return 2;
  return null;
}

export interface OverlayThemeProps {
  /** Any theme id (legacy ids map to Standard). */
  theme?: string;
  /** The Custom theme's colours. */
  customColors?: CustomColours | null;
}

/** The `--ov-*` variables for a theme and this match's team colours. */
export function overlayStyle(
  state: Pick<LiveMatchState, "team_colors"> | null,
  theme?: string,
  customColors?: CustomColours | null,
): CSSProperties {
  return overlayThemeVars(
    overlayPalette(theme, {
      custom: customColors,
      team1: state?.team_colors?.team1,
      team2: state?.team_colors?.team2,
    }),
  );
}

/** The themed root of a graphic. */
export function OverlayFrame({
  state,
  theme,
  customColors,
  className,
  style,
  children,
  ...rest
}: OverlayThemeProps & {
  state: LiveMatchState | null;
  className?: string;
  children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      style={{ ...overlayStyle(state, theme, customColors), ...style }}
      className={cn("select-none font-score", className)}
    >
      {children}
    </div>
  );
}

/** A team's logo, or its code when it has none. */
export function TeamMark({
  logoUrl,
  code,
  className,
}: {
  logoUrl?: string | null;
  code: string;
  className?: string;
}) {
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt=""
      className={cn("h-full w-full object-contain", className)}
    />
  ) : (
    <span className={cn("font-semibold leading-none", className)}>{code}</span>
  );
}

/** The batting side's badge: team colour (Team colours theme) or panel. */
export function TeamBadge({
  side,
  code,
  logoUrl,
  detail,
  className,
}: {
  side: 1 | 2 | null;
  code: string;
  logoUrl?: string | null;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 px-4",
        side === 2 ? OV.team2 : OV.team1,
        className,
      )}
    >
      {logoUrl && (
        <span className="flex h-9 w-9 items-center justify-center">
          <TeamMark logoUrl={logoUrl} code={code} />
        </span>
      )}
      <span className="leading-none">
        <span className="block text-[1.75rem] font-semibold">{code}</span>
        {detail && (
          <span className="mt-1 block text-sm font-medium opacity-80">
            {detail}
          </span>
        )}
      </span>
    </div>
  );
}

/** This over's deliveries as the app's ball chips (dashed slots to six). */
export function BallTrack({
  balls,
  slots = 6,
  size = "md",
  className,
}: {
  balls: readonly string[];
  slots?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const empty = Math.max(0, slots - balls.length);
  return (
    <ol
      aria-label="This over"
      className={cn("flex items-center gap-1.5", className)}
    >
      {balls.map((token, i) => {
        const chip = overBallChip(token);
        return (
          <li key={i}>
            <BallChip kind={chip.kind} label={chip.label} size={size} />
          </li>
        );
      })}
      {Array.from({ length: empty }, (_, i) => (
        <li
          key={`slot-${i}`}
          aria-hidden="true"
          className={cn(
            "rounded-full border border-dashed opacity-40",
            OV.line,
            size === "md" ? "h-8 w-8" : "h-6 w-6",
          )}
        />
      ))}
    </ol>
  );
}

/** "this over" tokens from `live_state.this_over_balls`. */
export function overTokens(state: Pick<LiveMatchState, "this_over_balls">) {
  return (state.this_over_balls ?? "").split(" ").filter(Boolean);
}

/** A labelled figure: "SR 142.5". */
export function Figure({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className="text-sm font-medium opacity-75">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

/**
 * A full-screen or lower-third card: header in the bar colours (eyebrow,
 * title, optional right side), body in the card colours.
 */
export function CardShell({
  eyebrow,
  title,
  aside,
  children,
  className,
  bodyClassName,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "w-full overflow-hidden rounded-lg duration-300 animate-in fade-in slide-in-from-bottom-4 motion-reduce:animate-none",
        OV.shadow,
        className,
      )}
    >
      <header
        className={cn(
          "flex items-end justify-between gap-6 border-b px-7 py-4",
          OV.bar,
          OV.cardLine,
        )}
      >
        <div className="min-w-0">
          {eyebrow && (
            <p className={cn("truncate text-base font-medium", OV.barMuted)}>
              {eyebrow}
            </p>
          )}
          <h2 className="truncate text-balance text-[2rem] font-semibold leading-tight">
            {title}
          </h2>
        </div>
        {aside && <div className="shrink-0 text-right">{aside}</div>}
      </header>
      {children && (
        <div className={cn("px-7 py-5", OV.card, bodyClassName)}>
          {children}
        </div>
      )}
    </section>
  );
}

/** Centre a full-screen card on the 1920×1080 canvas. */
export function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-16">
      {children}
    </div>
  );
}

/** A player's photo, or their initials on the panel colour. */
export function PlayerPhoto({
  url,
  name,
  className,
}: {
  url?: string | null;
  name: string | null | undefined;
  className?: string;
}) {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md",
        OV.panel,
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-2xl font-semibold">{initials}</span>
      )}
    </span>
  );
}

/** "Tournament · label" for a card's eyebrow. */
export function eyebrowOf(state: LiveMatchState, label: string): string {
  const source = state.tournament_name ?? state.title;
  return source ? `${source} · ${label}` : label;
}
