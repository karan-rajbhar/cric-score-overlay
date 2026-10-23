"use client";

/**
 * Franchise night's score bug: a wide glass bar across title safe with the
 * batting side's crest wedge, big figures, both batters, the bowler, this
 * over's tray and the bowling side's crest, over a rate strip (current and
 * required rate, the chase and its rate meter, or projected totals).
 * Layouts: bottom (and broadcast), top (one slim row), compact (a corner
 * card). Phases: before the first ball, in play, the innings break, after
 * the match.
 */

import { useEffect, useState, type ReactNode } from "react";
import type { Innings, Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import {
  economyText,
  oversText,
  overTokens,
  teamCode,
} from "../../overlay-kit";
import {
  ballsPerOverOf,
  overlayPhaseOf,
  sidesOf,
  tossLineOf,
  type OverlayPhase,
  type Side,
} from "../../score-bug";
import type { LiveMatchState } from "../../types";
import { AnimatedNumber } from "../motion";
import type { OverlayElementProps } from "../types";
import {
  CUT,
  Crest,
  DISPLAY,
  FIGURE,
  FnRoot,
  GoldRule,
  Kicker,
  LIFT,
  OverTray,
  Sheen,
  TEXT,
  chamfer,
  deepGlass,
  glass,
  goldFill,
  slantLeft,
  slantRight,
  wedge,
} from "./kit";
import { inningsBalls, inningsNo, projectedTotals, rateMeter, shortName } from "../shared/derive";
import { scoreBugAnchor } from "../shared/layout";
import { FN, matchTones, type MatchTones, type TeamTone } from "./theme";

type BugProps = OverlayElementProps["scoreBug"];

const codeOf = (s: Side) => teamCode(s.short, s.name);

/** Local start time, set after hydration (the server has no time zone). */
function useStartTime(iso: string | null | undefined): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!iso) return;
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return;
    const sameDay = at.toDateString() === new Date().toDateString();
    const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const value = sameDay
      ? time
      : `${at.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
    const id = setTimeout(() => setText(value), 0);
    return () => clearTimeout(id);
  }, [iso]);
  return text;
}

function inningsShort(n: number | null | undefined): string {
  if ((n ?? 1) >= 3) return "Super over";
  return n === 2 ? "2nd innings" : "1st innings";
}

/** The other side of a team by name. */
function sideByName(state: LiveMatchState, name: string | null | undefined): 1 | 2 | null {
  if (!name) return null;
  if (name === state.team1_name) return 1;
  if (name === state.team2_name) return 2;
  return null;
}

function team(state: LiveMatchState, n: 1 | 2): Side {
  return n === 1
    ? { name: state.team1_name, short: state.team1_short_name, logo: state.team1_logo_url ?? null }
    : { name: state.team2_name, short: state.team2_short_name, logo: state.team2_logo_url ?? null };
}

// ---- pieces ---------------------------------------------------------------

/** A hairline between blocks, fading at its ends. */
function Divider() {
  return (
    <span
      aria-hidden="true"
      className="w-px shrink-0 self-stretch"
      style={{
        background:
          "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.22) 25%, rgba(255,255,255,0.22) 75%, transparent 100%)",
      }}
    />
  );
}

/** The striker's mark: a gold pointer. */
function StrikeMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="block shrink-0"
      style={{
        width: 12,
        height: 18,
        clipPath: "polygon(0 0, 100% 50%, 0 100%)",
        background: on ? FN.gold : "transparent",
      }}
    />
  );
}

/** A team's wedge with its crest and code. */
function TeamWedge({
  side,
  tone,
  detail,
  align = "left",
  size = 68,
  codeSize = "2.625rem",
  width,
  className,
  crest = true,
}: {
  side: Side;
  tone: TeamTone;
  detail?: ReactNode;
  align?: "left" | "right";
  size?: number;
  codeSize?: string;
  width?: number;
  className?: string;
  /** Without the crest: the code alone (slim bars). */
  crest?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center gap-4 overflow-hidden",
        align === "right" && "flex-row-reverse",
        className,
      )}
      style={{
        ...wedge(tone, align === "right" ? 255 : 105),
        width,
        clipPath: align === "right" ? slantLeft() : slantRight(),
        padding: align === "right" ? "0 18px 0 34px" : "0 34px 0 18px",
      }}
    >
      {crest && <Crest logo={side.logo} code={codeOf(side)} name={side.name} tone={tone} size={size} />}
      <span className={cn("min-w-0 leading-none", align === "right" && "text-right")}>
        <span className={cn(DISPLAY, "block truncate")} style={{ fontSize: codeSize }}>
          {codeOf(side)}
        </span>
        {detail && (
          <span
            className={cn(TEXT, "mt-1.5 block truncate font-semibold uppercase")}
            style={{ fontSize: "1rem", letterSpacing: "0.06em", color: tone.textMuted }}
          >
            {detail}
          </span>
        )}
      </span>
      <Sheen at={500} />
    </div>
  );
}

/** "138/5" with each figure rolling as it changes. */
function ScoreFigure({ runs, wickets, size }: { runs: number; wickets: number; size: string }) {
  return (
    <span className={cn(FIGURE, "flex items-baseline whitespace-nowrap")} style={{ fontSize: size }}>
      <AnimatedNumber value={runs} />
      <span style={{ color: FN.gold, margin: "0 0.06em" }}>/</span>
      <AnimatedNumber value={wickets} />
    </span>
  );
}

function BatterRow({
  name,
  runs,
  balls,
  striker,
}: {
  name: string | null;
  runs: number | null;
  balls: number | null;
  striker: boolean;
}) {
  if (!name) return null;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <StrikeMark on={striker} />
      <span
        className={cn(DISPLAY, "min-w-0 flex-1 truncate")}
        style={{ fontSize: "1.5rem", color: striker ? FN.white : "rgba(255,255,255,0.86)" }}
      >
        {shortName(name, 22)}
        {striker && <span className="sr-only"> on strike</span>}
      </span>
      <span className={FIGURE} style={{ fontSize: "1.875rem" }}>
        <AnimatedNumber value={runs ?? 0} />
      </span>
      <span
        className={cn(FIGURE, "w-12 text-left")}
        style={{ fontSize: "1.125rem", color: FN.muted, fontWeight: 600 }}
      >
        ({balls ?? 0})
      </span>
    </div>
  );
}

/** A label and figure on the rate strip. */
function StripFigure({
  label,
  value,
  accent,
}: {
  label: ReactNode;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <span className="flex shrink-0 items-baseline gap-2 whitespace-nowrap">
      <span
        className={cn(TEXT, "font-semibold uppercase")}
        style={{ fontSize: "1rem", letterSpacing: "0.08em", color: accent ? FN.gold : FN.muted }}
      >
        {label}
      </span>
      <span className={FIGURE} style={{ fontSize: "1.3125rem" }}>
        {value}
      </span>
    </span>
  );
}

/** The chase's rate meter: red behind the required rate, green ahead. */
export function RateMeterBar({
  state,
  height = 14,
  segment = 13,
}: {
  state: LiveMatchState;
  height?: number;
  segment?: number;
}) {
  const meter = rateMeter(state);
  if (!meter) return null;
  const cells = Array.from({ length: meter.segments * 2 + 1 }, (_, i) => {
    const pos = i - meter.segments; // -5..5
    let on = false;
    let colour = "rgba(255,255,255,0.12)";
    if (pos === 0) {
      on = meter.trend === "level";
      colour = on ? FN.gold : "rgba(255,197,49,0.35)";
    } else if (pos < 0) {
      on = meter.trend === "behind" && -pos <= meter.lit;
      if (on) colour = FN.wicket;
    } else {
      on = meter.trend === "ahead" && pos <= meter.lit;
      if (on) colour = FN.positive;
    }
    return { pos, on, colour };
  });
  const words =
    meter.trend === "level"
      ? "Scoring at the required rate"
      : `Scoring ${Math.abs(meter.gap).toFixed(2)} an over ${meter.trend === "ahead" ? "above" : "below"} the required rate`;
  return (
    <span role="img" aria-label={words} className="flex shrink-0 items-center gap-[3px]">
      {cells.map((c) => (
        <span
          key={c.pos}
          className="block"
          style={{
            width: c.pos === 0 ? segment * 0.6 : segment,
            height,
            transform: "skewX(-18deg)",
            background: c.colour,
            boxShadow: c.on ? `0 0 8px ${c.colour}` : undefined,
          }}
        />
      ))}
    </span>
  );
}

function freeHitChip() {
  return (
    <Kicker
      key="fh"
      size="sm"
      tone="glass"
      style={{ background: FN.extra, color: "#1c1000", boxShadow: "none" }}
    >
      Free hit
    </Kicker>
  );
}

/** The strip's left side: the chase, or the rate and projections. */
function RateFigures({ state, bpo }: { state: LiveMatchState; bpo: number }) {
  const parts: ReactNode[] = [];
  if (state.free_hit) parts.push(freeHitChip());
  if (state.powerplay) {
    parts.push(
      <Kicker key="pp" size="sm">
        Powerplay
      </Kicker>,
    );
  }
  const chasing =
    state.target_runs !== null &&
    state.runs_needed !== null &&
    state.balls_remaining !== null &&
    !state.innings_completed;
  if (chasing && (state.runs_needed ?? 0) > 0) {
    parts.push(
      <span
        key="need"
        className={cn(DISPLAY, "shrink-0 whitespace-nowrap")}
        style={{ ...goldFill(), clipPath: chamfer(6), padding: "4px 14px", fontSize: "1.25rem", letterSpacing: "0.04em" }}
      >
        Need {state.runs_needed} from {state.balls_remaining}{" "}
        {state.balls_remaining === 1 ? "ball" : "balls"}
      </span>,
      <StripFigure key="t" label="Target" value={state.target_runs} />,
    );
    if (state.current_run_rate !== null) {
      parts.push(<StripFigure key="crr" label="CRR" value={state.current_run_rate.toFixed(2)} />);
    }
    if (state.required_run_rate !== null) {
      parts.push(<StripFigure key="rrr" label="RRR" value={state.required_run_rate.toFixed(2)} accent />);
    }
    parts.push(<RateMeterBar key="meter" state={state} />);
    return <>{parts}</>;
  }
  if (state.current_run_rate !== null) {
    parts.push(<StripFigure key="crr" label="CRR" value={state.current_run_rate.toFixed(2)} />);
  }
  const proj = projectedTotals(state, bpo);
  if (proj.length) {
    parts.push(
      <span key="proj" className="flex shrink-0 items-baseline gap-4 whitespace-nowrap">
        <span
          className={cn(TEXT, "font-semibold uppercase")}
          style={{ fontSize: "1rem", letterSpacing: "0.08em", color: FN.gold }}
        >
          Projected
        </span>
        {proj.map((p) => (
          <span key={p.label} className="flex items-baseline gap-1.5">
            <span className={FIGURE} style={{ fontSize: "1.3125rem" }}>
              {p.total}
            </span>
            <span
              className={cn(TEXT, "font-semibold")}
              style={{ fontSize: "1rem", color: FN.muted }}
            >
              {p.current ? `(CRR ${p.rate.toFixed(2)})` : `(${p.label} rpo)`}
            </span>
          </span>
        ))}
      </span>,
    );
  }
  return <>{parts}</>;
}

/** The rate strip under the bar. */
function RateStrip({
  left,
  right,
  className,
}: {
  left: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex h-11 items-center justify-between gap-6 overflow-hidden", className)}
      style={{ ...deepGlass(), padding: "0 28px" }}
    >
      <div className="flex min-w-0 items-center gap-6 tabular-nums">{left}</div>
      {right && (
        <div className="flex min-w-0 shrink items-center justify-end gap-6 tabular-nums">
          {right}
        </div>
      )}
    </div>
  );
}

function StandAndLastWicket({ state, sponsor }: { state: LiveMatchState; sponsor: string | null }) {
  return (
    <>
      {(state.partnership_runs ?? 0) > 0 && (
        <StripFigure
          label="P'ship"
          value={`${state.partnership_runs} (${state.partnership_balls ?? 0})`}
        />
      )}
      {state.last_wicket?.name && (
        <span className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
          <span
            className={cn(TEXT, "shrink-0 font-semibold uppercase")}
            style={{ fontSize: "1rem", letterSpacing: "0.08em", color: FN.muted }}
          >
            Last wkt
          </span>
          <span className={cn(TEXT, "min-w-0 truncate font-semibold")} style={{ fontSize: "1.125rem" }}>
            {shortName(state.last_wicket.name, 18)}{" "}
            <span className={FIGURE} style={{ fontWeight: 700 }}>
              {state.last_wicket.runs} ({state.last_wicket.balls})
            </span>
          </span>
        </span>
      )}
      {sponsor && (
        <span
          className={cn(TEXT, "min-w-0 truncate font-semibold")}
          style={{ fontSize: "1rem", color: FN.muted, letterSpacing: "0.04em" }}
        >
          {sponsor}
        </span>
      )}
    </>
  );
}

/** A bar's outer shape: chamfered, lifted, the gold rule above the strip. */
function BarShell({
  children,
  strip,
  label,
}: {
  children: ReactNode;
  strip?: ReactNode;
  label: string;
}) {
  return (
    <div aria-label={label} style={LIFT}>
      <div className="fn-a-wipe-c relative" style={{ clipPath: chamfer(CUT) }}>
        <div className="relative flex h-[92px] items-stretch" style={glass()}>
          {children}
        </div>
        {strip && (
          <>
            <GoldRule />
            {strip}
          </>
        )}
      </div>
    </div>
  );
}

// ---- bottom bar --------------------------------------------------------------

function LiveBar({
  state,
  bpo,
  tones,
  sponsor,
}: {
  state: LiveMatchState;
  bpo: number;
  tones: MatchTones;
  sponsor: string | null;
}) {
  const { batting, bowling } = sidesOf(state);
  const tokens = overTokens(state);
  const limit = inningsBalls(state, bpo);
  const econ = economyText(state.bowler_runs, state.bowler_balls);
  const chip = tokens.length > 6 ? { size: 34, gap: 5 } : { size: 40, gap: 8 };
  return (
    <BarShell
      label="Score"
      strip={
        <RateStrip
          left={<RateFigures state={state} bpo={bpo} />}
          right={<StandAndLastWicket state={state} sponsor={sponsor} />}
        />
      }
    >
      <TeamWedge side={batting} tone={tones.bat} detail={inningsShort(state.innings_number)} width={262} />
      <div
        className="relative flex w-[300px] shrink-0 items-center gap-4 pl-3 pr-5"
        style={glass({ tone: tones.bat, from: "0% 50%", strength: 0.38 })}
      >
        <ScoreFigure runs={state.total_runs ?? 0} wickets={state.total_wickets ?? 0} size="4.25rem" />
        <span className="flex flex-col leading-none">
          <span className="flex items-center gap-1.5">
            {state.powerplay && (
              <span
                className={cn(DISPLAY, "flex h-6 w-6 items-center justify-center")}
                style={{ ...goldFill(), fontSize: "1rem", clipPath: chamfer(4) }}
                aria-label="Powerplay"
              >
                P
              </span>
            )}
            <span className={FIGURE} style={{ fontSize: "1.75rem" }}>
              <AnimatedNumber value={oversText(state.total_balls, bpo)} />
            </span>
          </span>
          {limit !== null && (
            <span
              className={cn(TEXT, "mt-1.5 font-semibold")}
              style={{ fontSize: "1rem", color: FN.muted }}
            >
              of {oversText(limit, bpo).replace(/\.0$/, "")} ov
            </span>
          )}
        </span>
      </div>
      <Divider />
      <div aria-label="At the crease" className="flex w-[430px] min-w-0 shrink-0 flex-col justify-center gap-1.5 px-5">
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
      <Divider />
      <div className="flex w-[300px] min-w-0 shrink-0 flex-col justify-center gap-1.5 px-5">
        {state.current_bowler_name && (
          <>
            <span className={cn(DISPLAY, "truncate")} style={{ fontSize: "1.5rem" }}>
              {shortName(state.current_bowler_name, 20)}
            </span>
            <span className="flex items-baseline gap-3 leading-none">
              <span className={FIGURE} style={{ fontSize: "1.875rem" }}>
                <AnimatedNumber value={`${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0}`} />
              </span>
              <span className={cn(FIGURE)} style={{ fontSize: "1.125rem", color: FN.muted, fontWeight: 600 }}>
                {oversText(state.bowler_balls, bpo)}
                {econ && ` · Econ ${econ}`}
              </span>
            </span>
          </>
        )}
      </div>
      <Divider />
      <div className="flex min-w-0 flex-1 items-center justify-center px-3">
        <OverTray tokens={tokens} slots={bpo} size={chip.size} gap={chip.gap} />
      </div>
      <TeamWedge
        side={bowling}
        tone={tones.bowl}
        align="right"
        size={54}
        codeSize="1.5rem"
        width={180}
      />
    </BarShell>
  );
}

/** "HAW 156/7 (20)" for an innings of the match. */
function inningsLine(
  state: LiveMatchState,
  match: Match | null | undefined,
  inn: Innings,
  bpo: number,
): { code: string; score: string; overs: string } {
  const isTeam1 = match?.team1_id ? inn.team_id === match.team1_id : inn.innings_number === 1;
  const side = team(state, isTeam1 ? 1 : 2);
  return {
    code: codeOf(side),
    score: `${inn.total_runs ?? 0}/${inn.total_wickets ?? 0}`,
    overs: oversText(inn.total_balls, bpo),
  };
}

function BreakBar({
  state,
  match,
  bpo,
  tones,
  sponsor,
}: {
  state: LiveMatchState;
  match: Match | null | undefined;
  bpo: number;
  tones: MatchTones;
  sponsor: string | null;
}) {
  const { batting, bowling } = sidesOf(state);
  const first = inningsNo(match?.innings ?? [], 1);
  const target = state.target_runs ?? (first ? first.total_runs + 1 : null);
  const balls = state.balls_remaining ?? inningsBalls(state, bpo);
  const prev = first ? inningsLine(state, match, first, bpo) : null;
  return (
    <BarShell
      label="Innings break"
      strip={
        <RateStrip
          left={
            <>
              {prev && (
                <StripFigure
                  label="1st innings"
                  value={`${prev.code} ${prev.score} (${prev.overs} ov)`}
                />
              )}
              {state.required_run_rate !== null && (
                <StripFigure label="Required rate" value={state.required_run_rate.toFixed(2)} accent />
              )}
            </>
          }
          right={sponsor ? <StandAndLastWicket state={{ ...state, partnership_runs: null, last_wicket: null }} sponsor={sponsor} /> : undefined}
        />
      }
    >
      <TeamWedge side={batting} tone={tones.bat} detail="To bat" width={262} />
      <div className="flex min-w-0 flex-1 items-center gap-8 px-8" style={glass({ tone: tones.bat, strength: 0.3 })}>
        <Kicker size="lg">Innings break</Kicker>
        {target !== null && (
          <span className="flex items-baseline gap-3 whitespace-nowrap">
            <span className={cn(TEXT, "font-semibold uppercase")} style={{ fontSize: "1.25rem", letterSpacing: "0.08em", color: FN.gold }}>
              Target
            </span>
            <span className={FIGURE} style={{ fontSize: "4rem" }}>
              {target}
            </span>
          </span>
        )}
        {target !== null && balls !== null && (
          <span className={cn(DISPLAY, "min-w-0 truncate")} style={{ fontSize: "1.75rem", color: "rgba(255,255,255,0.9)" }}>
            {codeOf(batting)} need {target} from {balls} balls
          </span>
        )}
      </div>
      <TeamWedge side={bowling} tone={tones.bowl} align="right" size={54} codeSize="1.5rem" width={180} />
    </BarShell>
  );
}

function ResultBar({
  state,
  match,
  bpo,
  tones,
  sponsor,
}: {
  state: LiveMatchState;
  match: Match | null | undefined;
  bpo: number;
  tones: MatchTones;
  sponsor: string | null;
}) {
  const winner = sideByName(state, state.winning_team_name);
  const lead: 1 | 2 = winner ?? 1;
  const leadTone = lead === 1 ? tones.team1 : tones.team2;
  const lines = [...(match?.innings ?? [])]
    .filter((i) => i.innings_number <= 2)
    .sort((a, b) => a.innings_number - b.innings_number)
    .map((i) => inningsLine(state, match, i, bpo));
  const toss = tossLineOf(state, match);
  const potm = match?.player_of_the_match?.full_name;
  return (
    <BarShell
      label="Result"
      strip={
        <RateStrip
          left={
            <>
              {potm && <StripFigure label="Player of the match" value={<span className={TEXT}>{potm}</span>} accent />}
              {toss && (
                <span className={cn(TEXT, "truncate font-semibold")} style={{ fontSize: "1.125rem", color: FN.muted }}>
                  {toss}
                </span>
              )}
            </>
          }
          right={sponsor ? <span className={cn(TEXT, "truncate font-semibold")} style={{ fontSize: "1rem", color: FN.muted }}>{sponsor}</span> : undefined}
        />
      }
    >
      <TeamWedge side={team(state, lead)} tone={leadTone} detail={winner ? "Winners" : "Result"} width={262} />
      <div className="flex min-w-0 flex-1 items-center gap-8 px-8" style={glass({ tone: leadTone, strength: 0.34 })}>
        <span className={cn(DISPLAY, "min-w-0 flex-1 truncate")} style={{ fontSize: "2.5rem" }}>
          {state.result_description ?? "Match finished"}
        </span>
        {lines.map((l) => (
          <span key={l.code + l.score} className="flex shrink-0 items-baseline gap-2.5 whitespace-nowrap">
            <span className={DISPLAY} style={{ fontSize: "1.5rem", color: FN.muted }}>
              {l.code}
            </span>
            <span className={FIGURE} style={{ fontSize: "2.25rem" }}>
              {l.score}
            </span>
            <span className={FIGURE} style={{ fontSize: "1.125rem", color: FN.muted, fontWeight: 600 }}>
              ({l.overs})
            </span>
          </span>
        ))}
      </div>
      <TeamWedge
        side={team(state, lead === 1 ? 2 : 1)}
        tone={lead === 1 ? tones.team2 : tones.team1}
        align="right"
        size={54}
        codeSize="1.5rem"
        width={180}
      />
    </BarShell>
  );
}

function PreBar({
  state,
  match,
  tones,
}: {
  state: LiveMatchState;
  match: Match | null | undefined;
  tones: MatchTones;
}) {
  const start = useStartTime(match?.scheduled_at);
  const toss = tossLineOf(state, match);
  const source = state.tournament_name ?? state.title;
  const t1 = team(state, 1);
  const t2 = team(state, 2);
  const label = start ? `Starts ${start}` : "Coming up";
  return (
    <BarShell
      label="Coming up"
      strip={
        (toss || state.venue) && (
          <RateStrip
            left={
              <span className={cn(TEXT, "truncate font-semibold")} style={{ fontSize: "1.125rem" }}>
                {toss ?? state.venue}
              </span>
            }
            right={
              toss && state.venue ? (
                <span className={cn(TEXT, "truncate font-semibold")} style={{ fontSize: "1.125rem", color: FN.muted }}>
                  {state.venue}
                </span>
              ) : undefined
            }
          />
        )
      }
    >
      <TeamWedge side={t1} tone={tones.team1} width={262} />
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-8 text-center" style={glass()}>
        <Kicker size="sm">{label}</Kicker>
        <span className={cn(DISPLAY, "mt-2 block max-w-full truncate")} style={{ fontSize: "2.25rem" }}>
          {state.team1_name ?? codeOf(t1)}{" "}
          <span style={{ color: FN.gold }}>v</span> {state.team2_name ?? codeOf(t2)}
        </span>
        {source && (
          <span className={cn(TEXT, "sr-only")}>{source}</span>
        )}
      </div>
      <TeamWedge
        side={t2}
        tone={tones.team2}
        align="right"
        width={262}
      />
    </BarShell>
  );
}

// ---- top and compact ------------------------------------------------------------

function TopBar({
  state,
  bpo,
  tones,
  phase,
}: {
  state: LiveMatchState;
  bpo: number;
  tones: MatchTones;
  phase: OverlayPhase;
}) {
  const { batting, bowling } = sidesOf(state);
  const chasing =
    state.target_runs !== null && state.runs_needed !== null && (state.runs_needed ?? 0) > 0;
  const inPlay = phase === "live";
  return (
    <div style={LIFT}>
      <div
        className="fn-a-wipe-c relative flex h-16 items-stretch"
        style={{ ...glass(), clipPath: chamfer(12) }}
      >
        <TeamWedge side={batting} tone={tones.bat} size={44} codeSize="1.875rem" width={190} />
        <div className="flex shrink-0 items-center gap-3 px-5" style={glass({ tone: tones.bat, strength: 0.34 })}>
          <ScoreFigure runs={state.total_runs ?? 0} wickets={state.total_wickets ?? 0} size="2.75rem" />
          <span className={FIGURE} style={{ fontSize: "1.375rem", color: FN.muted }}>
            {oversText(state.total_balls, bpo)}
          </span>
        </div>
        {inPlay ? (
          <>
            <Divider />
            {state.striker_name && (
              <div className="flex min-w-0 max-w-[20rem] items-center gap-2.5 px-4">
                <StrikeMark on />
                <span className={cn(DISPLAY, "truncate")} style={{ fontSize: "1.375rem" }}>
                  {shortName(state.striker_name, 16)}
                </span>
                <span className={FIGURE} style={{ fontSize: "1.625rem" }}>
                  {state.striker_runs ?? 0}
                </span>
                <span className={FIGURE} style={{ fontSize: "1rem", color: FN.muted, fontWeight: 600 }}>
                  ({state.striker_balls ?? 0})
                </span>
              </div>
            )}
            <Divider />
            {state.current_bowler_name && (
              <div className="flex min-w-0 max-w-[18rem] items-center gap-2.5 px-4">
                <span className={cn(DISPLAY, "truncate")} style={{ fontSize: "1.375rem" }}>
                  {shortName(state.current_bowler_name, 16)}
                </span>
                <span className={FIGURE} style={{ fontSize: "1.625rem" }}>
                  {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0}
                </span>
              </div>
            )}
            <Divider />
            <div className="flex min-w-0 flex-1 items-center justify-center px-3">
              <OverTray tokens={overTokens(state)} slots={bpo} size={30} gap={5} />
            </div>
            {chasing && (
              <div
                className={cn(DISPLAY, "flex shrink-0 items-center whitespace-nowrap px-5")}
                style={{ ...goldFill(), fontSize: "1.375rem", letterSpacing: "0.03em" }}
              >
                Need {state.runs_needed} from {state.balls_remaining}
              </div>
            )}
          </>
        ) : (
          <div className="flex min-w-0 flex-1 items-center px-6">
            <span className={cn(DISPLAY, "truncate")} style={{ fontSize: "1.5rem" }}>
              {phase === "break"
                ? `Innings break · ${codeOf(batting)} to bat${state.target_runs !== null ? ` · Target ${state.target_runs}` : ""}`
                : (state.result_description ?? "Match finished")}
            </span>
          </div>
        )}
        <TeamWedge side={bowling} tone={tones.bowl} align="right" crest={false} codeSize="1.5rem" width={112} />
      </div>
    </div>
  );
}

function CompactCard({
  state,
  bpo,
  tones,
  phase,
}: {
  state: LiveMatchState;
  bpo: number;
  tones: MatchTones;
  phase: OverlayPhase;
}) {
  const { batting } = sidesOf(state);
  const inPlay = phase === "live";
  const chasing =
    state.target_runs !== null && state.runs_needed !== null && (state.runs_needed ?? 0) > 0;
  return (
    <div style={{ ...LIFT, width: 470 }}>
      <div className="fn-a-wipe relative" style={{ clipPath: chamfer(CUT) }}>
        <div className="flex h-[76px] items-stretch" style={glass()}>
          <TeamWedge side={batting} tone={tones.bat} size={50} codeSize="1.875rem" width={190} />
          <div className="flex flex-1 items-center justify-end gap-3 px-5" style={glass({ tone: tones.bat, strength: 0.3 })}>
            <ScoreFigure runs={state.total_runs ?? 0} wickets={state.total_wickets ?? 0} size="3rem" />
            <span className={FIGURE} style={{ fontSize: "1.375rem", color: FN.muted }}>
              {oversText(state.total_balls, bpo)}
            </span>
          </div>
        </div>
        <GoldRule />
        <div className="space-y-2 px-5 py-3" style={deepGlass()}>
          {inPlay ? (
            <>
              <BatterRow name={state.striker_name} runs={state.striker_runs} balls={state.striker_balls} striker />
              <BatterRow
                name={state.non_striker_name}
                runs={state.non_striker_runs}
                balls={state.non_striker_balls}
                striker={false}
              />
              {state.current_bowler_name && (
                <div className="flex items-center gap-3 pl-[24px]">
                  <span className={cn(DISPLAY, "min-w-0 flex-1 truncate")} style={{ fontSize: "1.375rem", color: FN.muted }}>
                    {shortName(state.current_bowler_name, 18)}
                  </span>
                  <span className={FIGURE} style={{ fontSize: "1.5rem" }}>
                    {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0}
                  </span>
                  <span className={FIGURE} style={{ fontSize: "1rem", color: FN.muted, fontWeight: 600 }}>
                    ({oversText(state.bowler_balls, bpo)})
                  </span>
                </div>
              )}
              <div className="flex justify-center pt-1">
                <OverTray tokens={overTokens(state)} slots={bpo} size={32} gap={6} />
              </div>
            </>
          ) : (
            <span className={cn(DISPLAY, "block truncate")} style={{ fontSize: "1.5rem" }}>
              {phase === "break"
                ? `Innings break · ${codeOf(batting)} to bat`
                : (state.result_description ?? "Match finished")}
            </span>
          )}
        </div>
        {(chasing || (inPlay && state.current_run_rate !== null)) && (
          <div
            className={cn(DISPLAY, "px-5 py-2")}
            style={chasing ? { ...goldFill(), fontSize: "1.25rem", letterSpacing: "0.03em" } : { ...deepGlass(), fontSize: "1.125rem" }}
          >
            {chasing
              ? `Need ${state.runs_needed} from ${state.balls_remaining} · RRR ${state.required_run_rate?.toFixed(2) ?? "-"}`
              : `CRR ${state.current_run_rate?.toFixed(2)}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- the element ------------------------------------------------------------------

export function FranchiseScoreBug(p: BugProps) {
  const { state, match, layout, sponsor, marginOffsetPx } = p;
  const phase = overlayPhaseOf(state);
  const bpo = ballsPerOverOf(match);
  const tones = matchTones(state);
  const pre = phase === "pre" || state.innings_number == null;
  const top = layout === "top";
  const compact = layout === "compact" && !pre;
  // Before the start the compact card has nothing to hold: the full bar.
  const position = scoreBugAnchor(pre && layout === "compact" ? "bottom" : layout, marginOffsetPx);
  return (
    <FnRoot
      data-testid="fn-score-bug"
      data-layout={layout}
      data-phase={phase}
      className="fixed z-20"
      style={position}
    >
      {pre ? (
        <PreBar state={state} match={match} tones={tones} />
      ) : top ? (
        <TopBar state={state} bpo={bpo} tones={tones} phase={phase} />
      ) : compact ? (
        <CompactCard state={state} bpo={bpo} tones={tones} phase={phase} />
      ) : phase === "break" ? (
        <BreakBar state={state} match={match} bpo={bpo} tones={tones} sponsor={sponsor} />
      ) : phase === "done" ? (
        <ResultBar state={state} match={match} bpo={bpo} tones={tones} sponsor={sponsor} />
      ) : (
        <LiveBar state={state} bpo={bpo} tones={tones} sponsor={sponsor} />
      )}
    </FnRoot>
  );
}
