"use client";

/**
 * Summer bash's score bug: a run of slanted, lit segments like a game HUD
 * (team plate, score, crease, bowler, this over) over a ribbon that
 * carries the chase. Every layout (bottom / broadcast, top, compact) and
 * phase (before the start, in play, the break, the result) has its own
 * arrangement; figures roll when they change.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Innings, Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { economyText, overTokens, oversText, teamCode } from "../../overlay-kit";
import {
  ballsPerOverOf,
  inningsLabel,
  sidesOf,
  tossLineOf,
  type OverlayPhase,
} from "../../score-bug";
import { inningsTeamName, scoreOf } from "../../scorecard-cards";
import type { LiveMatchState } from "../../types";
import type { OverlayElementProps } from "../types";
import {
  BallChips,
  BUG_GAP,
  BUG_RIBBON,
  BUG_ROW,
  COMPACT_W,
  Crest,
  delay,
  Frame,
  neonStyle,
  Num,
  s,
  SAFE_X,
  SAFE_Y,
  sideOfName,
  sideStyle,
  nameSize,
  type NeonKey,
  type SideKey,
} from "./kit";

// ---- data --------------------------------------------------------------------

/** Overs per innings (1 in a super over). */
function oversLimitOf(state: LiveMatchState): number | null {
  if ((state.innings_number ?? 1) >= 3) return 1;
  return state.overs_per_innings ?? null;
}

/** The batting side's key ("t1" / "t2"); team 1 when unknown. */
function battingKey(state: LiveMatchState): "t1" | "t2" {
  return sideOfName(state, state.batting_team_name) ?? "t1";
}

function battingLogo(state: LiveMatchState): string | null {
  return battingKey(state) === "t2"
    ? (state.team2_logo_url ?? null)
    : (state.team1_logo_url ?? null);
}

/** The chase, when there is one to show. */
export function chaseOf(state: LiveMatchState): {
  need: number;
  balls: number;
  target: number;
} | null {
  if (
    state.target_runs === null ||
    state.runs_needed === null ||
    state.balls_remaining === null ||
    state.innings_completed ||
    (state.runs_needed ?? 0) <= 0
  ) {
    return null;
  }
  return {
    need: state.runs_needed,
    balls: state.balls_remaining,
    target: state.target_runs,
  };
}

/** Local start time, formatted after hydration (the server has no zone). */
function useStartTime(iso: string | null | undefined): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!iso) return;
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return;
    const sameDay = at.toDateString() === new Date().toDateString();
    const time = at.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    const value = sameDay
      ? time
      : `${at.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
    const id = setTimeout(() => setText(value), 0);
    return () => clearTimeout(id);
  }, [iso]);
  return text;
}

/** Both main innings of the match, in order, with their side. */
function mainInnings(
  state: LiveMatchState,
  match: Match | null | undefined,
): Array<{ inn: Innings; name: string; side: SideKey }> {
  return [...(match?.innings ?? [])]
    .filter((i) => i.innings_number <= 2)
    .sort((a, b) => a.innings_number - b.innings_number)
    .map((inn) => {
      const name = inningsTeamName(state, inn, match?.team1_id);
      return { inn, name, side: sideOfName(state, name) ?? "t1" };
    });
}

/** "HAW" for a team name in this match. */
function codeOfName(state: LiveMatchState, name: string): string {
  if (name === state.team1_name) return teamCode(state.team1_short_name, name);
  if (name === state.team2_name) return teamCode(state.team2_short_name, name);
  return teamCode(null, name);
}

/** A team code's size on a plate: longer codes step down. */
export function codeSize(code: string, base: number): number {
  if (code.length <= 3) return base;
  if (code.length === 4) return Math.round(base * 0.8);
  return Math.round(base * 0.64);
}

// ---- segments ----------------------------------------------------------------

const K = 24;

type Cut = "start" | "mid" | "end" | "both";

/** One slanted segment of the bug. */
function Seg({
  cut = "mid",
  tone,
  side,
  neon,
  width,
  grow,
  index,
  className,
  style,
  children,
}: {
  cut?: Cut;
  tone: "glass" | "team" | "neon";
  side?: SideKey;
  neon?: NeonKey;
  width?: number;
  grow?: boolean;
  index: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const clip =
    cut === "start" ? s.slantStart : cut === "end" ? s.slantEnd : cut === "both" ? "" : s.slant;
  return (
    <div
      style={{
        ...(side ? sideStyle(side) : neon ? neonStyle(neon) : {}),
        "--k": `${K}px`,
        ...delay(index * 70),
        width,
        marginLeft: index === 0 ? 0 : -(K - BUG_GAP),
        ...style,
      } as CSSProperties}
      className={cn(
        tone === "glass" ? s.glass : tone === "team" ? s.team : s.neon,
        clip,
        s.inLeft,
        "relative flex h-full min-w-0 items-center overflow-hidden",
        grow ? "flex-1" : "shrink-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A label over a value inside a segment. */
function Small({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        s.label,
        "block text-[0.9375rem] leading-none text-[color:var(--sb-mist)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Score({
  runs,
  wickets,
  size,
}: {
  runs: number | null;
  wickets: number | null;
  size: number;
}) {
  return (
    <span
      className={cn(s.figures, "flex items-baseline leading-none")}
      style={{ fontSize: size, fontWeight: 800 }}
    >
      <Num value={runs ?? 0} />
      <span className="mx-[0.06em] text-[color:var(--sb-magenta)]">/</span>
      <Num value={wickets ?? 0} />
    </span>
  );
}

/** The striker marker: a lit lime wedge. */
function StrikeMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("h-6 w-2.5 shrink-0 -skew-x-12 rounded-[2px]", on && s.breathe)}
      style={
        on
          ? { background: "var(--sb-lime)", boxShadow: "0 0 10px var(--sb-lime)" }
          : { background: "transparent" }
      }
    />
  );
}

function BatterRow({
  name,
  runs,
  balls,
  striker,
  size = "md",
}: {
  name: string | null;
  runs: number | null;
  balls: number | null;
  striker: boolean;
  size?: "md" | "sm";
}) {
  if (!name) return null;
  const big = size === "md";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <StrikeMark on={striker} />
      <span
        className={cn(
          s.semi,
          s.caps,
          "min-w-0 flex-1 truncate font-bold leading-tight",
          big ? "text-[1.625rem]" : "text-[1.375rem]",
          !striker && "text-[color:var(--sb-mist)]",
        )}
      >
        {name}
        {striker && <span className="sr-only"> on strike</span>}
      </span>
      <span
        className={cn(s.figures, "shrink-0 leading-none")}
        style={{ fontSize: big ? 28 : 24, fontWeight: 800 }}
      >
        <Num value={runs ?? 0} />
      </span>
      <span
        className={cn(
          s.figures,
          "w-14 shrink-0 text-left font-semibold leading-none text-[color:var(--sb-mist)]",
        )}
        style={{ fontSize: big ? 19 : 17, fontWeight: 500 }}
      >
        (<Num value={balls ?? 0} />)
      </span>
    </div>
  );
}

/** Ribbon items: the chase or the rate, the stand. */
function ribbonItems(state: LiveMatchState, phase: OverlayPhase): ReactNode[] {
  const out: ReactNode[] = [];
  const chase = chaseOf(state);
  if (chase) {
    out.push(
      <span key="need" className="font-extrabold text-[color:var(--sb-yellow)]">
        Need <Num value={chase.need} /> off <Num value={chase.balls} />{" "}
        {chase.balls === 1 ? "ball" : "balls"}
      </span>,
      <span key="target">Target {chase.target}</span>,
    );
    if (state.required_run_rate !== null && phase === "live") {
      out.push(<span key="rrr">RRR {state.required_run_rate.toFixed(2)}</span>);
    }
  }
  if (state.current_run_rate !== null && phase === "live") {
    out.push(<span key="crr">CRR {state.current_run_rate.toFixed(2)}</span>);
  }
  if (phase === "live" && (state.partnership_runs ?? 0) > 0) {
    out.push(
      <span key="stand">
        Stand {state.partnership_runs} ({state.partnership_balls ?? 0})
      </span>,
    );
  }
  return out;
}

function Slashed({ items }: { items: ReactNode[] }) {
  return (
    <>
      {items.map((c, i) => (
        <span key={i} className="flex min-w-0 shrink-0 items-center gap-4">
          {i > 0 && (
            <span
              aria-hidden="true"
              className="h-5 w-[3px] -skew-x-[20deg] bg-[color:var(--sb-magenta)]"
            />
          )}
          {c}
        </span>
      ))}
    </>
  );
}

/** The state chips: free hit, powerplay. */
function Chips({ state, size = "md" }: { state: LiveMatchState; size?: "md" | "sm" }) {
  const cls = cn(
    s.neon,
    s.slant,
    s.label,
    s.breathe,
    "flex shrink-0 items-center leading-none",
    size === "md" ? "h-8 px-5 text-[1rem]" : "h-7 px-4 text-[0.9375rem]",
  );
  return (
    <>
      {state.free_hit && (
        <span
          className={cls}
          style={{ ...neonStyle("orange"), "--k": "10px" } as CSSProperties}
        >
          <span className="relative z-10">Free hit</span>
        </span>
      )}
      {state.powerplay && (
        <span
          className={cls}
          style={{ ...neonStyle("lime"), "--k": "10px" } as CSSProperties}
        >
          <span className="relative z-10">Powerplay</span>
        </span>
      )}
    </>
  );
}

/** The strip under the main row. */
function Ribbon({
  tag,
  tagSide,
  tagNeon = "magenta",
  left,
  right,
}: {
  tag: ReactNode;
  tagSide?: SideKey;
  tagNeon?: NeonKey;
  left: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      className={cn(s.rise, "relative flex items-stretch")}
      style={{
        height: BUG_RIBBON,
        marginTop: BUG_GAP,
        marginLeft: 36,
        marginRight: 36,
        ...delay(380),
      }}
    >
      <div
        style={{
          ...(tagSide ? sideStyle(tagSide) : neonStyle(tagNeon)),
          "--k": "16px",
        } as CSSProperties}
        className={cn(
          tagSide ? s.team : s.neon,
          s.slant,
          s.label,
          "relative z-10 flex shrink-0 items-center px-7 text-[1.0625rem]",
        )}
      >
        <span className="relative z-10">{tag}</span>
      </div>
      <div
        style={{ "--k": "16px", marginLeft: -8 } as CSSProperties}
        className={cn(
          s.glass,
          s.slantEnd,
          s.semi,
          "flex min-w-0 flex-1 items-center justify-between gap-6 pl-8 pr-8 text-[1.25rem] font-bold",
        )}
      >
        <div className="flex min-w-0 items-center gap-4 overflow-hidden tabular-nums">
          {left}
        </div>
        {right && (
          <div className="flex min-w-0 shrink items-center gap-4 overflow-hidden text-[color:var(--sb-mist)]">
            {right}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- bottom bar ----------------------------------------------------------------

interface BugProps {
  state: LiveMatchState;
  match: Match | null;
  phase: OverlayPhase;
  bpo: number;
  sponsor: string | null;
}

function TeamSeg({ state, index }: { state: LiveMatchState; index: number }) {
  const side = battingKey(state);
  const { batting } = sidesOf(state);
  return (
    <Seg cut="start" tone="team" side={side} width={270} index={index} className="gap-4 pl-6 pr-8">
      <span className={s.sheen} />
      <Crest name={batting.name} side={side} code={teamCode(batting.short, batting.name)} logo={battingLogo(state)} size={64} />
      <span
        className={cn(s.display, "relative z-10 truncate leading-none")}
        style={{ fontSize: codeSize(teamCode(batting.short, batting.name), 40) }}
      >
        {teamCode(batting.short, batting.name)}
      </span>
    </Seg>
  );
}

function ScoreSeg({ state, bpo, index }: { state: LiveMatchState; bpo: number; index: number }) {
  const limit = oversLimitOf(state);
  return (
    <Seg tone="glass" side={battingKey(state)} width={410} index={index} className={cn(s.edgeTop, "gap-5 pl-10 pr-9")}>
      <Score runs={state.total_runs} wickets={state.total_wickets} size={62} />
      <span className="flex flex-col items-start gap-1.5">
        <span className={cn(s.figures, "text-[1.875rem] leading-none")}>
          <Num value={oversText(state.total_balls, bpo)} />
        </span>
        <Small className="whitespace-nowrap">{limit !== null ? `of ${limit}` : "overs"}</Small>
      </span>
    </Seg>
  );
}

function BottomLive({ state, bpo, sponsor }: BugProps) {
  const econ = economyText(state.bowler_runs, state.bowler_balls);
  const left = ribbonItems(state, "live");
  const lastOut = state.last_wicket?.name
    ? `Last out ${state.last_wicket.name} ${state.last_wicket.runs} (${state.last_wicket.balls})`
    : null;
  return (
    <>
      <div className={cn(s.lift, "flex items-stretch")} style={{ height: BUG_ROW }}>
        <TeamSeg state={state} index={0} />
        <ScoreSeg state={state} bpo={bpo} index={1} />
        <Seg tone="glass" width={480} index={2} className="pl-10 pr-8" aria-label="At the crease">
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            <BatterRow
              name={state.striker_name}
              runs={state.striker_runs}
              balls={state.striker_balls}
              striker
            />
            <BatterRow
              name={state.non_striker_name}
              runs={state.non_striker_runs}
              balls={state.non_striker_balls}
              striker={false}
            />
          </div>
        </Seg>
        {state.current_bowler_name && (
          <Seg tone="glass" side={sideOfName(state, state.bowling_team_name) ?? "t2"} width={318} index={3} className={cn(s.edgeTop, "pl-10 pr-7")}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <span className={cn(s.semi, s.caps, "truncate text-[1.5rem] font-bold leading-tight")}>
                {state.current_bowler_name}
              </span>
              <span className="flex items-baseline gap-3 leading-none">
                <span className={s.figures} style={{ fontSize: 28, fontWeight: 800 }}>
                  <Num value={`${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0}`} />
                </span>
                <span className={cn(s.figures, "text-[1.1875rem] text-[color:var(--sb-mist)]")} style={{ fontWeight: 500 }}>
                  <Num value={oversText(state.bowler_balls, bpo)} />
                  {econ && <span className="ml-2">Econ {econ}</span>}
                </span>
              </span>
            </div>
          </Seg>
        )}
        <Seg cut="end" tone="glass" grow index={4} className="justify-center pl-9 pr-6">
          <div className="flex flex-col items-center gap-2">
            <Small>This over</Small>
            <BallChips tokens={overTokens(state)} slots={bpo} size={36} />
          </div>
        </Seg>
      </div>
      <Ribbon
        tag={inningsLabel(state.innings_number)}
        tagSide={battingKey(state)}
        left={
          <>
            <Chips state={state} />
            <Slashed items={left} />
          </>
        }
        right={
          <Slashed
            items={[
              lastOut && <span key="last" className="truncate">{lastOut}</span>,
              sponsor && <span key="sp" className="truncate">{sponsor}</span>,
            ].filter(Boolean)}
          />
        }
      />
    </>
  );
}

function BottomBreak({ state, match, sponsor }: BugProps) {
  const side = battingKey(state);
  const { batting } = sidesOf(state);
  const first = mainInnings(state, match).find((i) => i.inn.innings_number === 1);
  const target =
    state.target_runs ?? (first ? first.inn.total_runs + 1 : null);
  const chase = chaseOf(state);
  return (
    <>
      <div className={cn(s.lift, "flex items-stretch")} style={{ height: BUG_ROW }}>
        <TeamSeg state={state} index={0} />
        {target !== null && (
          <Seg tone="neon" neon="yellow" width={330} index={1} className="gap-5 pl-10 pr-9">
            <span className={cn(s.label, "relative z-10 text-[1.25rem] leading-none")}>Target</span>
            <span className={cn(s.figures, "relative z-10 text-[3.5rem] leading-none")} style={{ fontWeight: 800 }}>
              {target}
            </span>
          </Seg>
        )}
        <Seg cut="end" tone="glass" grow index={2} className="pl-10 pr-10">
          <span className={cn(s.display, "truncate text-[2rem] uppercase leading-tight")}>
            {chase
              ? `${batting.name ?? teamCode(batting.short, batting.name)} need ${chase.need} from ${chase.balls} balls`
              : `${teamCode(batting.short, batting.name)} to bat next`}
          </span>
        </Seg>
      </div>
      <Ribbon
        tag="Innings break"
        tagSide={side}
        left={
          first ? (
            <span className="truncate">
              {first.name} {scoreOf(first.inn)} ({oversText(first.inn.total_balls)} ov)
            </span>
          ) : null
        }
        right={sponsor ? <span className="truncate">{sponsor}</span> : undefined}
      />
    </>
  );
}

function InningsScores({
  state,
  match,
  size = "md",
}: {
  state: LiveMatchState;
  match: Match | null;
  size?: "md" | "sm";
}) {
  const rows = mainInnings(state, match);
  if (!rows.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(({ inn, name, side }) => (
        <span key={inn.id} className="flex items-center gap-3 leading-none">
          <span
            style={sideStyle(side)}
            className={cn(s.team, s.label, "rounded-[3px] px-2 py-1 text-[0.9375rem]")}
          >
            <span className="relative z-10">{codeOfName(state, name)}</span>
          </span>
          <span className={s.figures} style={{ fontSize: size === "md" ? 24 : 20, fontWeight: 800 }}>
            {scoreOf(inn)}
          </span>
          <span className={cn(s.figures, "text-[1rem] text-[color:var(--sb-mist)]")} style={{ fontWeight: 500 }}>
            ({oversText(inn.total_balls)})
          </span>
        </span>
      ))}
    </div>
  );
}

function BottomDone({ state, match, sponsor }: BugProps) {
  const winner = sideOfName(state, state.winning_team_name);
  const name = state.winning_team_name;
  const code = winner === "t2" ? teamCode(state.team2_short_name, name) : teamCode(state.team1_short_name, name);
  const logo = winner === "t2" ? state.team2_logo_url : state.team1_logo_url;
  const toss = tossLineOf(state, match);
  return (
    <>
      <div className={cn(s.lift, "flex items-stretch")} style={{ height: BUG_ROW }}>
        {winner && name ? (
          <Seg cut="start" tone="team" side={winner} width={270} index={0} className="gap-4 pl-6 pr-8">
            <span className={s.sheen} />
            <Crest name={name} side={winner} code={code} logo={logo} size={64} />
            <span className={cn(s.display, "relative z-10 truncate leading-none")} style={{ fontSize: codeSize(code, 40) }}>{code}</span>
          </Seg>
        ) : (
          <Seg cut="start" tone="neon" neon="magenta" width={270} index={0} className="justify-center px-8">
            <span className={cn(s.display, "relative z-10 text-[2rem] uppercase leading-none")}>Result</span>
          </Seg>
        )}
        <Seg tone="glass" side={winner ?? undefined} grow index={1} className={cn(s.edgeTop, "pl-10 pr-10")}>
          <span className={cn(s.display, "truncate text-[2.25rem] uppercase leading-tight")}>
            {state.result_description ?? "Match finished"}
          </span>
        </Seg>
        {mainInnings(state, match).length > 0 && (
          <Seg cut="end" tone="glass" width={330} index={2} className="pl-10 pr-6">
            <InningsScores state={state} match={match} />
          </Seg>
        )}
      </div>
      <Ribbon
        tag="Result"
        tagNeon="yellow"
        left={
          <Slashed
            items={[
              <span key="sides">
                {teamCode(state.team1_short_name, state.team1_name)} v{" "}
                {teamCode(state.team2_short_name, state.team2_name)}
              </span>,
              toss && <span key="toss" className="truncate">{toss}</span>,
            ].filter(Boolean)}
          />
        }
        right={sponsor ? <span className="truncate">{sponsor}</span> : undefined}
      />
    </>
  );
}

function BottomPre({ state, match, phase, sponsor }: BugProps) {
  const startTime = useStartTime(match?.scheduled_at);
  const label =
    phase === "done"
      ? { kicker: "Match", main: "Result" }
      : startTime
        ? { kicker: "Starts", main: startTime }
        : { kicker: "Next up", main: "Soon" };
  const toss = tossLineOf(state, match);
  const t1 = state.team1_name ?? match?.team1?.name ?? "";
  const t2 = state.team2_name ?? match?.team2?.name ?? "";
  const source = state.tournament_name ?? state.title;
  return (
    <>
      <div className={cn(s.lift, "flex items-stretch")} style={{ height: BUG_ROW }}>
        <Seg cut="start" tone="neon" neon="magenta" width={300} index={0} className="justify-center px-8">
          <span className="relative z-10 flex min-w-0 flex-col leading-none">
            <span className={cn(s.label, "text-[1rem]")}>{label.kicker}</span>
            <span className={cn(s.display, "mt-1.5 truncate text-[1.75rem] uppercase")}>{label.main}</span>
          </span>
        </Seg>
        <Seg tone="team" side="t1" grow index={1} className="gap-5 pl-10 pr-8">
          <Crest name={t1} side="t1" code={teamCode(state.team1_short_name, t1)} logo={state.team1_logo_url} size={60} />
          <span className={cn(s.display, "relative z-10 truncate uppercase leading-tight")} style={{ fontSize: nameSize(t1, 30) }}>{t1}</span>
        </Seg>
        <Seg tone="neon" neon="yellow" width={92} index={2} className="justify-center">
          <span className={cn(s.display, "relative z-10 text-[1.75rem] leading-none")}>V</span>
        </Seg>
        <Seg tone="team" side="t2" grow index={3} className="gap-5 pl-10 pr-8">
          <Crest name={t2} side="t2" code={teamCode(state.team2_short_name, t2)} logo={state.team2_logo_url} size={60} />
          <span className={cn(s.display, "relative z-10 truncate uppercase leading-tight")} style={{ fontSize: nameSize(t2, 30) }}>{t2}</span>
        </Seg>
        {(toss || state.venue) && (
          <Seg cut="end" tone="glass" width={400} index={4} className="pl-10 pr-6">
            <span className={cn(s.semi, "line-clamp-2 text-[1.3125rem] font-bold leading-snug")}>
              {toss ?? state.venue}
            </span>
          </Seg>
        )}
      </div>
      {(source || state.venue) && (
        <Ribbon
          tag={phase === "done" ? "Result" : "Live soon"}
          tagNeon="cyan"
          left={<span className="truncate">{[source, toss ? state.venue : null].filter(Boolean).join(" · ")}</span>}
          right={sponsor ? <span className="truncate">{sponsor}</span> : undefined}
        />
      )}
    </>
  );
}

// ---- top bar -------------------------------------------------------------------

function TopBar({ state, phase, bpo }: BugProps) {
  const side = battingKey(state);
  const { batting } = sidesOf(state);
  const chase = chaseOf(state);
  const height = 68;
  const text =
    phase === "break"
      ? `${teamCode(batting.short, batting.name)} to bat next${state.target_runs !== null ? ` · Target ${state.target_runs}` : ""}`
      : phase === "done"
        ? (state.result_description ?? "Match finished")
        : null;
  return (
    <div className={cn(s.lift, "flex items-stretch")} style={{ height }}>
      <Seg cut="start" tone="team" side={side} width={190} index={0} className="gap-3 pl-4 pr-7">
        <span className={s.sheen} />
        <Crest name={batting.name} side={side} code={teamCode(batting.short, batting.name)} logo={battingLogo(state)} size={46} />
        <span className={cn(s.display, "relative z-10 truncate text-[2rem] leading-none")}>
          {teamCode(batting.short, batting.name)}
        </span>
      </Seg>
      <Seg tone="glass" side={side} width={250} index={1} className={cn(s.edgeTop, "gap-4 pl-9 pr-7")}>
        <Score runs={state.total_runs} wickets={state.total_wickets} size={42} />
        <span className={cn(s.figures, "text-[1.375rem] leading-none text-[color:var(--sb-mist)]")} style={{ fontWeight: 600 }}>
          <Num value={oversText(state.total_balls, bpo)} />
        </span>
      </Seg>
      {phase === "live" ? (
        <>
          {state.striker_name && (
            <Seg tone="glass" width={330} index={2} className="gap-3 pl-9 pr-6">
              <StrikeMark on />
              <span className={cn(s.semi, s.caps, "min-w-0 flex-1 truncate text-[1.375rem] font-bold")}>
                {state.striker_name}
              </span>
              <span className={s.figures} style={{ fontSize: 24, fontWeight: 800 }}>
                <Num value={state.striker_runs ?? 0} />
              </span>
            </Seg>
          )}
          {state.current_bowler_name && (
            <Seg tone="glass" width={300} index={3} className="gap-3 pl-9 pr-6">
              <span className={cn(s.semi, s.caps, "min-w-0 flex-1 truncate text-[1.375rem] font-bold text-[color:var(--sb-mist)]")}>
                {state.current_bowler_name}
              </span>
              <span className={s.figures} style={{ fontSize: 24, fontWeight: 800 }}>
                <Num value={`${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0}`} />
              </span>
            </Seg>
          )}
          <Seg cut={chase ? "mid" : "end"} tone="glass" width={chase ? 290 : 300} index={4} className="justify-center pl-8 pr-6">
            <BallChips tokens={overTokens(state)} slots={bpo} size={30} />
          </Seg>
          {chase && (
            <Seg cut="end" tone="neon" neon="yellow" index={5} className={cn(s.semi, "px-8")}>
              <span className={cn(s.label, "relative z-10 whitespace-nowrap text-[1.25rem]")}>
                Need <Num value={chase.need} /> off <Num value={chase.balls} />
              </span>
            </Seg>
          )}
        </>
      ) : (
        <Seg cut="end" tone="glass" width={760} index={2} className="pl-9 pr-8">
          <span className={cn(s.display, "truncate text-[1.5rem] uppercase")}>{text}</span>
        </Seg>
      )}
    </div>
  );
}

function TopPre({ state, match }: BugProps) {
  const startTime = useStartTime(match?.scheduled_at);
  const t1 = state.team1_name ?? "";
  const t2 = state.team2_name ?? "";
  return (
    <div className={cn(s.lift, "flex items-stretch")} style={{ height: 68 }}>
      <Seg cut="start" tone="neon" neon="magenta" width={250} index={0} className="justify-center px-6">
        <span className={cn(s.label, "relative z-10 truncate text-[1.25rem]")}>
          {startTime ? `Starts ${startTime}` : "Coming up"}
        </span>
      </Seg>
      <Seg tone="team" side="t1" width={420} index={1} className="gap-3 pl-9 pr-6">
        <Crest name={t1} side="t1" code={teamCode(state.team1_short_name, t1)} logo={state.team1_logo_url} size={44} />
        <span className={cn(s.display, "relative z-10 truncate text-[1.375rem] uppercase")}>{t1}</span>
      </Seg>
      <Seg tone="neon" neon="yellow" width={74} index={2} className="justify-center">
        <span className={cn(s.display, "relative z-10 text-[1.375rem]")}>V</span>
      </Seg>
      <Seg cut="end" tone="team" side="t2" width={420} index={3} className="gap-3 pl-9 pr-6">
        <Crest name={t2} side="t2" code={teamCode(state.team2_short_name, t2)} logo={state.team2_logo_url} size={44} />
        <span className={cn(s.display, "relative z-10 truncate text-[1.375rem] uppercase")}>{t2}</span>
      </Seg>
    </div>
  );
}

// ---- compact card --------------------------------------------------------------

function CompactCard({ state, phase, bpo }: BugProps) {
  const side = battingKey(state);
  const { batting } = sidesOf(state);
  const chase = chaseOf(state);
  const items = ribbonItems(state, phase);
  return (
    <div style={{ width: COMPACT_W }}>
      <div className={cn(s.lift, "flex items-stretch")} style={{ height: 76 }}>
        <Seg cut="start" tone="team" side={side} width={176} index={0} className="gap-3 pl-4 pr-7">
          <span className={s.sheen} />
          <Crest name={batting.name} side={side} code={teamCode(batting.short, batting.name)} logo={battingLogo(state)} size={48} />
          <span className={cn(s.display, "relative z-10 truncate text-[2rem] leading-none")}>
            {teamCode(batting.short, batting.name)}
          </span>
        </Seg>
        <Seg cut="end" tone="glass" side={side} grow index={1} className={cn(s.edgeTop, "justify-between gap-3 pl-9 pr-5")}>
          <Score runs={state.total_runs} wickets={state.total_wickets} size={46} />
          <span className={cn(s.figures, "text-[1.5rem] leading-none text-[color:var(--sb-mist)]")} style={{ fontWeight: 600 }}>
            <Num value={oversText(state.total_balls, bpo)} />
          </span>
        </Seg>
      </div>
      <div
        className={cn(s.glass, s.rise, "mt-2 space-y-1.5 rounded-[4px] px-5 py-3")}
        style={delay(240)}
      >
        {phase === "live" ? (
          <>
            <BatterRow name={state.striker_name} runs={state.striker_runs} balls={state.striker_balls} striker size="sm" />
            <BatterRow name={state.non_striker_name} runs={state.non_striker_runs} balls={state.non_striker_balls} striker={false} size="sm" />
            {state.current_bowler_name && (
              <div className="flex items-center gap-3 border-t border-white/15 pt-2">
                <span className={cn(s.semi, s.caps, "min-w-0 flex-1 truncate text-[1.25rem] font-bold text-[color:var(--sb-mist)]")}>
                  {state.current_bowler_name}
                </span>
                <span className={s.figures} style={{ fontSize: 22, fontWeight: 800 }}>
                  <Num value={`${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0}`} />
                </span>
              </div>
            )}
            <BallChips tokens={overTokens(state)} slots={bpo} size={28} className="pt-1" />
          </>
        ) : (
          <span className={cn(s.display, "block truncate text-[1.25rem] uppercase")}>
            {phase === "break"
              ? `${teamCode(batting.short, batting.name)} to bat next`
              : (state.result_description ?? "Match finished")}
          </span>
        )}
      </div>
      {(chase || items.length > 0) && (
        <div
          className={cn(s.neon, s.rise, s.semi, "mt-2 flex h-10 items-center gap-3 overflow-hidden rounded-[4px] px-5 text-[1.125rem] font-extrabold")}
          style={{ ...neonStyle(chase ? "yellow" : "cyan"), ...delay(360) }}
        >
          <span className="relative z-10 truncate">{items[0]}</span>
        </div>
      )}
    </div>
  );
}

// ---- the element ---------------------------------------------------------------

export function SummerBashScoreBug(p: OverlayElementProps["scoreBug"]) {
  const { state, match, layout, sponsor, marginOffsetPx } = p;
  const phase: OverlayPhase =
    state.innings_number === null || state.innings_number === undefined
      ? "pre"
      : p.phase;
  const bpo = ballsPerOverOf(match);
  const props: BugProps = { state, match, phase, bpo, sponsor };
  const top = layout === "top";
  const compact = layout === "compact" && phase !== "pre";
  const bottom = SAFE_Y + marginOffsetPx;
  return (
    <Frame
      state={state}
      data-testid="score-bug"
      data-layout={layout}
      data-phase={phase}
      className="fixed z-20"
      style={
        top
          ? { top: SAFE_Y, left: SAFE_X }
          : compact
            ? { bottom, left: SAFE_X }
            : { bottom, left: SAFE_X, right: SAFE_X }
      }
    >
      {top ? (
        phase === "pre" ? (
          <TopPre {...props} />
        ) : (
          <TopBar {...props} />
        )
      ) : compact ? (
        <CompactCard {...props} />
      ) : phase === "pre" ? (
        <BottomPre {...props} />
      ) : phase === "break" ? (
        <BottomBreak {...props} />
      ) : phase === "done" ? (
        <BottomDone {...props} />
      ) : (
        <BottomLive {...props} />
      )}
    </Frame>
  );
}
