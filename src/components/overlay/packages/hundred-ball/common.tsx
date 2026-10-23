"use client";

/**
 * Pieces several Hundred-ball graphics share: who bats, the chase
 * statement, batter and bowler cells, the start time.
 */

import { useEffect, useState, type ReactNode } from "react";
import { battingSide } from "../../overlay-kit";
import { sidesOf, teamCode, type Side } from "../shared";
import type { LiveMatchState } from "../../types";
import { ballsWord, surnameOf, type Chase } from "./balls";
import {
  Block,
  BowlingFig,
  Crest,
  Fig,
  FONT,
  HERO_H,
  Label,
  mutedOn,
  Reveal,
  sideTone,
  type Tone,
} from "./kit";

export const codeOf = (side: Pick<Side, "short" | "name">) =>
  teamCode(side.short, side.name);

export interface Sides {
  batting: Side & { tone: Tone; code: string };
  bowling: Side & { tone: Tone; code: string };
}

/** The batting and bowling sides with their tones and codes. */
export function sidesWithTones(state: LiveMatchState): Sides {
  const { batting, bowling } = sidesOf(state);
  const side = battingSide(state);
  const batTone = sideTone(side);
  const bowlTone: Tone = side === 2 ? "t1" : "t2";
  return {
    batting: { ...batting, tone: batTone, code: codeOf(batting) },
    bowling: { ...bowling, tone: bowlTone, code: codeOf(bowling) },
  };
}

/** Team 1 / team 2 as sides (match intro, toss, result). */
export function teamsOf(state: LiveMatchState) {
  return [
    {
      n: 1 as const,
      name: state.team1_name,
      short: state.team1_short_name,
      logo: state.team1_logo_url ?? null,
      tone: "t1" as Tone,
      code: teamCode(state.team1_short_name, state.team1_name),
    },
    {
      n: 2 as const,
      name: state.team2_name,
      short: state.team2_short_name,
      logo: state.team2_logo_url ?? null,
      tone: "t2" as Tone,
      code: teamCode(state.team2_short_name, state.team2_name),
    },
  ];
}

/** The team (1 / 2) a name belongs to, if either. */
export function teamNumberOf(
  state: LiveMatchState,
  name: string | null | undefined,
): 1 | 2 | null {
  if (!name) return null;
  if (name === state.team1_name) return 1;
  if (name === state.team2_name) return 2;
  return null;
}

/** "1st", "2nd", "Super over" for an innings number. */
export function inningsShort(n: number | null | undefined): string {
  if ((n ?? 1) >= 3) return "Super over";
  return n === 2 ? "2nd inns" : "1st inns";
}

/**
 * The chase in one line, the figures big: NEEDS 24 FROM 15 BALLS.
 * `size` is the figures' size; words are 0.42 of it.
 */
export function ChaseLine({
  chase,
  size = 36,
  color,
}: {
  chase: Chase;
  size?: number;
  color?: string;
}) {
  const word = Math.max(18, Math.round(size * 0.46));
  const w = (t: string) => (
    <span className="shrink-0">
      <Label size={word} style={{ letterSpacing: "0.04em", overflow: "visible" }} color={color}>
        {t}
      </Label>
    </span>
  );
  return (
    <span
      className="flex items-baseline whitespace-nowrap"
      style={{ gap: Math.round(size * 0.24) }}
      aria-label={`Needs ${chase.runs} from ${chase.balls} ${ballsWord(chase.balls)}`}
    >
      {w("Needs")}
      <Fig value={chase.runs} size={size} />
      {w("from")}
      <Fig value={chase.balls} size={size} />
      {w(ballsWord(chase.balls))}
    </span>
  );
}

/** A batter in a strip: SURNAME 42 (28), the striker marked. */
export function BatterCell({
  name,
  runs,
  balls,
  striker,
  size = 26,
}: {
  name: string | null;
  runs: number | null;
  balls: number | null;
  striker: boolean;
  size?: number;
}) {
  if (!name) return null;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="shrink-0"
        style={{
          width: 8,
          height: size + 4,
          background: striker ? "var(--hb-volt)" : "transparent",
        }}
      />
      <span
        className="min-w-0 truncate font-bold uppercase"
        style={{ fontSize: size * 0.92, fontStretch: "75%", letterSpacing: "-0.01em" }}
      >
        {surnameOf(name)}
        {striker && <span className="sr-only"> on strike</span>}
      </span>
      <span className="flex shrink-0 items-baseline gap-1.5">
        <Fig value={runs ?? 0} size={size * 1.3} />
        <span
          className="font-semibold tabular-nums"
          style={{ fontSize: size * 0.8, color: "var(--hb-ink-muted)", fontStretch: "75%" }}
        >
          ({balls ?? 0})
        </span>
      </span>
    </div>
  );
}

/** The bowler in a strip: SURNAME 1-18 · 14 BALLS. */
export function BowlerCell({
  state,
  tone,
  size = 26,
}: {
  state: LiveMatchState;
  tone: Tone;
  size?: number;
}) {
  if (!state.current_bowler_name) return null;
  const balls = state.bowler_balls ?? 0;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="shrink-0"
        style={{ width: 8, height: size + 4, background: `var(--hb-${tone}-pop)` }}
      />
      <span
        className="min-w-0 truncate font-bold uppercase"
        style={{ fontSize: size * 0.92, fontStretch: "75%", letterSpacing: "-0.01em" }}
      >
        {surnameOf(state.current_bowler_name)}
      </span>
      <span className="flex shrink-0 items-baseline gap-2">
        <BowlingFig
          wickets={state.bowler_wickets}
          runs={state.bowler_runs}
          size={size * 1.3}
        />
        <span
          className="font-semibold uppercase tabular-nums"
          style={{ fontSize: size * 0.72, color: "var(--hb-ink-muted)", fontStretch: "75%" }}
        >
          {balls} {ballsWord(balls)}
        </span>
      </span>
    </div>
  );
}

/** Local start time, formatted after hydration (the server has no zone). */
export function useStartTime(iso: string | null | undefined): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!iso) return;
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return;
    const sameDay = at.toDateString() === new Date().toDateString();
    const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const value = sameDay
      ? time
      : `${at.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} ${time}`;
    const id = setTimeout(() => setText(value), 0);
    return () => clearTimeout(id);
  }, [iso]);
  return text;
}

/** A caption line in the text face. */
export function Caption({
  children,
  color,
  size = 22,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="block truncate font-medium"
      style={{ fontFamily: FONT.text, fontSize: size, color, lineHeight: 1.2 }}
    >
      {children}
    </span>
  );
}

/** The batting side's block: crest or code, the innings under it. */
export function SideBlock({
  tone,
  logo,
  code,
  detail,
  width = 136,
  height = HERO_H,
  delay = 0,
}: {
  tone: Tone;
  logo: string | null;
  code: string;
  detail?: string | null;
  width?: number;
  height?: number;
  delay?: number;
}) {
  return (
    <Block
      tone={tone}
      className="flex shrink-0 flex-col items-center justify-center gap-2 px-3"
      style={{ width, height }}
    >
      <Reveal delay={delay} kind="pop" className="flex w-full justify-center">
        <span
          className="flex items-center justify-center"
          style={{ height: logo ? height * 0.5 : "auto", width: logo ? height * 0.5 : "100%" }}
        >
          <Crest logo={logo} code={code} size={Math.round(height * 0.31)} />
        </span>
      </Reveal>
      {detail && (
        <Label size={18} color={mutedOn(tone)} className="max-w-full text-center">
          {detail}
        </Label>
      )}
    </Block>
  );
}

