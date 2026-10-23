"use client";

/**
 * Hundred-ball full-frame cards: a header slab (the side's colour, the
 * title on ink, the hero figure on paper) over block rows. Balls replace
 * overs everywhere; rows keep to a couple of big figures.
 */

import type { ReactNode } from "react";
import { formatDismissalType } from "~/lib/cricket";
import type {
  BattingPerformance,
  BowlingPerformance,
  Innings,
  Match,
  TeamPlayer,
} from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { estimateOf } from "../shared";
import { playingXi, tossWinnerName } from "../../presentation-card-views";
import { inningsTeamName } from "../../scorecard-cards";
import type { LiveMatchState } from "../../types";
import type { OverlayElementProps } from "../types";
import {
  ballCountOf,
  ballOfOvers,
  ballsPerOverFrom,
  ballsWord,
  chaseOf,
  currentSetOf,
  surnameOf,
} from "./balls";
import { initialsOf, inningsBalls, roleMark } from "../shared";
import {
  Caption,
  ChaseLine,
  SideBlock,
  sidesWithTones,
  teamNumberOf,
  teamsOf,
} from "./common";
import {
  BallBar,
  Block,
  BowlingFig,
  CardStage,
  Crest,
  deepOf,
  Fig,
  HERO_H,
  Label,
  lowerAnchor,
  mutedOn,
  Name,
  Reveal,
  Root,
  ScoreFig,
  SetSquares,
  Slab,
  Tab,
  Text,
  type Tone,
} from "./kit";
import { RunsBalls, SplitBar } from "./straps";

// ---- shell ------------------------------------------------------------------

export interface BoardSide {
  tone: Tone;
  logo: string | null;
  code: string;
}

/** A card title's size: smaller as it gets longer, so it fits one line. */
export function titleSize(title: ReactNode): number {
  const n = typeof title === "string" ? title.length : 0;
  return n > 34 ? 36 : n > 24 ? 44 : 52;
}

/** A full-frame card: header slab, then its body rows. */
export function Board({
  testId,
  width = 1320,
  side,
  eyebrow,
  title,
  hero,
  heroLabel,
  children,
}: {
  testId: string;
  width?: number;
  side?: BoardSide | null;
  eyebrow: ReactNode;
  title: ReactNode;
  hero?: ReactNode;
  heroLabel?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <CardStage testId={testId}>
      <Slab deep={side ? deepOf(side.tone) : "#000000"} column style={{ width }} cut="right">
        <div className="flex" style={{ gap: 6 }}>
          {side && (
            <SideBlock tone={side.tone} logo={side.logo} code={side.code} width={HERO_H} delay={140} />
          )}
          <Block
            tone="ink"
            className="flex min-w-0 flex-1 flex-col justify-center gap-3 px-8"
            style={{ height: HERO_H }}
          >
            <Label color="var(--hb-volt)" size={22}>
              {eyebrow}
            </Label>
            <Reveal delay={180}>
              <Name size={titleSize(title)}>{title}</Name>
            </Reveal>
          </Block>
          {hero !== undefined && hero !== null && (
            <Block
              tone="paper"
              className="flex shrink-0 flex-col justify-between px-8"
              style={{ height: HERO_H, paddingTop: 16, paddingBottom: 16 }}
            >
              <Label color="var(--hb-paper-muted)">{heroLabel}</Label>
              <Reveal delay={240}>{hero}</Reveal>
            </Block>
          )}
        </div>
        {children}
      </Slab>
    </CardStage>
  );
}

/** A body block of rows, striped paper. */
export function Rows({
  children,
  tone = "paper",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Block tone={tone} className={cn("flex flex-col py-2", className)}>
      {children}
    </Block>
  );
}

/** One row of a table: a grid with the given columns. */
export function Row({
  columns,
  index,
  children,
  mark,
  head = false,
  height = 48,
}: {
  columns: string;
  index: number;
  children: ReactNode;
  /** A coloured bar down the left edge (not out, this match's teams). */
  mark?: string | null;
  head?: boolean;
  height?: number;
}) {
  return (
    <Reveal delay={head ? 260 : 300 + index * 40} className="w-full">
      <div
        className="relative grid items-center gap-6 px-8"
        style={{
          gridTemplateColumns: columns,
          height: head ? 36 : height,
          background: !head && index % 2 === 1 ? "var(--hb-paper2)" : "transparent",
        }}
      >
        {mark && (
          <span aria-hidden="true" className="absolute inset-y-1 left-0 w-2" style={{ background: mark }} />
        )}
        {children}
      </div>
    </Reveal>
  );
}

const Head = ({ children, right = false }: { children?: ReactNode; right?: boolean }) => (
  <Label size={18} color="var(--hb-paper-muted)" className={right ? "text-right" : undefined}>
    {children}
  </Label>
);

const RowName = ({ children, size = 28 }: { children: ReactNode; size?: number }) => (
  <Name size={size} className="min-w-0">
    {children}
  </Name>
);

const Muted = ({ children, right = false, size = 22 }: { children: ReactNode; right?: boolean; size?: number }) => (
  <span
    className={cn("block truncate font-semibold tabular-nums", right && "text-right")}
    style={{ fontSize: size, color: "var(--hb-paper-muted)", fontStretch: "75%" }}
  >
    {children}
  </span>
);

const RightFig = ({ children, size = 40 }: { children: ReactNode; size?: number }) => (
  <span className="block text-right">
    <Fig value={children} size={size} roll={false} />
  </span>
);

/** An ink strip under a card: extras, a footnote. */
export function Footer({ children }: { children: ReactNode }) {
  return (
    <Block tone="ink2" className="flex min-h-14 items-center gap-8 px-8 py-3">
      {children}
    </Block>
  );
}

function boardSideOf(state: LiveMatchState, match: Match | null, innings: Innings): BoardSide {
  const teams = teamsOf(state);
  const n =
    match?.team1_id && innings.team_id === match.team1_id
      ? 1
      : match?.team2_id && innings.team_id === match.team2_id
        ? 2
        : (teamNumberOf(state, inningsTeamName(state, innings, match?.team1_id)) ?? 1);
  const t = teams[n - 1]!;
  return { tone: t.tone, logo: t.logo, code: t.code };
}

function otherSide(state: LiveMatchState, side: BoardSide): BoardSide {
  const [t1, t2] = teamsOf(state);
  const o = side.tone === "t1" ? t2! : t1!;
  return { tone: o.tone, logo: o.logo, code: o.code };
}

const inningsWord = (n: number) =>
  n >= 3 ? "Super over" : n === 2 ? "2nd innings" : "1st innings";

// ---- scorecards ---------------------------------------------------------------

const BAT_COLS = "minmax(0,1fr) minmax(0,15rem) 6rem 5rem";
const BAT_COLS_FULL = "minmax(0,1fr) minmax(0,10rem) 5rem 4.5rem";
const BOWL_COLS = "minmax(0,1fr) 7.5rem 5rem";

function battingRows(innings: Innings): BattingPerformance[] {
  return (innings.batting_performances ?? [])
    .filter((b) => b.balls_faced > 0 || b.is_out || b.is_current_batsman)
    .sort((a, b) => (a.batting_position ?? 99) - (b.batting_position ?? 99));
}

function bowlingRows(innings: Innings): BowlingPerformance[] {
  return (innings.bowling_performances ?? []).filter(
    (b) => b.balls_bowled > 0 || b.is_current_bowler,
  );
}

function BattingTable({ innings, full }: { innings: Innings; full: boolean }) {
  const cols = full ? BAT_COLS_FULL : BAT_COLS;
  const rows = battingRows(innings);
  return (
    <Rows className="min-w-0 flex-[3]">
      <Row columns={cols} index={0} head>
        <Head>Batter</Head>
        <Head />
        <Head right>Runs</Head>
        <Head right>Balls</Head>
      </Row>
      {rows.map((b, i) => (
        <Row key={b.id} columns={cols} index={i} mark={b.is_out ? null : "var(--hb-volt)"}>
          <RowName>{b.user?.full_name ?? ""}</RowName>
          <Caption color="var(--hb-paper-muted)" size={20}>
            {b.is_out ? formatDismissalType(b.dismissal_type) : "not out"}
          </Caption>
          <RightFig>{b.runs_scored}</RightFig>
          <Muted right>{b.balls_faced}</Muted>
        </Row>
      ))}
    </Rows>
  );
}

function BowlingTable({ innings }: { innings: Innings }) {
  const rows = bowlingRows(innings);
  return (
    <Rows className="min-w-0 flex-[2]">
      <Row columns={BOWL_COLS} index={0} head>
        <Head>Bowler</Head>
        <Head right>W-R</Head>
        <Head right>Balls</Head>
      </Row>
      {rows.map((b, i) => (
        <Row key={b.id} columns={BOWL_COLS} index={i} mark={b.is_current_bowler ? "var(--hb-volt)" : null}>
          <RowName>{b.user?.full_name ?? ""}</RowName>
          <span className="block text-right">
            <BowlingFig wickets={b.wickets_taken} runs={b.runs_conceded} size={40} />
          </span>
          <Muted right>{b.balls_bowled}</Muted>
        </Row>
      ))}
    </Rows>
  );
}

function ExtrasFooter({ innings }: { innings: Innings }) {
  return (
    <Footer>
      <span className="flex items-baseline gap-3">
        <Label color="var(--hb-volt)">Extras</Label>
        <Fig value={innings.extras_total ?? 0} size={30} roll={false} />
      </span>
      <Caption color="var(--hb-ink-muted)">
        {`Wides ${innings.extras_wides ?? 0} · No-balls ${innings.extras_no_balls ?? 0} · Byes ${innings.extras_byes ?? 0} · Leg byes ${innings.extras_leg_byes ?? 0}`}
      </Caption>
    </Footer>
  );
}

const inningsHero = (innings: Innings) => (
  <ScoreFig runs={innings.total_runs} wickets={innings.total_wickets} size={72} />
);

const ballsLabel = (innings: Innings) =>
  `${innings.total_balls} ${ballsWord(innings.total_balls)}`;

export function HundredScorecard(p: OverlayElementProps["scorecard"]) {
  const { state, match, innings, teamName, full } = p;
  const side = boardSideOf(state, match, innings);
  return (
    <Board
      testId="hb-scorecard"
      width={full ? 1700 : 1240}
      side={side}
      eyebrow={inningsWord(innings.innings_number)}
      title={`${teamName} batting`}
      hero={inningsHero(innings)}
      heroLabel={ballsLabel(innings)}
    >
      <div className="flex" style={{ gap: 6 }}>
        <BattingTable innings={innings} full={full} />
        {full && <BowlingTable innings={innings} />}
      </div>
      <ExtrasFooter innings={innings} />
    </Board>
  );
}

export function HundredBowlingCard(p: OverlayElementProps["bowlingCard"]) {
  const { state, match, innings, teamName } = p;
  const side = otherSide(state, boardSideOf(state, match, innings));
  return (
    <Board
      testId="hb-bowling"
      width={1100}
      side={side}
      eyebrow={inningsWord(innings.innings_number)}
      title={`${teamName} bowling`}
      hero={inningsHero(innings)}
      heroLabel={ballsLabel(innings)}
    >
      <BowlingTable innings={innings} />
    </Board>
  );
}

export function HundredFallOfWickets(p: OverlayElementProps["fallOfWickets"]) {
  const { state, match, innings, teamName } = p;
  const fow = [...(innings.fall_of_wickets ?? [])].sort((a, b) => a.wicket_number - b.wicket_number);
  if (!fow.length) return null;
  const bpo = ballsPerOverFrom(state, match);
  const limit =
    inningsBalls({ ...state, innings_number: innings.innings_number }, bpo) ??
    Math.max(innings.total_balls, 1);
  const side = boardSideOf(state, match, innings);
  return (
    <Board
      testId="hb-fow"
      width={1320}
      side={side}
      eyebrow={`Fall of wickets · ${inningsWord(innings.innings_number)}`}
      title={teamName}
      hero={inningsHero(innings)}
      heroLabel={ballsLabel(innings)}
    >
      <Block tone="ink2" className="px-8 pb-6 pt-5">
        <Label size={18} color="var(--hb-ink-muted)">
          Ball by ball · {limit} balls
        </Label>
        <div className="relative mt-4 h-14">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2" style={{ background: "rgb(255 255 255 / 0.14)" }} />
          <div
            className="absolute left-0 top-1/2 h-2 -translate-y-1/2"
            style={{ width: `${Math.min(100, (innings.total_balls / limit) * 100)}%`, background: `var(--hb-${side.tone}-pop)` }}
          />
          {fow.map((f, i) => {
            const ball = ballOfOvers(f.overs_at_fall, bpo);
            return (
              <span
                key={f.wicket_number}
                className="absolute top-0 -translate-x-1/2"
                style={{ left: `${Math.min(100, (ball / limit) * 100)}%` }}
              >
                <Reveal delay={400 + i * 60} kind="pop" className="overflow-visible">
                  <span
                    className="flex h-14 w-11 items-center justify-center font-extrabold"
                    style={{
                      background: "var(--hb-wicket)",
                      color: "var(--hb-wicket-fg)",
                      fontSize: 26,
                      boxShadow: "inset 0 -3px 0 rgb(0 0 0 / 0.22), 0 0 0 3px var(--hb-ink2)",
                    }}
                  >
                    {f.wicket_number}
                  </span>
                </Reveal>
              </span>
            );
          })}
        </div>
      </Block>
      <Rows>
        {fow.map((f, i) => (
          <Row key={f.wicket_number} columns="3.5rem 8rem minmax(0,1fr) 9rem" index={i}>
            <span
              className="flex h-9 w-9 items-center justify-center font-extrabold"
              style={{ background: "var(--hb-wicket)", color: "var(--hb-wicket-fg)", fontSize: 22 }}
            >
              {f.wicket_number}
            </span>
            <span>
              <Fig value={f.runs_at_fall} size={40} roll={false} />
            </span>
            <RowName>{f.batsman?.full_name ?? ""}</RowName>
            <Muted right>Ball {ballOfOvers(f.overs_at_fall, bpo)}</Muted>
          </Row>
        ))}
      </Rows>
    </Board>
  );
}

// ---- teams -------------------------------------------------------------------------

function XiList({
  players,
  tone,
  name,
  logo,
  code,
  delay = 0,
}: {
  players: TeamPlayer[];
  tone: Tone;
  name: string | null;
  logo: string | null;
  code: string;
  delay?: number;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 6 }}>
      <Block tone={tone} className="flex h-20 items-center gap-4 px-6">
        <span className="flex h-12 w-14 items-center justify-center">
          <Crest logo={logo} code={code} size={30} />
        </span>
        <Reveal delay={delay + 160}>
          <Name size={36}>{name}</Name>
        </Reveal>
      </Block>
      <Rows>
        {players.map((p, i) => (
          <Row key={p.id} columns="3rem minmax(0,1fr)" index={i} height={44}>
            <Muted size={22}>{i + 1}</Muted>
            <RowName size={26}>
              {p.user?.full_name ?? ""}
              {roleMark(p.role_in_team)}
            </RowName>
          </Row>
        ))}
      </Rows>
    </div>
  );
}

export function HundredPlayingXi(p: OverlayElementProps["playingXi"]) {
  const { state, match, side } = p;
  const teams = teamsOf(state);
  const lists = ([1, 2] as const)
    .filter((n) => side === null || side === n)
    .map((n) => ({
      t: teams[n - 1]!,
      players: playingXi((n === 1 ? match?.team1 : match?.team2)?.team_players),
    }))
    .filter((l) => l.players.length > 0);
  if (!lists.length) return null;
  return (
    <CardStage testId="hb-playing-xi">
      <div className="flex flex-col items-start gap-2">
        <Slab deep="#000000" style={{ width: lists.length === 2 ? 1500 : 760 }} cut="right">
          <Block tone="volt" className="flex w-16 shrink-0 items-center justify-center">
            <span
              className="block whitespace-nowrap font-extrabold uppercase"
              style={{ transform: "rotate(-90deg)", fontSize: 26, letterSpacing: "0.04em" }}
            >
              Playing XI
            </span>
          </Block>
          {lists.map((l, i) => (
            <XiList
              key={l.t.n}
              players={l.players}
              tone={l.t.tone}
              name={l.t.name}
              logo={l.t.logo}
              code={l.t.code}
              delay={i * 80}
            />
          ))}
        </Slab>
      </div>
    </CardStage>
  );
}

/** Two teams face to face: colour blocks, a "v" between. */
function FaceOff({
  state,
  height = 260,
  size = 64,
}: {
  state: LiveMatchState;
  height?: number;
  size?: number;
}) {
  const [t1, t2] = teamsOf(state);
  const team = (t: typeof t1, i: number) => (
    <Block
      tone={t!.tone}
      enter={i === 0 ? "wipeRight" : "wipeLeft"}
      delay={120 + i * 100}
      className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 px-8"
      style={{ height }}
    >
      <span className="flex h-28 w-full items-center justify-center">
        <Crest logo={t!.logo} code={t!.code} size={size} />
      </span>
      <Reveal delay={300 + i * 80} className="w-full text-center">
        <Name size={36} className="text-center">
          {t!.name}
        </Name>
      </Reveal>
    </Block>
  );
  return (
    <div className="flex" style={{ gap: 6 }}>
      {team(t1, 0)}
      <Block tone="ink" className="flex w-28 shrink-0 items-center justify-center" style={{ height }}>
        <Reveal delay={360} kind="pop">
          <span className="font-extrabold" style={{ fontSize: 80, color: "var(--hb-volt)", fontStretch: "87.5%" }}>
            V
          </span>
        </Reveal>
      </Block>
      {team(t2, 1)}
    </div>
  );
}

export function HundredToss(p: OverlayElementProps["toss"]) {
  const { state, match } = p;
  const winner = tossWinnerName(state, match);
  if (!winner || !state.toss_decision) return null;
  const n = teamNumberOf(state, winner) ?? 1;
  const t = teamsOf(state)[n - 1]!;
  const choice = state.toss_decision === "bowl" ? "BOWL" : "BAT";
  const umpires = state.umpire1_name
    ? `Umpires ${state.umpire1_name}${state.umpire2_name ? ` and ${state.umpire2_name}` : ""}`
    : null;
  return (
    <Board
      testId="hb-toss"
      width={1180}
      side={{ tone: t.tone, logo: t.logo, code: t.code }}
      eyebrow="The toss"
      title={`${t.name} won the toss`}
      hero={<Fig value={choice} size={72} roll={false} />}
      heroLabel="Chose to"
    >
      <FaceOff state={state} height={220} />
      {(state.venue || umpires) && (
        <Footer>
          <Caption color="#ffffff" size={24}>
            {[state.venue, umpires].filter(Boolean).join(" · ")}
          </Caption>
        </Footer>
      )}
    </Board>
  );
}

export function HundredMatchIntro(p: OverlayElementProps["matchIntro"]) {
  const { state, match } = p;
  const toss = tossWinnerName(state, match);
  const limit = (() => {
    const bpo = ballsPerOverFrom(state, match);
    return state.overs_per_innings ? state.overs_per_innings * bpo : null;
  })();
  return (
    <CardStage testId="hb-intro">
      <div className="flex flex-col items-start gap-2">
        {(state.tournament_name || state.match_format) && (
          <Block tone="volt" enter="wipeRight" delay={200} className="flex h-12 items-center px-6">
            <Label size={22}>{state.tournament_name ?? state.match_format}</Label>
          </Block>
        )}
        <Slab deep="#000000" column style={{ width: 1400 }}>
          <Block tone="ink" className="flex h-24 items-center justify-between gap-8 px-8">
            <Reveal delay={160}>
              <Name size={44}>{state.title ?? `${state.team1_name} v ${state.team2_name}`}</Name>
            </Reveal>
            {limit && (
              <span className="flex shrink-0 items-baseline gap-3">
                <Fig value={limit} size={52} roll={false} />
                <Label color="var(--hb-volt)">balls an innings</Label>
              </span>
            )}
          </Block>
          <FaceOff state={state} height={300} size={80} />
          {(state.venue || toss) && (
            <Footer>
              <Caption color="#ffffff" size={24}>
                {[
                  state.venue,
                  toss && `${toss} won the toss and chose to ${state.toss_decision === "bowl" ? "bowl" : "bat"}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Caption>
            </Footer>
          )}
        </Slab>
      </div>
    </CardStage>
  );
}

// ---- tournament ------------------------------------------------------------------

export function HundredPointsTable(p: OverlayElementProps["pointsTable"]) {
  const { table } = p;
  if (!table?.rows.length) return null;
  const cols = "3.5rem minmax(0,1fr) 4.5rem 4.5rem 4.5rem 7.5rem 6rem";
  return (
    <Board testId="hb-points" width={1240} eyebrow="Standings" title={table.title}>
      <Rows>
        <Row columns={cols} index={0} head>
          <Head />
          <Head>Team</Head>
          <Head right>P</Head>
          <Head right>W</Head>
          <Head right>L</Head>
          <Head right>NRR</Head>
          <Head right>Pts</Head>
        </Row>
        {table.rows.map((r, i) => (
          <Row key={`${r.team}-${i}`} columns={cols} index={i} mark={r.highlight ? "var(--hb-volt)" : null} height={50}>
            <span
              className="flex h-9 w-10 items-center justify-center font-extrabold"
              style={{ background: i === 0 ? "var(--hb-volt)" : "var(--hb-ink)", color: i === 0 ? "var(--hb-ink)" : "#fff", fontSize: 22 }}
            >
              {i + 1}
            </span>
            <RowName>{r.team}</RowName>
            <RightFig size={32}>{r.played}</RightFig>
            <RightFig size={32}>{r.won}</RightFig>
            <RightFig size={32}>{r.lost}</RightFig>
            <Muted right>
              {r.nrr === null || r.nrr === undefined ? "–" : `${r.nrr > 0 ? "+" : ""}${r.nrr.toFixed(3)}`}
            </Muted>
            <RightFig size={40}>{r.points}</RightFig>
          </Row>
        ))}
      </Rows>
    </Board>
  );
}

export function HundredLeaderboard(p: OverlayElementProps["leaderboard"]) {
  const { board } = p;
  if (!board?.rows.length) return null;
  const rows = board.rows.slice(0, 8);
  const top = rows[0]!;
  return (
    <Board
      testId="hb-leaders"
      width={1180}
      eyebrow="Leaders"
      title={board.title}
      hero={<Fig value={top.value} size={72} roll={false} />}
      heroLabel={board.metric}
    >
      <Rows>
        {rows.map((r, i) => (
          <Row key={`${r.name}-${i}`} columns="3.5rem minmax(0,1fr) minmax(0,16rem) 7rem" index={i} height={56}>
            <span
              className="flex h-10 w-10 items-center justify-center font-extrabold"
              style={{ background: i === 0 ? "var(--hb-volt)" : "var(--hb-ink)", color: i === 0 ? "var(--hb-ink)" : "#fff", fontSize: 22 }}
            >
              {i + 1}
            </span>
            <span className="min-w-0">
              <RowName size={30}>{r.name}</RowName>
            </span>
            <Caption color="var(--hb-paper-muted)" size={20}>
              {[r.team, r.detail].filter(Boolean).join(" · ")}
            </Caption>
            <RightFig size={44}>{r.value}</RightFig>
          </Row>
        ))}
      </Rows>
    </Board>
  );
}

function startText(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HundredNextFixture(p: OverlayElementProps["nextFixture"]) {
  const { fixture } = p;
  if (!fixture?.team1 || !fixture.team2) return null;
  const when = startText(fixture.startsAt);
  const team = (name: string, short: string | null | undefined, logo: string | null | undefined, i: number) => (
    <Block
      tone={i === 0 ? "paper" : "paper2"}
      enter={i === 0 ? "wipeRight" : "wipeLeft"}
      delay={140 + i * 100}
      className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 px-8"
      style={{ height: 240 }}
    >
      <span
        className="flex h-24 w-24 items-center justify-center p-3"
        style={{ background: "var(--hb-ink)", color: "#fff" }}
      >
        <Crest logo={logo} code={short || initialsOf(name)} size={34} />
      </span>
      <Reveal delay={300 + i * 80} className="w-full text-center">
        <Name size={34} className="text-center">
          {name}
        </Name>
      </Reveal>
    </Block>
  );
  return (
    <Board testId="hb-fixture" width={1180} eyebrow={fixture.round ?? "Coming up"} title={fixture.title ?? "Next match"}>
      <div className="flex" style={{ gap: 6 }}>
        {team(fixture.team1, fixture.team1Short, fixture.team1Logo, 0)}
        <Block tone="ink" className="flex w-28 shrink-0 items-center justify-center" style={{ height: 240 }}>
          <span className="font-extrabold" style={{ fontSize: 72, color: "var(--hb-volt)", fontStretch: "87.5%" }}>
            V
          </span>
        </Block>
        {team(fixture.team2, fixture.team2Short, fixture.team2Logo, 1)}
      </div>
      {(when || fixture.venue) && (
        <Footer>
          <Caption color="#ffffff" size={24}>
            {[when, fixture.venue].filter(Boolean).join(" · ")}
          </Caption>
        </Footer>
      )}
    </Board>
  );
}

// ---- results and summaries -----------------------------------------------------------

function inningsSides(state: LiveMatchState, match: Match | null, innings: Innings[]) {
  return innings
    .filter((i) => i.innings_number <= 2)
    .sort((a, b) => a.innings_number - b.innings_number)
    .map((inn) => ({ inn, side: boardSideOf(state, match, inn), name: inningsTeamName(state, inn, match?.team1_id) }));
}

/** Best batters and bowler of an innings, as short lines. */
function leadersOf(inn: Innings) {
  const bat = [...(inn.batting_performances ?? [])]
    .filter((b) => b.balls_faced > 0)
    .sort((a, b) => b.runs_scored - a.runs_scored)
    .slice(0, 2);
  const bowl = [...(inn.bowling_performances ?? [])]
    .filter((b) => b.balls_bowled > 0)
    .sort((a, b) => b.wickets_taken - a.wickets_taken || a.runs_conceded - b.runs_conceded)
    .slice(0, 2);
  return { bat, bowl };
}

function LeaderLine({ name, children }: { name: string; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-baseline justify-between gap-4">
      <Name size={24} className="min-w-0" style={{ fontWeight: 700 }}>
        {surnameOf(name)}
      </Name>
      <span className="shrink-0">{children}</span>
    </span>
  );
}

function InningsLine({
  inn,
  side,
  name,
  index,
  leaders = true,
}: {
  inn: Innings;
  side: BoardSide;
  name: string;
  index: number;
  leaders?: boolean;
}) {
  const l = leadersOf(inn);
  return (
    <div className="flex" style={{ gap: 6 }}>
      <SideBlock tone={side.tone} logo={side.logo} code={side.code} width={HERO_H} delay={200 + index * 80} />
      <Block
        tone="paper"
        className={cn("flex flex-col justify-between px-7", leaders ? "w-[25rem] shrink-0" : "min-w-0 flex-1")}
        style={{ height: HERO_H, paddingTop: 16, paddingBottom: 16 }}
      >
        <Label color="var(--hb-paper-muted)" className="max-w-full">
          {name}
        </Label>
        <Reveal delay={260 + index * 80}>
          <span className="flex items-baseline gap-4">
            <ScoreFig runs={inn.total_runs} wickets={inn.total_wickets} size={64} />
            <Label size={20} color="var(--hb-paper-muted)">
              {inn.total_balls} {ballsWord(inn.total_balls)}
            </Label>
          </span>
        </Reveal>
      </Block>
      {leaders && (
        <Block tone="ink2" className="grid min-w-0 flex-1 grid-cols-2 gap-x-10 gap-y-2 px-7 py-4" style={{ height: HERO_H }}>
          <div className="flex min-w-0 flex-col justify-center gap-2">
            {l.bat.map((b) => (
              <LeaderLine key={b.id} name={b.user?.full_name ?? ""}>
                <Fig value={`${b.runs_scored}${b.is_out ? "" : "*"}`} size={30} roll={false} />
                <span style={{ fontSize: 20, color: "var(--hb-ink-muted)" }}> ({b.balls_faced})</span>
              </LeaderLine>
            ))}
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-2">
            {l.bowl.map((b) => (
              <LeaderLine key={b.id} name={b.user?.full_name ?? ""}>
                <BowlingFig wickets={b.wickets_taken} runs={b.runs_conceded} size={30} />
                <span style={{ fontSize: 20, color: "var(--hb-ink-muted)" }}> ({b.balls_bowled})</span>
              </LeaderLine>
            ))}
          </div>
        </Block>
      )}
    </div>
  );
}

export function HundredResult(p: OverlayElementProps["result"]) {
  const { state, match, innings } = p;
  const lines = inningsSides(state, match, innings);
  const winner = teamNumberOf(state, state.winning_team_name);
  const t = winner ? teamsOf(state)[winner - 1]! : null;
  const potm = match?.player_of_the_match?.full_name;
  return (
    <CardStage testId="hb-result">
      <div className="flex flex-col items-start gap-2">
        <Block tone="volt" enter="wipeRight" delay={200} className="flex h-12 items-center px-6">
          <Label size={22}>Result</Label>
        </Block>
        <Slab deep={t ? deepOf(t.tone) : "#000000"} column style={{ width: 1320 }}>
          <Block tone={t?.tone ?? "ink"} className="flex items-center gap-8 px-8 py-7">
            {t && (
              <span className="flex h-24 w-28 shrink-0 items-center justify-center">
                <Crest logo={t.logo} code={t.code} size={52} />
              </span>
            )}
            <Reveal delay={180}>
              <Name size={72} className="whitespace-normal" style={{ lineHeight: 0.98, textWrap: "balance" }}>
                {state.result_description ?? "Match finished"}
              </Name>
            </Reveal>
          </Block>
          {lines.map((l, i) => (
            <InningsLine key={l.inn.id} inn={l.inn} side={l.side} name={l.name} index={i} leaders={false} />
          ))}
          {potm && (
            <Footer>
              <Label color="var(--hb-volt)">Player of the match</Label>
              <Name size={30}>{potm}</Name>
            </Footer>
          )}
        </Slab>
      </div>
    </CardStage>
  );
}

export function HundredMatchSummary(p: OverlayElementProps["matchSummary"]) {
  const { state, match, innings } = p;
  const lines = inningsSides(state, match, innings);
  if (!lines.length) return null;
  const chase = chaseOf(state);
  return (
    <Board
      testId="hb-summary"
      width={1500}
      eyebrow="Match summary"
      title={state.result_description ?? `${state.team1_name} v ${state.team2_name}`}
      hero={chase ? <ChaseLine chase={chase} size={44} /> : undefined}
      heroLabel={chase ? "The chase" : undefined}
    >
      {lines.map((l, i) => (
        <InningsLine key={l.inn.id} inn={l.inn} side={l.side} name={l.name} index={i} />
      ))}
    </Board>
  );
}

export function HundredInningsBreak(p: OverlayElementProps["inningsBreak"]) {
  const { state, match, innings } = p;
  const lines = inningsSides(state, match, innings).filter((l) => l.inn.innings_number === 1);
  const first = lines[0];
  if (!first) return null;
  const chase = chaseOf(state);
  const target = state.target_runs ?? first.inn.total_runs + 1;
  const chasing = first.side.tone === "t1" ? teamsOf(state)[1]! : teamsOf(state)[0]!;
  const bpo = ballsPerOverFrom(state, match);
  const count = ballCountOf({ ...state, innings_number: 2 }, bpo);
  const balls = chase?.balls ?? count.limit;
  return (
    <Board
      testId="hb-innings-break"
      width={1500}
      side={first.side}
      eyebrow="Innings break"
      title={`${first.name} set the target`}
      hero={<Fig value={target} size={72} roll={false} />}
      heroLabel="Target"
    >
      <InningsLine inn={first.inn} side={first.side} name={first.name} index={0} />
      {balls !== null && balls !== undefined && (
        <Block tone="volt" className="flex h-28 items-center gap-6 px-8">
          <span className="flex h-16 items-center px-4" style={{ background: `var(--hb-${chasing.tone})`, color: `var(--hb-${chasing.tone}-fg)` }}>
            <Name size={34}>{chasing.code}</Name>
          </span>
          <Reveal delay={420}>
            <ChaseLine chase={{ runs: chase?.runs ?? target, balls, target }} size={64} />
          </Reveal>
        </Block>
      )}
    </Board>
  );
}

export function HundredPlayerOfTheMatch(p: OverlayElementProps["playerOfTheMatch"]) {
  const { state, match, innings } = p;
  const potm = match?.player_of_the_match;
  if (!potm?.full_name) return null;
  const bat = innings.flatMap((i) => i.batting_performances ?? []).find((b) => b.user_id === potm.id);
  const bowl = innings.flatMap((i) => i.bowling_performances ?? []).find((b) => b.user_id === potm.id);
  const batInn = bat ? innings.find((i) => i.id === bat.innings_id) : undefined;
  const bowlInn = bowl ? innings.find((i) => i.id === bowl.innings_id) : undefined;
  const side = batInn
    ? boardSideOf(state, match, batInn)
    : bowlInn
      ? otherSide(state, boardSideOf(state, match, bowlInn))
      : null;
  return (
    <PotmPlate
      layout={p.layout}
      side={side}
      name={potm.full_name}
      bat={bat && bat.balls_faced > 0 ? bat : null}
      bowl={bowl && bowl.balls_bowled > 0 ? bowl : null}
    />
  );
}

function PotmPlate({
  layout,
  side,
  name,
  bat,
  bowl,
}: {
  layout: OverlayElementProps["playerOfTheMatch"]["layout"];
  side: BoardSide | null;
  name: string;
  bat: BattingPerformance | null;
  bowl: BowlingPerformance | null;
}) {
  const anchor = lowerAnchor(layout);
  const fromRight = anchor.from === "right";
  const enter = fromRight ? "wipeLeft" : anchor.from === "left" ? "wipeRight" : "wipeUp";
  return (
    <Root
      data-testid="hb-potm"
      style={anchor.style}
      className={cn("flex flex-col gap-2", fromRight ? "items-end" : "items-start")}
    >
      <Tab tone="volt" cut={fromRight ? "left" : "right"} enter={enter} delay={220}>
        <Label size={22}>Player of the match</Label>
      </Tab>
      <Slab deep={side ? deepOf(side.tone) : "#000000"} cut={fromRight ? "left" : "right"} enter={enter} style={{ maxWidth: 820 }}>
        {side && <SideBlock tone={side.tone} logo={side.logo} code={side.code} width={112} delay={120} />}
        <Block tone="paper" className="flex min-w-[16rem] flex-col justify-center px-7" style={{ height: HERO_H }}>
          <Reveal delay={160}>
            <Name size={40}>{name}</Name>
          </Reveal>
        </Block>
        {bat && (
          <Block tone="ink" className="flex shrink-0 flex-col justify-between px-6" style={{ height: HERO_H, paddingTop: 16, paddingBottom: 16 }}>
            <Label color="var(--hb-volt)">{bat.is_out ? "Runs" : "Runs, not out"}</Label>
            <Reveal delay={220}>
              <RunsBalls runs={bat.runs_scored} balls={bat.balls_faced} size={64} />
            </Reveal>
          </Block>
        )}
        {bowl && (
          <Block tone="ink2" className="flex shrink-0 flex-col justify-between px-6" style={{ height: HERO_H, paddingTop: 16, paddingBottom: 16 }}>
            <Label color="var(--hb-volt)">
              From {bowl.balls_bowled} {ballsWord(bowl.balls_bowled)}
            </Label>
            <Reveal delay={260}>
              <BowlingFig wickets={bowl.wickets_taken} runs={bowl.runs_conceded} size={64} />
            </Reveal>
          </Block>
        )}
      </Slab>
    </Root>
  );
}

// ---- partnership, this set, estimates ---------------------------------------------------

function standShares(state: LiveMatchState, innings: Innings[]) {
  const current = innings.find((i) => i.innings_number === state.innings_number);
  const stand = current?.partnerships?.find((p) => p.is_current);
  const share = (id: string | null | undefined) => {
    if (!stand || !id) return null;
    if (stand.batsman1_id === id) return { runs: stand.batsman1_runs, balls: stand.batsman1_balls };
    if (stand.batsman2_id === id) return { runs: stand.batsman2_runs, balls: stand.batsman2_balls };
    return null;
  };
  return [
    { name: state.striker_name, own: share(state.striker_id) },
    { name: state.non_striker_name, own: share(state.non_striker_id) },
  ];
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export function HundredPartnershipCard(p: OverlayElementProps["partnership"]) {
  const { state, match, variant } = p;
  if (state.partnership_runs === null || !state.striker_name || !state.non_striker_name) return null;
  const sides = sidesWithTones(state);
  const rows = standShares(state, match?.innings ?? []);
  const total = Math.max(1, state.partnership_runs ?? 0);
  const title = `${ordinal((state.total_wickets ?? 0) + 1)} wicket`;
  const hero = <RunsBalls runs={state.partnership_runs} balls={state.partnership_balls} size={72} color="var(--hb-paper-muted)" />;
  if (variant === "split") {
    const known = rows.every((r) => r.own?.runs !== null && r.own?.runs !== undefined);
    return (
      <Board testId="hb-partnership-split" width={1400} side={sides.batting} eyebrow="Partnership split" title={title} hero={hero} heroLabel="Runs">
        <div className="flex" style={{ gap: 6 }}>
          {rows.map((r, i) => {
            const runs = r.own?.runs ?? 0;
            const grow = known ? Math.max(0.2, runs / total) : 0.5;
            return (
              <Block
                key={i}
                tone={i === 0 ? sides.batting.tone : "paper"}
                enter={i === 0 ? "wipeRight" : "wipeLeft"}
                delay={260 + i * 120}
                duration={700}
                className={cn("flex min-w-0 flex-col justify-between px-7 py-5", i === 1 && "items-end text-right")}
                style={{ flexGrow: grow, flexBasis: 0, height: 200 }}
              >
                <Name size={34} className={cn("max-w-full", i === 1 && "text-right")}>
                  {surnameOf(r.name)}
                </Name>
                {r.own && r.own.runs !== null && r.own.runs !== undefined ? (
                  <RunsBalls runs={r.own.runs} balls={r.own.balls} size={84} color={mutedOn(i === 0 ? sides.batting.tone : "paper")} />
                ) : (
                  <Label color={mutedOn(i === 0 ? sides.batting.tone : "paper")}>At the crease</Label>
                )}
              </Block>
            );
          })}
        </div>
      </Board>
    );
  }
  return (
    <Board testId="hb-partnership-card" width={1240} side={sides.batting} eyebrow="Partnership" title={title} hero={hero} heroLabel="Runs">
      <div className="flex" style={{ gap: 6 }}>
        {rows.map((r, i) => (
          <Block key={i} tone={i === 0 ? "paper" : "paper2"} className="flex min-w-0 flex-1 flex-col gap-4 px-8 py-6">
            <Reveal delay={300 + i * 80}>
              <Name size={40}>{r.name}</Name>
            </Reveal>
            {r.own && r.own.runs !== null && r.own.runs !== undefined && (
              <>
                <RunsBalls runs={r.own.runs} balls={r.own.balls} size={96} color="var(--hb-paper-muted)" />
                <BallBar value={r.own.runs} max={total} height={14} color={`var(--hb-${sides.batting.tone})`} className="bg-transparent" />
              </>
            )}
          </Block>
        ))}
      </div>
    </Board>
  );
}

export function HundredThisOverCard(p: OverlayElementProps["thisOver"]) {
  const { state, match } = p;
  const bpo = ballsPerOverFrom(state, match);
  const set = currentSetOf(state, bpo);
  const count = ballCountOf(state, bpo);
  const sides = sidesWithTones(state);
  const bowler = state.current_bowler_name;
  return (
    <Board
      testId="hb-this-over-card"
      width={1180}
      side={sides.bowling}
      eyebrow={bowler ? `${bowler} · ${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0} from ${state.bowler_balls ?? 0} balls` : `This ${set.word.toLowerCase()}`}
      title={`${set.word} ${set.number}`}
      hero={<Fig value={state.this_over_runs ?? 0} size={72} />}
      heroLabel="Runs"
    >
      <Block tone="ink2" className="flex flex-col gap-6 px-8 py-8">
        <SetSquares balls={set.balls} open={set.open} size={104} gap={14} delay={300} />
        {count.limit !== null && (
          <div className="flex items-center gap-6">
            <Label size={20} color="var(--hb-ink-muted)" className="shrink-0">
              Ball {count.bowled} of {count.limit}
            </Label>
            <BallBar value={count.bowled} max={count.limit} height={10} />
          </div>
        )}
      </Block>
    </Board>
  );
}

export function EstimateCard({ state, testId }: { state: LiveMatchState; testId: string }) {
  const est = estimateOf(state);
  if (!est) return null;
  const sides = sidesWithTones(state);
  if (est.kind === "projection") {
    return (
      <Board
        testId={testId}
        width={1180}
        side={sides.batting}
        eyebrow="Estimate"
        title="Projected score"
        hero={<ScoreFig runs={state.total_runs} wickets={state.total_wickets} size={64} />}
        heroLabel="Now"
      >
        <Block tone="volt" className="flex h-44 items-center justify-between gap-8 px-8">
          <Label size={24}>Heading for</Label>
          <Reveal delay={320}>
            <span className="flex items-baseline gap-5">
              <Fig value={est.low} size={128} roll={false} />
              <Label size={28}>to</Label>
              <Fig value={est.high} size={128} roll={false} />
            </span>
          </Reveal>
        </Block>
        <Footer>
          <Text size={22} style={{ color: "var(--hb-ink-muted)" }}>
            At this scoring rate, with the balls and wickets left, most likely around {est.mid}.
          </Text>
        </Footer>
      </Board>
    );
  }
  return (
    <Board
      testId={testId}
      width={1180}
      eyebrow="Estimate"
      title="Win predictor"
      hero={<ChaseLine chase={{ runs: est.runsNeeded, balls: est.ballsLeft, target: null }} size={40} />}
      heroLabel={`${sides.batting.code} chasing`}
    >
      <SplitBar state={state} width={1180 - 12} height={200} size={112} />
      <Footer>
        <Text size={22} style={{ color: "var(--hb-ink-muted)" }}>
          From the runs needed, balls and wickets left, against the first innings&apos; scoring rate.
        </Text>
      </Footer>
    </Board>
  );
}
