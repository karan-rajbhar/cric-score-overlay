"use client";

/**
 * Franchise night's stings: shards in the side's colour sweep across the
 * screen, the word slams in at full width with a shock ring and a light
 * sweep, then the player's line slides in under it. Boundaries and
 * batting milestones in the batting side's colours, wickets red, bowling
 * milestones in the bowling side's, free hits orange.
 */

import type { CSSProperties } from "react";
import { cn } from "~/lib/utils";
import { withAlpha } from "../../overlay-themes";
import type { OverlayElementProps, StingKind } from "../types";
import {
  DISPLAY,
  FIGURE,
  FnRoot,
  SAFE,
  TEXT,
  chamfer,
  deepGlass,
  delay,
  goldFill,
} from "./kit";
import { FN, matchTones, teamTone, type TeamTone } from "./theme";

interface StingLook {
  /** The word. */
  word: string;
  tone: TeamTone;
  /** The second shard colour. */
  accent: string;
  /** Fill of the word. */
  fill: string;
}

const BOWLING_KINDS = new Set<StingKind>(["wicket", "three_for", "five_for", "hat_trick"]);

/** The gloss over the colour band. */
const GLOSS_BAND =
  "linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.06) 47%, rgba(0,0,0,0) 53%, rgba(0,0,0,0.22) 100%)";

const WORD: Partial<Record<StingKind, string>> = {
  four: "Four",
  six: "Six",
  wicket: "Wicket",
  fifty: "Fifty",
  hundred: "Hundred",
  three_for: "Three-for",
  five_for: "Five-for",
  hat_trick: "Hat-trick",
  free_hit: "Free hit",
};

const SILVER = "linear-gradient(180deg, #ffffff 0%, #ffffff 46%, #d9deea 54%, #f6f7fb 100%)";
const GOLD = `linear-gradient(180deg, #fff3c4 0%, #ffd75e 44%, ${FN.goldDeep} 56%, #ffe7a0 100%)`;
/** The word on a light band (a yellow or white side): dark ink. */
const INK = "linear-gradient(180deg, #2a3042 0%, #10131d 48%, #05070c 54%, #1d2232 100%)";

function baseLook(p: OverlayElementProps["sting"]): StingLook {
  const tones = matchTones(p.state);
  const word = WORD[p.kind] ?? p.sting.title ?? "Milestone";
  switch (p.kind) {
    case "wicket":
      return { word, tone: teamTone("#d0182d", "#d0182d"), accent: tones.bowl.light, fill: SILVER };
    case "free_hit":
      return { word, tone: teamTone("#e8720c", "#e8720c"), accent: FN.gold, fill: SILVER };
    case "four":
      return { word, tone: tones.bat, accent: FN.four, fill: SILVER };
    case "six":
      return { word, tone: tones.bat, accent: FN.six, fill: GOLD };
    default:
      return {
        word,
        tone: BOWLING_KINDS.has(p.kind) ? tones.bowl : tones.bat,
        accent: FN.gold,
        fill: GOLD,
      };
  }
}

/** The sting's colours: silver or gold type, dark type on a light side's band. */
export function lookOf(p: OverlayElementProps["sting"]): StingLook {
  const look = baseLook(p);
  return look.tone.text === FN.white ? look : { ...look, fill: INK };
}

/** The word's size: as big as fits inside title safe. */
function wordSize(word: string): string {
  const px = Math.min(272, 1500 / Math.max(3, word.length * 0.5));
  return `${(px / 16).toFixed(2)}rem`;
}

/**
 * One shard: a band that sweeps in from one side, its ends cut on the
 * slant where they stop inside the picture (`left` / `right` insets).
 */
function Shard({
  top,
  height,
  background,
  at,
  from = "left",
  opacity = 1,
  left = "-200px",
  right = "-200px",
}: {
  top: number;
  height: number;
  background: string;
  at: number;
  from?: "left" | "right";
  opacity?: number;
  left?: string;
  right?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("absolute block", from === "left" ? "fn-a-shard" : "fn-a-shard-r")}
      style={{
        ...delay(at),
        top,
        height,
        left,
        right,
        opacity,
      }}
    >
      <span
        className="absolute inset-0 block"
        style={{ transform: "skewX(-24deg)", background }}
      />
    </span>
  );
}

export function FranchiseSting(p: OverlayElementProps["sting"]) {
  const look = lookOf(p);
  const { tone } = look;
  const subtitle = p.sting.subtitle;
  const detail =
    p.kind === "free_hit" ? (p.sting.detail ?? "Only a run out stands") : p.sting.detail;
  const band: CSSProperties = { top: 300, height: 400 };
  return (
    <FnRoot className="fixed inset-0 z-50 overflow-hidden" aria-hidden={false}>
      <div
        key={p.sting.id}
        role="status"
        aria-live="polite"
        data-sting-type={p.sting.type}
        data-sting-kind={p.kind}
        className="absolute inset-x-0"
        style={band}
      >
        {/* Shards on a rising tilt: the dark backing, the side's colour,
            accent cuts and light streaks that stop short of the edges. */}
        <div aria-hidden="true" className="absolute inset-0" style={{ transform: "rotate(-3.5deg)" }}>
          <Shard top={34} height={300} at={0} background={`linear-gradient(180deg, ${withAlpha(tone.deep, 0.94)} 0%, ${withAlpha(FN.ink, 0.95)} 100%)`} />
          <Shard top={66} height={236} at={60} from="right" background={`${GLOSS_BAND}, linear-gradient(100deg, ${tone.light} 0%, ${tone.base} 42%, ${tone.deep} 100%)`} />
          <Shard top={48} height={14} at={150} background={look.accent} right="40%" />
          <Shard top={308} height={12} at={190} from="right" background={look.accent} left="44%" />
          <Shard top={326} height={4} at={230} background={withAlpha(FN.white, 0.75)} left="12%" right="30%" />
          <Shard top={22} height={4} at={270} from="right" background={withAlpha(FN.white, 0.6)} left="58%" />
          <Shard top={90} height={3} at={320} background={withAlpha(FN.white, 0.35)} right="72%" />
          <Shard top={274} height={3} at={340} from="right" background={withAlpha(FN.white, 0.35)} left="76%" />
        </div>

        {/* The shock ring behind the word. */}
        <span
          aria-hidden="true"
          className="fn-a-ring absolute left-1/2 top-[175px] block h-[260px] w-[260px] rounded-full"
          style={{ ...delay(260), border: `10px solid ${withAlpha(FN.white, 0.8)}`, marginLeft: -130, marginTop: -130 }}
        />

        {/* The word. */}
        <div className="absolute inset-x-0 top-[70px] flex h-[210px] items-center justify-center" style={{ padding: `0 ${SAFE.x}px` }}>
          <span
            className={cn(DISPLAY, "fn-a-pop fn-italic relative block whitespace-nowrap")}
            style={{
              ...delay(180),
              fontSize: wordSize(look.word),
              lineHeight: 0.92,
              letterSpacing: "0.02em",
              backgroundImage: look.fill,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: `drop-shadow(0 6px 0 ${withAlpha(FN.ink, 0.55)}) drop-shadow(0 0 2px ${withAlpha(FN.ink, 0.6)})`,
              paddingRight: "0.08em",
            }}
          >
            {look.word}
          </span>
          {/* A sweep of light across the word. */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <span
              className="fn-a-sheen absolute inset-y-[-30%] left-0 block w-[14%]"
              style={{
                ...delay(700),
                background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)",
              }}
            />
          </span>
        </div>

        {/* The player's line. */}
        {(subtitle || detail) && (
          <div className="absolute inset-x-0 top-[352px] flex justify-center">
            <div
              className="fn-a-wipe-c flex items-stretch"
              style={{ ...delay(620), clipPath: chamfer(12), filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.5))" }}
            >
              {subtitle && (
                <span
                  className={cn(DISPLAY, "flex items-center px-8")}
                  style={{ ...goldFill(), fontSize: "2.5rem", height: 68, letterSpacing: "0.02em" }}
                >
                  {subtitle}
                </span>
              )}
              {detail && (
                <span
                  className={cn(p.kind === "free_hit" ? TEXT : FIGURE, "flex items-center px-8 font-semibold")}
                  style={{ ...deepGlass(), fontSize: p.kind === "free_hit" ? "1.75rem" : "2.25rem", height: 68 }}
                >
                  {detail}
                </span>
              )}
            </div>
          </div>
        )}
        <span className="sr-only">{p.sting.title}</span>
      </div>
    </FnRoot>
  );
}
