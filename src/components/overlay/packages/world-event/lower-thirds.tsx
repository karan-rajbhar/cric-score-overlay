"use client";

/**
 * World event's lower thirds: a team-colour cap with the side's crest, the
 * name on a white panel, the headline figure on a deep panel, and a strip
 * of labelled figures under them, with the event tab on top. The chase
 * (the equation graphic), the end of an over, partnerships, the win
 * predictor, breaks, producer messages, player profiles and the player of
 * the match all build on that frame.
 */

import type { CSSProperties, ReactNode } from "react";
import { formatDismissalType } from "~/lib/cricket";
import type { PlayerCareerStatsRow } from "~/lib/firebase/types";
import { cn } from "~/lib/utils";
import { winPredictorFromLive } from "~/lib/win-predictor";
import { usePlayerProfile } from "../../overlay-data";
import { economyText, overTokens, oversText, strikeRateText } from "../../overlay-kit";
import { inningsStats, playerInSlot, type PlayerSlot } from "../../profile-card";
import { strapText } from "../../strap-views";
import type { ActiveLowerThirdStrap, LayoutMode, LiveMatchState, SeriesFigures } from "../../types";
import type { BreakKind, OverlayElementProps } from "../types";
import { avatarOf, chaseLine, projectedTotals } from "../shared/derive";
import { AvatarSlot } from "../shared/slots";
import {
  battingAndBowling,
  finishAtCurrentRate,
  fixed2,
  ordinal,
  scoreText,
  surnameOf,
  type SideInfo,
} from "./data";
import {
  Balls,
  Crest,
  delay,
  Fig,
  LowerFrame,
  Root,
  side,
  StatCells,
  Tab,
  type Stat,
} from "./kit";
import { SAFE, scoreBugAnchor } from "../shared/layout";

// ---- the frame ------------------------------------------------------------

export interface LowerThirdProps {
  state: LiveMatchState | null;
  layout: LayoutMode;
  team: SideInfo | null;
  tab: ReactNode;
  tabTone?: "accent" | "gold" | "mint" | "red";
  title: ReactNode;
  /** A line under the name. */
  subtitle?: ReactNode;
  /** The big figure on the right, with its small label. */
  figure?: ReactNode;
  figureLabel?: ReactNode;
  stats?: Stat[];
  /** Instead of (or after) the stats: anything in the strip. */
  strip?: ReactNode;
  /** A photo or initials instead of the crest. */
  photo?: ReactNode;
  width?: number;
  testId: string;
}

/** The lower third every strap and figures card builds on. */
export function LowerThird(p: LowerThirdProps) {
  const sideStyle: CSSProperties = p.team ? side(p.team.n) : {};
  const hasStrip = (p.stats && p.stats.length > 0) || p.strip;
  return (
    <LowerFrame state={p.state} layout={p.layout} width={p.width} testId={p.testId}>
      <div className="relative z-10 ml-[150px]">
        <Tab tone={p.tabTone ?? "accent"} className="we-a-drop" style={delay(320)}>
          {p.tab}
        </Tab>
      </div>
      <div className="we-lift flex w-full items-stretch bg-[#0a0532]" style={sideStyle}>
        <div className="we-a-slide-r flex w-[150px] shrink-0">
          <div
            className={cn("flex w-full items-center justify-center", p.team ? "we-team" : "we-night")}
            style={{ ["--we-cut" as string]: "18px" }}
          >
            {p.photo ??
              (p.team && (
                <Crest n={p.team.n} logo={p.team.logo} code={p.team.code} name={p.team.name} size={86} className="we-a-pop" style={delay(240)} />
              ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-[96px] items-stretch">
            <div className="we-paper we-on-paper we-a-wipe-r flex min-w-0 flex-1 flex-col justify-center px-7 py-2" style={delay(80)}>
              {typeof p.title === "string" ? (
                <span className="we-name we-trunc block text-[44px] leading-[1.05]">{p.title}</span>
              ) : (
                <div className="min-w-0">{p.title}</div>
              )}
              {p.subtitle && (
                <span className="we-figl we-ink-muted we-trunc mt-0.5 block text-[22px] font-semibold">{p.subtitle}</span>
              )}
            </div>
            {p.figure !== undefined && p.figure !== null && (
              <div className="we-night we-sheen we-a-wipe-l relative flex shrink-0 flex-col items-end justify-center px-8" style={delay(180)}>
                <span className="we-fig text-[52px] leading-none">{p.figure}</span>
                {p.figureLabel && <span className="we-label we-muted mt-1">{p.figureLabel}</span>}
              </div>
            )}
          </div>
          {hasStrip && (
            <div className="we-night2 we-a-wipe-down flex min-h-[70px] items-center" style={delay(260)}>
              {p.stats && p.stats.length > 0 && <StatCells stats={p.stats} start={340} className="h-full py-2" />}
              {p.strip}
            </div>
          )}
        </div>
      </div>
    </LowerFrame>
  );
}

// ---- batters and bowlers ----------------------------------------------------

/** The live row's short labels as the strip spells them. */
const STAT_LABEL: Record<string, string> = {
  "4s": "Fours",
  "6s": "Sixes",
  SR: "Strike rate",
  Econ: "Economy",
  At: "Out at",
};

const BADGE: Record<PlayerSlot, string> = {
  striker: "On strike",
  non_striker: "Batting",
  bowler: "Bowling",
  last_out: "Out",
};

/** How the last wicket fell: "Caught, b Hughes". */
function lastOutLine(state: LiveMatchState): string | null {
  const w = state.last_wicket;
  if (!w) return null;
  const how = w.dismissal_type ? formatDismissalType(w.dismissal_type) : null;
  const by = w.bowler_name ? `b ${surnameOf(w.bowler_name)}` : null;
  const at = `${scoreText(w.score, w.wicket_number)} (${w.overs} ov)`;
  return [how && by ? `${how}, ${by}` : (how ?? by), at].filter(Boolean).join("  ·  ");
}

/** A batter's or the bowler's figures this innings (no reads). */
function FiguresLowerThird({
  state,
  layout,
  slot,
  tab,
  testId,
}: {
  state: LiveMatchState;
  layout: LayoutMode;
  slot: PlayerSlot;
  tab?: string;
  testId: string;
}) {
  const who = playerInSlot(state, slot);
  const figures = inningsStats(state, slot);
  if (!who.name || !figures) return null;
  const { bat, bowl } = battingAndBowling(state);
  const team = slot === "bowler" ? bowl : bat;
  const bowler = slot === "bowler";
  const strip = bowler && overTokens(state).length > 0 && (
    <div className="ml-auto flex items-center gap-4 pr-6">
      <span className="we-label we-muted">This over</span>
      <Balls tokens={overTokens(state)} size={34} stagger={420} />
    </div>
  );
  return (
    <LowerThird
      state={state}
      layout={layout}
      team={team}
      tab={tab ?? `${BADGE[slot]}  ·  ${team.code}`}
      title={who.name}
      subtitle={slot === "last_out" ? lastOutLine(state) : undefined}
      figure={figures.headline}
      figureLabel={bowler ? "Wkts-runs" : slot === "last_out" ? "Runs (balls)" : "Runs (balls)"}
      stats={[
        ...figures.stats.map((s) => ({ label: STAT_LABEL[s.label] ?? s.label, value: s.value })),
        ...(slot === "striker" || slot === "non_striker") && (state.partnership_runs ?? 0) > 0
          ? [{ label: "Partnership", value: `${state.partnership_runs} (${state.partnership_balls ?? 0})` }]
          : [],
      ]}
      strip={strip || undefined}
      testId={testId}
    />
  );
}

/** Producer text on the frame (a custom title replaces the figures). */
function TextLowerThird({
  state,
  layout,
  strap,
  team,
  testId,
  tabTone,
}: {
  state: LiveMatchState;
  layout: LayoutMode;
  strap: ActiveLowerThirdStrap;
  team: SideInfo | null;
  testId: string;
  tabTone?: LowerThirdProps["tabTone"];
}) {
  const text = strapText(strap, state);
  if (!text?.title) return null;
  const details = text.detail ? text.detail.split(" · ") : [];
  return (
    <LowerThird
      state={state}
      layout={layout}
      team={team}
      tab={text.badge || "Update"}
      tabTone={tabTone}
      title={text.title}
      subtitle={text.subtitle || undefined}
      strip={
        details.length > 0 ? (
          <span className="we-label flex gap-8 px-6 text-[20px]">
            {details.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </span>
        ) : undefined
      }
      testId={testId}
    />
  );
}

export function WorldEventBatterLowerThird(p: OverlayElementProps["batterLowerThird"]) {
  if (p.variant === "strap" && p.strap?.title) {
    return <TextLowerThird state={p.state} layout={p.layout} strap={p.strap} team={battingAndBowling(p.state).bat} testId="we-batter" />;
  }
  const slot = p.variant === "strap" && p.strap?.type === "last_wicket" ? "last_out" : p.slot;
  return (
    <FiguresLowerThird
      state={p.state}
      layout={p.layout}
      slot={slot}
      tab={p.strap?.badge ? `${p.strap.badge}  ·  ${battingAndBowling(p.state).bat.code}` : undefined}
      testId="we-batter"
    />
  );
}

export function WorldEventBowlerLowerThird(p: OverlayElementProps["bowlerLowerThird"]) {
  if (p.variant === "strap" && p.strap?.title) {
    return <TextLowerThird state={p.state} layout={p.layout} strap={p.strap} team={battingAndBowling(p.state).bowl} testId="we-bowler" />;
  }
  return <FiguresLowerThird state={p.state} layout={p.layout} slot="bowler" testId="we-bowler" />;
}

/** A new batter in: name, when they came in. */
export function WorldEventNewBatter(p: OverlayElementProps["newBatter"]) {
  const text = strapText(p.strap, p.state);
  if (!text?.title) return null;
  const { bat } = battingAndBowling(p.state);
  const stand = (p.state.total_wickets ?? 0) + 1;
  return (
    <LowerThird
      state={p.state}
      layout={p.layout}
      team={bat}
      tab={`${text.badge || "New batter"}  ·  ${bat.code}`}
      title={text.title}
      subtitle={text.subtitle || undefined}
      figure={scoreText(p.state.total_runs, p.state.total_wickets)}
      figureLabel={`${bat.code} score`}
      strip={
        <span className="we-label flex gap-8 px-6 text-[20px]">
          {p.state.partnership_runs !== null && p.state.total_wickets !== null && (
            <span>
              {ordinal(stand)} wicket stand <span className="we-fig">{p.state.partnership_runs}</span>
            </span>
          )}
          {text.detail && <span>{text.detail}</span>}
        </span>
      }
      testId="we-new-batter"
    />
  );
}

/** A bowler into the attack: name, their figures when they have bowled. */
export function WorldEventNewBowler(p: OverlayElementProps["newBowler"]) {
  const text = strapText(p.strap, p.state);
  if (!text?.title) return null;
  const { bowl } = battingAndBowling(p.state);
  const s = p.state;
  const current = s.current_bowler_name === text.title && (s.bowler_balls ?? 0) > 0;
  const econ = current ? economyText(s.bowler_runs, s.bowler_balls) : null;
  return (
    <LowerThird
      state={s}
      layout={p.layout}
      team={bowl}
      tab={`${text.badge || "Bowling"}  ·  ${bowl.code}`}
      title={text.title}
      subtitle={text.subtitle || undefined}
      figure={current ? `${s.bowler_wickets ?? 0}-${s.bowler_runs ?? 0}` : undefined}
      figureLabel={current ? "So far" : undefined}
      stats={
        current
          ? [
              { label: "Overs", value: oversText(s.bowler_balls) },
              { label: "Maidens", value: s.bowler_maidens ?? 0 },
              ...(econ ? [{ label: "Econ", value: econ }] : []),
            ]
          : undefined
      }
      testId="we-new-bowler"
    />
  );
}

// ---- the chase: the equation graphic -----------------------------------------

/** A labelled rate with its bar (scaled against the larger of the two). */
function RateBar({ label, value, max, tone, start }: { label: string; value: number; max: number; tone: string; start: number }) {
  const pct = Math.max(4, Math.min(100, (value / Math.max(max, 0.01)) * 100));
  return (
    <div className="flex items-center gap-4">
      <span className="we-label we-muted w-[120px] shrink-0">{label}</span>
      <span className="relative h-[16px] flex-1 overflow-hidden bg-white/10">
        <span className={cn("we-a-grow-x absolute inset-y-0 left-0", tone)} style={{ width: `${pct}%`, ...delay(start) }} />
      </span>
      <span className="we-fig w-[84px] shrink-0 text-right text-[28px]">{value.toFixed(2)}</span>
    </div>
  );
}

/** Two sides' chances as a split bar with their codes. */
export function SplitBar({
  left,
  right,
  leftPct,
  height = 18,
  start = 500,
}: {
  left: SideInfo;
  right: SideInfo;
  leftPct: number;
  height?: number;
  start?: number;
}) {
  return (
    <div className="flex w-full items-center gap-3">
      <span className="we-fig shrink-0 text-[26px]">
        {left.code} <Fig value={`${leftPct}%`} />
      </span>
      <span
        role="img"
        aria-label={`${left.code} ${leftPct} percent, ${right.code} ${100 - leftPct} percent`}
        className="relative flex flex-1 overflow-hidden"
        style={{ height }}
      >
        <span className="we-a-grow-x h-full" style={{ ...side(left.n), width: `${leftPct}%`, background: "var(--we-side-dark)", ...delay(start) }} />
        <span className="h-full w-[3px] bg-white" />
        <span className="we-a-grow-xr h-full flex-1" style={{ ...side(right.n), background: "var(--we-side-dark)", ...delay(start) }} />
      </span>
      <span className="we-fig shrink-0 text-[26px]">
        <Fig value={`${100 - leftPct}%`} /> {right.code}
      </span>
    </div>
  );
}

export function WorldEventChase(p: OverlayElementProps["chase"]) {
  const chase = chaseLine(p.state);
  if (!chase) {
    return p.strap?.title ? (
      <TextLowerThird state={p.state} layout={p.layout} strap={p.strap} team={battingAndBowling(p.state).bat} testId="we-chase" />
    ) : null;
  }
  const { bat, bowl } = battingAndBowling(p.state);
  const est = winPredictorFromLive(p.state);
  const max = Math.max(chase.requiredRate ?? 0, chase.currentRate ?? 0);
  const atRate = finishAtCurrentRate(p.state, chase);
  return (
    <LowerFrame state={p.state} layout={p.layout} width={1240} testId="we-chase">
      <div className="relative z-10 ml-[150px]">
        <Tab className="we-a-drop" style={delay(320)}>
          {p.strap?.badge || "The chase"}  ·  {bat.code}
        </Tab>
      </div>
      <div className="we-lift flex w-full items-stretch bg-[#0a0532]">
        <div className="we-a-slide-r flex w-[150px] shrink-0">
          <div className="we-team flex w-full items-center justify-center" style={side(bat.n)}>
            <Crest n={bat.n} logo={bat.logo} code={bat.code} name={bat.name} size={86} className="we-a-pop" style={delay(240)} />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-[104px] items-stretch">
            <div className="we-paper we-a-wipe-r flex min-w-0 flex-1 items-baseline gap-4 px-8 pt-4" style={delay(80)}>
              {p.strap?.title ? (
                <span className="we-name we-trunc self-center text-[42px]">{p.strap.title}</span>
              ) : (
                <>
                  <span className="we-label we-ink-muted text-[22px]">Need</span>
                  <Fig value={chase.runsNeeded} className="we-fig text-[72px] leading-[0.9] text-[#dc0078]" />
                  <span className="we-label we-ink-muted text-[22px]">{chase.runsNeeded === 1 ? "run" : "runs"} from</span>
                  <Fig value={chase.ballsRemaining} className="we-fig text-[72px] leading-[0.9]" />
                  <span className="we-label we-ink-muted text-[22px]">{chase.ballsRemaining === 1 ? "ball" : "balls"}</span>
                </>
              )}
            </div>
            <div className="we-night we-sheen we-a-wipe-l relative flex shrink-0 flex-col items-end justify-center px-8" style={delay(180)}>
              <span className="we-label we-muted">Target</span>
              <span className="we-fig text-[52px] leading-none">{chase.target}</span>
            </div>
          </div>
          <div className="we-night2 we-a-wipe-down grid grid-cols-[1.2fr_1fr] gap-8 px-7 py-4" style={delay(260)}>
            <div className="flex flex-col justify-center gap-2.5">
              {chase.requiredRate !== null && <RateBar label="Req rate" value={chase.requiredRate} max={max} tone="we-accent" start={420} />}
              {chase.currentRate !== null && <RateBar label="Run rate" value={chase.currentRate} max={max} tone="we-mint" start={500} />}
            </div>
            <div className="flex flex-col justify-center gap-2 border-l pl-8 we-hair">
              {atRate !== null && (
                <span className="we-label flex items-baseline justify-between gap-4 text-[18px]">
                  <span className="we-muted">At this rate</span>
                  <span className="we-fig text-[28px] normal-case tracking-normal">{atRate}</span>
                </span>
              )}
              {est?.kind === "chase" && (
                <>
                  <span className="we-label we-muted text-[16px]">Win predictor (estimate)</span>
                  <SplitBar left={bat} right={bowl} leftPct={est.battingPct} height={14} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </LowerFrame>
  );
}

// ---- end of over, partnership, predictor straps -------------------------------

export function WorldEventThisOverStrap({ state, layout, strap }: { state: LiveMatchState; layout: LayoutMode; strap: ActiveLowerThirdStrap | null }) {
  const tokens = overTokens(state);
  if (!tokens.length && !strap?.title) return null;
  const { bat, bowl } = battingAndBowling(state);
  const runs = state.this_over_runs ?? 0;
  return (
    <LowerThird
      state={state}
      layout={layout}
      team={bowl}
      tab={strap?.badge || `Over ${(state.current_over ?? 0) + (state.current_ball ? 1 : 0)}`}
      title={
        <Balls tokens={tokens} size={56} stagger={360} className="py-1.5" />
      }
      subtitle={state.current_bowler_name ? `${state.current_bowler_name}  ${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0} (${oversText(state.bowler_balls)})` : undefined}
      figure={<Fig value={runs} />}
      figureLabel={runs === 1 ? "Run this over" : "Runs this over"}
      strip={
        <span className="we-label flex items-baseline gap-8 px-6 text-[20px]">
          <span>
            {bat.code} <span className="we-fig text-[26px]">{scoreText(state.total_runs, state.total_wickets)}</span>
          </span>
          {state.current_run_rate !== null && <span className="we-muted">Run rate {fixed2(state.current_run_rate)}</span>}
        </span>
      }
      testId="we-this-over"
    />
  );
}

/** Each batter's share of the stand (from the innings' current partnership). */
export function standShares(state: LiveMatchState, match: OverlayElementProps["partnership"]["match"]) {
  const inn = match?.innings?.find((i) => i.innings_number === state.innings_number);
  const stand = inn?.partnerships?.find((p) => p.is_current);
  const share = (
    id: string | null | undefined,
    name: string | null,
    innings: { runs: number | null; balls: number | null },
  ) => {
    if (!name) return null;
    const own =
      stand && id
        ? stand.batsman1_id === id
          ? { runs: stand.batsman1_runs, balls: stand.batsman1_balls }
          : stand.batsman2_id === id
            ? { runs: stand.batsman2_runs, balls: stand.batsman2_balls }
            : null
        : null;
    return { name, runs: own?.runs ?? null, balls: own?.balls ?? null, innings };
  };
  return [
    share(state.striker_id, state.striker_name, { runs: state.striker_runs, balls: state.striker_balls }),
    share(state.non_striker_id, state.non_striker_name, { runs: state.non_striker_runs, balls: state.non_striker_balls }),
  ];
}

export function WorldEventPartnershipStrap({ state, layout, strap }: { state: LiveMatchState; layout: LayoutMode; strap: ActiveLowerThirdStrap | null }) {
  if (state.partnership_runs === null || !state.striker_name || !state.non_striker_name) {
    return strap?.title ? <TextLowerThird state={state} layout={layout} strap={strap} team={null} testId="we-partnership" /> : null;
  }
  const { bat } = battingAndBowling(state);
  const balls = state.partnership_balls ?? 0;
  const rate = strikeRateText(state.partnership_runs, balls);
  return (
    <LowerThird
      state={state}
      layout={layout}
      team={bat}
      tab={`${strap?.badge || "Partnership"}  ·  ${ordinal((state.total_wickets ?? 0) + 1)} wicket`}
      title={`${surnameOf(state.striker_name)} & ${surnameOf(state.non_striker_name)}`}
      subtitle={`${state.striker_name} ${state.striker_runs ?? 0} (${state.striker_balls ?? 0})  ·  ${state.non_striker_name} ${state.non_striker_runs ?? 0} (${state.non_striker_balls ?? 0})`}
      figure={<Fig value={state.partnership_runs} />}
      figureLabel={`Off ${balls} ${balls === 1 ? "ball" : "balls"}`}
      stats={[
        { label: "Runs", value: state.partnership_runs },
        { label: "Balls", value: balls },
        ...(rate ? [{ label: "Strike rate", value: rate }] : []),
      ]}
      testId="we-partnership"
    />
  );
}

export function WorldEventWinStrap({ state, layout, strap }: { state: LiveMatchState; layout: LayoutMode; strap: ActiveLowerThirdStrap | null }) {
  const est = winPredictorFromLive(state);
  if (!est) return strap?.title ? <TextLowerThird state={state} layout={layout} strap={strap} team={null} testId="we-win-strap" /> : null;
  const { bat, bowl } = battingAndBowling(state);
  if (est.kind === "projection") {
    const rows = projectedTotals(state);
    return (
      <LowerThird
        state={state}
        layout={layout}
        team={bat}
        tab={`Projected score  ·  ${bat.code}`}
        title={`${est.low} to ${est.high}`}
        subtitle="Estimate from the runs, overs and wickets so far"
        figure={scoreText(state.total_runs, state.total_wickets)}
        figureLabel={`${oversText(state.total_balls)} overs`}
        stats={rows.map((r) => ({ label: r.current ? `At ${fixed2(r.rate)}` : `At ${r.rate}`, value: r.total }))}
        testId="we-projected-strap"
      />
    );
  }
  return (
    <LowerThird
      state={state}
      layout={layout}
      team={bat}
      tab="Win predictor  ·  Estimate"
      title={`${bat.code} ${est.battingPct}%  ·  ${bowl.code} ${est.bowlingPct}%`}
      subtitle={`${bat.name} need ${est.runsNeeded} from ${est.ballsLeft} ${est.ballsLeft === 1 ? "ball" : "balls"}`}
      strip={
        <div className="w-full px-7">
          <SplitBar left={bat} right={bowl} leftPct={est.battingPct} />
        </div>
      }
      testId="we-win-strap"
    />
  );
}

// ---- breaks and messages --------------------------------------------------------

const BREAK_TAB: Record<BreakKind, string> = {
  drinks: "Drinks",
  rain_delay: "Weather",
  timeout: "Timeout",
  innings_break: "Innings break",
  powerplay: "Powerplay",
};

/** The score and the chase or rate, for break straps and cards. */
function scoreStrip(state: LiveMatchState) {
  if (state.total_runs === null) return undefined;
  const { bat } = battingAndBowling(state);
  const chase = chaseLine(state);
  return (
    <span className="we-label flex items-baseline gap-8 px-6 text-[20px]">
      <span>
        {bat.code} <span className="we-fig text-[28px]">{scoreText(state.total_runs, state.total_wickets)}</span>{" "}
        <span className="we-muted">({oversText(state.total_balls)} ov)</span>
      </span>
      {chase ? (
        <span className="text-[#bdf7e8]">
          {chase.text}
        </span>
      ) : state.current_run_rate !== null ? (
        <span className="we-muted">Run rate {fixed2(state.current_run_rate)}</span>
      ) : null}
    </span>
  );
}

export function WorldEventBreakStrap(p: OverlayElementProps["breakStrap"]) {
  const strap = p.strap ?? { id: `we-${p.kind}`, type: p.kind, title: "" };
  const text = strapText(strap, p.state);
  if (!text?.title) return null;
  const { bat } = battingAndBowling(p.state);
  const card = p.variant === "card";
  return (
    <LowerThird
      state={p.state}
      layout={card ? "bottom" : p.layout}
      team={p.state.total_runs !== null ? bat : null}
      tab={text.badge || BREAK_TAB[p.kind]}
      tabTone={p.kind === "powerplay" ? "mint" : p.kind === "rain_delay" ? "gold" : "accent"}
      title={text.title}
      subtitle={text.subtitle || undefined}
      figure={card && p.state.total_runs !== null ? scoreText(p.state.total_runs, p.state.total_wickets) : undefined}
      figureLabel={card ? `${oversText(p.state.total_balls)} overs` : undefined}
      strip={scoreStrip(p.state)}
      width={card ? 1240 : 1100}
      testId={`we-break-${p.kind}`}
    />
  );
}

/** The producer's notice: one line in place of the bar, a card, or a baseline. */
export function WorldEventMessage(p: OverlayElementProps["message"]) {
  const text = strapText(p.strap, p.state);
  if (!text?.title) return null;
  const form = p.strap.type === "message" ? (p.strap.form ?? "double") : null;
  if (form === "single") {
    return (
      <Root state={p.state} data-testid="we-message-single" style={scoreBugAnchor("bottom")}>
        <div className="we-lift flex h-[96px] items-stretch">
          {text.badge && (
            <div className="we-a-slide-r flex shrink-0">
              <span className="we-accent we-cut-r we-label flex items-center pl-8 pr-14 text-[22px]" style={{ ["--we-cut" as string]: "24px" }}>
                {text.badge}
              </span>
            </div>
          )}
          <div className="we-night we-a-wipe-r -ml-[24px] flex min-w-0 flex-1 items-center px-12" style={delay(100)}>
            <span className="we-name we-trunc text-[40px]">{text.title}</span>
          </div>
        </div>
      </Root>
    );
  }
  if (form === "baseline") {
    return (
      <Root state={p.state} data-testid="we-message-baseline" style={{ left: SAFE.x, right: SAFE.x, bottom: 10 }}>
        <div className="we-night we-a-wipe-r flex h-[38px] items-center gap-5 pr-6">
          {text.badge && <span className="we-accent we-label flex h-full items-center px-5">{text.badge}</span>}
          <span className="we-trunc text-[20px] font-semibold">{text.title}</span>
        </div>
      </Root>
    );
  }
  if (form === "double") {
    return (
      <LowerFrame state={p.state} layout={p.layout} width={1100} testId="we-message-double">
        <div className="relative z-10">
          <Tab className="we-a-drop" style={delay(300)}>
            {text.badge || "Notice"}
          </Tab>
        </div>
        <div className="we-lift w-full">
          <div className="we-night we-a-wipe-r px-9 py-5">
            <span className="we-name block text-[40px] leading-tight [text-wrap:balance]">{text.title}</span>
          </div>
          {text.subtitle && (
            <p className="we-paper we-a-wipe-down px-9 py-5 text-[26px] font-semibold leading-snug" style={delay(160)}>
              {text.subtitle}
            </p>
          )}
        </div>
      </LowerFrame>
    );
  }
  // Custom and commentary straps.
  return <TextLowerThird state={p.state} layout={p.layout} strap={p.strap} team={null} testId="we-message" />;
}

// ---- profiles and the player of the match ---------------------------------------

/** A player's photo in a square, or their initials on their side's colour. */
export function Portrait({ url, name, n, size = 150 }: { url?: string | null; name: string; n: 1 | 2; size?: number }) {
  return (
    <AvatarSlot
      url={url}
      name={name}
      className="we-team flex h-full w-full items-center justify-center overflow-hidden"
      style={{ ...side(n), minHeight: size }}
      imgClassName="h-full w-full object-cover"
      textClassName="we-x text-[56px] opacity-90"
    />
  );
}

function careerStats(c: PlayerCareerStatsRow, bowler: boolean): Stat[] {
  const out: Stat[] = [{ label: "Matches", value: c.total_matches ?? 0 }];
  if (bowler) {
    out.push({ label: "Wickets", value: c.total_wickets ?? 0 });
    if (c.bowling_average) out.push({ label: "Average", value: c.bowling_average.toFixed(1) });
    if (c.economy_rate) out.push({ label: "Econ", value: c.economy_rate.toFixed(2) });
    if (c.best_bowling_figures) out.push({ label: "Best", value: c.best_bowling_figures });
    return out;
  }
  out.push({ label: "Runs", value: c.total_runs ?? 0 });
  if (c.batting_average) out.push({ label: "Average", value: c.batting_average.toFixed(1) });
  if (c.strike_rate) out.push({ label: "Strike rate", value: c.strike_rate.toFixed(1) });
  if (c.highest_score) out.push({ label: "Best", value: c.highest_score });
  out.push({ label: "Fifties / hundreds", value: `${c.half_centuries ?? 0} / ${c.centuries ?? 0}` });
  return out;
}

/** A player's figures in this tournament (the control room's snapshot). */
function seriesStats(f: SeriesFigures, bowler: boolean): Stat[] {
  const out: Stat[] = [{ label: "Matches", value: f.matches }];
  const count = bowler ? f.wickets : f.runs;
  if (count !== null && count !== undefined) out.push({ label: bowler ? "Wickets" : "Runs", value: count });
  const extra: Array<[string, string | null | undefined]> = bowler
    ? [
        ["Econ", f.economy ? f.economy.toFixed(2) : null],
        ["Best", f.best],
      ]
    : [
        ["Average", f.average ? f.average.toFixed(1) : null],
        ["Strike rate", f.strikeRate ? f.strikeRate.toFixed(1) : null],
        ["Best", f.highest],
      ];
  for (const [label, value] of extra) if (value) out.push({ label, value });
  return out;
}

export function WorldEventPlayerProfile(p: OverlayElementProps["playerProfile"]) {
  const who = playerInSlot(p.state, p.slot);
  const career = p.mode === "career";
  const read = usePlayerProfile(p.state, career && p.profile === undefined ? who.id : null, true);
  const profile = p.profile ?? read.profile;
  const { bat, bowl } = battingAndBowling(p.state);
  const team = who.bowler ? bowl : bat;
  const loaded = p.profile !== undefined || read.loaded;
  const series = who.id ? p.snapshots?.series?.[who.id] : null;
  const stats = career
    ? loaded && profile?.career
      ? careerStats(profile.career, who.bowler)
      : null
    : series
      ? seriesStats(series, who.bowler)
      : null;
  if (!who.name || !stats) return null;
  const tab = career ? "Career" : (p.state.tournament_name ?? "This tournament");
  return (
    <LowerThird
      state={p.state}
      layout={p.layout}
      team={team}
      tab={`${tab}  ·  ${team.code}`}
      title={who.name}
      subtitle={team.name}
      photo={<Portrait url={(career ? profile?.avatarUrl : null) ?? avatarOf(p.match, who.id)} name={who.name} n={team.n} />}
      stats={stats}
      width={1240}
      testId={`we-profile-${p.mode}`}
    />
  );
}
