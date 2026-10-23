"use client";

/**
 * The Test classic score bug, built for a long innings: a bevelled navy
 * bar across the foot of the screen (the side, its score and overs, both
 * batters, the bowler's overs-maidens-runs-wickets, this over's tray),
 * an ivory tab above it naming the innings and where the side stands
 * (lead, deficit or chase) and an ivory strip under it led by the
 * partnership. Figures flip like a scoreboard's when they change.
 *
 * Layouts: bottom (the full bar; also "broadcast"), top (one bar and its
 * strip at the head of the screen) and compact (a card in the lower left
 * corner). Phases: before the first ball, in play, the innings break and
 * the result. A slot without data closes up; no day or session is shown
 * until `live_state` carries one.
 */

import type { CSSProperties, ReactNode } from "react";
import type { Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { AnimatedNumber } from "../motion";
import { battingSide, oversText, overTokens, teamCode } from "../../overlay-kit";
import { inningsTeamName } from "../../scorecard-cards";
import {
  ballsPerOverOf,
  sidesOf,
  tossLineOf,
  type OverlayPhase,
} from "../../score-bug";
import type { LayoutMode, LiveMatchState } from "../../types";
import type { OverlayElementProps } from "../types";
import {
  BallTray,
  Crest,
  delay,
  Divider,
  DROP_FILTER,
  Fig,
  FIGS,
  GoldRule,
  IVORY,
  Label,
  NAVY,
  NAVY_DEEP,
  RADIUS,
  SAFE,
  SERIF,
  Stripe,
  TC,
  TcRoot,
  useLocalStart,
} from "./kit";
import {
  bowlingFigures,
  earlierInningsOf,
  inningsTitle,
  oversLimitOf,
  previousInnings,
  scoreText,
  standingOf,
  thisOverRuns,
  type Standing,
} from "./logic";

type BugProps = OverlayElementProps["scoreBug"];

const teamVar = (side: 1 | 2 | null) =>
  side === 2 ? "var(--tc-team2)" : "var(--tc-team1)";

// ---- shared pieces -----------------------------------------------------------

/** The score as two flipping figures: "138-5" (all out: "212"). */
function ScoreFigures({
  state,
  className,
}: {
  state: LiveMatchState;
  className?: string;
}) {
  const runs = state.total_runs ?? 0;
  const wkts = state.total_wickets ?? 0;
  return (
    <Fig className={cn("inline-flex items-baseline", className)}>
      <AnimatedNumber value={runs} variant="flip" durationMs={460} />
      {wkts < 10 && (
        <>
          <span className="px-[0.04em]">-</span>
          <AnimatedNumber value={wkts} variant="flip" durationMs={460} />
        </>
      )}
      <span className="sr-only">
        {` ${runs} for ${wkts}`}
      </span>
    </Fig>
  );
}

function BatterRow({
  name,
  runs,
  balls,
  striker,
  size = "lg",
}: {
  name: string | null;
  runs: number | null;
  balls: number | null;
  striker: boolean;
  size?: "lg" | "md";
}) {
  if (!name) return null;
  const lg = size === "lg";
  return (
    <div className={cn("flex min-w-0 items-center gap-3", lg ? "h-8" : "h-7")}>
      <span
        aria-hidden="true"
        className="shrink-0 rounded-[2px]"
        style={{
          width: 6,
          height: lg ? 24 : 20,
          background: striker ? TC.ivoryHi : "transparent",
          boxShadow: striker ? "0 0 0 1px rgba(0,0,0,0.25)" : undefined,
        }}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate leading-tight",
          lg ? "text-[1.5625rem]" : "text-[1.3125rem]",
          striker ? "font-semibold" : "font-medium",
        )}
        style={{ color: striker ? TC.ivoryHi : "rgba(243,236,218,0.88)" }}
      >
        {name}
        {striker && <span className="sr-only"> on strike</span>}
      </span>
      <Fig className={lg ? "text-[1.75rem]" : "text-[1.5rem]"}>
        <AnimatedNumber value={runs ?? 0} variant="flip" />
      </Fig>
      <span
        className={cn("shrink-0 text-right", lg ? "w-14 text-[1.25rem]" : "w-12 text-[1.125rem]")}
        style={{ color: "rgba(243,236,218,0.72)", ...FIGS }}
      >
        ({balls ?? 0})
      </span>
    </div>
  );
}

function BowlerBlock({
  state,
  bpo,
  size = "lg",
}: {
  state: LiveMatchState;
  bpo: number;
  size?: "lg" | "md";
}) {
  if (!state.current_bowler_name) return null;
  const lg = size === "lg";
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1.5">
      <span
        className={cn("truncate font-medium leading-tight", lg ? "text-[1.5rem]" : "text-[1.3125rem]")}
        style={{ color: "rgba(243,236,218,0.92)" }}
      >
        {state.current_bowler_name}
      </span>
      <span className="flex items-baseline gap-2.5">
        <Fig className={lg ? "text-[1.625rem]" : "text-[1.375rem]"} style={{ color: TC.ivoryHi }}>
          {bowlingFigures(
            state.bowler_balls,
            state.bowler_maidens,
            state.bowler_runs,
            state.bowler_wickets,
            bpo,
          )}
        </Fig>
        <span className="sr-only">overs, maidens, runs, wickets</span>
      </span>
    </div>
  );
}

/** The ivory tab above the bar: the innings and where the side stands. */
function Tab({ children, d = 120 }: { children: ReactNode; d?: number }) {
  return (
    <div
      className="tc-a-wipe relative flex h-[2.375rem] w-max max-w-full items-center gap-4 overflow-hidden px-5"
      style={{
        ...IVORY,
        borderTopLeftRadius: RADIUS,
        borderTopRightRadius: RADIUS,
        ...delay(d),
      }}
    >
      <GoldRule height={2} className="absolute inset-x-0 top-0" d={d} />
      {children}
    </div>
  );
}

function Diamond({ colour = TC.gold }: { colour?: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rotate-45"
      style={{ background: colour }}
    />
  );
}

function StandingText({ standing }: { standing: Standing }) {
  return (
    <span
      className="truncate text-[1.375rem] font-bold leading-none"
      style={{
        fontFamily: SERIF,
        ...FIGS,
        color: standing.kind === "trail" ? TC.claret : TC.ink,
      }}
    >
      {standing.text}
    </span>
  );
}

function StateChips({ state }: { state: LiveMatchState }) {
  return (
    <>
      {state.free_hit && (
        <span
          className="shrink-0 rounded-[3px] px-2.5 py-1 text-[1rem] font-semibold uppercase leading-none tracking-[0.12em] text-white"
          style={{ background: TC.claret }}
        >
          Free hit
        </span>
      )}
      {state.powerplay && (
        <span
          className="shrink-0 rounded-[3px] px-2.5 py-1 text-[1rem] font-semibold uppercase leading-none tracking-[0.12em]"
          style={{ background: TC.navy, color: TC.ivoryHi }}
        >
          Powerplay
        </span>
      )}
    </>
  );
}

/** One item of the ivory strip: a tracked label and a figure. */
function StripItem({
  label,
  value,
  strong = false,
  d = 0,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  d?: number;
}) {
  return (
    <span className="tc-a-fade flex min-w-0 shrink-0 items-center gap-2.5" style={delay(d)}>
      {strong ? (
        <span
          className="rounded-[3px] px-2 py-1 text-[1rem] font-semibold uppercase leading-none tracking-[0.14em]"
          style={{ background: TC.navy, color: TC.goldText }}
        >
          {label}
        </span>
      ) : (
        <Label style={{ color: TC.inkMuted }}>{label}</Label>
      )}
      <span
        className={cn("leading-none", strong ? "text-[1.375rem] font-bold" : "text-[1.25rem] font-semibold")}
        style={{ fontFamily: strong ? SERIF : undefined, ...FIGS, color: TC.ink }}
      >
        {value}
      </span>
    </span>
  );
}

function Strip({
  left,
  right,
  className,
}: {
  left: ReactNode[];
  right?: ReactNode[];
  className?: string;
}) {
  if (!left.length && !right?.length) return null;
  return (
    <div
      className={cn("flex h-10 items-center justify-between gap-6 px-6", className)}
      style={{
        ...IVORY,
        borderBottomLeftRadius: RADIUS,
        borderBottomRightRadius: RADIUS,
      }}
    >
      <div className="flex min-w-0 items-center gap-6 overflow-hidden">
        {left.map((n, i) => (
          <span key={i} className="flex min-w-0 shrink-0 items-center gap-6">
            {i > 0 && <Diamond colour={TC.ivoryLine} />}
            {n}
          </span>
        ))}
      </div>
      {right && right.length > 0 && (
        <div className="flex min-w-0 items-center gap-6 overflow-hidden">
          {right.map((n, i) => (
            <span key={i} className="flex min-w-0 items-center gap-6">
              {i > 0 && <Diamond colour={TC.ivoryLine} />}
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Partnership, rates and target for the strip (what applies now). */
function stripItems(state: LiveMatchState, standing: Standing | null) {
  const left: ReactNode[] = [];
  if ((state.partnership_runs ?? null) !== null && state.striker_name) {
    left.push(
      <StripItem
        key="p"
        strong
        label="Partnership"
        value={`${state.partnership_runs} (${state.partnership_balls ?? 0})`}
        d={420}
      />,
    );
  }
  if (standing?.kind === "chase") {
    left.push(<StripItem key="t" label="Target" value={standing.target} d={480} />);
    if (standing.balls !== null && state.required_run_rate !== null) {
      left.push(
        <StripItem
          key="rrr"
          label="Req rate"
          value={state.required_run_rate.toFixed(2)}
          d={520}
        />,
      );
    }
  }
  if (state.current_run_rate !== null && (state.total_balls ?? 0) > 0) {
    left.push(
      <StripItem key="crr" label="Run rate" value={state.current_run_rate.toFixed(2)} d={560} />,
    );
  }
  return left;
}

function lastWicketItem(state: LiveMatchState): ReactNode | null {
  const w = state.last_wicket;
  if (!w?.name) return null;
  return (
    <span className="tc-a-fade flex min-w-0 items-center gap-2.5" style={delay(600)}>
      <Label style={{ color: TC.inkMuted }}>Last wkt</Label>
      <span className="truncate text-[1.25rem] font-semibold" style={{ color: TC.ink }}>
        {w.name}
      </span>
      <span className="shrink-0 text-[1.25rem] font-semibold" style={{ ...FIGS, color: TC.ink }}>
        {w.runs} ({w.balls})
      </span>
    </span>
  );
}

function SponsorItem({ sponsor }: { sponsor: string | null | undefined }) {
  if (!sponsor) return null;
  return (
    <span className="truncate text-[1.125rem] font-medium italic" style={{ color: TC.inkMuted, fontFamily: SERIF }}>
      {sponsor}
    </span>
  );
}

// ---- in play ---------------------------------------------------------------

interface PlayProps {
  state: LiveMatchState;
  match: Match | null;
  bpo: number;
  sponsor: string | null;
}

function TeamBlock({
  state,
  size = 52,
  codeClass = "text-[1.875rem]",
}: {
  state: LiveMatchState;
  size?: number;
  codeClass?: string;
}) {
  const side = battingSide(state);
  const { batting } = sidesOf(state);
  const logo =
    side === 1 ? state.team1_logo_url : side === 2 ? state.team2_logo_url : batting.logo;
  return (
    <div className="flex shrink-0 items-stretch">
      <Stripe colour={teamVar(side)} />
      <div className="flex items-center gap-3.5 px-5">
        {logo && (
          <Crest logoUrl={logo} name={batting.name} size={size} colour={teamVar(side)} />
        )}
        <span
          className={cn("max-w-[9rem] truncate font-bold leading-none tracking-[0.04em]", codeClass)}
          style={{ fontFamily: SERIF }}
        >
          {teamCode(batting.short, batting.name)}
        </span>
      </div>
    </div>
  );
}

function ScoreBlock({
  state,
  match,
  bpo,
  big = true,
}: {
  state: LiveMatchState;
  match: Match | null;
  bpo: number;
  big?: boolean;
}) {
  const earlier = earlierInningsOf(state, match);
  const limit = oversLimitOf(state);
  return (
    <div className="flex shrink-0 items-center gap-4 px-6">
      {earlier && (
        <Fig className={big ? "text-[1.625rem]" : "text-[1.25rem]"} style={{ color: "rgba(243,236,218,0.7)" }}>
          {scoreText(earlier.total_runs, earlier.total_wickets)} &amp;
        </Fig>
      )}
      <ScoreFigures state={state} className={big ? "text-[3.25rem]" : "text-[2.5rem]"} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-semibold", big ? "text-[1.5rem]" : "text-[1.25rem]")} style={FIGS}>
          <AnimatedNumber value={oversText(state.total_balls, bpo)} />
          {limit === null && <span className="ml-1.5 text-[1rem] font-medium" style={{ color: "rgba(243,236,218,0.72)" }}>ov</span>}
        </span>
        {limit !== null && (
          <span className="mt-1.5 text-[1rem] font-medium" style={{ color: "rgba(243,236,218,0.72)", ...FIGS }}>
            of {limit} {limit === 1 ? "over" : "overs"}
          </span>
        )}
      </span>
    </div>
  );
}

function OverTray({ state, bpo, size = 34 }: { state: LiveMatchState; bpo: number; size?: number }) {
  const tokens = overTokens(state);
  const runs = thisOverRuns(tokens, state.this_over_runs);
  return (
    <div className="flex min-w-0 flex-col items-end justify-center gap-2">
      <span className="flex items-baseline gap-2.5">
        <Label style={{ color: TC.goldText }}>This over</Label>
        {tokens.length > 0 && runs !== null && (
          <span className="text-[1.125rem] font-semibold leading-none" style={{ ...FIGS, color: "rgba(243,236,218,0.85)" }}>
            {runs}
          </span>
        )}
      </span>
      <BallTray tokens={tokens} slots={bpo} size={size} />
    </div>
  );
}

function BottomInPlay({ state, match, bpo, sponsor }: PlayProps) {
  const standing = standingOf(state, match);
  const left = stripItems(state, standing);
  const last = lastWicketItem(state);
  return (
    <>
      <Tab>
        <Label style={{ color: TC.inkMuted }}>
          {inningsTitle(state.innings_number, state.match_format)}
        </Label>
        {standing && (
          <>
            <Diamond />
            <StandingText standing={standing} />
          </>
        )}
        <StateChips state={state} />
      </Tab>
      <div
        className="tc-a-wipe relative flex h-[4.75rem] items-stretch overflow-hidden"
        style={{ ...NAVY, borderTopRightRadius: RADIUS, ...delay(0) }}
      >
        <GoldRule height={2} className="absolute inset-x-0 top-0 z-10" d={0} />
        <TeamBlock state={state} />
        <Divider />
        <ScoreBlock state={state} match={match} bpo={bpo} />
        <Divider />
        <div
          aria-label="At the crease"
          className="flex w-[31rem] min-w-0 flex-col justify-center gap-1.5 px-6"
        >
          <BatterRow name={state.striker_name} runs={state.striker_runs} balls={state.striker_balls} striker />
          <BatterRow name={state.non_striker_name} runs={state.non_striker_runs} balls={state.non_striker_balls} striker={false} />
        </div>
        {state.current_bowler_name && (
          <>
            <Divider />
            <div className="flex w-[21rem] min-w-0 px-6">
              <BowlerBlock state={state} bpo={bpo} />
            </div>
          </>
        )}
        <Divider />
        <div className="flex min-w-0 flex-1 items-center justify-end px-6">
          <OverTray state={state} bpo={bpo} />
        </div>
      </div>
      <Strip
        left={left}
        right={[last, sponsor ? <SponsorItem key="s" sponsor={sponsor} /> : null].filter(Boolean) as ReactNode[]}
      />
    </>
  );
}

function TopInPlay({ state, match, bpo, sponsor }: PlayProps) {
  const standing = standingOf(state, match);
  const left: ReactNode[] = [
    <Label key="inn" style={{ color: TC.inkMuted }}>
      {inningsTitle(state.innings_number, state.match_format)}
    </Label>,
  ];
  if (standing) left.push(<StandingText key="st" standing={standing} />);
  left.push(...stripItems(state, standing));
  return (
    <>
      <div
        className="tc-a-wipe relative flex h-16 items-stretch overflow-hidden"
        style={{ ...NAVY, borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS }}
      >
        <GoldRule height={2} className="absolute inset-x-0 top-0 z-10" />
        <TeamBlock state={state} size={42} codeClass="text-[1.5rem]" />
        <Divider />
        <ScoreBlock state={state} match={match} bpo={bpo} big={false} />
        <Divider />
        <div className="flex w-[22rem] min-w-0 items-center px-5">
          <div className="w-full">
            <BatterRow name={state.striker_name} runs={state.striker_runs} balls={state.striker_balls} striker size="md" />
          </div>
        </div>
        <Divider />
        <div className="flex w-[22rem] min-w-0 items-center px-5">
          <div className="w-full">
            <BatterRow name={state.non_striker_name} runs={state.non_striker_runs} balls={state.non_striker_balls} striker={false} size="md" />
          </div>
        </div>
        {state.current_bowler_name && (
          <>
            <Divider />
            <div className="flex min-w-0 max-w-[22rem] items-center gap-3 px-5">
              <span className="truncate text-[1.3125rem] font-medium" style={{ color: "rgba(243,236,218,0.92)" }}>
                {state.current_bowler_name}
              </span>
              <Fig className="shrink-0 text-[1.375rem]">
                {bowlingFigures(state.bowler_balls, state.bowler_maidens, state.bowler_runs, state.bowler_wickets, bpo)}
              </Fig>
            </div>
          </>
        )}
        <Divider />
        <div className="flex min-w-0 flex-1 items-center justify-end px-5">
          <BallTray tokens={overTokens(state)} slots={bpo} size={30} />
        </div>
      </div>
      <Strip left={left} right={sponsor ? [<SponsorItem key="s" sponsor={sponsor} />] : []} className="h-9" />
    </>
  );
}

function CompactInPlay({ state, match, bpo }: PlayProps) {
  const standing = standingOf(state, match);
  return (
    <div className="w-[30rem]">
      <Tab>
        <Label style={{ color: TC.inkMuted }}>
          {inningsTitle(state.innings_number, state.match_format)}
        </Label>
        {standing && (
          <>
            <Diamond />
            <StandingText standing={standing} />
          </>
        )}
      </Tab>
      <div
        className="tc-a-wipe relative overflow-hidden"
        style={{ ...NAVY, borderTopRightRadius: RADIUS }}
      >
        <GoldRule height={2} className="absolute inset-x-0 top-0 z-10" />
        <div className="flex h-[4.25rem] items-stretch">
          <TeamBlock state={state} size={42} codeClass="text-[1.5rem]" />
          <div className="ml-auto flex items-center">
            <ScoreBlock state={state} match={match} bpo={bpo} big={false} />
          </div>
        </div>
        <div className="space-y-1.5 px-5 py-3" style={NAVY_DEEP}>
          <BatterRow name={state.striker_name} runs={state.striker_runs} balls={state.striker_balls} striker size="md" />
          <BatterRow name={state.non_striker_name} runs={state.non_striker_runs} balls={state.non_striker_balls} striker={false} size="md" />
          {state.current_bowler_name && (
            <div className="flex items-center gap-3 pt-1.5" style={{ borderTop: "1px solid rgba(243,236,218,0.16)" }}>
              <span className="min-w-0 flex-1 truncate pl-[1.125rem] text-[1.25rem] font-medium" style={{ color: "rgba(243,236,218,0.9)" }}>
                {state.current_bowler_name}
              </span>
              <Fig className="text-[1.375rem]">
                {bowlingFigures(state.bowler_balls, state.bowler_maidens, state.bowler_runs, state.bowler_wickets, bpo)}
              </Fig>
            </div>
          )}
          <div className="flex justify-end pt-1.5">
            <BallTray tokens={overTokens(state)} slots={bpo} size={28} />
          </div>
        </div>
      </div>
      <Strip left={stripItems(state, standing).slice(0, 2)} />
    </div>
  );
}

// ---- before, between and after -----------------------------------------------

function SideName({
  name,
  short,
  logo,
  side,
  align = "left",
  big = true,
}: {
  name: string | null;
  short: string | null;
  logo: string | null | undefined;
  side: 1 | 2;
  align?: "left" | "right";
  big?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-4", align === "right" && "flex-row-reverse")}>
      <Crest logoUrl={logo} code={teamCode(short, name)} name={name} size={big ? 50 : 40} colour={teamVar(side)} />
      <span
        className={cn("min-w-0 truncate font-bold leading-tight", big ? "text-[2rem]" : "text-[1.5rem]")}
        style={{ fontFamily: SERIF }}
      >
        {name}
      </span>
    </div>
  );
}

function PreBar({ state, match, slim }: { state: LiveMatchState; match: Match | null; slim: boolean }) {
  const start = useLocalStart(match?.scheduled_at);
  const toss = tossLineOf(state, match);
  const source = state.tournament_name ?? (state.title !== `${state.team1_name} v ${state.team2_name}` ? state.title : null);
  const team1 = state.team1_name ?? match?.team1?.name ?? "";
  const team2 = state.team2_name ?? match?.team2?.name ?? "";
  const right = [toss, state.venue].filter(Boolean) as string[];
  return (
    <>
      <Tab>
        <Label style={{ color: TC.inkMuted }}>{start ? "Start of play" : "Coming up"}</Label>
        {start && (
          <>
            <Diamond />
            <span className="text-[1.375rem] font-bold leading-none" style={{ fontFamily: SERIF, ...FIGS }}>
              {start}
            </span>
          </>
        )}
      </Tab>
      <div
        className={cn("tc-a-wipe relative flex items-center gap-6 overflow-hidden px-7", slim ? "h-16" : "h-[4.75rem]")}
        style={{ ...NAVY, borderTopRightRadius: RADIUS, ...(right.length ? {} : { borderBottomLeftRadius: RADIUS, borderBottomRightRadius: RADIUS }) }}
      >
        <GoldRule height={2} className="absolute inset-x-0 top-0 z-10" />
        <SideName name={team1} short={state.team1_short_name} logo={state.team1_logo_url} side={1} big={!slim} />
        <span className="shrink-0 text-[1.5rem] italic" style={{ fontFamily: SERIF, color: TC.goldText }}>
          v
        </span>
        <SideName name={team2} short={state.team2_short_name} logo={state.team2_logo_url} side={2} big={!slim} />
        {source && !slim && (
          <span className="ml-auto max-w-[30rem] truncate text-right">
            <Label style={{ color: TC.goldText }}>{source}</Label>
          </span>
        )}
      </div>
      <Strip
        left={right.map((t, i) => (
          <span key={i} className="truncate text-[1.25rem] font-medium" style={{ color: TC.ink }}>
            {t}
          </span>
        ))}
      />
    </>
  );
}

function BreakBar({ state, match, slim }: { state: LiveMatchState; match: Match | null; slim: boolean }) {
  const done = state.innings_completed
    ? match?.innings?.find((i) => i.innings_number === state.innings_number) ?? null
    : previousInnings(state, match);
  const standing = standingOf(state, match);
  const { batting } = sidesOf(state);
  const doneName = done ? inningsTeamName(state, done, match?.team1_id) : null;
  const bpo = ballsPerOverOf(match);
  const nextName = state.innings_completed ? null : batting.name;
  const target = state.target_runs;
  const strip: ReactNode[] = [];
  if (standing?.kind === "chase" && standing.balls !== null) {
    strip.push(
      <StripItem key="need" label="To win" value={`${standing.need} from ${standing.balls} balls`} />,
    );
    if (state.required_run_rate !== null) {
      strip.push(<StripItem key="rrr" label="Req rate" value={state.required_run_rate.toFixed(2)} />);
    }
  }
  return (
    <>
      <Tab>
        <Label style={{ color: TC.inkMuted }}>Innings break</Label>
        {standing && standing.kind !== "chase" && (
          <>
            <Diamond />
            <StandingText standing={standing} />
          </>
        )}
      </Tab>
      <div
        className={cn("tc-a-wipe relative flex items-stretch overflow-hidden", slim ? "h-16" : "h-[4.75rem]")}
        style={{ ...NAVY, borderTopRightRadius: RADIUS, ...(strip.length ? {} : { borderBottomLeftRadius: RADIUS, borderBottomRightRadius: RADIUS }) }}
      >
        <GoldRule height={2} className="absolute inset-x-0 top-0 z-10" />
        {done && doneName && (
          <>
            <div className="flex shrink-0 items-center gap-4 px-7">
              <span className="max-w-[22rem] truncate text-[1.5rem] font-semibold">{doneName}</span>
              <Fig className={slim ? "text-[2.25rem]" : "text-[2.75rem]"}>
                {scoreText(done.total_runs, done.total_wickets)}
              </Fig>
              <span className="text-[1.25rem]" style={{ color: "rgba(243,236,218,0.72)", ...FIGS }}>
                ({oversText(done.total_balls, bpo)} ov)
              </span>
            </div>
            <Divider />
          </>
        )}
        <div className="flex min-w-0 flex-1 items-center px-7">
          {nextName && (
            <span className="truncate text-[1.625rem] italic" style={{ fontFamily: SERIF }}>
              {nextName} to bat
            </span>
          )}
        </div>
        {target ? (
          <div className="flex shrink-0 items-center gap-4 px-7" style={NAVY_DEEP}>
            <Label style={{ color: TC.goldText }}>Target</Label>
            <Fig className="text-[2.75rem]" style={{ color: TC.goldText }}>
              {target}
            </Fig>
          </div>
        ) : null}
      </div>
      <Strip left={strip} />
    </>
  );
}

function ResultBar({ state, match, slim }: { state: LiveMatchState; match: Match | null; slim: boolean }) {
  const main = (match?.innings ?? []).filter((i) => i.innings_number <= 4).sort((a, b) => a.innings_number - b.innings_number);
  const bpo = ballsPerOverOf(match);
  const potm = match?.player_of_the_match?.full_name;
  const toss = tossLineOf(state, match);
  const strip: ReactNode[] = [];
  if (potm) strip.push(<StripItem key="potm" strong label="Player of the match" value={potm} />);
  else if (toss) strip.push(<span key="toss" className="truncate text-[1.25rem]" style={{ color: TC.ink }}>{toss}</span>);
  return (
    <>
      <Tab>
        <Label style={{ color: TC.inkMuted }}>Result</Label>
      </Tab>
      <div
        className={cn("tc-a-wipe relative flex items-stretch overflow-hidden", slim ? "h-16" : "h-[4.75rem]")}
        style={{ ...NAVY, borderTopRightRadius: RADIUS, ...(strip.length ? {} : { borderBottomLeftRadius: RADIUS, borderBottomRightRadius: RADIUS }) }}
      >
        <GoldRule height={2} className="absolute inset-x-0 top-0 z-10" sheen />
        <div className="flex min-w-0 flex-1 items-center px-7">
          <span className={cn("truncate font-bold", slim ? "text-[1.75rem]" : "text-[2.125rem]")} style={{ fontFamily: SERIF }}>
            {state.result_description ?? "Match finished"}
          </span>
        </div>
        {!slim &&
          main.map((inn) => (
            <div key={inn.id} className="flex shrink-0 items-center gap-3 px-6" style={NAVY_DEEP}>
              <span className="text-[1.25rem] font-semibold tracking-[0.04em]">
                {teamCode(
                  inn.team_id === match?.team1_id ? state.team1_short_name : state.team2_short_name,
                  inningsTeamName(state, inn, match?.team1_id),
                )}
              </span>
              <Fig className="text-[1.75rem]">{scoreText(inn.total_runs, inn.total_wickets)}</Fig>
              <span className="text-[1.0625rem]" style={{ color: "rgba(243,236,218,0.72)", ...FIGS }}>
                {oversText(inn.total_balls, bpo)} ov
              </span>
            </div>
          ))}
      </div>
      <Strip left={strip} />
    </>
  );
}

// ---- the element -----------------------------------------------------------

function position(layout: LayoutMode, offset: number): CSSProperties {
  if (layout === "top") return { top: SAFE.y, left: SAFE.x, right: SAFE.x };
  if (layout === "compact") return { bottom: SAFE.y + offset, left: SAFE.x };
  return { bottom: SAFE.y + offset, left: SAFE.x, right: SAFE.x };
}

export function TestClassicScoreBug(p: BugProps) {
  const { state, match, layout, sponsor, marginOffsetPx, phase } = p;
  const bpo = ballsPerOverOf(match);
  const slim = layout === "top" || layout === "compact";
  const effective: OverlayPhase = phase;
  const play: PlayProps = { state, match, bpo, sponsor };
  return (
    <TcRoot
      data-testid="score-bug"
      data-layout={layout}
      data-phase={effective}
      className="fixed z-20"
      style={{ ...position(layout, marginOffsetPx), filter: DROP_FILTER }}
    >
      <div className={layout === "compact" && effective !== "live" ? "w-[44rem]" : undefined}>
        {effective === "pre" ? (
          <PreBar state={state} match={match} slim={slim} />
        ) : effective === "break" ? (
          <BreakBar state={state} match={match} slim={slim} />
        ) : effective === "done" ? (
          <ResultBar state={state} match={match} slim={slim} />
        ) : layout === "top" ? (
          <TopInPlay {...play} />
        ) : layout === "compact" ? (
          <CompactInPlay {...play} />
        ) : (
          <BottomInPlay {...play} />
        )}
      </div>
    </TcRoot>
  );
}
