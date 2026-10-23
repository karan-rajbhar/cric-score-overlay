"use client";

/**
 * Test classic full-screen cards, in the scorecard tradition: the batting
 * card (with "how out", extras, the total, who is yet to bat and the fall
 * of wickets in the "1-23 (Mehta, 4.2 ov)" form), the bowling card
 * (O M R W Econ Wd Nb), the fall of wickets on a ruler, partnerships,
 * this over, the toss, the line-ups, the introduction, standings,
 * leaders, the next fixture, the result, summaries and the estimates.
 */

import type { CSSProperties, ReactNode } from "react";
import type { Innings, Match, TeamPlayer } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { winPredictorFromLive } from "~/lib/win-predictor";
import { eyebrowOf, oversText, overTokens, teamCode } from "../../overlay-kit";
import { playingXi, tossWinnerName } from "../../presentation-card-views";
import { ballsPerOverOf, sidesOf } from "../../score-bug";
import { inningsTeamName } from "../../scorecard-cards";
import { strapText } from "../../strap-views";
import type { LiveMatchState } from "../../types";
import type { OverlayElementProps } from "../types";
import {
  BallTray,
  CardShell,
  Crest,
  delay,
  DROP,
  Fig,
  FIGS,
  GOLD_LEAF,
  GoldRule,
  IVORY,
  Label,
  NAVY,
  RADIUS,
  SERIF,
  TC,
  TcRoot,
  useLocalStart,
} from "./kit";
import {
  battingRows,
  bowlingFigures,
  currentStand,
  economy,
  extrasParts,
  fallOfWickets,
  howOut,
  inningsTitle,
  isMultiInnings,
  ordinal,
  partnershipRows,
  plural,
  scoreText,
  standingOf,
  strikeRate,
  playerNames,
  surname,
  thisOverRuns,
  totalDetail,
  yetToBat,
  type StandRow,
} from "./logic";
import { ChanceBar } from "./strap-elements";

type P<E extends keyof OverlayElementProps> = OverlayElementProps[E];

/** The card's root (fonts, motion); the shell positions itself. */
function Card({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <TcRoot data-card={label} className="fixed inset-0 z-40">
      {children}
    </TcRoot>
  );
}

/** The score as a card's head shows it: big figures, overs under them. */
function HeadScore({
  innings,
  bpo,
  note,
}: {
  innings: Innings;
  bpo: number;
  note?: string;
}) {
  return (
    <span className="flex flex-col items-end gap-2">
      <Fig className="text-[3rem]" style={{ color: TC.ivoryHi }}>
        {scoreText(innings.total_runs, innings.total_wickets)}
      </Fig>
      <span className="text-[1.125rem] font-medium" style={{ color: "rgba(243,236,218,0.75)", ...FIGS }}>
        {note ?? `${oversText(innings.total_balls, bpo)} overs`}
      </span>
    </span>
  );
}

const TH = "px-3 pb-2.5 text-right";
const TD = "px-3 text-right text-[1.375rem] font-semibold";

function Th({
  children,
  left = false,
  className,
  plain = false,
}: {
  children: ReactNode;
  left?: boolean;
  className?: string;
  /** Keep the case ("4s", "6s"). */
  plain?: boolean;
}) {
  return (
    <th scope="col" className={cn(TH, left && "text-left", className)}>
      <Label className={plain ? "normal-case tracking-[0.06em]" : undefined} style={{ color: TC.inkMuted }}>
        {children}
      </Label>
    </th>
  );
}

/** One table row: a faint band on even rows, a hairline under each. */
function rowStyle(i: number, highlight = false): CSSProperties {
  return {
    height: 46,
    background: highlight
      ? "rgba(16, 37, 74, 0.09)"
      : i % 2 === 1
        ? "rgba(110, 90, 50, 0.06)"
        : "transparent",
    borderBottom: `1px solid ${TC.ivoryLine}`,
    ...delay(260 + i * 45),
  };
}

// ---- batting and bowling ---------------------------------------------------------

function BattingTable({
  innings,
  state,
  match,
}: {
  innings: Innings;
  state: LiveMatchState;
  match: Match | null;
}) {
  const rows = battingRows(innings);
  const names = playerNames(innings, match);
  const atCrease = new Set(
    [state.striker_id, state.non_striker_id].filter(Boolean) as string[],
  );
  const live = innings.innings_number === state.innings_number && !innings.is_completed;
  return (
    <table className="w-full border-collapse" style={{ color: TC.ink }}>
      <thead>
        <tr style={{ borderBottom: `2px solid ${TC.ink}` }}>
          <Th left>Batter</Th>
          <Th left>
            <span className="sr-only">How out</span>
          </Th>
          <Th>R</Th>
          <Th>B</Th>
          <Th plain>4s</Th>
          <Th plain>6s</Th>
          <Th>SR</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((b, i) => {
          const inNow = live && (atCrease.has(b.user_id) || !!b.is_current_batsman) && !b.is_out;
          return (
            <tr key={b.id} className="tc-a-fade" style={rowStyle(i, inNow)}>
              <td className="max-w-[20rem] truncate px-3 text-left text-[1.375rem] font-semibold">
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="h-5 w-1.5 shrink-0 rounded-[1px]"
                    style={{ background: inNow ? TC.navy : "transparent" }}
                  />
                  <span className="truncate">{b.user?.full_name ?? ""}</span>
                </span>
              </td>
              <td
                className="max-w-[22rem] truncate px-3 text-left text-[1.1875rem] italic"
                style={{ fontFamily: SERIF, color: TC.inkMuted }}
              >
                {howOut(b, innings.fall_of_wickets, names)}
              </td>
              <td className={TD}>
                <Fig className="text-[1.5rem]">
                  {b.runs_scored}
                  {!b.is_out && <span style={{ color: TC.inkMuted }}>*</span>}
                </Fig>
              </td>
              <td className={TD} style={FIGS}>{b.balls_faced}</td>
              <td className={TD} style={FIGS}>{b.fours}</td>
              <td className={TD} style={FIGS}>{b.sixes}</td>
              <td className={cn(TD, "font-medium")} style={{ ...FIGS, color: TC.inkMuted }}>
                {strikeRate(b.runs_scored, b.balls_faced) ?? "–"}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr style={{ height: 44 }}>
          <td className="px-3 text-left text-[1.25rem] font-semibold">Extras</td>
          <td className="px-3 text-left text-[1.125rem]" style={{ color: TC.inkMuted, ...FIGS }}>
            ({extrasParts(innings)})
          </td>
          <td className={TD} style={FIGS}>{innings.extras_total ?? 0}</td>
          <td colSpan={4} />
        </tr>
        <tr style={{ height: 50, borderTop: `2px solid ${TC.ink}` }}>
          <td className="px-3 text-left">
            <Label style={{ color: TC.ink }}>Total</Label>
          </td>
          <td className="px-3 text-left text-[1.125rem]" style={{ color: TC.inkMuted, ...FIGS }}>
            ({totalDetail(innings)})
          </td>
          <td className={TD}>
            <Fig className="text-[1.75rem]">{innings.total_runs}</Fig>
          </td>
          <td colSpan={4} />
        </tr>
      </tfoot>
    </table>
  );
}

function BowlingTable({ innings, bpo }: { innings: Innings; bpo: number }) {
  const rows = (innings.bowling_performances ?? []).filter(
    (b) => b.balls_bowled > 0 || b.is_current_bowler,
  );
  return (
    <table className="w-full border-collapse" style={{ color: TC.ink }}>
      <thead>
        <tr style={{ borderBottom: `2px solid ${TC.ink}` }}>
          <Th left>Bowler</Th>
          <Th>O</Th>
          <Th>M</Th>
          <Th>R</Th>
          <Th>W</Th>
          <Th>Econ</Th>
          <Th>Wd</Th>
          <Th>Nb</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((b, i) => (
          <tr key={b.id} className="tc-a-fade" style={rowStyle(i, !!b.is_current_bowler && !innings.is_completed)}>
            <td className="max-w-[18rem] truncate px-3 text-left text-[1.375rem] font-semibold">
              {b.user?.full_name ?? ""}
            </td>
            <td className={TD} style={FIGS}>{oversText(b.balls_bowled, bpo)}</td>
            <td className={TD} style={FIGS}>{b.maidens}</td>
            <td className={TD} style={FIGS}>{b.runs_conceded}</td>
            <td className={TD}>
              <Fig className="text-[1.5rem]">{b.wickets_taken}</Fig>
            </td>
            <td className={cn(TD, "font-medium")} style={{ ...FIGS, color: TC.inkMuted }}>
              {economy(b.runs_conceded, b.balls_bowled, bpo) ?? "–"}
            </td>
            <td className={cn(TD, "font-medium")} style={{ ...FIGS, color: TC.inkMuted }}>{b.wides}</td>
            <td className={cn(TD, "font-medium")} style={{ ...FIGS, color: TC.inkMuted }}>{b.no_balls}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** "Fall of wickets 1-23 (Mehta, 4.2 ov), 2-45 (...)". */
function FowLine({ innings }: { innings: Innings }) {
  const fow = fallOfWickets(innings);
  if (!fow.length) return null;
  return (
    <p className="tc-a-fade text-[1.1875rem] leading-relaxed" style={{ color: TC.ink, ...FIGS, ...delay(700) }}>
      <Label className="mr-3" style={{ color: TC.inkMuted }}>
        Fall of wickets
      </Label>
      {fow.map((f, i) => (
        <span key={f.wicket} className="whitespace-nowrap">
          {i > 0 && ", "}
          <strong className="font-semibold">
            {f.wicket}-{f.runs}
          </strong>{" "}
          <span style={{ color: TC.inkMuted }}>
            ({surname(f.batter)}, {f.overs} ov)
          </span>
        </span>
      ))}
    </p>
  );
}

function YetToBat({ innings, match }: { innings: Innings; match: Match | null }) {
  const names = yetToBat(innings, match);
  if (!names.length) return null;
  return (
    <p className="tc-a-fade truncate text-[1.1875rem]" style={{ color: TC.ink, ...delay(650) }}>
      <Label className="mr-3" style={{ color: TC.inkMuted }}>
        {innings.is_completed ? "Did not bat" : "Yet to bat"}
      </Label>
      {names.join(", ")}
    </p>
  );
}

function eyebrowFor(state: LiveMatchState, innings: Innings, extra?: string) {
  const title = inningsTitle(innings.innings_number, state.match_format);
  return eyebrowOf(state, extra ? `${title} · ${extra}` : title);
}

export function ScorecardCard(p: P<"scorecard">) {
  const { state, innings, match } = p;
  const bpo = ballsPerOverOf(match);
  const full = p.full;
  return (
    <Card label="scorecard">
      <CardShell
        label={`${p.teamName} batting`}
        width={full ? 1728 : 1360}
        eyebrow={eyebrowFor(state, innings)}
        title={`${p.teamName} batting`}
        aside={<HeadScore innings={innings} bpo={bpo} />}
        bodyClassName="py-6"
      >
        {full ? (
          <div className="grid grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] gap-10">
            <div className="min-w-0 space-y-3">
              <BattingTable innings={innings} state={state} match={match} />
              <YetToBat innings={innings} match={match} />
            </div>
            <div className="min-w-0">
              <BowlingTable innings={innings} bpo={bpo} />
            </div>
            <div className="col-span-2 border-t pt-3" style={{ borderColor: TC.ivoryLine }}>
              <FowLine innings={innings} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <BattingTable innings={innings} state={state} match={match} />
            <YetToBat innings={innings} match={match} />
            <FowLine innings={innings} />
          </div>
        )}
      </CardShell>
    </Card>
  );
}

export function BowlingCard(p: P<"bowlingCard">) {
  const { state, innings, match } = p;
  const bpo = ballsPerOverOf(match);
  if (!(innings.bowling_performances ?? []).some((b) => b.balls_bowled > 0 || b.is_current_bowler)) {
    return null;
  }
  return (
    <Card label="bowling">
      <CardShell
        label={`${p.teamName} bowling`}
        width={1240}
        eyebrow={eyebrowFor(state, innings)}
        title={`${p.teamName} bowling`}
        aside={<HeadScore innings={innings} bpo={bpo} />}
      >
        <BowlingTable innings={innings} bpo={bpo} />
        <p className="tc-a-fade mt-4 text-[1.1875rem]" style={{ color: TC.inkMuted, ...FIGS, ...delay(600) }}>
          Extras {innings.extras_total ?? 0} ({extrasParts(innings)})
        </p>
      </CardShell>
    </Card>
  );
}

// ---- fall of wickets -----------------------------------------------------------

export function FallOfWicketsCard(p: P<"fallOfWickets">) {
  const { state, innings, match } = p;
  const fow = fallOfWickets(innings);
  if (!fow.length) return null;
  const bpo = ballsPerOverOf(match);
  const total = Math.max(innings.total_runs, fow[fow.length - 1]!.runs, 1);
  return (
    <Card label="fall-of-wickets">
      <CardShell
        label={`${p.teamName} fall of wickets`}
        width={1500}
        eyebrow={eyebrowFor(state, innings)}
        title={`${p.teamName} fall of wickets`}
        aside={<HeadScore innings={innings} bpo={bpo} />}
      >
        {/* The innings as a ruler: each wicket where it fell. */}
        <div className="relative mx-4 mb-8 mt-12 h-[5.5rem]" aria-hidden="true">
          <div
            className="tc-a-grow absolute inset-x-0 top-[2.75rem] h-2 rounded-full"
            style={{ background: `linear-gradient(90deg, ${TC.navy}, ${TC.navyHi})`, ...delay(250) }}
          />
          {fow.map((f, i) => {
            const left = `${(f.runs / total) * 100}%`;
            const above = i % 2 === 0;
            return (
              <div
                key={f.wicket}
                className="tc-a-fade absolute top-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left, ...delay(500 + i * 90) }}
              >
                <span className={cn("text-[1.125rem] font-bold leading-none", above ? "" : "invisible")} style={{ fontFamily: SERIF, ...FIGS }}>
                  {f.wicket}-{f.runs}
                </span>
                <span
                  className="mt-2 h-6 w-6 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, ${TC.claretHi}, #5e121c)`,
                    boxShadow: "0 0 0 2px #fdf9ef, 0 2px 4px rgba(0,0,0,0.3)",
                  }}
                />
                <span className={cn("mt-2 text-[1.125rem] font-bold leading-none", above ? "invisible" : "")} style={{ fontFamily: SERIF, ...FIGS }}>
                  {f.wicket}-{f.runs}
                </span>
              </div>
            );
          })}
          <span className="absolute -bottom-1 left-0 text-[1rem]" style={{ color: TC.inkMuted, ...FIGS }}>0</span>
          <span className="absolute -bottom-1 right-0 text-[1rem]" style={{ color: TC.inkMuted, ...FIGS }}>{total}</span>
        </div>
        <table className="w-full border-collapse" style={{ color: TC.ink }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${TC.ink}` }}>
              <Th left>Score</Th>
              <Th left>Batter</Th>
              <Th>Overs</Th>
              <Th>Stand</Th>
            </tr>
          </thead>
          <tbody>
            {fow.map((f, i) => (
              <tr key={f.wicket} className="tc-a-fade" style={{ ...rowStyle(i), height: 42 }}>
                <td className="px-3 text-left">
                  <Fig className="text-[1.5rem]">
                    {f.wicket}-{f.runs}
                  </Fig>
                </td>
                <td className="max-w-[30rem] truncate px-3 text-left text-[1.375rem] font-semibold">{f.batter}</td>
                <td className={TD} style={FIGS}>{f.overs}</td>
                <td className={cn(TD, "font-medium")} style={{ ...FIGS, color: TC.inkMuted }}>
                  {f.stand ?? "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardShell>
    </Card>
  );
}

// ---- partnerships ----------------------------------------------------------------

/** The stand split between its batters, from the centre outwards. */
function SplitBar({ stand, height = 18, d = 400 }: { stand: StandRow; height?: number; d?: number }) {
  const a = stand.a.runs ?? 0;
  const b = stand.b.runs ?? 0;
  const max = Math.max(a, b, 1);
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      <div className="flex flex-1 justify-end">
        <div
          className="tc-a-grow-r rounded-l-[2px]"
          style={{ width: `${(a / max) * 100}%`, height, background: `linear-gradient(180deg, ${TC.navyHi}, ${TC.navy})`, ...delay(d) }}
        />
      </div>
      <span className="h-8 w-[3px] shrink-0" style={{ background: GOLD_LEAF }} />
      <div className="flex flex-1">
        <div
          className="tc-a-grow rounded-r-[2px]"
          style={{ width: `${(b / max) * 100}%`, height, background: `linear-gradient(180deg, #b48d3c, ${TC.goldDeep})`, ...delay(d) }}
        />
      </div>
    </div>
  );
}

function StandHalf({
  name,
  runs,
  balls,
  align,
}: {
  name: string;
  runs: number | null;
  balls: number | null;
  align: "left" | "right";
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", align === "right" && "items-end text-right")}>
      <span className="max-w-full truncate text-[1.75rem] font-semibold">{name}</span>
      {runs !== null && (
        <span className="flex items-baseline gap-2">
          <Fig className="text-[3rem]">{runs}</Fig>
          <span className="text-[1.25rem]" style={{ color: TC.inkMuted, ...FIGS }}>
            ({balls ?? 0})
          </span>
        </span>
      )}
    </div>
  );
}

export function PartnershipCard(p: P<"partnership">) {
  const { state, match } = p;
  const stand = currentStand(state, match);
  if (!stand && (state.partnership_runs === null || state.partnership_runs === undefined)) {
    return null;
  }
  const runs = stand?.runs ?? state.partnership_runs ?? 0;
  const balls = stand?.balls ?? state.partnership_balls ?? 0;
  const innings = match?.innings?.find((i) => i.innings_number === state.innings_number);
  const all = p.variant === "card" && innings ? partnershipRows(innings) : [];
  const maxRuns = Math.max(1, ...all.map((r) => r.runs));
  const wicket = (state.total_wickets ?? 0) + 1;
  const a = stand?.a ?? { name: state.striker_name ?? "", runs: null, balls: null };
  const b = stand?.b ?? { name: state.non_striker_name ?? "", runs: null, balls: null };
  return (
    <Card label="partnership">
      <CardShell
        label="Partnership"
        width={p.variant === "card" ? 1400 : 1180}
        eyebrow={eyebrowOf(state, `Partnership · ${ordinal(wicket)} wicket`)}
        title={`${runs} runs off ${plural(balls, "ball")}`}
        aside={
          <span className="flex flex-col items-end gap-2">
            <Label style={{ color: TC.goldText }}>Run rate</Label>
            <Fig className="text-[2.25rem]" style={{ color: TC.ivoryHi }}>
              {economy(runs, balls) ?? "–"}
            </Fig>
          </span>
        }
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-8">
          <StandHalf name={a.name} runs={a.runs} balls={a.balls} align="left" />
          <span className="pb-2 text-[1.5rem] italic" style={{ fontFamily: SERIF, color: TC.inkMuted }}>
            and
          </span>
          <StandHalf name={b.name} runs={b.runs} balls={b.balls} align="right" />
        </div>
        {stand && (stand.a.runs !== null || stand.b.runs !== null) && (
          <div className="mt-5">
            <SplitBar stand={stand} />
          </div>
        )}
        {all.length > 1 && (
          <div className="mt-7 border-t pt-5" style={{ borderColor: TC.ivoryLine }}>
            <Label style={{ color: TC.inkMuted }}>Partnerships this innings</Label>
            <ol className="mt-3 space-y-1.5">
              {all.map((r, i) => (
                <li
                  key={i}
                  className="tc-a-fade grid grid-cols-[7rem_5.5rem_minmax(0,1fr)_minmax(0,22rem)] items-center gap-4"
                  style={{ height: 34, ...delay(500 + i * 50) }}
                >
                  <span className="text-[1.125rem] font-semibold" style={{ color: r.current ? TC.navy : TC.inkMuted }}>
                    {r.label}
                  </span>
                  <span className="text-right">
                    <Fig className="text-[1.375rem]">{r.runs}</Fig>
                    <span className="ml-1.5 text-[1rem]" style={{ color: TC.inkMuted, ...FIGS }}>
                      ({r.balls})
                    </span>
                  </span>
                  <span className="h-3.5 overflow-hidden rounded-[2px]" style={{ background: "rgba(110,90,50,0.1)" }}>
                    <span
                      className="tc-a-grow block h-full"
                      style={{
                        width: `${(r.runs / maxRuns) * 100}%`,
                        background: r.current ? GOLD_LEAF : `linear-gradient(180deg, ${TC.navyHi}, ${TC.navy})`,
                        ...delay(560 + i * 50),
                      }}
                    />
                  </span>
                  <span className="truncate text-[1.125rem]" style={{ color: TC.ink }}>
                    {surname(r.a.name)} &amp; {surname(r.b.name)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardShell>
    </Card>
  );
}

// ---- this over -----------------------------------------------------------------

export function ThisOverCard(p: P<"thisOver">) {
  const { state, match } = p;
  const tokens = overTokens(state);
  if (!tokens.length && state.this_over_runs === null) return null;
  const bpo = ballsPerOverOf(match);
  const over = (state.current_over ?? 0) + (tokens.length ? 1 : 0);
  const runs = thisOverRuns(tokens, state.this_over_runs) ?? 0;
  return (
    <Card label="this-over">
      <CardShell
        label="This over"
        width={1100}
        eyebrow={eyebrowOf(state, `Over ${over}`)}
        title={`${plural(runs, "run")} this over`}
        aside={
          <span className="flex flex-col items-end gap-2">
            <Fig className="text-[3rem]" style={{ color: TC.ivoryHi }}>
              {scoreText(state.total_runs, state.total_wickets)}
            </Fig>
            <span className="text-[1.125rem]" style={{ color: "rgba(243,236,218,0.75)", ...FIGS }}>
              {oversText(state.total_balls, bpo)} overs
            </span>
          </span>
        }
      >
        <div className="flex justify-center py-3">
          <BallTray tokens={tokens} slots={bpo} size={72} light className="gap-4" />
        </div>
        {state.current_bowler_name && (
          <div className="mt-6 flex items-baseline justify-between border-t pt-5" style={{ borderColor: TC.ivoryLine }}>
            <span className="flex items-baseline gap-4">
              <Label style={{ color: TC.inkMuted }}>Bowler</Label>
              <span className="text-[1.75rem] font-semibold">{state.current_bowler_name}</span>
            </span>
            <Fig className="text-[2rem]">
              {bowlingFigures(state.bowler_balls, state.bowler_maidens, state.bowler_runs, state.bowler_wickets, bpo)}
            </Fig>
          </div>
        )}
      </CardShell>
    </Card>
  );
}

// ---- before the start ----------------------------------------------------------

function TeamMedallion({
  name,
  short,
  logo,
  side,
  size = 132,
  note,
  crown = false,
}: {
  name: string | null;
  short: string | null;
  logo: string | null | undefined;
  side: 1 | 2;
  size?: number;
  note?: ReactNode;
  crown?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-4">
      <span className="rounded-full p-1.5" style={crown ? { background: GOLD_LEAF } : undefined}>
        <Crest logoUrl={logo} code={teamCode(short, name)} name={name} size={size} colour={side === 2 ? "var(--tc-team2)" : "var(--tc-team1)"} />
      </span>
      <span className="max-w-full truncate text-[2rem] font-bold" style={{ fontFamily: SERIF }}>
        {name}
      </span>
      {note}
    </div>
  );
}

function officialsLine(state: LiveMatchState): string | null {
  if (!state.umpire1_name) return null;
  return `Umpires ${state.umpire1_name}${state.umpire2_name ? ` and ${state.umpire2_name}` : ""}`;
}

export function TossCard(p: P<"toss">) {
  const { state, match } = p;
  const winner = tossWinnerName(state, match);
  if (!winner || !state.toss_decision) return null;
  const chose = state.toss_decision === "bowl" ? "bowl" : "bat";
  const won1 = winner === state.team1_name;
  const foot = [state.venue, officialsLine(state)].filter(Boolean) as string[];
  return (
    <Card label="toss">
      <CardShell
        label="Toss"
        width={1240}
        eyebrow={eyebrowOf(state, "The toss")}
        title={`${winner} won the toss`}
        aside={
          <span className="text-[2rem] italic" style={{ fontFamily: SERIF, color: TC.goldText }}>
            and chose to {chose}
          </span>
        }
        foot={
          foot.length ? (
            <span className="truncate" style={{ color: "rgba(243,236,218,0.85)" }}>
              {foot.join("  ·  ")}
            </span>
          ) : undefined
        }
      >
        <div className="flex items-center justify-around gap-10 py-4">
          <TeamMedallion
            name={state.team1_name}
            short={state.team1_short_name}
            logo={state.team1_logo_url}
            side={1}
            crown={won1}
            note={won1 ? <Label style={{ color: TC.goldDeep }}>Won the toss</Label> : <span className="h-4" />}
          />
          <span className="text-[2.5rem] italic" style={{ fontFamily: SERIF, color: TC.inkMuted }}>
            v
          </span>
          <TeamMedallion
            name={state.team2_name}
            short={state.team2_short_name}
            logo={state.team2_logo_url}
            side={2}
            crown={!won1}
            note={!won1 ? <Label style={{ color: TC.goldDeep }}>Won the toss</Label> : <span className="h-4" />}
          />
        </div>
      </CardShell>
    </Card>
  );
}

export function MatchIntroCard(p: P<"matchIntro">) {
  const { state, match } = p;
  const start = useLocalStart(match?.scheduled_at);
  const toss = tossWinnerName(state, match);
  const details: Array<[string, string]> = [];
  if (state.venue) details.push(["Venue", state.venue]);
  if (start) details.push(["Start", start]);
  if (state.match_format) {
    details.push([
      "Format",
      isMultiInnings(state.match_format) || !state.overs_per_innings
        ? state.match_format
        : `${state.match_format}, ${state.overs_per_innings} overs a side`,
    ]);
  }
  const umps = officialsLine(state);
  if (umps) details.push(["Umpires", umps.replace(/^Umpires /, "")]);
  const title = `${state.team1_name ?? match?.team1?.name ?? ""} v ${state.team2_name ?? match?.team2?.name ?? ""}`;
  const eyebrow = state.title && state.title !== title ? state.title : (state.tournament_name ?? state.match_format ?? "Today");
  return (
    <Card label="intro">
      <CardShell
        label="Match introduction"
        width={1400}
        eyebrow={eyebrow}
        title={title}
        foot={
          toss && state.toss_decision ? (
            <span style={{ color: "rgba(243,236,218,0.9)" }}>
              <Label className="mr-3" style={{ color: TC.goldText }}>Toss</Label>
              {toss} won the toss and chose to {state.toss_decision === "bowl" ? "bowl" : "bat"}
            </span>
          ) : undefined
        }
      >
        <div className="flex items-center justify-around gap-10 py-2">
          <TeamMedallion name={state.team1_name} short={state.team1_short_name} logo={state.team1_logo_url} side={1} size={150} />
          <span className="text-[3rem] italic" style={{ fontFamily: SERIF, color: TC.goldDeep }}>
            v
          </span>
          <TeamMedallion name={state.team2_name} short={state.team2_short_name} logo={state.team2_logo_url} side={2} size={150} />
        </div>
        {details.length > 0 && (
          <dl className="mt-7 grid border-t pt-5" style={{ borderColor: TC.ivoryLine, gridTemplateColumns: `repeat(${details.length}, minmax(0, 1fr))` }}>
            {details.map(([k, v], i) => (
              <div
                key={k}
                className="tc-a-rise min-w-0 px-5 first:pl-0"
                style={{ borderLeft: i > 0 ? `1px solid ${TC.ivoryLine}` : undefined, ...delay(400 + i * 70) }}
              >
                <dt>
                  <Label style={{ color: TC.inkMuted }}>{k}</Label>
                </dt>
                <dd className="mt-2 truncate text-[1.375rem] font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardShell>
    </Card>
  );
}

function roleMark(role: string | null | undefined): string {
  if (role === "captain") return " (c)";
  if (role === "wicket_keeper") return " (wk)";
  return "";
}

function XiList({ players, d = 300, big = false }: { players: TeamPlayer[]; d?: number; big?: boolean }) {
  return (
    <ol>
      {players.map((pl, i) => (
        <li
          key={pl.id}
          className="tc-a-fade flex items-center gap-4"
          style={{ height: big ? 50 : 44, borderBottom: `1px solid ${TC.ivoryLine}`, ...delay(d + i * 40) }}
        >
          <Fig className="w-8 text-right text-[1.25rem]" style={{ color: TC.goldDeep }}>
            {i + 1}
          </Fig>
          <span className={cn("min-w-0 truncate font-semibold", big ? "text-[1.625rem]" : "text-[1.4375rem]")}>
            {pl.user?.full_name ?? ""}
            <span className="font-medium" style={{ color: TC.inkMuted }}>
              {roleMark(pl.role_in_team)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function PlayingXiCard(p: P<"playingXi">) {
  const { state, match } = p;
  const one = playingXi(match?.team1?.team_players);
  const two = playingXi(match?.team2?.team_players);
  if (p.side !== null) {
    const players = p.side === 1 ? one : two;
    if (!players.length) return null;
    const name = p.side === 1 ? state.team1_name : state.team2_name;
    return (
      <Card label="playing-xi">
        <CardShell
          label={`${name} playing XI`}
          width={860}
          eyebrow={eyebrowOf(state, "Playing XI")}
          title={name ?? ""}
          crest={
            <Crest
              logoUrl={p.side === 1 ? state.team1_logo_url : state.team2_logo_url}
              code={p.side === 1 ? state.team1_short_name : state.team2_short_name}
              name={name}
              size={72}
              colour={p.side === 2 ? "var(--tc-team2)" : "var(--tc-team1)"}
            />
          }
        >
          <XiList players={players} big />
        </CardShell>
      </Card>
    );
  }
  if (!one.length && !two.length) return null;
  const col = (side: 1 | 2, players: TeamPlayer[]) => (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-4 pb-3" style={{ borderBottom: `2px solid ${TC.ink}` }}>
        <Crest
          logoUrl={side === 1 ? state.team1_logo_url : state.team2_logo_url}
          code={side === 1 ? state.team1_short_name : state.team2_short_name}
          name={side === 1 ? state.team1_name : state.team2_name}
          size={48}
          colour={side === 2 ? "var(--tc-team2)" : "var(--tc-team1)"}
        />
        <span className="truncate text-[1.75rem] font-bold" style={{ fontFamily: SERIF }}>
          {side === 1 ? state.team1_name : state.team2_name}
        </span>
      </div>
      <XiList players={players} d={side === 1 ? 300 : 360} />
    </div>
  );
  return (
    <Card label="playing-xi">
      <CardShell label="Playing XI" width={1400} eyebrow={eyebrowOf(state, "Team line-ups")} title="Playing XI">
        <div className="grid grid-cols-2 gap-14">
          {col(1, one)}
          {col(2, two)}
        </div>
      </CardShell>
    </Card>
  );
}

// ---- standings, leaders, fixtures --------------------------------------------------

export function PointsTableCard(p: P<"pointsTable">) {
  const { state, table } = p;
  if (!table?.rows.length) return null;
  const tied = table.rows.some((r) => (r.tied ?? 0) > 0);
  const nr = table.rows.some((r) => (r.noResult ?? 0) > 0);
  return (
    <Card label="points-table">
      <CardShell
        label={table.title}
        width={1320}
        eyebrow={table.title === state.tournament_name ? "Points table" : eyebrowOf(state, "Points table")}
        title={table.title}
      >
        <table className="w-full border-collapse" style={{ color: TC.ink }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${TC.ink}` }}>
              <Th left className="w-14">
                <span className="sr-only">Position</span>
              </Th>
              <Th left>Team</Th>
              <Th>P</Th>
              <Th>W</Th>
              <Th>L</Th>
              {tied && <Th>T</Th>}
              {nr && <Th>NR</Th>}
              <Th>NRR</Th>
              <Th>Pts</Th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={`${r.team}-${i}`} className="tc-a-fade" style={{ ...rowStyle(i, !!r.highlight), height: 52 }}>
                <td className="px-3 text-left">
                  <Fig className="text-[1.375rem]" style={{ color: r.highlight ? TC.navy : TC.inkMuted }}>
                    {i + 1}
                  </Fig>
                </td>
                <td className="max-w-[34rem] truncate px-3 text-left text-[1.5rem] font-semibold">
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="h-6 w-1.5 shrink-0 rounded-[1px]"
                      style={{ background: r.highlight ? GOLD_LEAF : "transparent" }}
                    />
                    <span className="truncate">{r.team}</span>
                  </span>
                </td>
                <td className={TD} style={FIGS}>{r.played}</td>
                <td className={TD} style={FIGS}>{r.won}</td>
                <td className={TD} style={FIGS}>{r.lost}</td>
                {tied && <td className={TD} style={FIGS}>{r.tied ?? 0}</td>}
                {nr && <td className={TD} style={FIGS}>{r.noResult ?? 0}</td>}
                <td className={cn(TD, "font-medium")} style={{ ...FIGS, color: TC.inkMuted }}>
                  {r.nrr === null || r.nrr === undefined ? "–" : `${r.nrr > 0 ? "+" : ""}${r.nrr.toFixed(3)}`}
                </td>
                <td className={TD}>
                  <Fig className="text-[1.625rem]">{r.points}</Fig>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardShell>
    </Card>
  );
}

export function LeaderboardCard(p: P<"leaderboard">) {
  const { state, board } = p;
  if (!board?.rows.length) return null;
  const rows = board.rows.slice(0, 8);
  return (
    <Card label="leaderboard">
      <CardShell
        label={board.title}
        width={1160}
        eyebrow={eyebrowOf(state, "Leaders")}
        title={board.title}
        aside={<Label style={{ color: TC.goldText }}>{board.metric}</Label>}
      >
        <ol>
          {rows.map((r, i) => (
            <li
              key={`${r.name}-${i}`}
              className="tc-a-fade flex items-center gap-6"
              style={{ minHeight: 66, borderBottom: `1px solid ${TC.ivoryLine}`, ...delay(300 + i * 60) }}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={i === 0 ? { background: GOLD_LEAF } : { boxShadow: `inset 0 0 0 1.5px ${TC.ivoryLine}` }}
              >
                <Fig className="text-[1.375rem]" style={{ color: TC.ink }}>
                  {i + 1}
                </Fig>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[1.625rem] font-semibold">{r.name}</span>
                {(r.team || r.detail) && (
                  <span className="mt-0.5 block truncate text-[1.125rem]" style={{ color: TC.inkMuted, ...FIGS }}>
                    {[r.team, r.detail].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <Fig className={i === 0 ? "text-[2.5rem]" : "text-[2rem]"}>{r.value}</Fig>
            </li>
          ))}
        </ol>
      </CardShell>
    </Card>
  );
}

export function NextFixtureCard(p: P<"nextFixture">) {
  const { state, fixture } = p;
  const when = useLocalStart(fixture?.startsAt);
  if (!fixture?.team1 || !fixture.team2) return null;
  const foot = [when, fixture.venue].filter(Boolean) as string[];
  return (
    <Card label="next-fixture">
      <CardShell
        label={fixture.title ?? "Next match"}
        width={1240}
        eyebrow={eyebrowOf(state, fixture.round ?? "Coming up")}
        title={fixture.title ?? "Next match"}
        foot={
          foot.length
            ? foot.map((t, i) => (
                <span key={i} className="flex items-center gap-3 truncate" style={{ color: "rgba(243,236,218,0.9)" }}>
                  <Label style={{ color: TC.goldText }}>{i === 0 && when ? "When" : "Where"}</Label>
                  {t}
                </span>
              ))
            : undefined
        }
      >
        <div className="flex items-center justify-around gap-10 py-3">
          <TeamMedallion name={fixture.team1} short={fixture.team1Short ?? null} logo={fixture.team1Logo} side={1} size={120} />
          <span className="text-[2.5rem] italic" style={{ fontFamily: SERIF, color: TC.goldDeep }}>
            v
          </span>
          <TeamMedallion name={fixture.team2} short={fixture.team2Short ?? null} logo={fixture.team2Logo} side={2} size={120} />
        </div>
      </CardShell>
    </Card>
  );
}

// ---- results and summaries -----------------------------------------------------------

/** Each side's innings in order: "325 & 112-2" in a multi-innings match. */
function sideLines(state: LiveMatchState, match: Match | null, innings: Innings[]) {
  const bpo = ballsPerOverOf(match);
  const ordered = [...innings].sort((a, b) => a.innings_number - b.innings_number);
  const multi = isMultiInnings(state.match_format ?? match?.match_format);
  const main = multi ? ordered : ordered.filter((i) => i.innings_number <= 2);
  const order: string[] = [];
  const byTeam = new Map<string, Innings[]>();
  for (const inn of main) {
    const key = inn.team_id || inningsTeamName(state, inn, match?.team1_id);
    if (!byTeam.has(key)) {
      byTeam.set(key, []);
      order.push(key);
    }
    byTeam.get(key)!.push(inn);
  }
  return order.map((key) => {
    const list = byTeam.get(key)!;
    const first = list[0]!;
    const side: 1 | 2 = match && first.team_id === match.team2_id ? 2 : 1;
    return {
      key,
      side,
      name: inningsTeamName(state, first, match?.team1_id),
      score: list.map((i) => scoreText(i.total_runs, i.total_wickets)).join(" & "),
      overs: `${oversText(list[list.length - 1]!.total_balls, bpo)} ov`,
      last: list[list.length - 1]!,
    };
  });
}

function Leaders({ innings, d = 400 }: { innings: Innings; d?: number }) {
  const bat = [...(innings.batting_performances ?? [])]
    .filter((b) => b.balls_faced > 0)
    .sort((a, b) => b.runs_scored - a.runs_scored)
    .slice(0, 3);
  const bowl = [...(innings.bowling_performances ?? [])]
    .filter((b) => b.balls_bowled > 0)
    .sort((a, b) => b.wickets_taken - a.wickets_taken || a.runs_conceded - b.runs_conceded)
    .slice(0, 3);
  const line = (key: string, name: string, fig: ReactNode, note: string, i: number) => (
    <li
      key={key}
      className="tc-a-fade flex items-baseline justify-between gap-4"
      style={{ height: 38, borderBottom: `1px solid ${TC.ivoryLine}`, ...delay(d + i * 50) }}
    >
      <span className="truncate text-[1.375rem] font-semibold">{name}</span>
      <span className="flex shrink-0 items-baseline gap-2">
        <Fig className="text-[1.5rem]">{fig}</Fig>
        <span className="w-[4.5rem] text-[1.0625rem]" style={{ color: TC.inkMuted, ...FIGS }}>
          {note}
        </span>
      </span>
    </li>
  );
  return (
    <div className="grid grid-cols-2 gap-12">
      <ul>
        {bat.map((b, i) =>
          line(b.id, b.user?.full_name ?? "", `${b.runs_scored}${b.is_out ? "" : "*"}`, `(${b.balls_faced})`, i),
        )}
      </ul>
      <ul>
        {bowl.map((b, i) =>
          line(b.id, b.user?.full_name ?? "", `${b.wickets_taken}-${b.runs_conceded}`, `(${oversText(b.balls_bowled)})`, i + 3),
        )}
      </ul>
    </div>
  );
}

function InningsBlock({
  state,
  match,
  innings,
  d,
}: {
  state: LiveMatchState;
  match: Match | null;
  innings: Innings;
  d: number;
}) {
  const bpo = ballsPerOverOf(match);
  const side: 1 | 2 = match && innings.team_id === match.team2_id ? 2 : 1;
  return (
    <section className="tc-a-rise" style={delay(d)}>
      <div className="mb-2 flex items-center gap-4 pb-2.5" style={{ borderBottom: `2px solid ${TC.ink}` }}>
        <span aria-hidden="true" className="h-7 w-1.5 rounded-[1px]" style={{ background: side === 2 ? "var(--tc-team2)" : "var(--tc-team1)" }} />
        <span className="min-w-0 flex-1 truncate text-[1.75rem] font-bold" style={{ fontFamily: SERIF }}>
          {inningsTeamName(state, innings, match?.team1_id)}
          <span className="ml-3 text-[1.125rem] font-normal italic" style={{ color: TC.inkMuted }}>
            {inningsTitle(innings.innings_number, state.match_format)}
          </span>
        </span>
        <Fig className="text-[2rem]">{scoreText(innings.total_runs, innings.total_wickets)}</Fig>
        <span className="text-[1.125rem]" style={{ color: TC.inkMuted, ...FIGS }}>
          ({oversText(innings.total_balls, bpo)} ov)
        </span>
      </div>
      <Leaders innings={innings} d={d + 120} />
    </section>
  );
}

export function ResultCard(p: P<"result">) {
  const { state, match, innings } = p;
  if (!state.result_description) return null;
  const sides = sideLines(state, match, innings);
  const potm = match?.player_of_the_match?.full_name;
  return (
    <Card label="result">
      <CardShell
        label="Result"
        width={1320}
        eyebrow={eyebrowOf(state, "Result")}
        title={state.result_description}
        foot={
          potm ? (
            <span className="flex items-center gap-4" style={{ color: TC.ivoryHi }}>
              <Label style={{ color: TC.goldText }}>Player of the match</Label>
              <span className="text-[1.5rem] font-bold" style={{ fontFamily: SERIF }}>
                {potm}
              </span>
            </span>
          ) : undefined
        }
      >
        <ul>
          {sides.map((s, i) => {
            const won = state.winning_team_name === s.name;
            return (
              <li
                key={s.key}
                className="tc-a-rise flex items-center gap-6"
                style={{ height: 92, borderBottom: i < sides.length - 1 ? `1px solid ${TC.ivoryLine}` : undefined, ...delay(300 + i * 100) }}
              >
                <Crest
                  logoUrl={s.side === 1 ? state.team1_logo_url : state.team2_logo_url}
                  code={s.side === 1 ? state.team1_short_name : state.team2_short_name}
                  name={s.name}
                  size={60}
                  colour={s.side === 2 ? "var(--tc-team2)" : "var(--tc-team1)"}
                />
                <span className="min-w-0 flex-1 truncate text-[2rem] font-bold" style={{ fontFamily: SERIF }}>
                  {s.name}
                </span>
                {won && (
                  <span className="rounded-[3px] px-3 py-1.5" style={{ background: GOLD_LEAF }}>
                    <Label style={{ color: TC.ink }}>Won</Label>
                  </span>
                )}
                <Fig className="text-[2.75rem]">{s.score}</Fig>
                <span className="w-24 text-right text-[1.25rem]" style={{ color: TC.inkMuted, ...FIGS }}>
                  {s.overs}
                </span>
              </li>
            );
          })}
        </ul>
      </CardShell>
    </Card>
  );
}

export function MatchSummaryCard(p: P<"matchSummary">) {
  const { state, match, innings } = p;
  const multi = isMultiInnings(state.match_format ?? match?.match_format);
  const shown = [...innings]
    .filter((i) => multi || i.innings_number <= 2)
    .sort((a, b) => a.innings_number - b.innings_number);
  if (!shown.length) return null;
  const standing = standingOf(state, match);
  return (
    <Card label="summary">
      <CardShell
        label="Match summary"
        width={1500}
        eyebrow={eyebrowOf(state, "Match summary")}
        title={state.result_description ?? `${state.team1_name} v ${state.team2_name}`}
        aside={
          !state.result_description && standing ? (
            <span className="text-[1.625rem] font-bold" style={{ fontFamily: SERIF, color: TC.goldText }}>
              {standing.text}
            </span>
          ) : undefined
        }
      >
        <div className="space-y-7">
          {shown.slice(-2).map((inn, i) => (
            <InningsBlock key={inn.id} state={state} match={match} innings={inn} d={250 + i * 200} />
          ))}
        </div>
      </CardShell>
    </Card>
  );
}

export function InningsBreakCard(p: P<"inningsBreak">) {
  const { state, match, innings } = p;
  const n = state.innings_completed ? (state.innings_number ?? 1) : (state.innings_number ?? 2) - 1;
  const done = innings.find((i) => i.innings_number === n) ?? innings.find((i) => i.innings_number === 1);
  if (!done) return null;
  const bpo = ballsPerOverOf(match);
  const target = state.target_runs ?? (n === 1 && !isMultiInnings(state.match_format) ? done.total_runs + 1 : null);
  const standing = standingOf(state, match);
  const next = sidesOf(state).batting.name;
  return (
    <Card label="innings-break">
      <CardShell
        label="Innings break"
        width={1500}
        eyebrow={eyebrowOf(state, "Innings break")}
        title={`${inningsTeamName(state, done, match?.team1_id)} ${scoreText(done.total_runs, done.total_wickets)}`}
        aside={
          target ? (
            <span className="flex flex-col items-end gap-2">
              <Label style={{ color: TC.goldText }}>Target</Label>
              <Fig className="text-[3rem]" style={{ color: TC.goldText }}>
                {target}
              </Fig>
            </span>
          ) : standing ? (
            <span className="text-[1.75rem] font-bold" style={{ fontFamily: SERIF, color: TC.goldText }}>
              {standing.text}
            </span>
          ) : undefined
        }
        foot={
          target && next && next !== inningsTeamName(state, done, match?.team1_id) ? (
            <span style={{ color: TC.ivoryHi }} className="text-[1.375rem]">
              <span className="italic" style={{ fontFamily: SERIF }}>
                {next} need {target} to win
              </span>
              {!isMultiInnings(state.match_format) && state.overs_per_innings ? (
                <span style={{ color: "rgba(243,236,218,0.75)" }}>
                  {" "}
                  from {state.overs_per_innings} overs ({(target / state.overs_per_innings).toFixed(2)} an over)
                </span>
              ) : null}
            </span>
          ) : undefined
        }
      >
        <p className="tc-a-fade mb-4 text-[1.25rem]" style={{ color: TC.inkMuted, ...FIGS, ...delay(250) }}>
          {totalDetail(done, bpo)} · Extras {done.extras_total ?? 0}
        </p>
        <Leaders innings={done} d={320} />
      </CardShell>
    </Card>
  );
}

// ---- estimates -----------------------------------------------------------------------

export function WinPredictorCard(p: P<"winPredictor">) {
  const { state } = p;
  const est = winPredictorFromLive(state);
  if (!est || est.kind !== "chase") return null;
  const bat = state.batting_team_name ?? "Batting side";
  const bowl = state.bowling_team_name ?? "Bowling side";
  return (
    <Card label="win-predictor">
      <CardShell
        label="Win predictor"
        width={1240}
        eyebrow={eyebrowOf(state, "Estimate")}
        title="Win predictor"
        aside={
          <span className="text-[1.5rem]" style={{ color: "rgba(243,236,218,0.85)", ...FIGS }}>
            Need {est.runsNeeded} from {plural(est.ballsLeft, "ball")}
          </span>
        }
      >
        <div className="flex items-end justify-between gap-8">
          <div className="min-w-0">
            <span className="block truncate text-[1.75rem] font-semibold">{bat}</span>
            <Fig className="mt-2 block text-[4rem]">{est.battingPct}%</Fig>
          </div>
          <div className="min-w-0 text-right">
            <span className="block truncate text-[1.75rem] font-semibold">{bowl}</span>
            <Fig className="mt-2 block text-[4rem]">{est.bowlingPct}%</Fig>
          </div>
        </div>
        <div className="mt-5">
          <ChanceBar state={state} battingPct={est.battingPct} height={22} />
        </div>
        <p className="tc-a-fade mt-5 text-[1.1875rem] italic" style={{ fontFamily: SERIF, color: TC.inkMuted, ...delay(600) }}>
          An estimate from the runs needed, the balls and wickets left and the first innings&apos; scoring rate.
        </p>
      </CardShell>
    </Card>
  );
}

export function ProjectedCard(p: P<"projectedScore">) {
  const { state } = p;
  const est = winPredictorFromLive(state);
  if (!est || est.kind !== "projection") return null;
  const lo = Math.min(est.low, state.total_runs ?? est.low);
  const span = Math.max(1, est.high - lo);
  const at = (v: number) => `${((v - lo) / span) * 100}%`;
  return (
    <Card label="projected">
      <CardShell
        label="Projected score"
        width={1240}
        eyebrow={eyebrowOf(state, "Estimate")}
        title="Projected score"
        aside={
          <Fig className="text-[3rem]" style={{ color: TC.goldText }}>
            {est.low} to {est.high}
          </Fig>
        }
      >
        <div className="relative mx-6 mt-10 h-16" aria-hidden="true">
          <div className="absolute inset-x-0 top-6 h-2 rounded-full" style={{ background: "rgba(110,90,50,0.14)" }} />
          <div
            className="tc-a-grow absolute top-5 h-4 rounded-full"
            style={{ left: at(est.low), width: `calc(${at(est.high)} - ${at(est.low)})`, background: GOLD_LEAF, ...delay(400) }}
          />
          <div className="absolute top-0 -translate-x-1/2 text-center" style={{ left: at(est.mid) }}>
            <span className="mx-auto block h-14 w-[3px]" style={{ background: TC.navy }} />
          </div>
          <span className="absolute -bottom-3 -translate-x-1/2 text-[1.25rem] font-bold" style={{ left: at(est.mid), ...FIGS }}>
            {est.mid}
          </span>
          {(state.total_runs ?? 0) < est.low && (
            <span className="absolute -top-8 left-0 text-[1.125rem]" style={{ color: TC.inkMuted, ...FIGS }}>
              Now {scoreText(state.total_runs, state.total_wickets)}
            </span>
          )}
          <span className="absolute -top-8 -translate-x-1/2 text-[1.125rem] font-semibold" style={{ left: at(est.low), ...FIGS }}>
            {est.low}
          </span>
          <span className="absolute -top-8 -translate-x-1/2 text-[1.125rem] font-semibold" style={{ left: at(est.high), ...FIGS }}>
            {est.high}
          </span>
        </div>
        <p className="tc-a-fade mt-8 text-[1.375rem]" style={{ color: TC.ink, ...delay(500) }}>
          {state.batting_team_name} are{" "}
          <strong>{scoreText(state.total_runs, state.total_wickets)}</strong> after {oversText(state.total_balls)} overs. At this
          rate, with the overs and wickets left, they would most likely finish around <strong>{est.mid}</strong>.
        </p>
      </CardShell>
    </Card>
  );
}

// ---- a stoppage as a card ---------------------------------------------------------------

/** A centred plaque for a stoppage: the reason, then the score as it stands. */
export function BreakCard(p: P<"breakStrap">) {
  const { state, match } = p;
  const strap = p.strap ?? { id: `tc-${p.kind}`, type: p.kind, title: "" };
  const text = strapText(strap, state);
  if (!text?.title) return null;
  const bpo = ballsPerOverOf(match);
  const inPlay = state.total_runs !== null && state.total_runs !== undefined && (state.total_balls ?? 0) > 0;
  return (
    <TcRoot data-strap-type={p.kind} className="fixed inset-x-0 z-30 flex justify-center" style={{ bottom: 226 }}>
      <div className="w-[64rem] overflow-hidden" style={{ borderRadius: RADIUS, boxShadow: DROP }}>
        <div className="tc-a-wipe-c relative px-10 py-6 text-center" style={NAVY}>
          <Label className="tc-a-fade" style={{ color: TC.goldText, ...delay(200) }}>
            {text.badge}
          </Label>
          <div className="tc-a-rise mt-3 text-[3rem] font-bold leading-tight" style={{ fontFamily: SERIF, ...delay(150) }}>
            {text.title}
          </div>
          {!inPlay && text.subtitle && (
            <p className="mt-2 text-[1.375rem]" style={{ color: "rgba(243,236,218,0.85)", ...FIGS }}>
              {text.subtitle}
            </p>
          )}
        </div>
        <GoldRule from="centre" d={250} sheen />
        {inPlay && (
          <div className="tc-a-wipe-up grid grid-cols-[auto_1fr_1fr] items-center gap-8 px-10 py-5" style={{ ...IVORY, ...delay(300) }}>
            <span className="flex items-baseline gap-3">
              <span className="text-[1.5rem] font-semibold">
                {teamCode(state.batting_team_short_name, state.batting_team_name)}
              </span>
              <Fig className="text-[2.5rem]">{scoreText(state.total_runs, state.total_wickets)}</Fig>
              <span className="text-[1.125rem]" style={{ color: TC.inkMuted, ...FIGS }}>
                {oversText(state.total_balls, bpo)} ov
              </span>
            </span>
            <span className="min-w-0 space-y-1">
              {[
                [state.striker_name, state.striker_runs, state.striker_balls],
                [state.non_striker_name, state.non_striker_runs, state.non_striker_balls],
              ]
                .filter(([n]) => n)
                .map(([n, r, b]) => (
                  <span key={String(n)} className="flex items-baseline justify-between gap-3 text-[1.25rem]">
                    <span className="truncate font-semibold">{n}</span>
                    <span style={FIGS}>
                      <strong>{r ?? 0}*</strong> <span style={{ color: TC.inkMuted }}>({b ?? 0})</span>
                    </span>
                  </span>
                ))}
            </span>
            <span className="min-w-0 space-y-1 border-l pl-8" style={{ borderColor: TC.ivoryLine }}>
              {state.partnership_runs !== null && state.partnership_runs !== undefined && state.striker_name && (
                <span className="flex items-baseline justify-between gap-3 text-[1.25rem]">
                  <Label style={{ color: TC.inkMuted }}>Stand</Label>
                  <span style={FIGS}>
                    <strong>{state.partnership_runs}</strong> <span style={{ color: TC.inkMuted }}>({state.partnership_balls ?? 0})</span>
                  </span>
                </span>
              )}
              {state.current_run_rate !== null && (
                <span className="flex items-baseline justify-between gap-3 text-[1.25rem]">
                  <Label style={{ color: TC.inkMuted }}>Run rate</Label>
                  <strong style={FIGS}>{state.current_run_rate.toFixed(2)}</strong>
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </TcRoot>
  );
}

