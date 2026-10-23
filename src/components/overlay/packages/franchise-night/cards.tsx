"use client";

/**
 * Franchise night's full-screen cards: batting and bowling cards, fall of
 * wickets, playing XIs, toss, the match-up, result, summaries, the
 * partnership, this over, the estimate and the break cards (a strategic
 * timeout in the batting side's colours with the state of play).
 */

import type { ReactNode } from "react";
import { formatDismissalType, formatFowOvers } from "~/lib/cricket";
import type { Innings, Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { winPredictorFromLive } from "~/lib/win-predictor";
import {
  economyText,
  oversText,
  overTokens,
  strikeRateText,
  teamCode,
} from "../../overlay-kit";
import { playingXi, tossWinnerName } from "../../presentation-card-views";
import { ballsPerOverOf, sidesOf, type Side } from "../../score-bug";
import { inningsLabel, inningsTeamName } from "../../scorecard-cards";
import type { LiveMatchState } from "../../types";
import { AnimatedNumber } from "../motion";
import type { BreakKind, OverlayElementProps } from "../types";
import {
  CardFrame,
  Crest,
  DISPLAY,
  FIGURE,
  FnRoot,
  GoldRule,
  Kicker,
  LIFT,
  OverTray,
  PlayerSlot,
  SAFE,
  Sheen,
  Stat,
  TEXT,
  TableHead,
  chamfer,
  deepGlass,
  delay,
  glass,
  goldFill,
  rowStyle,
  slantLeft,
  slantRight,
  wedge,
} from "./kit";
import {
  avatarOf,
  inningsBalls,
  inningsLeaders,
  inningsNo,
  projectedTotals,
  roleMark,
  partnershipOf,
  playerTeamOf,
} from "../shared/derive";
import { BREAK_COPY } from "./straps";
import { FN, matchTones, type MatchTones, type TeamTone } from "./theme";

// ---- shared ---------------------------------------------------------------------

function team(state: LiveMatchState, n: 1 | 2): Side {
  return n === 1
    ? { name: state.team1_name, short: state.team1_short_name, logo: state.team1_logo_url ?? null }
    : { name: state.team2_name, short: state.team2_short_name, logo: state.team2_logo_url ?? null };
}

const codeOf = (s: Side) => teamCode(s.short, s.name);

/** Which side batted in `inn` (by team id, else the live row's sides). */
function sideOfInnings(state: LiveMatchState, match: Match | null | undefined, inn: Innings): 1 | 2 {
  if (match?.team1_id) return inn.team_id === match.team1_id ? 1 : 2;
  const name = inningsTeamName(state, inn, null);
  return name === state.team2_name ? 2 : 1;
}

const toneOf = (tones: MatchTones, n: 1 | 2) => (n === 1 ? tones.team1 : tones.team2);

/** "Tournament · label" for a kicker. */
function kickerOf(state: LiveMatchState, label: string): string {
  const source = state.tournament_name;
  return source ? `${source} · ${label}` : label;
}

/** The big score in a card header. */
function HeaderScore({ runs, wickets, overs, tone }: { runs: number; wickets: number; overs?: string; tone: TeamTone }) {
  return (
    <span className="block leading-none" style={{ color: tone.text }}>
      <span className={cn(FIGURE, "block")} style={{ fontSize: "3.75rem" }}>
        {runs}/{wickets}
      </span>
      {overs && (
        <span className={cn(TEXT, "mt-1 block font-semibold")} style={{ fontSize: "1.25rem", color: tone.textMuted }}>
          {overs} overs
        </span>
      )}
    </span>
  );
}

const TD = "px-3 py-[7px] text-right";

// ---- batting, bowling, fall of wickets ----------------------------------------

function BattingTable({ innings, bpo, compact }: { innings: Innings; bpo: number; compact?: boolean }) {
  void bpo;
  const rows = (innings.batting_performances ?? []).filter(
    (b) => b.balls_faced > 0 || b.is_out || b.is_current_batsman,
  );
  const fs = compact ? "1.3125rem" : "1.5rem";
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <TableHead className="text-left">Batter</TableHead>
          <TableHead className="text-left">
            <span className="sr-only">How out</span>
          </TableHead>
          <TableHead>R</TableHead>
          <TableHead>B</TableHead>
          <TableHead className="normal-case">4s</TableHead>
          <TableHead className="normal-case">6s</TableHead>
          <TableHead>SR</TableHead>
        </tr>
      </thead>
      <tbody>
        {rows.map((b, i) => {
          const live = !!b.is_current_batsman && !b.is_out;
          return (
            <tr key={b.id} className="fn-a-rise" style={{ ...rowStyle(i, live), ...delay(160 + i * 35) }}>
              <td className={cn(DISPLAY, "max-w-[20rem] truncate px-3 py-[7px] text-left")} style={{ fontSize: fs }}>
                {b.user?.full_name ?? ""}
                {live && b.is_striker ? <span style={{ color: FN.gold }}> *</span> : null}
              </td>
              <td className={cn(TEXT, "max-w-[14rem] truncate px-3 py-[7px] text-left font-medium")} style={{ fontSize: "1.125rem", color: live ? FN.gold : FN.muted }}>
                {b.is_out ? formatDismissalType(b.dismissal_type) : "not out"}
              </td>
              <td className={cn(FIGURE, TD)} style={{ fontSize: compact ? "1.5rem" : "1.75rem" }}>
                {b.runs_scored}
              </td>
              <td className={cn(FIGURE, TD)} style={{ fontSize: "1.25rem", fontWeight: 600, color: FN.muted }}>
                {b.balls_faced}
              </td>
              <td className={cn(FIGURE, TD)} style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                {b.fours}
              </td>
              <td className={cn(FIGURE, TD)} style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                {b.sixes}
              </td>
              <td className={cn(FIGURE, TD)} style={{ fontSize: "1.25rem", fontWeight: 600, color: FN.muted }}>
                {strikeRateText(b.runs_scored, b.balls_faced) ?? "-"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BowlingTable({ innings, bpo, compact }: { innings: Innings; bpo: number; compact?: boolean }) {
  const rows = (innings.bowling_performances ?? []).filter(
    (b) => b.balls_bowled > 0 || b.is_current_bowler,
  );
  const fs = compact ? "1.3125rem" : "1.5rem";
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <TableHead className="text-left">Bowler</TableHead>
          <TableHead>O</TableHead>
          <TableHead>M</TableHead>
          <TableHead>R</TableHead>
          <TableHead>W</TableHead>
          <TableHead>Econ</TableHead>
        </tr>
      </thead>
      <tbody>
        {rows.map((b, i) => (
          <tr key={b.id} className="fn-a-rise" style={{ ...rowStyle(i, !!b.is_current_bowler), ...delay(200 + i * 35) }}>
            <td className={cn(DISPLAY, "max-w-[18rem] truncate px-3 py-[7px] text-left")} style={{ fontSize: fs }}>
              {b.user?.full_name ?? ""}
            </td>
            <td className={cn(FIGURE, TD)} style={{ fontSize: "1.25rem", fontWeight: 600 }}>
              {oversText(b.balls_bowled, bpo)}
            </td>
            <td className={cn(FIGURE, TD)} style={{ fontSize: "1.25rem", fontWeight: 600, color: FN.muted }}>
              {b.maidens}
            </td>
            <td className={cn(FIGURE, TD)} style={{ fontSize: "1.25rem", fontWeight: 600 }}>
              {b.runs_conceded}
            </td>
            <td className={cn(FIGURE, TD)} style={{ fontSize: compact ? "1.5rem" : "1.75rem", color: b.wickets_taken > 0 ? FN.gold : FN.white }}>
              {b.wickets_taken}
            </td>
            <td className={cn(FIGURE, TD)} style={{ fontSize: "1.25rem", fontWeight: 600, color: FN.muted }}>
              {economyText(b.runs_conceded, b.balls_bowled) ?? "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExtrasAndTotal({ innings, bpo }: { innings: Innings; bpo: number }) {
  return (
    <div className="flex items-center justify-between gap-8">
      <span className={cn(TEXT, "font-semibold")} style={{ fontSize: "1.25rem", color: FN.muted }}>
        <span style={{ color: FN.white }}>Extras {innings.extras_total ?? 0}</span>{" "}
        (b {innings.extras_byes ?? 0}, lb {innings.extras_leg_byes ?? 0}, w {innings.extras_wides ?? 0}, nb{" "}
        {innings.extras_no_balls ?? 0})
      </span>
      <span className="flex items-baseline gap-3">
        <span className={cn(TEXT, "font-semibold uppercase")} style={{ fontSize: "1.125rem", letterSpacing: "0.08em", color: FN.gold }}>
          Total
        </span>
        <span className={FIGURE} style={{ fontSize: "2rem" }}>
          {innings.total_runs ?? 0}/{innings.total_wickets ?? 0}
        </span>
        <span className={FIGURE} style={{ fontSize: "1.25rem", color: FN.muted, fontWeight: 600 }}>
          ({oversText(innings.total_balls, bpo)} ov)
        </span>
      </span>
    </div>
  );
}

function fowEntries(innings: Innings) {
  return [...(innings.fall_of_wickets ?? [])].sort((a, b) => a.wicket_number - b.wicket_number);
}

function FowLine({ innings }: { innings: Innings }) {
  const fow = fowEntries(innings);
  if (!fow.length) return null;
  return (
    <p className={cn(TEXT, "font-medium tabular-nums")} style={{ fontSize: "1.125rem", color: FN.muted, lineHeight: 1.35 }}>
      <span className="font-semibold uppercase" style={{ color: FN.gold, letterSpacing: "0.08em" }}>
        Fall of wickets{" "}
      </span>
      {fow
        .map((f) => `${f.runs_at_fall}/${f.wicket_number} (${f.batsman?.full_name ?? ""}, ${formatFowOvers(f.overs_at_fall)})`)
        .join(" · ")}
    </p>
  );
}

function inningsCrest(state: LiveMatchState, match: Match | null | undefined, inn: Innings, tones: MatchTones) {
  const n = sideOfInnings(state, match, inn);
  const side = team(state, n);
  return { side, tone: toneOf(tones, n), code: codeOf(side) };
}

export function FranchiseScorecard(p: OverlayElementProps["scorecard"]) {
  const tones = matchTones(p.state);
  const bpo = ballsPerOverOf(p.match);
  const { side, tone, code } = inningsCrest(p.state, p.match, p.innings, tones);
  return (
    <CardFrame
      label={`${p.teamName} batting`}
      kicker={kickerOf(p.state, inningsLabel(p.innings.innings_number))}
      title={`${p.teamName} batting`}
      tone={tone}
      crest={{ logo: side.logo, code, name: side.name }}
      width={p.full ? 1728 : 1300}
      aside={<HeaderScore runs={p.innings.total_runs} wickets={p.innings.total_wickets} overs={oversText(p.innings.total_balls, bpo)} tone={tone} />}
      footer={
        <div className="space-y-1.5">
          <ExtrasAndTotal innings={p.innings} bpo={bpo} />
          <FowLine innings={p.innings} />
        </div>
      }
    >
      {p.full ? (
        <div className="grid grid-cols-[1.55fr_1fr] gap-10">
          <div className="min-w-0">
            <BattingTable innings={p.innings} bpo={bpo} compact />
          </div>
          <div className="min-w-0">
            <BowlingTable innings={p.innings} bpo={bpo} compact />
          </div>
        </div>
      ) : (
        <BattingTable innings={p.innings} bpo={bpo} />
      )}
    </CardFrame>
  );
}

export function FranchiseBowlingCard(p: OverlayElementProps["bowlingCard"]) {
  const tones = matchTones(p.state);
  const bpo = ballsPerOverOf(p.match);
  const batting = sideOfInnings(p.state, p.match, p.innings);
  const n: 1 | 2 = batting === 1 ? 2 : 1;
  const side = team(p.state, n);
  const tone = toneOf(tones, n);
  return (
    <CardFrame
      label={`${p.teamName} bowling`}
      kicker={kickerOf(p.state, inningsLabel(p.innings.innings_number))}
      title={`${p.teamName} bowling`}
      tone={tone}
      crest={{ logo: side.logo, code: codeOf(side), name: side.name }}
      width={1200}
      aside={<HeaderScore runs={p.innings.total_runs} wickets={p.innings.total_wickets} overs={oversText(p.innings.total_balls, bpo)} tone={tone} />}
    >
      <BowlingTable innings={p.innings} bpo={bpo} />
    </CardFrame>
  );
}

export function FranchiseFallOfWickets(p: OverlayElementProps["fallOfWickets"]) {
  const fow = fowEntries(p.innings);
  if (!fow.length) return null;
  const tones = matchTones(p.state);
  const { side, tone, code } = inningsCrest(p.state, p.match, p.innings, tones);
  const total = Math.max(1, p.innings.total_runs ?? 1);
  return (
    <CardFrame
      label={`${p.teamName} fall of wickets`}
      kicker={kickerOf(p.state, inningsLabel(p.innings.innings_number))}
      title="Fall of wickets"
      tone={tone}
      crest={{ logo: side.logo, code, name: side.name }}
      width={1300}
      aside={<HeaderScore runs={p.innings.total_runs} wickets={p.innings.total_wickets} tone={tone} />}
    >
      {/* The innings as a track, each wicket where it fell. */}
      <div className="relative mb-7 mt-3 h-14" role="img" aria-label={`Wickets at ${fow.map((f) => f.runs_at_fall).join(", ")} runs`}>
        <div className="fn-a-grow-x absolute inset-x-0 top-[22px] h-[10px]" style={{ background: `linear-gradient(90deg, ${tone.deep}, ${tone.light})`, clipPath: chamfer(3) }} />
        {fow.map((f, i) => (
          <span
            key={f.wicket_number}
            className="fn-a-rise absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${(f.runs_at_fall / total) * 100}%`, ...delay(300 + i * 70) }}
          >
            <span
              className={cn(FIGURE, "flex h-[54px] w-[38px] items-center justify-center")}
              style={{ background: FN.wicket, color: FN.white, fontSize: "1.375rem", clipPath: "polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)" }}
            >
              {f.wicket_number}
            </span>
          </span>
        ))}
      </div>
      <ol className="grid grid-cols-2 gap-x-10">
        {fow.map((f, i) => (
          <li key={f.wicket_number} className="fn-a-rise flex items-center gap-5 px-3 py-[9px]" style={{ ...rowStyle(Math.floor(i / 2) + (i % 2)), ...delay(180 + i * 40) }}>
            <span className={FIGURE} style={{ fontSize: "1.75rem", width: "5.5rem" }}>
              {f.runs_at_fall}/{f.wicket_number}
            </span>
            <span className={cn(DISPLAY, "min-w-0 flex-1 truncate")} style={{ fontSize: "1.5rem" }}>
              {f.batsman?.full_name ?? ""}
            </span>
            <span className={FIGURE} style={{ fontSize: "1.25rem", color: FN.muted, fontWeight: 600 }}>
              {formatFowOvers(f.overs_at_fall)} ov
            </span>
          </li>
        ))}
      </ol>
    </CardFrame>
  );
}

// ---- playing XI ------------------------------------------------------------------------

function XiList({ players, columns = 1, start = 0 }: { players: ReturnType<typeof playingXi>; columns?: 1 | 2; start?: number }) {
  return (
    <ol className={cn("grid gap-x-10", columns === 2 ? "grid-cols-2" : "grid-cols-1")} style={columns === 2 ? { gridAutoFlow: "column", gridTemplateRows: `repeat(${Math.ceil(players.length / 2)}, auto)` } : undefined}>
      {players.map((p, i) => (
        <li key={p.id} className="fn-a-slide flex items-center gap-4 px-3 py-[7px]" style={{ ...rowStyle(i), ...delay(start + i * 40) }}>
          <span className={FIGURE} style={{ fontSize: "1.25rem", width: "1.75rem", color: FN.gold, textAlign: "right" }}>
            {i + 1}
          </span>
          <span className={cn(DISPLAY, "min-w-0 truncate")} style={{ fontSize: "1.625rem" }}>
            {p.user?.full_name ?? ""}
          </span>
          {roleMark(p.role_in_team) && (
            <span className={cn(TEXT, "shrink-0 font-semibold")} style={{ fontSize: "1.125rem", color: FN.muted }}>
              {roleMark(p.role_in_team).trim()}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function TeamColumnHead({ side, tone }: { side: Side; tone: TeamTone }) {
  return (
    <div className="fn-a-wipe relative mb-3 flex items-center gap-4 overflow-hidden px-5 py-3" style={{ ...wedge(tone), clipPath: chamfer(10) }}>
      <Crest logo={side.logo} code={codeOf(side)} name={side.name} tone={tone} size={56} />
      <span className={cn(DISPLAY, "min-w-0 truncate")} style={{ fontSize: "2rem" }}>
        {side.name}
      </span>
      <Sheen at={500} />
    </div>
  );
}

export function FranchisePlayingXi(p: OverlayElementProps["playingXi"]) {
  const tones = matchTones(p.state);
  if (p.side === null) {
    const one = playingXi(p.match?.team1?.team_players);
    const two = playingXi(p.match?.team2?.team_players);
    if (!one.length && !two.length) return null;
    return (
      <CardFrame
        label="Playing XI"
        kicker={kickerOf(p.state, "Team news")}
        title="Playing XI"
        tone={tones.team1}
        width={1500}
      >
        <div className="grid grid-cols-2 gap-12">
          <div className="min-w-0">
            <TeamColumnHead side={team(p.state, 1)} tone={tones.team1} />
            <XiList players={one} start={200} />
          </div>
          <div className="min-w-0">
            <TeamColumnHead side={team(p.state, 2)} tone={tones.team2} />
            <XiList players={two} start={260} />
          </div>
        </div>
      </CardFrame>
    );
  }
  const players = playingXi((p.side === 1 ? p.match?.team1 : p.match?.team2)?.team_players);
  if (!players.length) return null;
  const side = team(p.state, p.side);
  const tone = toneOf(tones, p.side);
  return (
    <CardFrame
      label={`${side.name} playing XI`}
      kicker={kickerOf(p.state, "Playing XI")}
      title={side.name ?? ""}
      tone={tone}
      crest={{ logo: side.logo, code: codeOf(side), name: side.name }}
      width={1300}
    >
      <XiList players={players} columns={2} start={180} />
    </CardFrame>
  );
}

// ---- toss, match-up, result ------------------------------------------------------------

export function FranchiseToss(p: OverlayElementProps["toss"]) {
  const winner = tossWinnerName(p.state, p.match);
  if (!winner) return null;
  const tones = matchTones(p.state);
  const n: 1 | 2 = winner === p.state.team1_name ? 1 : 2;
  const choice = p.state.toss_decision === "bowl" ? "bowl" : "bat";
  const sides = [1, 2] as const;
  return (
    <CardFrame
      label="Toss"
      kicker={kickerOf(p.state, "The toss")}
      title={`${winner} won the toss`}
      tone={toneOf(tones, n)}
      width={1300}
      aside={<Kicker size="lg">Chose to {choice}</Kicker>}
      footer={
        (p.state.venue || p.state.umpire1_name) && (
          <p className={cn(TEXT, "truncate text-center font-semibold")} style={{ fontSize: "1.25rem", color: FN.muted }}>
            {[
              p.state.venue,
              p.state.umpire1_name &&
                `Umpires ${p.state.umpire1_name}${p.state.umpire2_name ? ` and ${p.state.umpire2_name}` : ""}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )
      }
    >
      <div className="flex items-center justify-around py-4">
        {sides.map((s) => {
          const side = team(p.state, s);
          const won = s === n;
          return (
            <div key={s} className="fn-a-rise flex min-w-0 flex-1 flex-col items-center gap-4" style={delay(200 + s * 80)}>
              <span className="relative">
                <Crest logo={side.logo} code={codeOf(side)} name={side.name} tone={toneOf(tones, s)} size={170} />
                {won && (
                  <span aria-hidden="true" className="absolute -inset-3 rounded-full" style={{ boxShadow: `0 0 0 5px ${FN.gold}` }} />
                )}
              </span>
              <span className={cn(DISPLAY, "max-w-[34rem] truncate")} style={{ fontSize: "2.5rem", color: won ? FN.white : FN.muted }}>
                {side.name}
              </span>
              {won ? <Kicker size="sm">Won the toss</Kicker> : <span style={{ height: 30 }} />}
            </div>
          );
        })}
      </div>
    </CardFrame>
  );
}

/** Before the start: the two sides face off across a gold V. */
export function FranchiseMatchIntro(p: OverlayElementProps["matchIntro"]) {
  const tones = matchTones(p.state);
  const s = p.state;
  const toss = tossWinnerName(s, p.match);
  const line = [
    s.venue,
    toss && `${toss} won the toss and chose to ${s.toss_decision === "bowl" ? "bowl" : "bat"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  // "Metro T20 League · Final" under a "Metro T20 League" kicker: "Final".
  const prefix = s.tournament_name ? `${s.tournament_name} · ` : null;
  const subtitle =
    s.title && s.title !== s.tournament_name
      ? prefix && s.title.startsWith(prefix)
        ? s.title.slice(prefix.length)
        : s.title
      : null;
  const half = (n: 1 | 2) => {
    const side = team(s, n);
    const tone = toneOf(tones, n);
    return (
      <div
        className={cn("relative flex min-w-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden", n === 1 ? "fn-a-slide" : "fn-a-slide-r")}
        style={{ ...wedge(tone, n === 1 ? 110 : 250), clipPath: n === 1 ? slantRight(70) : slantLeft(70), ...delay(100), padding: n === 1 ? "0 90px 0 40px" : "0 40px 0 90px" }}
      >
        <Crest logo={side.logo} code={codeOf(side)} name={side.name} tone={tone} size={210} />
        <span className={cn(DISPLAY, "max-w-full truncate text-center")} style={{ fontSize: "3.25rem", color: tone.text }}>
          {side.name}
        </span>
        <Sheen at={600} width="12%" />
      </div>
    );
  };
  return (
    <FnRoot className="fixed inset-0 z-40 flex items-center justify-center" style={{ padding: `${SAFE.y}px ${SAFE.x}px` }}>
      <section aria-label="Match intro" style={{ ...LIFT, width: 1560 }}>
        <div className="fn-a-rise mb-4 flex items-stretch justify-center">
          <Kicker size="lg" style={{ clipPath: "polygon(14px 0, 100% 0, 100% 100%, 0 100%)" }}>
            {s.tournament_name ?? s.match_format ?? "Match day"}
          </Kicker>
          {subtitle && (
            <span
              className={cn(DISPLAY, "flex max-w-[48rem] items-center truncate px-6")}
              style={{ ...glass(), fontSize: "1.75rem", clipPath: "polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" }}
            >
              {subtitle}
            </span>
          )}
        </div>
        <div className="relative" style={{ clipPath: chamfer(22) }}>
          <div className="relative flex h-[440px] items-stretch" style={glass()}>
            {half(1)}
            {half(2)}
            <span
              className={cn(DISPLAY, "fn-a-pop fn-italic absolute left-1/2 top-1/2 flex h-[120px] w-[120px] items-center justify-center")}
              style={{ ...goldFill(), ...delay(380), marginLeft: -60, marginTop: -60, fontSize: "4.5rem", clipPath: chamfer(16) }}
            >
              v
            </span>
          </div>
          {line && (
            <>
              <GoldRule />
              <div className="flex h-16 items-center justify-center px-10" style={deepGlass()}>
                <span className={cn(TEXT, "truncate font-semibold")} style={{ fontSize: "1.5rem" }}>
                  {line}
                </span>
              </div>
            </>
          )}
        </div>
      </section>
    </FnRoot>
  );
}

function ScorePanel({
  state,
  match,
  inn,
  tones,
  bpo,
  winner,
}: {
  state: LiveMatchState;
  match: Match | null | undefined;
  inn: Innings;
  tones: MatchTones;
  bpo: number;
  winner: boolean;
}) {
  const n = sideOfInnings(state, match, inn);
  const side = team(state, n);
  const tone = toneOf(tones, n);
  return (
    <div
      className="fn-a-rise relative flex min-w-0 flex-1 items-center gap-6 overflow-hidden px-7 py-6"
      style={{ ...glass({ tone, strength: 0.4 }), clipPath: chamfer(14), boxShadow: winner ? `inset 0 0 0 3px ${FN.gold}` : undefined, ...delay(240) }}
    >
      <Crest logo={side.logo} code={codeOf(side)} name={side.name} tone={tone} size={96} />
      <div className="min-w-0 flex-1">
        <span className={cn(DISPLAY, "block truncate")} style={{ fontSize: "2rem" }}>
          {side.name}
        </span>
        <span className={cn(TEXT, "mt-1 block font-semibold")} style={{ fontSize: "1.125rem", color: FN.muted }}>
          {inningsLabel(inn.innings_number)}
        </span>
      </div>
      <span className="shrink-0 text-right leading-none">
        <span className={cn(FIGURE, "block")} style={{ fontSize: "3.5rem" }}>
          {inn.total_runs}/{inn.total_wickets}
        </span>
        <span className={cn(FIGURE, "mt-1 block")} style={{ fontSize: "1.25rem", color: FN.muted, fontWeight: 600 }}>
          {oversText(inn.total_balls, bpo)} ov
        </span>
      </span>
    </div>
  );
}

export function FranchiseResult(p: OverlayElementProps["result"]) {
  const s = p.state;
  if (!s.result_description) return null;
  const tones = matchTones(s);
  const bpo = ballsPerOverOf(p.match);
  const winner = s.winning_team_name === s.team1_name ? 1 : s.winning_team_name === s.team2_name ? 2 : null;
  const lead = winner ?? 1;
  const side = team(s, lead);
  const main = p.innings.filter((i) => i.innings_number <= 2).sort((a, b) => a.innings_number - b.innings_number);
  const potm = p.match?.player_of_the_match;
  return (
    <CardFrame
      label="Result"
      kicker={kickerOf(s, "Result")}
      title={s.result_description}
      tone={toneOf(tones, lead)}
      crest={winner ? { logo: side.logo, code: codeOf(side), name: side.name } : null}
      width={1400}
      footer={
        potm?.full_name && (
          <div className="flex items-center gap-5">
            <PlayerSlot url={potm.avatar_url ?? avatarOf(p.match, potm.id)} name={potm.full_name} tone={toneOf(tones, playerTeamOf(p.match, potm.id) ?? lead)} width={56} height={56} style={{ clipPath: chamfer(8) }} />
            <span className={cn(TEXT, "font-semibold uppercase")} style={{ fontSize: "1.125rem", letterSpacing: "0.08em", color: FN.gold }}>
              Player of the match
            </span>
            <span className={DISPLAY} style={{ fontSize: "1.875rem" }}>
              {potm.full_name}
            </span>
          </div>
        )
      }
    >
      {main.length > 0 && (
        <div className="flex gap-6">
          {main.map((inn) => (
            <ScorePanel
              key={inn.id}
              state={s}
              match={p.match}
              inn={inn}
              tones={tones}
              bpo={bpo}
              winner={winner !== null && sideOfInnings(s, p.match, inn) === winner}
            />
          ))}
        </div>
      )}
    </CardFrame>
  );
}

// ---- summaries -------------------------------------------------------------------------

function LeaderRows({ innings, bpo }: { innings: Innings; bpo: number }) {
  const { batters, bowlers } = inningsLeaders(innings);
  return (
    <div className="grid grid-cols-2 gap-8">
      <ul>
        {batters.map((b, i) => (
          <li key={b.id} className="flex items-baseline gap-3 px-3 py-[6px]" style={rowStyle(i)}>
            <span className={cn(DISPLAY, "min-w-0 flex-1 truncate")} style={{ fontSize: "1.5rem" }}>
              {b.user?.full_name ?? ""}
            </span>
            <span className={FIGURE} style={{ fontSize: "1.625rem" }}>
              {b.runs_scored}
              {!b.is_out && "*"}
            </span>
            <span className={FIGURE} style={{ fontSize: "1.125rem", color: FN.muted, fontWeight: 600, width: "3rem" }}>
              ({b.balls_faced})
            </span>
          </li>
        ))}
      </ul>
      <ul>
        {bowlers.map((b, i) => (
          <li key={b.id} className="flex items-baseline gap-3 px-3 py-[6px]" style={rowStyle(i)}>
            <span className={cn(DISPLAY, "min-w-0 flex-1 truncate")} style={{ fontSize: "1.5rem" }}>
              {b.user?.full_name ?? ""}
            </span>
            <span className={FIGURE} style={{ fontSize: "1.625rem", color: b.wickets_taken > 0 ? FN.gold : FN.white }}>
              {b.wickets_taken}-{b.runs_conceded}
            </span>
            <span className={FIGURE} style={{ fontSize: "1.125rem", color: FN.muted, fontWeight: 600, width: "3rem" }}>
              ({oversText(b.balls_bowled, bpo)})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SummaryCard(p: OverlayElementProps["matchSummary"] & { breakCard?: boolean }) {
  const s = p.state;
  const tones = matchTones(s);
  const bpo = ballsPerOverOf(p.match);
  const shown = p.innings
    .filter((i) => i.innings_number <= (p.breakCard ? 1 : 2))
    .sort((a, b) => a.innings_number - b.innings_number);
  if (!shown.length) return null;
  const first = inningsNo(p.innings, 1);
  const lead = sideOfInnings(s, p.match, shown[0]!);
  const target = first ? first.total_runs + 1 : null;
  const aside = p.breakCard ? (
    target !== null && (
      <span className="block text-right leading-none">
        <span className={cn(TEXT, "block font-semibold uppercase")} style={{ fontSize: "1.125rem", letterSpacing: "0.08em", color: FN.gold }}>
          Target
        </span>
        <span className={cn(FIGURE, "block")} style={{ fontSize: "4rem" }}>
          {target}
        </span>
      </span>
    )
  ) : !s.result_description && s.runs_needed !== null && s.balls_remaining !== null ? (
    <Kicker size="lg">
      Need {s.runs_needed} from {s.balls_remaining}
    </Kicker>
  ) : null;
  return (
    <CardFrame
      label={p.breakCard ? "Innings break" : "Match summary"}
      kicker={kickerOf(s, p.breakCard ? "Innings break" : "Match summary")}
      title={p.breakCard ? "Innings break" : (s.result_description ?? `${s.team1_name} v ${s.team2_name}`)}
      tone={toneOf(tones, p.breakCard ? lead : (s.winning_team_name === s.team2_name ? 2 : 1))}
      width={1500}
      aside={aside}
    >
      <div className="space-y-6">
        {shown.map((inn, i) => {
          const n = sideOfInnings(s, p.match, inn);
          const side = team(s, n);
          const tone = toneOf(tones, n);
          return (
            <div key={inn.id} className="fn-a-rise" style={delay(180 + i * 120)}>
              <div className="mb-2 flex items-center gap-5 overflow-hidden" style={{ ...wedge(tone), clipPath: chamfer(10), padding: "10px 24px" }}>
                <Crest logo={side.logo} code={codeOf(side)} name={side.name} tone={tone} size={52} />
                <span className={cn(DISPLAY, "min-w-0 flex-1 truncate")} style={{ fontSize: "2rem" }}>
                  {side.name}
                </span>
                <span className={FIGURE} style={{ fontSize: "2.5rem" }}>
                  {inn.total_runs}/{inn.total_wickets}
                </span>
                <span className={FIGURE} style={{ fontSize: "1.25rem", color: tone.textMuted, fontWeight: 600 }}>
                  ({oversText(inn.total_balls, bpo)} ov)
                </span>
              </div>
              <LeaderRows innings={inn} bpo={bpo} />
            </div>
          );
        })}
      </div>
    </CardFrame>
  );
}

// ---- partnership, this over, estimate --------------------------------------------------

/** A label over a figure, on a team-colour header. */
function ToneStat({ label, value, tone }: { label: string; value: ReactNode; tone: TeamTone }) {
  return (
    <span className="block text-right leading-none">
      <span className={cn(TEXT, "block font-semibold uppercase")} style={{ fontSize: "1rem", letterSpacing: "0.08em", color: tone.textMuted }}>
        {label}
      </span>
      <span className={cn(FIGURE, "mt-1.5 block")} style={{ fontSize: "2.75rem", color: tone.text }}>
        {value}
      </span>
    </span>
  );
}

export function PartnershipCard(p: OverlayElementProps["partnership"]) {
  const s = p.state;
  const stand = partnershipOf(s, p.match?.innings ?? []);
  if (!stand) return null;
  const tones = matchTones(s);
  const tone = tones.bat;
  const shares = stand.batters;
  const known = stand.split;
  const total = Math.max(1, shares.reduce((n, x) => n + (x.runs ?? 0), 0));
  const split = p.variant === "split";
  return (
    <CardFrame
      label="Partnership"
      kicker={kickerOf(s, "Partnership")}
      title={`${stand.runs} runs`}
      tone={tone}
      width={1300}
      aside={
        <span className="flex items-end gap-10" style={{ color: tone.text }}>
          <ToneStat label="Balls" value={stand.balls} tone={tone} />
          <ToneStat label="Run rate" value={stand.runRate === null ? "-" : stand.runRate.toFixed(2)} tone={tone} />
        </span>
      }
    >
      <div className={cn("flex items-center gap-8", split && "flex-col items-stretch")}>
        {shares.map((x, i) => (
          <div
            key={i}
            className={cn("fn-a-rise flex min-w-0 flex-1 items-center gap-6", i === 1 && !split && "flex-row-reverse text-right")}
            style={delay(200 + i * 100)}
          >
            {!split && (
              <PlayerSlot url={avatarOf(p.match, x.id)} name={x.name} tone={tone} width={150} height={170} style={{ clipPath: chamfer(12) }} />
            )}
            <div className="min-w-0 flex-1">
              <span className={cn(DISPLAY, "block truncate")} style={{ fontSize: split ? "2rem" : "2.25rem" }}>
                {x.name}
                {i === 0 && <span style={{ color: FN.gold }}> *</span>}
              </span>
              <span className={cn(FIGURE, "mt-2 block")} style={{ fontSize: split ? "2.5rem" : "3.5rem" }}>
                {x.runs ?? "-"}
                {x.balls !== null && (
                  <span style={{ fontSize: "1.5rem", color: FN.muted, fontWeight: 600 }}> ({x.balls})</span>
                )}
              </span>
            </div>
            {split && known && (
              <span className={FIGURE} style={{ fontSize: "2rem", color: FN.gold }}>
                {Math.round(((x.runs ?? 0) / total) * 100)}%
              </span>
            )}
          </div>
        ))}
      </div>
      {known && (
        <div className="mt-6 flex h-6 overflow-hidden" role="img" aria-label={shares.map((x) => `${x.name} ${x.runs}`).join(", ")} style={{ clipPath: chamfer(6) }}>
          <span className="fn-a-grow-x block h-full" style={{ width: `${((shares[0]!.runs ?? 0) / total) * 100}%`, background: `linear-gradient(180deg, ${FN.gold}, ${FN.goldDeep})` }} />
          <span className="block h-full flex-1" style={{ background: `linear-gradient(180deg, ${tone.light}, ${tone.base})` }} />
        </div>
      )}
    </CardFrame>
  );
}

export function ThisOverCard(p: OverlayElementProps["thisOver"]) {
  const s = p.state;
  const tokens = overTokens(s);
  if (!tokens.length) return null;
  const tones = matchTones(s);
  const bpo = ballsPerOverOf(p.match);
  const runs = s.this_over_runs ?? 0;
  const { bowling } = sidesOf(s);
  return (
    <CardFrame
      label="This over"
      kicker={kickerOf(s, `Over ${(s.current_over ?? 0) + 1}`)}
      title={`${runs} ${runs === 1 ? "run" : "runs"} this over`}
      tone={tones.bowl}
      crest={{ logo: bowling.logo, code: codeOf(bowling), name: bowling.name }}
      width={1300}
      aside={<HeaderScore runs={s.total_runs ?? 0} wickets={s.total_wickets ?? 0} overs={oversText(s.total_balls, bpo)} tone={tones.bowl} />}
    >
      <div className="flex justify-center py-4">
        <OverTray tokens={tokens} slots={bpo} size={92} gap={20} />
      </div>
      {s.current_bowler_name && (
        <div className="mt-4 flex items-center gap-10 px-4 py-3" style={{ ...deepGlass(), clipPath: chamfer(10) }}>
          <span className={cn(DISPLAY, "min-w-0 flex-1 truncate")} style={{ fontSize: "2.25rem" }}>
            {s.current_bowler_name}
          </span>
          <Stat label="Figures" value={`${s.bowler_wickets ?? 0}-${s.bowler_runs ?? 0}`} />
          <Stat label="Overs" value={oversText(s.bowler_balls, bpo)} />
          <Stat label="Economy" value={economyText(s.bowler_runs, s.bowler_balls) ?? "-"} />
        </div>
      )}
    </CardFrame>
  );
}

/** The win predictor (a chase) or the projected score (a first innings). */
export function EstimateCard({ state, bpo }: { state: LiveMatchState; bpo: number }) {
  const est = winPredictorFromLive(state);
  const tones = matchTones(state);
  const { batting, bowling } = sidesOf(state);
  if (est?.kind === "chase") {
    const bowlColour = tones.bowl === tones.team2 ? tones.team2Contrast : tones.bowl.light;
    const sides = [
      { side: batting, tone: tones.bat, pct: est.battingPct },
      { side: bowling, tone: tones.bowl, pct: est.bowlingPct },
    ];
    return (
      <CardFrame
        label="Win predictor"
        kicker={kickerOf(state, "Estimate")}
        title="Win predictor"
        tone={tones.bat}
        width={1300}
        aside={<Kicker size="lg">Need {est.runsNeeded} from {est.ballsLeft}</Kicker>}
        footer={
          <p className={cn(TEXT, "font-semibold")} style={{ fontSize: "1.125rem", color: FN.muted }}>
            From the runs needed, balls and wickets left, against the first innings&apos; scoring rate.
          </p>
        }
      >
        <div className="flex items-center justify-between gap-10 py-2">
          {sides.map((x, i) => (
            <div key={i} className={cn("fn-a-rise flex items-center gap-6", i === 1 && "flex-row-reverse")} style={delay(200 + i * 80)}>
              <Crest logo={x.side.logo} code={codeOf(x.side)} name={x.side.name} tone={x.tone} size={120} />
              <span className={cn("leading-none", i === 1 && "text-right")}>
                <span className={cn(FIGURE, "block")} style={{ fontSize: "5rem" }}>
                  <AnimatedNumber value={x.pct} />%
                </span>
                <span className={cn(DISPLAY, "mt-1 block")} style={{ fontSize: "1.75rem", color: FN.muted }}>
                  {codeOf(x.side)}
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex h-8 overflow-hidden" role="img" aria-label={`${codeOf(batting)} ${est.battingPct} percent, ${codeOf(bowling)} ${est.bowlingPct} percent`} style={{ clipPath: chamfer(8) }}>
          <span className="fn-a-grow-x block h-full" style={{ width: `${est.battingPct}%`, background: `linear-gradient(180deg, ${tones.bat.light}, ${tones.bat.base})` }} />
          <span className="block h-full flex-1" style={{ background: `linear-gradient(180deg, ${bowlColour}, ${tones.bowl.deep})` }} />
        </div>
      </CardFrame>
    );
  }
  const rates = projectedTotals(state, bpo);
  const range = est?.kind === "projection" ? est : null;
  if (!range && !rates.length) return null;
  return (
    <CardFrame
      label="Projected score"
      kicker={kickerOf(state, "Estimate")}
      title="Projected score"
      tone={tones.bat}
      crest={{ logo: batting.logo, code: codeOf(batting), name: batting.name }}
      width={1300}
      aside={<HeaderScore runs={state.total_runs ?? 0} wickets={state.total_wickets ?? 0} overs={oversText(state.total_balls, bpo)} tone={tones.bat} />}
    >
      {range && (
        <div className="fn-a-rise mb-6 flex items-baseline justify-center gap-6" style={delay(200)}>
          <span className={FIGURE} style={{ fontSize: "6rem" }}>
            {range.low}
          </span>
          <span className={DISPLAY} style={{ fontSize: "2.5rem", color: FN.muted }}>
            to
          </span>
          <span className={FIGURE} style={{ fontSize: "6rem" }}>
            {range.high}
          </span>
        </div>
      )}
      {rates.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${rates.length}, minmax(0, 1fr))` }}>
          {rates.map((r, i) => (
            <div key={r.label} className="fn-a-rise flex flex-col items-center gap-2 px-4 py-4" style={{ ...(r.current ? { ...goldFill() } : deepGlass()), clipPath: chamfer(10), ...delay(260 + i * 60) }}>
              <span className={cn(TEXT, "font-semibold uppercase")} style={{ fontSize: "1rem", letterSpacing: "0.08em", color: r.current ? FN.goldText : FN.muted }}>
                {r.current ? `Now (${r.rate.toFixed(2)})` : `${r.label} an over`}
              </span>
              <span className={FIGURE} style={{ fontSize: "3rem" }}>
                {r.total}
              </span>
            </div>
          ))}
        </div>
      )}
    </CardFrame>
  );
}

// ---- breaks: the timeout card -----------------------------------------------------------

function StateOfPlay({ state, bpo, kind }: { state: LiveMatchState; bpo: number; kind: BreakKind }) {
  const tones = matchTones(state);
  const { batting } = sidesOf(state);
  const chasing = state.target_runs !== null && (state.runs_needed ?? 0) > 0;
  const limit = inningsBalls(state, bpo);
  const proj = projectedTotals(state, bpo)[0];
  const cols: ReactNode[] = [];
  cols.push(
    <div key="score" className="flex items-center gap-6">
      <Crest logo={batting.logo} code={codeOf(batting)} name={batting.name} tone={tones.bat} size={104} />
      <span className="leading-none">
        <span className={cn(DISPLAY, "block")} style={{ fontSize: "1.75rem", color: FN.muted }}>
          {codeOf(batting)}
        </span>
        <span className={cn(FIGURE, "mt-1 block")} style={{ fontSize: "4.5rem" }}>
          {state.total_runs ?? 0}/{state.total_wickets ?? 0}
        </span>
        <span className={cn(FIGURE, "mt-1 block")} style={{ fontSize: "1.375rem", color: FN.muted, fontWeight: 600 }}>
          {oversText(state.total_balls, bpo)}
          {limit !== null && ` of ${Math.round(limit / bpo)}`} overs
        </span>
      </span>
    </div>,
  );
  const rates: ReactNode[] = [];
  if (kind === "powerplay" && state.powerplay) {
    rates.push(<Stat key="pp" label="Powerplay" value={`Overs 1 to ${state.powerplay.end_over}`} size="sm" accent />);
  }
  // The chase reads first: need, required rate; then the scoring rate.
  if (chasing) {
    rates.push(<Stat key="need" label="Need" value={`${state.runs_needed} from ${state.balls_remaining}`} accent />);
    if (state.required_run_rate !== null) rates.push(<Stat key="rrr" label="Required rate" value={state.required_run_rate.toFixed(2)} />);
    if (state.target_runs !== null) rates.push(<Stat key="target" label="Target" value={state.target_runs} />);
  }
  if (state.current_run_rate !== null) rates.push(<Stat key="crr" label="Run rate" value={state.current_run_rate.toFixed(2)} />);
  if (!chasing && proj) {
    rates.push(<Stat key="proj" label="Projected (now)" value={proj.total} accent />);
  }
  if (!chasing && (state.partnership_runs ?? 0) > 0) {
    rates.push(<Stat key="stand" label="Partnership" value={`${state.partnership_runs} (${state.partnership_balls ?? 0})`} />);
  }
  cols.push(
    <div key="rates" className="grid grid-cols-2 gap-x-10 gap-y-4">
      {rates}
    </div>,
  );
  const crease = [
    state.striker_name && { name: state.striker_name, fig: `${state.striker_runs ?? 0} (${state.striker_balls ?? 0})`, mark: true },
    state.non_striker_name && { name: state.non_striker_name, fig: `${state.non_striker_runs ?? 0} (${state.non_striker_balls ?? 0})`, mark: false },
    state.current_bowler_name && {
      name: state.current_bowler_name,
      fig: `${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0} (${oversText(state.bowler_balls, bpo)})`,
      mark: false,
    },
  ].filter(Boolean) as Array<{ name: string; fig: string; mark: boolean }>;
  if (crease.length) {
    cols.push(
      <ul key="crease" className="min-w-0 space-y-1">
        {crease.map((c, i) => (
          <li key={i} className="flex items-baseline gap-3 px-3 py-[6px]" style={rowStyle(i)}>
            <span className={cn(DISPLAY, "min-w-0 flex-1 truncate")} style={{ fontSize: "1.5rem", color: i === 2 ? FN.muted : FN.white }}>
              {c.name}
              {c.mark && <span style={{ color: FN.gold }}> *</span>}
            </span>
            <span className={FIGURE} style={{ fontSize: "1.5rem" }}>
              {c.fig}
            </span>
          </li>
        ))}
      </ul>,
    );
  }
  return (
    <div className="grid items-center gap-10" style={{ gridTemplateColumns: cols.length === 3 ? "auto 1fr 1.15fr" : "auto 1fr" }}>
      {cols.map((c, i) => (
        <div key={i} className="fn-a-rise min-w-0" style={delay(260 + i * 90)}>
          {c}
        </div>
      ))}
    </div>
  );
}

/**
 * A stoppage card in the style of a strategic timeout: the break's name
 * huge on the batting side's colours, then the state of play.
 */
export function BreakCard(p: OverlayElementProps["breakStrap"]) {
  const s = p.state;
  const kind = p.kind;
  if (kind === "powerplay" && !s.powerplay) return null;
  const copy = BREAK_COPY[kind];
  const tones = matchTones(s);
  const bpo = ballsPerOverOf(p.match);
  const first = inningsNo(p.match?.innings ?? [], 1);
  const breakNow = kind === "innings_break";
  const target = s.target_runs ?? (s.innings_completed && s.total_runs !== null ? s.total_runs + 1 : first ? first.total_runs + 1 : null);
  const body =
    breakNow && first ? (
      <div className="flex items-center justify-between gap-10">
        <div className="flex items-center gap-6">
          {(() => {
            const n = sideOfInnings(s, p.match, first);
            const side = team(s, n);
            return (
              <>
                <Crest logo={side.logo} code={codeOf(side)} name={side.name} tone={toneOf(tones, n)} size={104} />
                <span className="leading-none">
                  <span className={cn(DISPLAY, "block")} style={{ fontSize: "1.75rem", color: FN.muted }}>
                    {side.name}
                  </span>
                  <span className={cn(FIGURE, "mt-1 block")} style={{ fontSize: "4.5rem" }}>
                    {first.total_runs}/{first.total_wickets}
                  </span>
                  <span className={cn(FIGURE, "mt-1 block")} style={{ fontSize: "1.375rem", color: FN.muted, fontWeight: 600 }}>
                    {oversText(first.total_balls, bpo)} overs
                  </span>
                </span>
              </>
            );
          })()}
        </div>
        {target !== null && (
          <div className="flex flex-col items-center gap-1 px-10 py-4" style={{ ...goldFill(), clipPath: chamfer(14) }}>
            <span className={cn(TEXT, "font-semibold uppercase")} style={{ fontSize: "1.25rem", letterSpacing: "0.08em" }}>
              Target
            </span>
            <span className={FIGURE} style={{ fontSize: "5rem" }}>
              {target}
            </span>
          </div>
        )}
      </div>
    ) : (s.total_balls ?? 0) > 0 || s.total_runs ? (
      <StateOfPlay state={s} bpo={bpo} kind={kind} />
    ) : null;
  const note =
    kind === "rain_delay"
      ? "Play resumes when the ground is fit"
      : kind === "timeout" || kind === "drinks"
        ? "Play resumes shortly"
        : null;
  return (
    <FnRoot className="fixed inset-0 z-40 flex items-center justify-center" style={{ padding: `${SAFE.y}px ${SAFE.x}px` }}>
      <section aria-label={copy.title} style={{ ...LIFT, width: 1440 }}>
        <div className="relative" style={{ clipPath: chamfer(22) }}>
          <div className="fn-a-wipe relative flex h-[220px] flex-col items-center justify-center gap-4 overflow-hidden" style={wedge(tones.bat, 100)}>
            {/* Stripes of light across the band. */}
            <span aria-hidden="true" className="absolute inset-0" style={{ background: "repeating-linear-gradient(115deg, rgba(255,255,255,0.06) 0 24px, transparent 24px 64px)" }} />
            <span className="fn-a-rise relative" style={delay(150)}>
              <Kicker size="lg">{kickerOf(s, copy.kicker)}</Kicker>
            </span>
            <h2
              className={cn(DISPLAY, "fn-a-pop fn-italic relative whitespace-nowrap")}
              style={{ ...delay(240), fontSize: "6.5rem", color: tones.bat.text, textShadow: "0 5px 0 rgba(0,0,0,0.25)" }}
            >
              {p.strap?.title || copy.title}
            </h2>
            <Sheen at={700} width="10%" />
          </div>
          <GoldRule />
          {body && (
            <div style={{ ...glass({ tone: tones.bat, from: "0% 0%", strength: 0.2 }), padding: "28px 44px" }}>
              {body}
            </div>
          )}
          {note && (
            <div className="flex h-14 items-center justify-center" style={deepGlass()}>
              <span className={cn(TEXT, "font-semibold")} style={{ fontSize: "1.375rem", color: FN.muted }}>
                {note}
              </span>
            </div>
          )}
        </div>
      </section>
    </FnRoot>
  );
}

