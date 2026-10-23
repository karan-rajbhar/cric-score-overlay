"use client";

/**
 * Hundred-ball stings: typographic and punchy. Three flat colour bands
 * sweep across the picture (the event's colour, ink, white), two sweep on
 * out and the event's colour closes in on a plate; the word slams in over
 * a giant stencil figure drifting behind it; the batter or bowler rises
 * in underneath. About 1.4s to build, 2.6s to settle.
 */

import type { CSSProperties } from "react";
import { cn } from "~/lib/utils";
import type { OverlayElementProps, StingKind } from "../types";
import { sidesWithTones } from "./common";
import { FONT, Name, Reveal, Root, styles, toneStyle, type Tone } from "./kit";

interface StingLook {
  tone: Tone;
  /** The giant figure behind the word. */
  figure: string;
}

const LOOK: Record<StingKind, StingLook> = {
  four: { tone: "four", figure: "4" },
  six: { tone: "six", figure: "6" },
  wicket: { tone: "wicket", figure: "W" },
  fifty: { tone: "volt", figure: "50" },
  hundred: { tone: "volt", figure: "100" },
  three_for: { tone: "wicket", figure: "3" },
  five_for: { tone: "wicket", figure: "5" },
  hat_trick: { tone: "wicket", figure: "3" },
  free_hit: { tone: "free", figure: "FH" },
  milestone: { tone: "volt", figure: "" },
};

/** Plate inset from each side when the bands close in (canvas share). */
const PLATE_X = 0.2;
const BAND_TOP = 300;
const BAND_H = 330;

/** The word's size so it fills the plate without running out of it. */
export function stingWordSize(word: string): number {
  const plate = 1920 * (1 - 2 * PLATE_X) - 120;
  return Math.round(Math.min(250, plate / (Math.max(word.length, 3) * 0.47)));
}

export function HundredSting(p: OverlayElementProps["sting"]) {
  const { sting, kind, state } = p;
  const look = LOOK[kind] ?? LOOK.milestone;
  const word = sting.title || kind;
  const side = state ? sidesWithTones(state) : null;
  const bowlingEvent = kind === "wicket" || kind === "three_for" || kind === "five_for" || kind === "hat_trick";
  const team = side ? (bowlingEvent ? side.bowling : side.batting) : null;
  const tone = toneStyle(look.tone);
  const deep = `var(--hb-${look.tone}-deep)`;
  return (
    <Root
      role="status"
      aria-live="polite"
      data-testid="hb-sting"
      data-sting-type={sting.type}
      data-kind={kind}
      className="inset-0 overflow-hidden"
    >
      {/* The sweep: ink and white bands across, then off. */}
      <div
        aria-hidden="true"
        className={cn("absolute inset-x-0", styles.bandSweep)}
        style={{ top: BAND_TOP - 30, height: BAND_H + 60, background: "var(--hb-ink)", "--d": "90ms" } as CSSProperties}
      />
      <div
        aria-hidden="true"
        className={cn("absolute inset-x-0", styles.bandSweep)}
        style={{ top: BAND_TOP + 60, height: BAND_H - 120, background: "var(--hb-paper)", "--d": "180ms" } as CSSProperties}
      />

      {/* The event's colour: sweeps across, then closes in on the plate. */}
      <div
        className={cn("absolute inset-x-0 overflow-hidden", styles.bandSettle, styles.sheen)}
        style={{
          ...tone,
          top: BAND_TOP,
          height: BAND_H,
          "--d": "0ms",
          "--plate-x": `${PLATE_X * 100}%`,
        } as CSSProperties}
      >
        {look.figure && (
          <span
            aria-hidden="true"
            className={cn("absolute whitespace-nowrap", styles.drift)}
            style={{
              left: `${PLATE_X * 100 + 1}%`,
              top: "50%",
              marginTop: -BAND_H * 0.62,
              fontFamily: FONT.stencil,
              fontWeight: 900,
              fontSize: BAND_H * 1.4,
              lineHeight: 0.9,
              color: "transparent",
              WebkitTextStroke: `6px ${deep}`,
              opacity: 0.7,
              "--d": "120ms",
            } as CSSProperties}
          >
            {look.figure}
          </span>
        )}
        <div
          className="absolute inset-y-0 flex items-center justify-center"
          style={{ left: `${PLATE_X * 100}%`, right: `${PLATE_X * 100}%` }}
        >
          <span
            className={cn("block whitespace-nowrap uppercase", styles.anim, styles.slam)}
            style={{
              fontFamily: FONT.stencil,
              fontWeight: 900,
              fontSize: stingWordSize(word),
              lineHeight: 0.84,
              letterSpacing: "0.01em",
              textShadow: "0 6px 0 rgb(0 0 0 / 0.18)",
              "--d": "680ms",
            } as CSSProperties}
          >
            {word}
          </span>
        </div>
      </div>

      {/* Who: rises under the plate. */}
      {(sting.subtitle || sting.detail) && (
        <div
          className="absolute flex"
          style={{
            top: BAND_TOP + BAND_H + 6,
            left: `${PLATE_X * 100}%`,
            right: `${PLATE_X * 100}%`,
            gap: 6,
          }}
        >
          {team && (
            <div
              className={cn("flex h-24 w-28 shrink-0 items-center justify-center", styles.sheen, styles.anim, styles.wipeDown)}
              style={{ ...toneStyle(team.tone), "--d": "980ms" } as CSSProperties}
            >
              <Name size={30}>{team.code}</Name>
            </div>
          )}
          <div
            className={cn("flex h-24 min-w-0 flex-1 items-center justify-between gap-8 px-8", styles.sheen, styles.anim, styles.wipeDown)}
            style={{ background: "var(--hb-ink)", color: "#ffffff", "--d": "1040ms" } as CSSProperties}
          >
            {sting.subtitle && (
              <Reveal delay={1180} className="min-w-0">
                <Name size={40}>{sting.subtitle}</Name>
              </Reveal>
            )}
            {sting.detail && (
              <Reveal delay={1260} className="shrink-0">
                <span
                  className="block whitespace-nowrap font-extrabold uppercase tabular-nums"
                  style={{ fontFamily: FONT.figures, fontSize: 32, color: "var(--hb-volt)", fontStretch: "75%" }}
                >
                  {sting.detail}
                </span>
              </Reveal>
            )}
          </div>
        </div>
      )}
    </Root>
  );
}
