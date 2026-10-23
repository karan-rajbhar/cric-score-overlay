"use client";

/**
 * World event's score bug, laid out like a global event's world feed: a
 * bar across the bottom with each side's crest in an end cap in its team
 * colour, the two batters, a deep centre block (both team codes, the
 * score in the event pill, the powerplay tab, overs, and a context line
 * that rotates), then the bowler with this over's balls.
 *
 * Phases: before the start (who plays, when, the toss), live, the innings
 * break (first innings and the target) and the result. Layouts: the full
 * bar (bottom / broadcast), a slim bar at the top, a compact corner card.
 */

import type { ReactNode } from "react";
import type { Innings, Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { overTokens, oversText } from "../../overlay-kit";
import { ballsPerOverOf, inningsLabel, tossLineOf } from "../../score-bug";
import { chaseLine } from "../shared/derive";
import type { LiveMatchState } from "../../types";
import type { OverlayElementProps } from "../types";
import {
  battingAndBowling,
  bugName,
  fixed2,
  mainInnings,
  scoreText,
  sideOfInnings,
  teamsOf,
  winnerSide,
  type SideInfo,
} from "./data";
import {
  Balls,
  Crest,
  delay,
  Fig,
  Root,
  ScoreFig,
  side,
  useLocalTime,
  useRotation,
} from "./kit";
import { SAFE, scoreBugAnchor } from "../shared/layout";

type BugProps = OverlayElementProps["scoreBug"];

// ---- context line -------------------------------------------------------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The live context line's items, most important first. */
export function liveContext(state: LiveMatchState): string[] {
  const items: string[] = [];
  const chase = chaseLine(state);
  if (chase) {
    items.push(
      `Need ${plural(chase.runsNeeded, "run", "runs")} from ${plural(chase.ballsRemaining, "ball", "balls")}`,
    );
    const rates = [
      `Target ${chase.target}`,
      chase.requiredRate !== null && `Req rate ${fixed2(chase.requiredRate)}`,
      chase.currentRate !== null && `Run rate ${fixed2(chase.currentRate)}`,
    ].filter(Boolean);
    items.push(rates.join("  ·  "));
  } else if (state.current_run_rate !== null && (state.total_balls ?? 0) > 0) {
    items.push(`Current run rate ${fixed2(state.current_run_rate)}`);
  }
  if ((state.partnership_runs ?? 0) > 0) {
    items.push(`Partnership ${state.partnership_runs} (${state.partnership_balls ?? 0})`);
  }
  const w = state.last_wicket;
  if (w?.name) items.push(`Last wicket ${bugName(w.name)} ${w.runs} (${w.balls})`);
  return items;
}

function ContextLine({ items, className }: { items: string[]; className?: string }) {
  const at = useRotation(items.length);
  const text = items[at];
  if (!text) return null;
  return (
    <span
      key={`${at}-${text}`}
      className={cn("we-label we-trunc we-a-fade block text-[18px] tracking-[0.06em]", className)}
    >
      {text}
    </span>
  );
}

// ---- pieces -------------------------------------------------------------

/** A side's end cap: its crest on its colour, cut towards the centre. */
function EndCap({ team, at, width = 128 }: { team: SideInfo; at: "left" | "right"; width?: number }) {
  return (
    <div className={cn("flex shrink-0", at === "left" ? "we-a-slide-r" : "we-a-slide-l")} style={{ width }}>
      <div
        className={cn(
          "we-team flex w-full items-center justify-center",
          at === "left" ? "we-cut-r pr-3" : "we-cut-l pl-3",
        )}
        style={{ ...side(team.n), ["--we-cut" as string]: "20px" }}
      >
        <Crest
          n={team.n}
          logo={team.logo}
          code={team.code}
          name={team.name}
          size={Math.round(width * 0.5)}
          className="we-a-pop"
          style={delay(260)}
        />
      </div>
    </div>
  );
}

/** Both codes, the batting side's bright. */
function Codes({ bat, bowl, size = 28 }: { bat: SideInfo; bowl: SideInfo; size?: number }) {
  return (
    <span className="we-x flex shrink-0 items-baseline gap-2.5" style={{ fontSize: size }}>
      <span>{bat.code}</span>
      <span className="we-muted text-[0.62em] font-bold normal-case">v</span>
      <span className="we-muted">{bowl.code}</span>
    </span>
  );
}

/** The event pill: the score (or a target) on the accent. */
function Pill({ children, size = 40 }: { children: ReactNode; size?: number }) {
  return (
    <span
      className="we-accent we-sheen we-trap relative flex shrink-0 items-center px-6"
      style={{ height: Math.round(size * 1.3), ["--we-cut" as string]: "12px" }}
    >
      <span className="we-fig leading-none" style={{ fontSize: size }}>
        {children}
      </span>
    </span>
  );
}

function PowerplayTab({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span
      className="we-mint we-chev-r we-x flex h-[34px] shrink-0 items-center pl-2.5 pr-5 text-[20px]"
      style={{ ["--we-cut" as string]: "10px" }}
      title="Powerplay"
    >
      P
    </span>
  );
}

function Overs({ state, bpo, size = 30 }: { state: LiveMatchState; bpo: number; size?: number }) {
  const limit = (state.innings_number ?? 1) >= 3 ? 1 : (state.dls_overs ?? state.overs_per_innings);
  return (
    <span className="flex shrink-0 items-baseline gap-1.5">
      <Fig value={oversText(state.total_balls, bpo)} className="we-fig" />
      <span className="we-label we-muted" style={{ fontSize: Math.max(16, Math.round(size * 0.56)) }}>
        {limit ? `of ${limit}` : "ov"}
      </span>
    </span>
  );
}

function Batter({
  name,
  runs,
  balls,
  striker,
  size = 25,
}: {
  name: string | null;
  runs: number | null;
  balls: number | null;
  striker: boolean;
  size?: number;
}) {
  if (!name) return <div className="h-[40px]" />;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn("h-0 w-0 shrink-0 border-y-[9px] border-l-[13px] border-y-transparent", striker ? "border-l-[#dc0078]" : "border-l-transparent")}
      />
      <span className="we-name we-trunc flex-1" style={{ fontSize: size }}>
        {bugName(name)}
        {striker && <span className="sr-only"> on strike</span>}
      </span>
      <Fig value={runs ?? 0} className="we-fig shrink-0 text-right" />
      <span className="we-figl we-ink-muted w-[52px] shrink-0 text-[20px]">({balls ?? 0})</span>
    </div>
  );
}

// ---- the full bar --------------------------------------------------------

/** The bar's frame: end caps, two side panels and the deep centre. */
function BarFrame({
  state,
  bottom,
  left,
  right,
  leftPanel,
  centre,
  rightPanel,
  above,
  phase,
}: {
  state: LiveMatchState;
  bottom: number;
  left: SideInfo;
  right: SideInfo;
  leftPanel: ReactNode;
  centre: ReactNode;
  rightPanel: ReactNode;
  above?: ReactNode;
  phase: string;
}) {
  return (
    <Root
      state={state}
      data-testid="we-score-bug"
      data-phase={phase}
      style={{ ...scoreBugAnchor("bottom"), bottom }}
    >
      {above && <div className="mb-1.5 flex items-end justify-between gap-4 px-[128px]">{above}</div>}
      <div className="we-lift flex h-[96px] items-stretch bg-[#0a0532]">
        <EndCap team={left} at="left" />
        <div className="we-paper we-on-paper we-a-wipe-r flex min-w-0 flex-1 flex-col justify-center gap-0.5 pl-6 pr-[46px]" style={delay(80)}>
          {leftPanel}
        </div>
        <div className="we-a-wipe-up relative z-10 -mx-[26px] flex w-[620px] shrink-0" style={delay(40)}>
          <div
            className="we-night we-trap relative flex w-full flex-col justify-center px-[52px]"
            style={{ ["--we-cut" as string]: "26px" }}
          >
            <span aria-hidden="true" className="we-accent absolute inset-x-0 top-0 h-[5px]" />
            {centre}
          </div>
        </div>
        <div className="we-paper we-on-paper we-a-wipe-l flex min-w-0 flex-1 flex-col justify-center gap-1 pl-[46px] pr-6" style={delay(80)}>
          {rightPanel}
        </div>
        <EndCap team={right} at="right" />
      </div>
    </Root>
  );
}

function LiveBar({ state, bpo, bottom, sponsor }: { state: LiveMatchState; bpo: number; bottom: number; sponsor: string | null }) {
  const { bat, bowl } = battingAndBowling(state);
  const above = (
    <>
      <span>
        {state.free_hit && (
          <span className="we-gold we-label we-cut-r we-a-drop inline-flex h-[32px] items-center pl-4 pr-8 text-[18px]" style={{ ["--we-cut" as string]: "12px" }}>
            Free hit
          </span>
        )}
      </span>
      {sponsor && (
        <span className="we-night we-label we-a-drop inline-flex h-[30px] max-w-[420px] items-center px-4 text-[16px]" style={delay(300)}>
          <span className="we-trunc">{sponsor}</span>
        </span>
      )}
    </>
  );
  return (
    <BarFrame
      state={state}
      bottom={bottom}
      phase="live"
      left={bat}
      right={bowl}
      above={state.free_hit || sponsor ? above : null}
      leftPanel={
        <div aria-label="At the crease" className="flex flex-col gap-1 text-[30px]">
          <Batter name={state.striker_name} runs={state.striker_runs} balls={state.striker_balls} striker />
          <Batter name={state.non_striker_name} runs={state.non_striker_runs} balls={state.non_striker_balls} striker={false} />
        </div>
      }
      centre={
        <>
          <div className="flex items-center gap-4">
            <Codes bat={bat} bowl={bowl} />
            <Pill>
              <ScoreFig runs={state.total_runs} wickets={state.total_wickets} />
            </Pill>
            <PowerplayTab on={!!state.powerplay} />
            <span className="ml-auto text-[30px]">
              <Overs state={state} bpo={bpo} />
            </span>
          </div>
          <ContextLine items={liveContext(state)} className="mt-1.5 text-[#bdf7e8]" />
        </>
      }
      rightPanel={
        state.current_bowler_name ? (
          <>
            <div className="flex min-w-0 items-baseline gap-3">
              <span className="we-name we-trunc flex-1 text-[24px]">{bugName(state.current_bowler_name)}</span>
              <span className="we-fig shrink-0 text-[28px]">
                <Fig value={`${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0}`} />
              </span>
              <span className="we-figl we-ink-muted shrink-0 text-[20px]">{oversText(state.bowler_balls, bpo)}</span>
            </div>
            <Balls tokens={overTokens(state)} slots={bpo} size={30} />
          </>
        ) : (
          <Balls tokens={overTokens(state)} slots={bpo} size={30} />
        )
      }
    />
  );
}

/** Pre-match: both sides by name, the codes, then start time, toss, venue. */
function PreBar({ state, match, bottom }: { state: LiveMatchState; match: Match | null; bottom: number }) {
  const [t1, t2] = teamsOf(state);
  const start = useLocalTime(match?.scheduled_at);
  const done = state.status === "abandoned" || state.status === "cancelled";
  const items = [
    done ? (state.result_description ?? "Match called off") : start ? `Starts ${start}` : null,
    tossLineOf(state, match),
    state.venue,
    state.tournament_name ?? state.title,
  ].filter((s): s is string => !!s);
  const name = (t: SideInfo, align: "left" | "right") => (
    <span className={cn("we-name we-trunc block text-[30px] leading-tight", align === "right" && "text-right")}>
      {t.name || t.code}
    </span>
  );
  return (
    <BarFrame
      state={state}
      bottom={bottom}
      phase="pre"
      left={t1}
      right={t2}
      leftPanel={name(t1, "right")}
      rightPanel={name(t2, "left")}
      centre={
        <>
          <div className="flex items-center justify-center gap-4">
            <span className="we-x text-[34px]">{t1.code}</span>
            <span className="we-accent we-x we-trap flex h-[36px] items-center px-5 text-[18px]" style={{ ["--we-cut" as string]: "10px" }}>
              v
            </span>
            <span className="we-x text-[34px]">{t2.code}</span>
          </div>
          <ContextLine items={items} className="mt-1 text-center text-[#bdf7e8]" />
        </>
      }
    />
  );
}

/** The innings of a side, from the match. */
function inningsOfSide(
  state: LiveMatchState,
  match: Match | null,
  n: 1 | 2,
): Innings | undefined {
  return mainInnings(match?.innings ?? []).find((i) => sideOfInnings(state, i, match) === n);
}

function InningsLine({
  label,
  innings,
  bpo,
  align,
  gold,
}: {
  label: string;
  innings: Innings | undefined;
  bpo: number;
  align: "left" | "right";
  gold?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col", align === "right" ? "items-end text-right" : "items-start")}>
      <span className={cn("we-label text-[17px]", gold ? "text-[#a35f00]" : "we-ink-muted")}>{label}</span>
      {innings ? (
        <span className="flex items-baseline gap-2">
          <span className="we-fig text-[36px] leading-none">{scoreText(innings.total_runs, innings.total_wickets)}</span>
          <span className="we-figl we-ink-muted text-[20px]">({oversText(innings.total_balls, bpo)})</span>
        </span>
      ) : (
        <span className="we-fig text-[30px] leading-none">–</span>
      )}
    </div>
  );
}

/** Between the innings: the first innings, the target and the ask. */
function BreakBar({ state, match, bpo, bottom }: { state: LiveMatchState; match: Match | null; bpo: number; bottom: number }) {
  const { bat, bowl } = battingAndBowling(state);
  const first = inningsOfSide(state, match, bowl.n);
  const chase = chaseLine(state, bpo);
  const target = chase?.target ?? (first ? first.total_runs + 1 : null);
  const items = [
    chase &&
      `${chase.text}${chase.requiredRate !== null ? `  ·  Req rate ${fixed2(chase.requiredRate)}` : ""}`,
    "Innings break",
    tossLineOf(state, match),
  ].filter((s): s is string => !!s);
  return (
    <BarFrame
      state={state}
      bottom={bottom}
      phase="break"
      left={bowl}
      right={bat}
      leftPanel={<InningsLine label={`${bowl.code} 1st innings`} innings={first} bpo={bpo} align="left" />}
      rightPanel={
        <div className="flex flex-col items-end text-right">
          <span className="we-label we-ink-muted text-[17px]">{bat.code} to bat</span>
          {chase ? (
            <span className="flex items-baseline gap-2">
              <span className="we-fig text-[36px] leading-none">{chase.runsNeeded}</span>
              <span className="we-label we-ink-muted text-[17px]">from {chase.ballsRemaining} balls</span>
            </span>
          ) : (
            <span className="we-fig text-[30px] leading-none">{inningsLabel(2)}</span>
          )}
        </div>
      }
      centre={
        <>
          <div className="flex items-center gap-4">
            <Codes bat={bowl} bowl={bat} />
            {target !== null && (
              <Pill size={34}>
                <span className="mr-3 text-[0.55em] font-extrabold tracking-[0.08em]">TARGET</span>
                {target}
              </Pill>
            )}
          </div>
          <ContextLine items={items} className="mt-1.5 text-[#bdf7e8]" />
        </>
      }
    />
  );
}

/** After the match: each side's innings and the result. */
function ResultBar({ state, match, bpo, bottom }: { state: LiveMatchState; match: Match | null; bpo: number; bottom: number }) {
  const [t1, t2] = teamsOf(state);
  const won = winnerSide(state);
  const line = (t: SideInfo, align: "left" | "right") => (
    <InningsLine
      label={won === t.n ? `${t.code} won` : t.code}
      innings={inningsOfSide(state, match, t.n)}
      bpo={bpo}
      align={align}
      gold={won === t.n}
    />
  );
  return (
    <BarFrame
      state={state}
      bottom={bottom}
      phase="done"
      left={t1}
      right={t2}
      leftPanel={line(t1, "left")}
      rightPanel={line(t2, "right")}
      centre={
        <>
          <span className="we-label text-center text-[17px] text-[#bdf7e8]">Result</span>
          <span className="we-x we-trunc mt-1 block text-center text-[26px] leading-tight">
            {state.result_description ?? "Match finished"}
          </span>
        </>
      }
    />
  );
}

// ---- slim top bar and compact card ---------------------------------------

function TopBar({ state, bpo, phase }: { state: LiveMatchState; bpo: number; phase: BugProps["phase"] }) {
  const { bat, bowl } = battingAndBowling(state);
  const live = phase === "live";
  const text =
    phase === "done"
      ? (state.result_description ?? "Match finished")
      : phase === "break"
        ? `Innings break${state.target_runs ? `  ·  target ${state.target_runs}` : ""}`
        : (state.tournament_name ?? state.title ?? "");
  return (
    <Root state={state} data-testid="we-score-bug" data-phase={phase} style={scoreBugAnchor("top")}>
      <div className="we-lift flex h-[66px] items-stretch bg-[#0a0532]">
        <EndCap team={bat} at="left" width={96} />
        <div className="we-paper we-on-paper we-a-wipe-r flex min-w-0 flex-1 items-center gap-6 pl-5 pr-[40px] text-[26px]" style={delay(80)}>
          {live ? (
            <>
              <div className="min-w-0 flex-1">
                <Batter name={state.striker_name} runs={state.striker_runs} balls={state.striker_balls} striker size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <Batter name={state.non_striker_name} runs={state.non_striker_runs} balls={state.non_striker_balls} striker={false} size={22} />
              </div>
            </>
          ) : (
            <span className="we-name we-trunc text-[24px]">{text}</span>
          )}
        </div>
        <div className="we-night we-trap we-a-fade relative z-10 -mx-[22px] flex w-[520px] shrink-0 items-center gap-4 px-[44px]" style={{ ["--we-cut" as string]: "22px" }}>
          <Codes bat={bat} bowl={bowl} size={24} />
          {phase !== "pre" && (
            <Pill size={32}>
              <ScoreFig runs={state.total_runs} wickets={state.total_wickets} />
            </Pill>
          )}
          {live && <PowerplayTab on={!!state.powerplay} />}
          {phase !== "pre" && (
            <span className="ml-auto text-[26px]">
              <Overs state={state} bpo={bpo} size={26} />
            </span>
          )}
        </div>
        <div className="we-paper we-on-paper we-a-wipe-l flex min-w-0 flex-1 items-center gap-4 pl-[40px] pr-5" style={delay(80)}>
          {live && state.current_bowler_name ? (
            <>
              <span className="we-name we-trunc flex-1 text-[22px]">{bugName(state.current_bowler_name)}</span>
              <span className="we-fig shrink-0 text-[24px]">{`${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0}`}</span>
              <Balls tokens={overTokens(state)} slots={bpo} size={26} />
            </>
          ) : live ? (
            <Balls tokens={overTokens(state)} slots={bpo} size={26} />
          ) : (
            <span className="we-figl we-ink-muted we-trunc text-[20px]">{state.venue}</span>
          )}
        </div>
        <EndCap team={bowl} at="right" width={96} />
      </div>
      {live && <TopChase state={state} />}
    </Root>
  );
}

/** Under the slim bar: the chase, when there is one. */
function TopChase({ state }: { state: LiveMatchState }) {
  const items = liveContext(state);
  if (!chaseLine(state)) return null;
  return (
    <div className="mt-1.5 flex justify-center">
      <span className="we-accent we-trap we-a-drop flex h-[36px] max-w-[760px] items-center px-8" style={{ ["--we-cut" as string]: "14px", ...delay(300) }}>
        <ContextLine items={items.slice(0, 2)} />
      </span>
    </div>
  );
}

function CompactCard({ state, bpo, phase, bottom }: { state: LiveMatchState; bpo: number; phase: BugProps["phase"]; bottom: number }) {
  const { bat, bowl } = battingAndBowling(state);
  const live = phase === "live";
  const items =
    phase === "live"
      ? liveContext(state)
      : [phase === "done" ? (state.result_description ?? "Match finished") : phase === "break" ? "Innings break" : (state.tournament_name ?? state.title ?? "")].filter(Boolean);
  return (
    <Root state={state} data-testid="we-score-bug" data-phase={phase} className="w-[480px]" style={{ ...scoreBugAnchor("compact"), bottom }}>
      <div className="we-lift">
        <div className="we-night we-a-wipe-r flex h-[76px] items-center gap-3 pr-4">
          <div className="we-team we-cut-r flex h-full w-[84px] shrink-0 items-center justify-center pr-2" style={{ ...side(bat.n), ["--we-cut" as string]: "14px" }}>
            <Crest n={bat.n} logo={bat.logo} code={bat.code} name={bat.name} size={46} />
          </div>
          <Codes bat={bat} bowl={bowl} size={22} />
          {phase !== "pre" && (
            <span className="ml-auto flex items-center gap-3">
              <Pill size={30}>
                <ScoreFig runs={state.total_runs} wickets={state.total_wickets} />
              </Pill>
              <span className="text-[22px]">
                <Overs state={state} bpo={bpo} size={22} />
              </span>
            </span>
          )}
        </div>
        {live && (
          <div className="we-paper we-on-paper we-a-wipe-down flex flex-col gap-1 px-4 py-2.5 text-[24px]" style={delay(120)}>
            <Batter name={state.striker_name} runs={state.striker_runs} balls={state.striker_balls} striker size={21} />
            <Batter name={state.non_striker_name} runs={state.non_striker_runs} balls={state.non_striker_balls} striker={false} size={21} />
            {state.current_bowler_name && (
              <div className="mt-1 flex items-center gap-3 border-t pt-2 we-hair-ink">
                <span className="we-name we-trunc flex-1 text-[20px]">{bugName(state.current_bowler_name)}</span>
                <span className="we-fig text-[22px]">{`${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0}`}</span>
                <span className="we-figl we-ink-muted text-[18px]">{oversText(state.bowler_balls, bpo)}</span>
              </div>
            )}
            <Balls tokens={overTokens(state)} slots={bpo} size={28} className="mt-1" />
          </div>
        )}
        {items.length > 0 && (
          <div className="we-accent we-a-wipe-down flex h-[40px] items-center px-4" style={delay(220)}>
            <ContextLine items={items} className="text-[17px]" />
          </div>
        )}
      </div>
      <span className="sr-only">{bowl.name}</span>
    </Root>
  );
}

/** The score bug element. */
export function WorldEventScoreBug(p: BugProps) {
  const state = p.state;
  const bpo = ballsPerOverOf(p.match);
  const bottom = SAFE.y + (p.marginOffsetPx ?? 0);
  const pre = p.phase === "pre" || state.innings_number == null;
  const phase = pre ? "pre" : p.phase;
  if (p.layout === "top") return <TopBar state={state} bpo={bpo} phase={phase} />;
  if (p.layout === "compact") return <CompactCard state={state} bpo={bpo} phase={phase} bottom={bottom} />;
  if (phase === "pre") return <PreBar state={state} match={p.match} bottom={bottom} />;
  if (phase === "break") return <BreakBar state={state} match={p.match} bpo={bpo} bottom={bottom} />;
  if (phase === "done") return <ResultBar state={state} match={p.match} bpo={bpo} bottom={bottom} />;
  return <LiveBar state={state} bpo={bpo} bottom={bottom} sponsor={p.sponsor} />;
}
