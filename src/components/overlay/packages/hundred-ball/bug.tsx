"use client";

/**
 * The Hundred-ball score bug: runs-wickets and balls left as two giant
 * figures on flat blocks, the batting side's colour beside them, the
 * crease in one strip underneath and the chase as one statement on top.
 *
 * Layouts: bottom (bottom-left block stack), broadcast (the split corner
 * look: runs top left, balls top right, the crease bottom centre), top
 * (one slim row, top left) and compact (a corner stack). Phases: before
 * the start, in play, the innings break and the result.
 */

import type { CSSProperties } from "react";
import type { Innings } from "~/lib/match-types";
import { tossLineOf } from "../../score-bug";
import type { LiveMatchState } from "../../types";
import type { OverlayElementProps } from "../types";
import {
  ballCountOf,
  ballsPerOverFrom,
  ballsWord,
  chaseOf,
  currentSetOf,
  type BallCount,
} from "./balls";
import {
  BatterCell,
  BowlerCell,
  Caption,
  ChaseLine,
  inningsShort,
  sidesWithTones,
  teamNumberOf,
  teamsOf,
  useStartTime,
  type Sides,
} from "./common";
import {
  BallBar,
  Block,
  Crest,
  deepOf,
  Fig,
  Flash,
  HERO_H,
  Label,
  mutedOn,
  Name,
  Reveal,
  Root,
  SAFE,
  ScoreFig,
  SetSquares,
  Slab,
  Tab,
  type Tone,
} from "./kit";

type BugProps = OverlayElementProps["scoreBug"];

interface Live {
  state: LiveMatchState;
  sides: Sides;
  bpo: number;
  count: BallCount;
}

const score = (s: LiveMatchState) => `${s.total_runs ?? 0}-${s.total_wickets ?? 0}`;

/** The batting side's block: crest or code, the innings under it. */
function SideBlock({
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

/** RUNS 142-5 on paper. */
function RunsBlock({
  state,
  size = 84,
  height = HERO_H,
  label = "Runs",
  delay = 0,
}: {
  state: LiveMatchState;
  size?: number;
  height?: number;
  label?: string | null;
  delay?: number;
}) {
  return (
    <Block
      tone="paper"
      className="flex shrink-0 flex-col justify-between px-7"
      style={{
        height,
        paddingTop: label ? 16 : 0,
        paddingBottom: label ? 16 : 0,
        justifyContent: label ? "space-between" : "center",
      }}
    >
      {label && <Label color="var(--hb-paper-muted)">{label}</Label>}
      <Reveal delay={delay}>
        <ScoreFig runs={state.total_runs} wickets={state.total_wickets} size={size} />
      </Reveal>
      <Flash on={score(state)} color="var(--hb-volt)" />
    </Block>
  );
}

/** BALLS LEFT 38, the set squares, the innings bar along the foot. */
function BallsBlock({
  live,
  size = 84,
  height = HERO_H,
  squares = true,
  delay = 0,
}: {
  live: Live;
  size?: number;
  height?: number;
  squares?: boolean;
  delay?: number;
}) {
  const { count, state, bpo } = live;
  const set = currentSetOf(state, bpo);
  const hero = count.left ?? count.bowled;
  return (
    <Block
      tone="ink"
      className="flex shrink-0 items-end gap-7 px-7"
      style={{ height, paddingTop: 16, paddingBottom: 24 }}
    >
      <div className="flex h-full flex-col justify-between">
        <Label color="var(--hb-volt)">
          {count.left === null ? "Balls" : "Balls left"}
        </Label>
        <Reveal delay={delay}>
          <Fig value={hero} size={size} />
        </Reveal>
      </div>
      {squares && (
        <div className="flex flex-col gap-2.5">
          <Label size={18} color="var(--hb-ink-muted)">
            {set.word} {set.number}
          </Label>
          <SetSquares tokens={set.tokens} open={set.open} size={30} delay={delay + 120} />
        </div>
      )}
      {count.limit !== null && (
        <BallBar
          value={count.bowled}
          max={count.limit}
          className="absolute inset-x-0 bottom-0"
        />
      )}
    </Block>
  );
}

/** The crease: striker, non-striker, bowler. */
function CreaseStrip({ live, height = 60 }: { live: Live; height?: number }) {
  const { state, sides } = live;
  return (
    <Block
      tone="ink2"
      className="flex items-center gap-8 px-5"
      style={{ height }}
      aria-label="At the crease"
    >
      <Reveal delay={260} className="min-w-0 flex-[1.1]">
        <BatterCell
          name={state.striker_name}
          runs={state.striker_runs}
          balls={state.striker_balls}
          striker
        />
      </Reveal>
      <Reveal delay={320} className="min-w-0 flex-1">
        <BatterCell
          name={state.non_striker_name}
          runs={state.non_striker_runs}
          balls={state.non_striker_balls}
          striker={false}
        />
      </Reveal>
      <Reveal delay={380} className="min-w-0 flex-[1.2]">
        <BowlerCell state={state} tone={sides.bowling.tone} />
      </Reveal>
    </Block>
  );
}

/** Tabs above the bug: the chase, a free hit, the powerplay. */
function Tabs({
  state,
  align = "start",
}: {
  state: LiveMatchState;
  align?: "start" | "center" | "end";
}) {
  const chase = chaseOf(state);
  if (!chase && !state.free_hit && !state.powerplay) return null;
  return (
    <div
      className="flex gap-1.5"
      style={{
        justifyContent:
          align === "center" ? "center" : align === "end" ? "flex-end" : "flex-start",
      }}
    >
      {chase && (
        <Tab tone="volt" delay={300}>
          <ChaseLine chase={chase} size={34} />
        </Tab>
      )}
      {state.free_hit && (
        <Tab tone="free" delay={360}>
          <Label size={22}>Free hit</Label>
        </Tab>
      )}
      {state.powerplay && (
        <Tab tone="paper" delay={400}>
          <Label size={22}>Powerplay</Label>
        </Tab>
      )}
    </div>
  );
}

// ---- in play ------------------------------------------------------------------

function BottomBug({ live, offset }: { live: Live; offset: number }) {
  const { state, sides } = live;
  return (
    <Root
      data-testid="hb-score-bug"
      data-layout="bottom"
      style={{ left: SAFE.x, bottom: SAFE.y + offset }}
      className="flex flex-col items-start gap-2"
    >
      <Tabs state={state} />
      <Slab deep={deepOf(sides.batting.tone)} column>
        <div className="flex" style={{ gap: 6 }}>
          <SideBlock
            tone={sides.batting.tone}
            logo={sides.batting.logo}
            code={sides.batting.code}
            detail={inningsShort(state.innings_number)}
            delay={120}
          />
          <RunsBlock state={state} delay={160} />
          <BallsBlock live={live} delay={220} />
        </div>
        <CreaseStrip live={live} />
      </Slab>
    </Root>
  );
}

/** The split corners: runs top left, balls top right, crease bottom centre. */
function SplitBug({ live }: { live: Live }) {
  const { state, sides } = live;
  return (
    <>
      <Root
        data-testid="hb-score-bug"
        data-layout="broadcast"
        style={{ left: SAFE.x, top: SAFE.y }}
      >
        <Slab deep={deepOf(sides.batting.tone)}>
          <SideBlock
            tone={sides.batting.tone}
            logo={sides.batting.logo}
            code={sides.batting.code}
            detail={inningsShort(state.innings_number)}
            delay={120}
          />
          <RunsBlock state={state} delay={160} />
        </Slab>
      </Root>
      <Root style={{ right: SAFE.x, top: SAFE.y }}>
        <Slab deep="#000000" cut="left" enter="wipeLeft">
          <BallsBlock live={live} delay={200} />
        </Slab>
      </Root>
      <Root
        style={{ left: "50%", bottom: SAFE.y, transform: "translateX(-50%)" }}
        className="flex flex-col items-center gap-2"
      >
        <Tabs state={state} align="center" />
        <Slab deep={deepOf(sides.batting.tone)} cut="none" enter="wipeUp">
          <div style={{ width: 1080 }}>
            <CreaseStrip live={live} height={72} />
          </div>
        </Slab>
      </Root>
    </>
  );
}

function TopBug({ live }: { live: Live }) {
  const { state, sides, count } = live;
  const chase = chaseOf(state);
  const h = 88;
  return (
    <Root
      data-testid="hb-score-bug"
      data-layout="top"
      style={{ left: SAFE.x, top: SAFE.y }}
    >
      <Slab deep={deepOf(sides.batting.tone)}>
        <SideBlock
          tone={sides.batting.tone}
          logo={sides.batting.logo}
          code={sides.batting.code}
          width={104}
          height={h}
          delay={100}
        />
        <RunsBlock state={state} size={68} height={h} label={null} delay={140} />
        <Block tone="ink" className="flex items-center gap-4 px-6" style={{ height: h }}>
          <Reveal delay={200}>
            <Fig value={count.left ?? count.bowled} size={68} />
          </Reveal>
          <Label color="var(--hb-volt)" size={18} className="w-[5.5rem] whitespace-normal leading-tight">
            {count.left === null ? "Balls" : "Balls left"}
          </Label>
          {count.limit !== null && (
            <BallBar value={count.bowled} max={count.limit} height={6} className="absolute inset-x-0 bottom-0" />
          )}
        </Block>
        {chase && (
          <Block tone="volt" className="flex items-center px-6" style={{ height: h }}>
            <Reveal delay={260}>
              <ChaseLine chase={chase} size={44} />
            </Reveal>
          </Block>
        )}
      </Slab>
    </Root>
  );
}

function CompactBug({ live, offset }: { live: Live; offset: number }) {
  const { state, sides, count, bpo } = live;
  const chase = chaseOf(state);
  const set = currentSetOf(state, bpo);
  return (
    <Root
      data-testid="hb-score-bug"
      data-layout="compact"
      style={{ left: SAFE.x, bottom: SAFE.y + offset, width: 360 }}
    >
      <Slab deep={deepOf(sides.batting.tone)} column enter="wipeUp">
        <Block tone={sides.batting.tone} className="flex h-14 items-center justify-between px-5">
          <Name size={30}>{sides.batting.code}</Name>
          <Label size={18} color={mutedOn(sides.batting.tone)}>
            {inningsShort(state.innings_number)}
          </Label>
        </Block>
        <Block tone="paper" className="flex h-[104px] items-end px-6 pb-3">
          <Reveal delay={140}>
            <Fig value={score(state)} size={88} />
          </Reveal>
        </Block>
        <Block tone="ink" className="flex h-[100px] items-end justify-between gap-4 px-6 pb-4">
          <div>
            <Label color="var(--hb-volt)" size={18}>
              {count.left === null ? "Balls" : "Balls left"}
            </Label>
            <Reveal delay={200}>
              <Fig value={count.left ?? count.bowled} size={60} />
            </Reveal>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Label size={18} color="var(--hb-ink-muted)">
              {set.word} {set.number}
            </Label>
            <SetSquares tokens={set.tokens.slice(-bpo)} open={set.open} size={24} gap={4} />
          </div>
          {count.limit !== null && (
            <BallBar value={count.bowled} max={count.limit} height={6} className="absolute inset-x-0 bottom-0" />
          )}
        </Block>
        {chase && (
          <Block tone="volt" className="flex h-14 items-center px-5">
            <ChaseLine chase={chase} size={30} />
          </Block>
        )}
      </Slab>
    </Root>
  );
}

// ---- other phases -----------------------------------------------------------------

function phasePosition(layout: BugProps["layout"], offset: number): CSSProperties {
  return layout === "top"
    ? { left: SAFE.x, top: SAFE.y }
    : { left: SAFE.x, bottom: SAFE.y + offset };
}

/** Before the first ball: who plays, the start time, the toss. */
function PreBug({ p, offset }: { p: BugProps; offset: number }) {
  const { state, match } = p;
  const start = useStartTime(match?.scheduled_at);
  const [t1, t2] = teamsOf(state);
  const toss = tossLineOf(state, match);
  const strip = toss ?? state.venue;
  const source = state.tournament_name ?? state.title;
  return (
    <Root
      data-testid="hb-score-bug"
      data-layout={p.layout}
      style={phasePosition(p.layout, offset)}
      className="flex flex-col items-start gap-2"
    >
      {source && (
        <Tab tone="volt" delay={240}>
          <Label size={22}>{source}</Label>
        </Tab>
      )}
      <Slab deep="#000000" column>
        <div className="flex" style={{ gap: 6 }}>
          <SideBlock tone="t1" logo={t1!.logo} code={t1!.code} delay={100} />
          <Block tone="paper" className="flex w-[34rem] flex-col justify-center gap-1 px-7" style={{ height: HERO_H }}>
            <Reveal delay={160}>
              <Name size={34}>{t1!.name}</Name>
            </Reveal>
            <Reveal delay={220}>
              <Name size={34}>
                <span style={{ color: "var(--hb-paper-muted)" }}>v </span>
                {t2!.name}
              </Name>
            </Reveal>
          </Block>
          <SideBlock tone="t2" logo={t2!.logo} code={t2!.code} delay={140} />
          <Block tone="ink" className="flex min-w-[15rem] flex-col justify-end px-7 pb-4" style={{ height: HERO_H }}>
            <Label className="absolute left-7 top-4" color="var(--hb-volt)">
              {p.phase === "done" ? "Result" : start ? "Starts" : "Coming up"}
            </Label>
            <Reveal delay={260}>
              {p.phase === "done" ? (
                <Name size={30} className="max-w-[24rem]">
                  {state.result_description ?? "Match finished"}
                </Name>
              ) : (
                <Fig value={start ?? "Soon"} size={start && start.length > 8 ? 40 : 56} roll={false} />
              )}
            </Reveal>
          </Block>
        </div>
        {strip && (
          <Block tone="ink2" className="flex h-[60px] items-center px-7">
            <Reveal delay={320}>
              <Caption color="#ffffff" size={24}>
                {strip}
              </Caption>
            </Reveal>
          </Block>
        )}
      </Slab>
    </Root>
  );
}

/** Between the innings: who chases, the target, the balls to get it in. */
function BreakBug({ p, offset }: { p: BugProps; offset: number }) {
  const { state, match } = p;
  const sides = sidesWithTones(state);
  const bpo = ballsPerOverFrom(state, match);
  const count = ballCountOf(state, bpo);
  const target = state.target_runs;
  const chase = chaseOf(state);
  return (
    <Root
      data-testid="hb-score-bug"
      data-layout={p.layout}
      style={phasePosition(p.layout, offset)}
      className="flex flex-col items-start gap-2"
    >
      <Tab tone="volt" delay={260}>
        <Label size={22}>Innings break</Label>
      </Tab>
      <Slab deep={deepOf(sides.batting.tone)} column>
        <div className="flex" style={{ gap: 6 }}>
          <SideBlock
            tone={sides.batting.tone}
            logo={sides.batting.logo}
            code={sides.batting.code}
            detail="To bat"
            delay={100}
          />
          {target !== null ? (
            <Block tone="paper" className="flex flex-col justify-end px-7 pb-3" style={{ height: HERO_H }}>
              <Label className="absolute left-7 top-3.5" color="var(--hb-paper-muted)">
                Target
              </Label>
              <Reveal delay={160}>
                <Fig value={target} size={100} />
              </Reveal>
            </Block>
          ) : (
            <Block tone="paper" className="flex items-center px-7" style={{ height: HERO_H }}>
              <Name size={44}>{sides.batting.code} to bat next</Name>
            </Block>
          )}
          {count.limit !== null && (
            <Block tone="ink" className="flex flex-col justify-end px-7 pb-3" style={{ height: HERO_H }}>
              <Label className="absolute left-7 top-3.5" color="var(--hb-volt)">
                Balls
              </Label>
              <Reveal delay={220}>
                <Fig value={count.left ?? count.limit} size={100} />
              </Reveal>
            </Block>
          )}
        </div>
        {chase && (
          <Block tone="ink2" className="flex h-[60px] items-center gap-4 px-6">
            <Label size={22} color="var(--hb-volt)">
              {sides.batting.code}
            </Label>
            <Reveal delay={320}>
              <ChaseLine chase={chase} size={34} />
            </Reveal>
          </Block>
        )}
      </Slab>
    </Root>
  );
}

const inningsScore = (i: Innings) => `${i.total_runs ?? 0}-${i.total_wickets ?? 0}`;

/** After the match: the winner's colour, the result, both scores. */
function ResultBug({ p, offset }: { p: BugProps; offset: number }) {
  const { state, match } = p;
  const winner = teamNumberOf(state, state.winning_team_name);
  const teams = teamsOf(state);
  const won = winner ? teams[winner - 1]! : null;
  const innings = [...(match?.innings ?? [])]
    .filter((i) => i.innings_number <= 2)
    .sort((a, b) => a.innings_number - b.innings_number);
  const nameOfInnings = (i: Innings) =>
    i.team_id === match?.team1_id ? teams[0]!.code : teams[1]!.code;
  return (
    <Root
      data-testid="hb-score-bug"
      data-layout={p.layout}
      style={phasePosition(p.layout, offset)}
      className="flex flex-col items-start gap-2"
    >
      <Tab tone="volt" delay={260}>
        <Label size={22}>Result</Label>
      </Tab>
      <Slab deep={won ? deepOf(won.tone) : "#000000"} column>
        <div className="flex" style={{ gap: 6 }}>
          {won && (
            <SideBlock tone={won.tone} logo={won.logo} code={won.code} detail="Won" delay={100} />
          )}
          <Block tone="paper" className="flex max-w-[56rem] items-center px-8" style={{ minHeight: HERO_H }}>
            <Reveal delay={160}>
              <Name size={48} className="whitespace-normal" style={{ lineHeight: 1.02 }}>
                {state.result_description ?? "Match finished"}
              </Name>
            </Reveal>
          </Block>
        </div>
        {innings.length > 0 && (
          <Block tone="ink2" className="flex h-[60px] items-center gap-10 px-6">
            {innings.map((i, n) => (
              <Reveal key={i.id} delay={300 + n * 60}>
                <span className="flex items-baseline gap-3">
                  <Label size={22} color="var(--hb-ink-muted)">
                    {match ? nameOfInnings(i) : ""}
                  </Label>
                  <Fig value={inningsScore(i)} size={34} roll={false} />
                  <Label size={18} color="var(--hb-ink-muted)">
                    {i.total_balls} {ballsWord(i.total_balls)}
                  </Label>
                </span>
              </Reveal>
            ))}
          </Block>
        )}
      </Slab>
    </Root>
  );
}

export function HundredScoreBug(p: BugProps) {
  const offset = p.marginOffsetPx ?? 0;
  if (p.phase === "pre" || p.state.innings_number == null) {
    return <PreBug p={p} offset={offset} />;
  }
  if (p.phase === "done") return <ResultBug p={p} offset={offset} />;
  if (p.phase === "break") return <BreakBug p={p} offset={offset} />;
  const bpo = ballsPerOverFrom(p.state, p.match);
  const live: Live = {
    state: p.state,
    sides: sidesWithTones(p.state),
    bpo,
    count: ballCountOf(p.state, bpo),
  };
  switch (p.layout) {
    case "top":
      return <TopBug live={live} />;
    case "compact":
      return <CompactBug live={live} offset={offset} />;
    case "broadcast":
      return <SplitBug live={live} />;
    default:
      return <BottomBug live={live} offset={offset} />;
  }
}

