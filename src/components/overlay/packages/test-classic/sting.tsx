"use client";

/**
 * Test classic event cards. Boundaries and wickets: a band above the
 * score bug, the word in the serif set in the event's colour (four in
 * green, six in gold leaf, wicket in claret), the batter and figures on
 * ivory. Milestones (fifty, hundred, three or five wickets, hat-trick):
 * an honours board, varnished wood with the name in gold leaf and the
 * figures under it, the way the boards record a hundred or a five-for,
 * with the opponent, ground and year when the match carries them. Each
 * plays in about 2.5 seconds: the band opens from the centre, the word
 * tracks in, the gold rules draw, one sheen crosses the gold.
 */

import type { CSSProperties, ReactNode } from "react";
import type { Match } from "~/lib/match-types";
import { ballsPerOverOf } from "../../score-bug";
import { oversText } from "../../overlay-kit";
import type { LiveMatchState } from "../../types";
import type { OverlayElementProps, StingKind } from "../types";
import {
  delay,
  DROP,
  Fig,
  FIGS,
  GOLD_LEAF,
  GOLD_TYPE,
  GoldRule,
  IVORY,
  NAVY,
  RADIUS,
  SERIF,
  Sheen,
  TC,
  TcRoot,
  WOOD,
} from "./kit";
import { matchYear, milestoneHeading, plural } from "./logic";

type StingProps = OverlayElementProps["sting"];

const BOARD_KINDS = new Set<StingKind>([
  "fifty",
  "hundred",
  "three_for",
  "five_for",
  "hat_trick",
  "milestone",
]);

const BOWLING_KINDS = new Set<StingKind>(["three_for", "five_for", "hat_trick"]);

/** The word's block for each event: its colour says what happened. */
const WORD_STYLE: Partial<Record<StingKind, CSSProperties>> = {
  four: {
    background: "linear-gradient(180deg, #2f7a53 0%, #1f5a3d 55%, #163f2b 100%)",
    color: "#ffffff",
  },
  six: { background: GOLD_TYPE, color: TC.ink },
  wicket: {
    background: `linear-gradient(180deg, ${TC.claretHi} 0%, ${TC.claret} 55%, #5e121c 100%)`,
    color: "#ffffff",
  },
  free_hit: { ...NAVY },
};

const WORD: Partial<Record<StingKind, string>> = {
  four: "Four",
  six: "Six",
  wicket: "Wicket",
  free_hit: "Free hit",
};

/** The batter's or bowler's figures from the live row, when the card names them. */
function figuresFor(
  state: LiveMatchState | null,
  name: string | undefined,
  bowling: boolean,
  match: Match | null,
): { big: string; note: string | null } | null {
  if (!state || !name) return null;
  const bpo = ballsPerOverOf(match);
  if (bowling) {
    if (name !== state.current_bowler_name) return null;
    return {
      big: `${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0}`,
      note: `${oversText(state.bowler_balls, bpo)} overs${state.bowler_maidens ? ` · ${plural(state.bowler_maidens, "maiden")}` : ""}`,
    };
  }
  const striker = name === state.striker_name;
  const non = name === state.non_striker_name;
  if (!striker && !non) return null;
  const runs = (striker ? state.striker_runs : state.non_striker_runs) ?? 0;
  const balls = (striker ? state.striker_balls : state.non_striker_balls) ?? 0;
  const fours = striker ? state.striker_fours : state.non_striker_fours;
  const sixes = striker ? state.striker_sixes : state.non_striker_sixes;
  const parts = [plural(balls, "ball")];
  if (fours !== null && fours !== undefined) parts.push(plural(fours, "four"));
  if (sixes !== null && sixes !== undefined) parts.push(plural(sixes, "six", "sixes"));
  return { big: String(runs), note: parts.join(" · ") };
}

function Band({ p }: { p: StingProps }) {
  const { sting, kind } = p;
  const word = WORD[kind] ?? sting.title;
  const free = kind === "free_hit";
  const figures =
    kind === "four" || kind === "six"
      ? figuresFor(p.state, sting.subtitle, false, p.match)
      : null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-sting-type={sting.type}
      className="w-[66rem] overflow-hidden"
      style={{ borderRadius: RADIUS, boxShadow: DROP }}
    >
      <GoldRule from="centre" d={120} />
      <div className="tc-a-wipe-c flex h-[8.5rem] items-stretch" style={IVORY}>
        <div
          className="relative flex w-[24rem] shrink-0 items-center justify-center overflow-hidden"
          style={WORD_STYLE[kind] ?? NAVY}
        >
          <span
            className={`tc-a-track whitespace-nowrap font-bold uppercase leading-none ${word.length > 6 ? "text-[2.75rem]" : "text-[4.25rem]"}`}
            style={{ fontFamily: SERIF, "--tc-track": word.length > 6 ? "0.08em" : "0.12em", ...delay(180) } as CSSProperties}
          >
            {word}
          </span>
          <Sheen d={900} opacity={kind === "six" ? 0.8 : 0.35} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-9">
          {free ? (
            <>
              <span className="tc-a-rise truncate text-[2.25rem] font-bold" style={{ fontFamily: SERIF, color: TC.claret, ...delay(300) }}>
                {sting.subtitle ?? "No-ball called"}
              </span>
              <span className="tc-a-fade truncate text-[1.5rem]" style={{ color: TC.ink, ...delay(450) }}>
                {sting.detail ?? "Next delivery is a free hit"}
                <span style={{ color: TC.inkMuted }}> · only a run out dismisses</span>
              </span>
            </>
          ) : (
            <>
              {sting.subtitle && (
                <span className="tc-a-rise truncate text-[2.375rem] font-bold leading-tight" style={{ fontFamily: SERIF, color: TC.ink, ...delay(300) }}>
                  {sting.subtitle}
                </span>
              )}
              {(figures || sting.detail) && (
                <span className="tc-a-fade flex items-baseline gap-3 truncate" style={{ color: TC.ink, ...delay(460) }}>
                  {figures ? (
                    <>
                      <Fig className="text-[2rem]">{figures.big}*</Fig>
                      <span className="truncate text-[1.375rem]" style={{ color: TC.inkMuted, ...FIGS }}>
                        {figures.note}
                      </span>
                    </>
                  ) : (
                    <span className="truncate text-[1.5rem] font-semibold" style={FIGS}>
                      {sting.detail}
                    </span>
                  )}
                </span>
              )}
              {!sting.subtitle && !sting.detail && (
                <span className="tc-a-rise truncate text-[2.375rem] font-bold" style={{ fontFamily: SERIF, color: TC.ink, ...delay(300) }}>
                  {sting.title}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <GoldRule from="centre" d={200} />
    </div>
  );
}

/** A thin gold ornament: rule, lozenge, rule. */
function Ornament({ children }: { children: ReactNode }) {
  const line = (
    <span
      aria-hidden="true"
      className="tc-a-rule-c h-[2px] flex-1"
      style={{ background: GOLD_LEAF, ...delay(300) }}
    />
  );
  const lozenge = (
    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rotate-45" style={{ background: GOLD_LEAF }} />
  );
  return (
    <div className="flex items-center gap-4">
      {line}
      {lozenge}
      <span className="shrink-0">{children}</span>
      {lozenge}
      {line}
    </div>
  );
}

/** Gold-leaf lettering (with an engraved drop). */
const GILT: CSSProperties = {
  backgroundImage: GOLD_TYPE,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  filter: "drop-shadow(0 2px 0 rgba(0, 0, 0, 0.55))",
};

function HonoursBoard({ p }: { p: StingProps }) {
  const { sting, kind, state, match } = p;
  const heading = milestoneHeading(kind) ?? sting.title;
  const bowling = BOWLING_KINDS.has(kind);
  const figures = figuresFor(state, sting.subtitle, bowling, match);
  const opponent = state
    ? bowling
      ? state.batting_team_name
      : state.bowling_team_name
    : null;
  const year = matchYear(match);
  const record = [opponent && `v ${opponent}`, state?.venue, year].filter(Boolean) as string[];
  return (
    <div
      role="status"
      aria-live="polite"
      data-sting-type={sting.type}
      data-honours-board=""
      className="tc-a-wipe-up relative w-[70rem] overflow-hidden p-[6px]"
      style={{ ...WOOD, borderRadius: RADIUS, boxShadow: `${WOOD.boxShadow}, ${DROP}` }}
    >
      {/* The gilt frame: an outer and an inner rule. */}
      <div
        className="relative px-14 pb-8 pt-7 text-center"
        style={{
          borderRadius: RADIUS - 1,
          boxShadow: `inset 0 0 0 2px ${TC.gold}, inset 0 0 0 7px rgba(33,19,10,0.6), inset 0 0 0 8px rgba(201,162,76,0.55)`,
        }}
      >
        <Ornament>
          <span
            className="tc-a-track text-[1.375rem] font-semibold uppercase"
            style={{ ...GILT, "--tc-track": "0.32em", ...delay(250) } as CSSProperties}
          >
            {heading}
          </span>
        </Ornament>
        <div
          className="tc-a-rise mt-5 truncate text-[4.25rem] font-bold uppercase leading-[1.1] tracking-[0.05em]"
          style={{ fontFamily: SERIF, ...GILT, ...delay(420) }}
        >
          {sting.subtitle ?? sting.title}
        </div>
        {(figures || sting.detail) && (
          <div className="tc-a-fade mt-4 flex items-baseline justify-center gap-5" style={delay(700)}>
            <Fig className="text-[3.5rem]" style={GILT}>
              {figures?.big ?? sting.detail}
            </Fig>
            {figures?.note && (
              <span className="text-[1.5rem] italic" style={{ fontFamily: SERIF, color: "rgba(246,231,176,0.9)", ...FIGS }}>
                {figures.note}
              </span>
            )}
          </div>
        )}
        {record.length > 0 && (
          <div
            className="tc-a-fade mt-4 text-[1.5rem] italic"
            style={{ fontFamily: SERIF, color: "rgba(236,214,150,0.92)", ...delay(900) }}
          >
            {record.join("  ·  ")}
          </div>
        )}
      </div>
      <Sheen d={1100} opacity={0.22} />
    </div>
  );
}

export function TestClassicSting(p: StingProps) {
  const board = BOARD_KINDS.has(p.kind);
  return (
    <TcRoot
      className="fixed inset-x-0 z-50 flex justify-center"
      style={{ bottom: 236 }}
    >
      {board ? <HonoursBoard p={p} /> : <Band p={p} />}
    </TcRoot>
  );
}
