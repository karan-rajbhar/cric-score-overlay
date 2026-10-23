"use client";

/**
 * Hundred-ball lower thirds: a tab on top, then a slab of three blocks
 * (the side's colour, the name on paper, one big figure on ink). Few
 * numbers, large: a batter is runs (balls), a bowler wickets-runs from N
 * balls, a stand its runs (balls), the chase one statement.
 *
 * A producer's strap text wins over the live row; a figure shows only
 * when the named player is the one the live row describes.
 */

import type { ReactNode } from "react";
import { formatDismissalType } from "~/lib/cricket";
import { cn } from "~/lib/utils";

import { estimateOf, strapText } from "../shared";
import type { ActiveLowerThirdStrap, LayoutMode, LiveMatchState } from "../../types";
import type { BreakKind, ElementBaseProps, OverlayElementProps } from "../types";
import {
  ballCountOf,
  ballsPerOverFrom,
  ballsWord,
  chaseOf,
  currentSetOf,
  surnameOf,
} from "./balls";
import {
  Caption,
  ChaseLine,
  SideBlock,
  sidesWithTones,
  type Sides,
} from "./common";
import {
  Block,
  BowlingFig,
  deepOf,
  Fig,
  FONT,
  HERO_H,
  Label,
  lowerAnchor,
  mutedOn,
  Name,
  Reveal,
  Root,
  SAFE,
  ScoreFig,
  SetSquares,
  Slab,
  Tab,
  Text,
  type Tone,
} from "./kit";

/** Widest a lower third gets (it sits beside the bottom-left bug). */
const MAX_W = 820;

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/** Runs (balls) as one figure group. */
export function RunsBalls({
  runs,
  balls,
  size = 84,
  color = "var(--hb-ink-muted)",
}: {
  runs: number | null | undefined;
  balls: number | null | undefined;
  size?: number;
  color?: string;
}) {
  return (
    <span className="flex items-baseline gap-2 whitespace-nowrap">
      <Fig value={runs ?? 0} size={size} />
      <span
        className="font-bold tabular-nums"
        style={{ fontSize: Math.round(size * 0.42), color, fontStretch: "75%" }}
      >
        ({balls ?? 0})
      </span>
    </span>
  );
}

export interface PlateProps {
  layout: LayoutMode;
  testId: string;
  tab?: ReactNode;
  tabTone?: Tone;
  side?: { tone: Tone; logo: string | null; code: string } | null;
  name: ReactNode;
  sub?: ReactNode;
  hero?: ReactNode;
  heroLabel?: ReactNode;
  heroTone?: Tone;
  /** Replaces the hero block (a set's squares, a split bar). */
  aside?: ReactNode;
}

/** The lower-third shape every strap shares. */
export function Plate({
  layout,
  testId,
  tab,
  tabTone = "volt",
  side,
  name,
  sub,
  hero,
  heroLabel,
  heroTone = "ink",
  aside,
}: PlateProps) {
  const anchor = lowerAnchor(layout);
  const fromRight = anchor.from === "right";
  const enter = fromRight ? "wipeLeft" : anchor.from === "left" ? "wipeRight" : "wipeUp";
  const heroMuted = heroTone === "ink" || heroTone === "ink2" ? "var(--hb-volt)" : mutedOn(heroTone);
  return (
    <Root
      data-testid={testId}
      style={anchor.style}
      className={cn(
        "flex flex-col gap-2",
        fromRight ? "items-end" : anchor.from === "centre" ? "items-center" : "items-start",
      )}
    >
      {tab && (
        <Tab tone={tabTone} cut={fromRight ? "left" : "right"} enter={enter} delay={220}>
          <Label size={22}>{tab}</Label>
        </Tab>
      )}
      <Slab
        deep={side ? deepOf(side.tone) : "#000000"}
        cut={fromRight ? "left" : "right"}
        enter={enter}
        style={{ maxWidth: MAX_W }}
      >
        {side && (
          <SideBlock tone={side.tone} logo={side.logo} code={side.code} width={112} delay={120} />
        )}
        <Block
          tone="paper"
          className="flex min-w-0 flex-col justify-center gap-2 px-7"
          style={{ height: HERO_H, minWidth: 260 }}
        >
          <Reveal delay={160}>
            <Name size={40}>{name}</Name>
          </Reveal>
          {sub && (
            <Reveal delay={220}>
              <Caption color="var(--hb-paper-muted)" size={24}>
                {sub}
              </Caption>
            </Reveal>
          )}
        </Block>
        {aside}
        {!aside && hero !== undefined && hero !== null && (
          <Block
            tone={heroTone}
            className="flex shrink-0 flex-col justify-between px-7"
            style={{ height: HERO_H, paddingTop: 16, paddingBottom: 16 }}
          >
            <Label color={heroMuted}>{heroLabel}</Label>
            <Reveal delay={240}>{hero}</Reveal>
          </Block>
        )}
      </Slab>
    </Root>
  );
}

// ---- players ------------------------------------------------------------------

const sideOf = (s: Sides["batting"]) => ({ tone: s.tone, logo: s.logo, code: s.code });

function countsLine(fours?: number | null, sixes?: number | null): string | null {
  const parts: string[] = [];
  if (fours !== null && fours !== undefined) parts.push(`${fours} ${fours === 1 ? "four" : "fours"}`);
  if (sixes !== null && sixes !== undefined) parts.push(`${sixes} ${sixes === 1 ? "six" : "sixes"}`);
  return parts.length ? parts.join(" · ") : null;
}

export function HundredBatter(p: OverlayElementProps["batterLowerThird"]) {
  const { state, slot, strap } = p;
  const sides = sidesWithTones(state);
  if (slot === "last_out") {
    const w = state.last_wicket;
    const name = strap?.title || w?.name;
    if (!name) return null;
    const same = !!w && name === w.name;
    const how = w
      ? [
          formatDismissalType(w.dismissal_type),
          w.bowler_name && `b ${w.bowler_name}`,
          `at ${w.score}-${w.wicket_number}`,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;
    return (
      <Plate
        layout={p.layout}
        testId="hb-batter"
        tab={strap?.badge || "Out"}
        tabTone="wicket"
        side={sideOf(sides.batting)}
        name={name}
        sub={strap?.subtitle || (same ? how : null)}
        hero={same && w ? <RunsBalls runs={w.runs} balls={w.balls} /> : null}
        heroLabel="Runs"
      />
    );
  }
  const striker = slot === "striker";
  const live = striker ? state.striker_name : state.non_striker_name;
  const name = strap?.title || live;
  if (!name) return null;
  const same = name === live;
  const runs = striker ? state.striker_runs : state.non_striker_runs;
  const balls = striker ? state.striker_balls : state.non_striker_balls;
  const counts = striker
    ? countsLine(state.striker_fours, state.striker_sixes)
    : countsLine(state.non_striker_fours, state.non_striker_sixes);
  return (
    <Plate
      layout={p.layout}
      testId="hb-batter"
      tab={strap?.badge || (striker ? "On strike" : "Batting")}
      side={sideOf(sides.batting)}
      name={name}
      sub={strap?.subtitle || (same ? counts : null)}
      hero={same ? <RunsBalls runs={runs} balls={balls} /> : null}
      heroLabel="Runs"
    />
  );
}

/** The bowler's figures: 1-18 from 14 balls. */
function bowlerHero(state: LiveMatchState) {
  const balls = state.bowler_balls ?? 0;
  return {
    hero: <BowlingFig wickets={state.bowler_wickets} runs={state.bowler_runs} size={84} />,
    label: `From ${balls} ${ballsWord(balls)}`,
  };
}

export function HundredBowler(p: OverlayElementProps["bowlerLowerThird"]) {
  const { state, strap } = p;
  const name = strap?.title || state.current_bowler_name;
  if (!name) return null;
  const same = name === state.current_bowler_name;
  const sides = sidesWithTones(state);
  const maidens = state.bowler_maidens ?? 0;
  const fig = bowlerHero(state);
  return (
    <Plate
      layout={p.layout}
      testId="hb-bowler"
      tab={strap?.badge || "Bowling"}
      side={sideOf(sides.bowling)}
      name={name}
      sub={strap?.subtitle || (same && maidens > 0 ? `${maidens} ${maidens === 1 ? "maiden" : "maidens"}` : null)}
      hero={same ? fig.hero : null}
      heroLabel={fig.label}
    />
  );
}

export function HundredNewBatter(p: OverlayElementProps["newBatter"]) {
  const { state, strap } = p;
  const text = strapText(strap, state);
  const name = text?.title || strap.title;
  if (!name) return null;
  const sides = sidesWithTones(state);
  const atCrease =
    name === state.striker_name
      ? { r: state.striker_runs, b: state.striker_balls }
      : name === state.non_striker_name
        ? { r: state.non_striker_runs, b: state.non_striker_balls }
        : null;
  return (
    <Plate
      layout={p.layout}
      testId="hb-new-batter"
      tab={text?.badge || "New batter"}
      side={sideOf(sides.batting)}
      name={name}
      sub={text?.subtitle}
      hero={atCrease ? <RunsBalls runs={atCrease.r} balls={atCrease.b} /> : null}
      heroLabel="Runs"
    />
  );
}

export function HundredNewBowler(p: OverlayElementProps["newBowler"]) {
  const { state, strap } = p;
  const text = strapText(strap, state);
  const name = text?.title || strap.title;
  if (!name) return null;
  const sides = sidesWithTones(state);
  const same = name === state.current_bowler_name;
  const bpo = ballsPerOverFrom(state, p.match);
  const set = currentSetOf(state, bpo);
  const fig = bowlerHero(state);
  const bowled = same && (state.bowler_balls ?? 0) > 0;
  return (
    <Plate
      layout={p.layout}
      testId="hb-new-bowler"
      tab={text?.badge || "New bowler"}
      side={sideOf(sides.bowling)}
      name={name}
      sub={text?.subtitle}
      hero={bowled ? fig.hero : same ? <Fig value={set.number} size={84} /> : null}
      heroLabel={bowled ? fig.label : `${set.word}`}
    />
  );
}

export function HundredPartnershipStrap(p: OverlayElementProps["partnership"]) {
  const { state, strap } = p;
  const sides = sidesWithTones(state);
  const has =
    state.partnership_runs !== null && !!state.striker_name && !!state.non_striker_name;
  if (!has && !strap?.title) return null;
  const pair = has
    ? `${surnameOf(state.striker_name)} & ${surnameOf(state.non_striker_name)}`
    : strap!.title;
  return (
    <Plate
      layout={p.layout}
      testId="hb-partnership"
      tab={strap?.badge || "Partnership"}
      side={sideOf(sides.batting)}
      name={strap?.title || pair}
      sub={strap?.subtitle || (has ? `${ordinal((state.total_wickets ?? 0) + 1)} wicket` : null)}
      hero={
        has ? <RunsBalls runs={state.partnership_runs} balls={state.partnership_balls} /> : null
      }
      heroLabel="Runs"
    />
  );
}

// ---- the chase ------------------------------------------------------------------

export function HundredChase(p: OverlayElementProps["chase"]) {
  const { state, strap } = p;
  const chase = chaseOf(state);
  const sides = sidesWithTones(state);
  if (!chase) {
    if (!strap?.title) return null;
    return (
      <Plate
        layout={p.layout}
        testId="hb-chase"
        tab={strap.badge || "The chase"}
        side={sideOf(sides.batting)}
        name={strap.title}
        sub={strap.subtitle}
      />
    );
  }
  const anchor = lowerAnchor(p.layout);
  const fromRight = anchor.from === "right";
  const enter = fromRight ? "wipeLeft" : anchor.from === "left" ? "wipeRight" : "wipeUp";
  return (
    <Root
      data-testid="hb-chase"
      style={anchor.style}
      className={cn("flex flex-col gap-2", fromRight ? "items-end" : "items-start")}
    >
      <Tab tone="paper" cut={fromRight ? "left" : "right"} enter={enter} delay={240}>
        <Label size={22}>{strap?.badge || `${sides.batting.code} chasing`}</Label>
      </Tab>
      <Slab deep={deepOf(sides.batting.tone)} cut={fromRight ? "left" : "right"} enter={enter} style={{ maxWidth: MAX_W }}>
        <SideBlock tone={sides.batting.tone} logo={sides.batting.logo} code={sides.batting.code} width={112} delay={120} />
        <Block tone="volt" className="flex items-center px-7" style={{ height: HERO_H }}>
          <Reveal delay={180}>
            <ChaseLine chase={chase} size={72} />
          </Reveal>
        </Block>
        {chase.target !== null && (
          <Block tone="ink" className="flex shrink-0 flex-col justify-between px-6" style={{ height: HERO_H, paddingTop: 16, paddingBottom: 16 }}>
            <Label color="var(--hb-volt)">Target</Label>
            <Reveal delay={240}>
              <Fig value={chase.target} size={56} />
            </Reveal>
          </Block>
        )}
      </Slab>
    </Root>
  );
}

// ---- this set ---------------------------------------------------------------------

export function HundredThisOverStrap(p: OverlayElementProps["thisOver"]) {
  const { state, strap } = p;
  const bpo = ballsPerOverFrom(state, p.match);
  const set = currentSetOf(state, bpo);
  const runs = state.this_over_runs;
  if (!set.balls.length && runs === null) {
    if (!strap?.title) return null;
    return (
      <Plate layout={p.layout} testId="hb-this-over" tab={strap.badge || `${set.word} ${set.number}`} name={strap.title} sub={strap.subtitle} />
    );
  }
  const anchor = lowerAnchor(p.layout);
  const fromRight = anchor.from === "right";
  const enter = fromRight ? "wipeLeft" : anchor.from === "left" ? "wipeRight" : "wipeUp";
  const sides = sidesWithTones(state);
  return (
    <Root
      data-testid="hb-this-over"
      style={anchor.style}
      className={cn("flex flex-col gap-2", fromRight ? "items-end" : "items-start")}
    >
      <Tab tone="volt" cut={fromRight ? "left" : "right"} enter={enter} delay={240}>
        <Label size={22}>{strap?.badge || `${set.word} ${set.number}`}</Label>
      </Tab>
      <Slab deep={deepOf(sides.bowling.tone)} cut={fromRight ? "left" : "right"} enter={enter} style={{ maxWidth: MAX_W }}>
        <Block tone="paper" className="flex shrink-0 flex-col justify-between px-7" style={{ height: HERO_H, paddingTop: 16, paddingBottom: 16 }}>
          <Label color="var(--hb-paper-muted)">Runs</Label>
          <Reveal delay={160}>
            <Fig value={runs ?? 0} size={84} />
          </Reveal>
        </Block>
        <Block tone="ink" className="flex min-w-0 flex-col justify-between px-7" style={{ height: HERO_H, paddingTop: 16, paddingBottom: 18 }}>
          {state.current_bowler_name ? (
            <span className="flex min-w-0 items-baseline gap-3">
              <Label color="var(--hb-ink-muted)" className="min-w-0">
                {surnameOf(state.current_bowler_name)}
              </Label>
              <Label color="var(--hb-volt)" className="shrink-0">
                {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0}
              </Label>
            </span>
          ) : (
            <Label color="var(--hb-ink-muted)">This {set.word.toLowerCase()}</Label>
          )}
          <SetSquares balls={set.balls} open={set.open} size={56} gap={8} delay={200} />
        </Block>
      </Slab>
    </Root>
  );
}

// ---- estimates ------------------------------------------------------------------

/** The win split as two team blocks sized by their chance. */
export function SplitBar({
  state,
  height = HERO_H,
  size = 64,
  width = 720,
}: {
  state: LiveMatchState;
  height?: number;
  size?: number;
  width?: number;
}) {
  const est = estimateOf(state);
  if (!est || est.kind !== "chase") return null;
  const sides = sidesWithTones(state);
  const min = 0.24;
  const share = Math.min(1 - min, Math.max(min, est.battingPct / 100));
  const cells = [
    { s: sides.batting, pct: est.battingPct, grow: share },
    { s: sides.bowling, pct: est.bowlingPct, grow: 1 - share },
  ];
  return (
    <div
      role="img"
      aria-label={`${sides.batting.code} ${est.battingPct} percent, ${sides.bowling.code} ${est.bowlingPct} percent`}
      className="flex"
      style={{ width, gap: 6 }}
    >
      {cells.map(({ s, pct, grow }, i) => (
        <Block
          key={i}
          tone={s.tone}
          enter={i === 0 ? "wipeRight" : "wipeLeft"}
          delay={160 + i * 120}
          duration={620}
          className={cn("flex items-end justify-between px-6", i === 1 && "flex-row-reverse")}
          style={{ height, flexGrow: grow, flexBasis: 0, paddingBottom: 16, paddingTop: 16 }}
        >
          <Label size={24} color={mutedOn(s.tone)} className="self-start">
            {s.code}
          </Label>
          <Fig value={`${pct}%`} size={size} roll={false} />
        </Block>
      ))}
    </div>
  );
}

export function EstimateStrap({
  p,
  testId,
}: {
  p: ElementBaseProps & { strap: ActiveLowerThirdStrap | null };
  testId: string;
}) {
  const { state } = p;
  const est = estimateOf(state);
  if (!est) return null;
  const sides = sidesWithTones(state);
  const anchor = lowerAnchor(p.layout);
  const fromRight = anchor.from === "right";
  const enter = fromRight ? "wipeLeft" : anchor.from === "left" ? "wipeRight" : "wipeUp";
  if (est.kind === "projection") {
    return (
      <Plate
        layout={p.layout}
        testId={testId}
        tab="Projected score · estimate"
        side={sideOf(sides.batting)}
        name={`${sides.batting.code} heading for`}
        sub="At this rate, with the balls and wickets left"
        hero={<Fig value={`${est.low}-${est.high}`} size={64} roll={false} />}
        heroLabel="Runs"
      />
    );
  }
  return (
    <Root
      data-testid={testId}
      style={anchor.style}
      className={cn("flex flex-col gap-2", fromRight ? "items-end" : "items-start")}
    >
      <Tab tone="volt" cut={fromRight ? "left" : "right"} enter={enter} delay={240}>
        <Label size={22}>Win predictor · estimate</Label>
      </Tab>
      <Slab deep="#000000" cut={fromRight ? "left" : "right"} enter={enter}>
        <SplitBar state={state} width={MAX_W - 12} />
      </Slab>
    </Root>
  );
}

// ---- breaks -------------------------------------------------------------------------

const BREAK_TONE: Record<BreakKind, Tone> = {
  drinks: "paper",
  rain_delay: "four",
  timeout: "volt",
  innings_break: "t1",
  powerplay: "six",
};

const BREAK_WORD: Record<BreakKind, string> = {
  drinks: "Drinks",
  rain_delay: "Rain delay",
  timeout: "Timeout",
  innings_break: "Innings break",
  powerplay: "Powerplay",
};

/** The figure a break shows on ink: the score, the target, the powerplay's balls. */
function breakFigure(kind: BreakKind, state: LiveMatchState, bpo: number) {
  if (kind === "powerplay") {
    if (!state.powerplay) return null;
    const balls = state.powerplay.end_over * bpo;
    return { label: "First", hero: <Fig value={balls} size={72} />, tail: ballsWord(balls) };
  }
  if (kind === "innings_break") {
    const target =
      state.target_runs ??
      (state.innings_completed && state.total_runs !== null ? state.total_runs + 1 : null);
    return target === null
      ? null
      : { label: "Target", hero: <Fig value={target} size={72} />, tail: null };
  }
  if (state.total_runs === null || state.total_runs === undefined) return null;
  return {
    label: state.batting_team_short_name ?? "Score",
    hero: <ScoreFig runs={state.total_runs} wickets={state.total_wickets} size={72} />,
    tail: null,
  };
}

export function HundredBreak(p: OverlayElementProps["breakStrap"]) {
  const { state, strap, kind, variant } = p;
  const text = strap ? strapText(strap, state) : null;
  if (kind === "powerplay" && !state.powerplay && !strap?.title) return null;
  const bpo = ballsPerOverFrom(state, p.match);
  const count = ballCountOf(state, bpo);
  const fig = breakFigure(kind, state, bpo);
  const sides = sidesWithTones(state);
  const tone = kind === "innings_break" ? sides.batting.tone : BREAK_TONE[kind];
  const card = variant === "card";
  const word = BREAK_WORD[kind];
  const subtitle =
    strap?.subtitle ||
    (kind === "rain_delay"
      ? "Play resumes when it is fit"
      : kind === "timeout"
        ? "Play resumes shortly"
        : kind === "drinks" && count.left !== null && state.total_balls
          ? `${count.left} ${ballsWord(count.left)} left in the innings`
          : kind === "powerplay"
            ? "Fielding restrictions"
            : text?.subtitle || null);
  const anchor = lowerAnchor(p.layout);
  const fromRight = anchor.from === "right";
  const enter = fromRight ? "wipeLeft" : anchor.from === "left" ? "wipeRight" : "wipeUp";
  const title = strap?.title || word;
  return (
    <Root
      data-testid="hb-break"
      data-kind={kind}
      style={anchor.style}
      className={cn("flex flex-col gap-2", fromRight ? "items-end" : "items-start")}
    >
      <Slab deep={deepOf(tone)} cut={fromRight ? "left" : "right"} enter={enter} column={card} style={{ maxWidth: MAX_W }}>
        {card ? (
          <>
            <Block tone={tone} className="flex flex-col justify-end px-8 pb-6 pt-5" style={{ minHeight: 168 }}>
              <Label color={mutedOn(tone)}>{strap?.badge || (kind === "rain_delay" ? "Weather" : "Break in play")}</Label>
              <Reveal delay={160}>
                <span className="mt-3 block uppercase leading-[0.86]" style={{ fontFamily: FONT.stencil, fontSize: 112, fontWeight: 900 }}>
                  {title}
                </span>
              </Reveal>
            </Block>
            <div className="flex" style={{ gap: 6 }}>
              <SideBlock tone={sides.batting.tone} logo={sides.batting.logo} code={sides.batting.code} width={112} delay={200} />
              <Block tone="ink" className="flex min-w-0 flex-1 items-end justify-between gap-8 px-7" style={{ height: HERO_H, paddingTop: 16, paddingBottom: 18 }}>
                {fig && (
                  <div className="flex h-full flex-col justify-between">
                    <Label color="var(--hb-volt)">{fig.label}</Label>
                    <Reveal delay={240}>{fig.hero}</Reveal>
                  </div>
                )}
                {kind !== "powerplay" && kind !== "innings_break" && count.left !== null && state.total_balls ? (
                  <div className="flex h-full flex-col items-end justify-between">
                    <Label color="var(--hb-volt)">Balls left</Label>
                    <Reveal delay={300}>
                      <Fig value={count.left} size={72} />
                    </Reveal>
                  </div>
                ) : subtitle ? (
                  <Text size={24} className="max-w-[22rem] text-right" style={{ color: "var(--hb-ink-muted)" }}>
                    {subtitle}
                  </Text>
                ) : null}
              </Block>
            </div>
          </>
        ) : (
          <>
            <Block tone={tone} className="flex min-w-0 flex-col justify-center gap-2 px-7" style={{ height: HERO_H }}>
              <Reveal delay={140}>
                <Name size={44}>{title}</Name>
              </Reveal>
              {subtitle && (
                <Reveal delay={200}>
                  <Caption color={mutedOn(tone)} size={24}>
                    {subtitle}
                  </Caption>
                </Reveal>
              )}
            </Block>
            {fig && (
              <Block tone="ink" className="flex shrink-0 flex-col justify-between px-7" style={{ height: HERO_H, paddingTop: 16, paddingBottom: 16 }}>
                <Label color="var(--hb-volt)">{fig.label}</Label>
                <Reveal delay={220}>
                  <span className="flex items-baseline gap-3">
                    {fig.hero}
                    {fig.tail && <Label size={22} color="var(--hb-ink-muted)">{fig.tail}</Label>}
                  </span>
                </Reveal>
              </Block>
            )}
          </>
        )}
      </Slab>
    </Root>
  );
}

// ---- messages ------------------------------------------------------------------------

export function HundredMessage(p: OverlayElementProps["message"]) {
  const { state, strap } = p;
  const text = strapText(strap, state);
  if (!text || !text.title) return null;
  const form = strap.type === "message" ? (strap.form ?? "double") : "double";
  if (form === "single") {
    // Stands in for the score bug, where it sits.
    return (
      <Root
        data-testid="hb-message"
        data-form="single"
        style={p.layout === "top" ? { left: SAFE.x, top: SAFE.y } : { left: SAFE.x, bottom: SAFE.y }}
      >
        <Slab deep="#000000" style={{ maxWidth: 1728 }}>
          {text.badge && (
            <Block tone="volt" className="flex shrink-0 items-center px-7" style={{ height: HERO_H }}>
              <Name size={36}>{text.badge}</Name>
            </Block>
          )}
          <Block tone="ink" className="flex min-w-0 items-center px-8" style={{ height: HERO_H }}>
            <Reveal delay={160}>
              <Name size={52}>{text.title}</Name>
            </Reveal>
          </Block>
        </Slab>
      </Root>
    );
  }
  if (form === "baseline") {
    return (
      <Root
        data-testid="hb-message"
        data-form="baseline"
        className="flex"
        style={{ left: SAFE.x, right: SAFE.x, bottom: 6 }}
      >
        <Slab deep="#000000" cut="none" enter="wipeRight" className="w-full" innerClassName="w-full">
          {text.badge && (
            <Block tone="volt" className="flex h-11 shrink-0 items-center px-5">
              <Label size={20}>{text.badge}</Label>
            </Block>
          )}
          <Block tone="ink" className="flex h-11 min-w-0 flex-1 items-center px-5">
            <Caption color="#ffffff" size={22}>
              {text.title}
            </Caption>
          </Block>
        </Slab>
      </Root>
    );
  }
  const anchor = lowerAnchor(p.layout);
  const fromRight = anchor.from === "right";
  const enter = fromRight ? "wipeLeft" : anchor.from === "left" ? "wipeRight" : "wipeUp";
  return (
    <Root
      data-testid="hb-message"
      data-form="double"
      style={anchor.style}
      className={cn("flex flex-col gap-2", fromRight ? "items-end" : "items-start")}
    >
      {text.badge && (
        <Tab tone="volt" cut={fromRight ? "left" : "right"} enter={enter} delay={220}>
          <Label size={22}>{text.badge}</Label>
        </Tab>
      )}
      <Slab deep="#000000" column cut={fromRight ? "left" : "right"} enter={enter} style={{ width: MAX_W }}>
        <Block tone="ink" className="px-8 py-6">
          <Reveal delay={140}>
            <Name size={44} className="whitespace-normal" style={{ textWrap: "balance" }}>
              {text.title}
            </Name>
          </Reveal>
        </Block>
        {(text.subtitle || text.detail) && (
          <Block tone="paper" className="px-8 py-5">
            <Reveal delay={220}>
              <Text size={28} style={{ color: "var(--hb-ink)" }}>
                {text.subtitle || text.detail}
              </Text>
            </Reveal>
          </Block>
        )}
      </Slab>
    </Root>
  );
}
