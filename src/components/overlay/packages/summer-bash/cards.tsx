"use client";

/**
 * Summer bash full-frame cards: scorecards, the bowling card, the fall of
 * wickets (with a wicket timeline), playing XIs, the toss, the match-up,
 * standings, leaders, the next match, the result, summaries, the stand,
 * the over and the estimates. Each sits on glass in a neon frame with a
 * slanted title plate; rows rise in one after another. A card with no
 * data renders nothing.
 */

import type { CSSProperties, ReactNode } from "react";
import { formatDismissalType, formatFowOvers } from "~/lib/cricket";
import type { Innings, Match, TeamPlayer } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { winPredictorFromLive } from "~/lib/win-predictor";
import {
  economyText,
  eyebrowOf,
  overTokens,
  oversText,
  strikeRateText,
  teamCode,
} from "../../overlay-kit";
import { playingXi, tossWinnerName } from "../../presentation-card-views";
import { ballsPerOverOf } from "../../score-bug";
import { inningsLabel, inningsTeamName, scoreOf } from "../../scorecard-cards";
import type {
  FixtureSnapshot,
  LeaderboardSnapshot,
  LiveMatchState,
  PointsTableSnapshot,
} from "../../types";
import type { OverlayElementProps } from "../types";
import {
  AsideScore,
  BallChips,
  Card,
  CardPlace,
  Crest,
  delay,
  Heads,
  initialsOf,
  neonStyle,
  Num,
  s,
  sideOfName,
  sideStyle,
  Tag,
  type SideKey,
} from "./kit";
import { TugBar } from "./straps";

// ---- helpers -----------------------------------------------------------------

/** The side key of the team batting in an innings. */
function inningsSide(
  state: LiveMatchState,
  inn: Innings,
  match: Match | null | undefined,
): { name: string; side: SideKey } {
  const name = inningsTeamName(state, inn, match?.team1_id);
  return { name, side: sideOfName(state, name) ?? "t1" };
}

function otherSide(side: SideKey): SideKey {
  return side === "t1" ? "t2" : side === "t2" ? "t1" : side === "bat" ? "bowl" : "bat";
}

const rowDelay = (i: number) => delay(260 + i * 45);

/** One table row: cells laid out by the shared column template. */
function Row({
  cols,
  index,
  current,
  side,
  children,
}: {
  cols: string;
  index: number;
  current?: boolean;
  side?: SideKey;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(s.rise, "relative grid items-center gap-x-4 px-4")}
      style={{
        gridTemplateColumns: cols,
        minHeight: 44,
        ...rowDelay(index),
        ...(current && side
          ? {
              ...sideStyle(side),
              background:
                "linear-gradient(90deg, var(--haze) 0%, rgba(255,255,255,0.04) 70%)",
            }
          : {}),
      }}
    >
      {current && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-0 w-1.5 -skew-x-12 rounded-sm"
          style={{ background: "var(--glow)", boxShadow: "0 0 10px var(--glow)" }}
        />
      )}
      {children}
    </div>
  );
}

const num = (extra = "") => cn(s.figures, "text-right text-[1.375rem] leading-none", extra);

function Name({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <span className="min-w-0">
      <span className={cn(s.semi, s.caps, "block truncate text-[1.375rem] font-bold leading-tight")}>
        {children}
      </span>
      {sub && (
        <span className={cn(s.semi, "block truncate text-[1rem] font-semibold leading-tight text-[color:var(--sb-mist)]")}>
          {sub}
        </span>
      )}
    </span>
  );
}

// ---- scorecards --------------------------------------------------------------

const BAT_COLS = "minmax(0,1fr) 4.5rem 4rem 3.5rem 3.5rem 5.5rem";

function BattingRows({ innings, side }: { innings: Innings; side: SideKey }) {
  const rows = (innings.batting_performances ?? []).filter(
    (b) => b.balls_faced > 0 || b.is_out || b.is_current_batsman,
  );
  return (
    <div>
      <Heads
        template={BAT_COLS}
        cols={[
          { label: "Batter" },
          { label: "R", className: "text-right" },
          { label: "B", className: "text-right" },
          { label: "4s", className: "text-right" },
          { label: "6s", className: "text-right" },
          { label: "SR", className: "text-right" },
        ]}
      />
      <div className={cn(s.rows, "mt-1")}>
        {rows.map((b, i) => (
          <Row key={b.id} cols={BAT_COLS} index={i} current={!!b.is_current_batsman} side={side}>
            <Name sub={b.is_out ? formatDismissalType(b.dismissal_type) : "not out"}>
              {b.user?.full_name ?? ""}
              {b.is_current_batsman && b.is_striker ? " *" : ""}
            </Name>
            <span className={num()} style={{ fontWeight: 800 }}>
              {b.runs_scored}
            </span>
            <span className={num("text-[color:var(--sb-mist)]")}>{b.balls_faced}</span>
            <span className={num()}>{b.fours}</span>
            <span className={num()}>{b.sixes}</span>
            <span className={num("text-[color:var(--sb-mist)]")}>
              {strikeRateText(b.runs_scored, b.balls_faced) ?? "–"}
            </span>
          </Row>
        ))}
      </div>
    </div>
  );
}

const BOWL_COLS = "minmax(0,1fr) 3.5rem 2.5rem 3.5rem 2.5rem 4.75rem";

function BowlingRows({ innings, side }: { innings: Innings; side: SideKey }) {
  const rows = (innings.bowling_performances ?? []).filter(
    (b) => b.balls_bowled > 0 || b.is_current_bowler,
  );
  return (
    <div>
      <Heads
        template={BOWL_COLS}
        cols={[
          { label: "Bowler" },
          { label: "O", className: "text-right" },
          { label: "M", className: "text-right" },
          { label: "R", className: "text-right" },
          { label: "W", className: "text-right" },
          { label: "Econ", className: "text-right" },
        ]}
      />
      <div className={cn(s.rows, "mt-1")}>
        {rows.map((b, i) => (
          <Row key={b.id} cols={BOWL_COLS} index={i} current={!!b.is_current_bowler} side={side}>
            <Name>{b.user?.full_name ?? ""}</Name>
            <span className={num()}>{oversText(b.balls_bowled)}</span>
            <span className={num("text-[color:var(--sb-mist)]")}>{b.maidens}</span>
            <span className={num()}>{b.runs_conceded}</span>
            <span
              className={num()}
              style={{ fontWeight: 800, color: b.wickets_taken > 0 ? "var(--sb-yellow)" : undefined }}
            >
              {b.wickets_taken}
            </span>
            <span className={num("text-[color:var(--sb-mist)]")}>
              {economyText(b.runs_conceded, b.balls_bowled) ?? "–"}
            </span>
          </Row>
        ))}
      </div>
    </div>
  );
}

function Extras({ innings }: { innings: Innings }) {
  return (
    <span className={cn(s.semi, "text-[1.125rem] font-semibold tabular-nums text-[color:var(--sb-mist)]")}>
      Extras <b className="text-white">{innings.extras_total ?? 0}</b> (b {innings.extras_byes ?? 0}, lb{" "}
      {innings.extras_leg_byes ?? 0}, w {innings.extras_wides ?? 0}, nb {innings.extras_no_balls ?? 0})
    </span>
  );
}

function FowLine({ innings }: { innings: Innings }) {
  const fow = [...(innings.fall_of_wickets ?? [])].sort((a, b) => a.wicket_number - b.wicket_number);
  if (!fow.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className={cn(s.label, "text-[1rem] text-[color:var(--edge)]")}>Fall of wickets</span>
      {fow.map((f) => (
        <span key={f.wicket_number} className={cn(s.semi, "text-[1.0625rem] font-semibold tabular-nums text-[color:var(--sb-mist)]")}>
          <b className="text-white">
            {f.runs_at_fall}/{f.wicket_number}
          </b>{" "}
          ({formatFowOvers(f.overs_at_fall)})
        </span>
      ))}
    </div>
  );
}

function ScorecardCard(p: OverlayElementProps["scorecard"]) {
  const { state, innings, teamName, full } = p;
  const side = sideOfName(state, teamName) ?? "t1";
  return (
    <CardPlace state={state}>
      <Card
        side={side}
        width={full ? 1640 : 1120}
        eyebrow={eyebrowOf(state, inningsLabel(innings.innings_number))}
        title={`${teamName} batting`}
        aside={<AsideScore score={scoreOf(innings)} detail={`${oversText(innings.total_balls)} overs`} />}
      >
        {full ? (
          <div className="grid grid-cols-[1.35fr_1fr] gap-10">
            <div className="min-w-0 space-y-3">
              <BattingRows innings={innings} side={side} />
              <Extras innings={innings} />
            </div>
            <div className="min-w-0">
              <BowlingRows innings={innings} side={otherSide(side)} />
            </div>
            <div className="col-span-2 border-t border-white/10 pt-3">
              <FowLine innings={innings} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <BattingRows innings={innings} side={side} />
            <Extras innings={innings} />
            <FowLine innings={innings} />
          </div>
        )}
      </Card>
    </CardPlace>
  );
}

function BowlingCard(p: OverlayElementProps["bowlingCard"]) {
  const { state, innings, teamName } = p;
  const side = sideOfName(state, teamName) ?? "t2";
  return (
    <CardPlace state={state}>
      <Card
        side={side}
        width={1040}
        eyebrow={eyebrowOf(state, inningsLabel(innings.innings_number))}
        title={`${teamName} bowling`}
        aside={<AsideScore score={scoreOf(innings)} detail={`${oversText(innings.total_balls)} overs`} />}
      >
        <BowlingRows innings={innings} side={side} />
      </Card>
    </CardPlace>
  );
}

function FallOfWicketsCard(p: OverlayElementProps["fallOfWickets"]) {
  const { state, innings, teamName } = p;
  const fow = [...(innings.fall_of_wickets ?? [])].sort((a, b) => a.wicket_number - b.wicket_number);
  if (!fow.length) return null;
  const side = sideOfName(state, teamName) ?? "t1";
  const bpo = 6;
  const limit = Math.max(
    state.overs_per_innings ?? 20,
    Math.ceil((innings.total_balls ?? 0) / bpo),
    1,
  );
  const ballsOf = (overs: number) => {
    const whole = Math.floor(overs);
    return whole * bpo + Math.round((overs - whole) * 10);
  };
  return (
    <CardPlace state={state}>
      <Card
        side={side}
        width={1180}
        eyebrow={eyebrowOf(state, inningsLabel(innings.innings_number))}
        title={`${teamName} fall of wickets`}
        aside={<AsideScore score={scoreOf(innings)} detail={`${oversText(innings.total_balls)} overs`} />}
      >
        {/* The wickets along the innings, over by over. */}
        <div className="relative mb-6 mt-14 h-3 rounded-full bg-white/10">
          <span
            className={cn(s.growX, "absolute inset-y-0 left-0 rounded-full")}
            style={{
              width: `${Math.min(100, ((innings.total_balls ?? 0) / (limit * bpo)) * 100)}%`,
              background: "linear-gradient(90deg, var(--plate), var(--glow))",
              boxShadow: "0 0 14px var(--haze)",
              ...delay(200),
            }}
          />
          {fow.map((f, i) => {
            const at = Math.min(100, (ballsOf(f.overs_at_fall) / (limit * bpo)) * 100);
            return (
              <span
                key={f.wicket_number}
                className={cn(s.pop, "absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center")}
                style={{ left: `${at}%`, ...delay(400 + i * 70) }}
              >
                <span
                  className={cn(s.figures, "absolute bottom-6 whitespace-nowrap text-[1rem]")}
                  style={{ fontWeight: 700, transform: i % 2 ? "translateY(-1.4rem)" : undefined }}
                >
                  {f.runs_at_fall}/{f.wicket_number}
                </span>
                <span className="h-5 w-5 rotate-45 rounded-[3px] border-2 border-[color:var(--sb-ink)]" style={{ background: "var(--sb-red)", boxShadow: "0 0 12px var(--sb-red)" }} />
              </span>
            );
          })}
        </div>
        <div className={s.rows}>
          {fow.map((f, i) => (
            <Row key={f.wicket_number} cols="7rem minmax(0,1fr) 9rem" index={i}>
              <span className={cn(s.figures, "text-[1.5rem] leading-none")} style={{ fontWeight: 800 }}>
                {f.runs_at_fall}/{f.wicket_number}
              </span>
              <Name sub={f.dismissal_type ? formatDismissalType(f.dismissal_type) : undefined}>
                {f.batsman?.full_name ?? ""}
              </Name>
              <span className={num("text-[color:var(--sb-mist)]")}>{formatFowOvers(f.overs_at_fall)} ov</span>
            </Row>
          ))}
        </div>
      </Card>
    </CardPlace>
  );
}

// ---- playing XI ------------------------------------------------------------------

function roleMark(role: string | null | undefined): string {
  if (role === "captain") return " (c)";
  if (role === "wicket_keeper") return " (wk)";
  return "";
}

function XiList({
  players,
  side,
  start = 0,
}: {
  players: TeamPlayer[];
  side: SideKey;
  start?: number;
}) {
  return (
    <ol className={s.rows}>
      {players.map((p, i) => (
        <li
          key={p.id}
          className={cn(s.rise, "flex items-center gap-4 px-3")}
          style={{ minHeight: 46, ...rowDelay(start + i) }}
        >
          <span
            style={sideStyle(side)}
            className={cn(s.team, s.figures, "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[1rem]")}
          >
            <span className="relative z-10">{p.jersey_number ?? i + 1}</span>
          </span>
          <span className={cn(s.semi, s.caps, "min-w-0 flex-1 truncate text-[1.375rem] font-bold")}>
            {p.user?.full_name ?? ""}
            <span className="text-[color:var(--glow)]">{roleMark(p.role_in_team)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function TeamHead({
  state,
  side,
  name,
}: {
  state: LiveMatchState;
  side: "t1" | "t2";
  name: string;
}) {
  const logo = side === "t1" ? state.team1_logo_url : state.team2_logo_url;
  const short = side === "t1" ? state.team1_short_name : state.team2_short_name;
  return (
    <div
      style={{ ...sideStyle(side), "--k": "20px" } as CSSProperties}
      className={cn(s.team, s.slantEnd, s.inLeft, "mb-3 flex h-[4.5rem] items-center gap-4 pl-4 pr-10")}
    >
      <Crest name={name} side={side} code={teamCode(short, name)} logo={logo} size={52} />
      <span className={cn(s.display, "relative z-10 truncate text-[1.75rem] uppercase")}>{name}</span>
    </div>
  );
}

function PlayingXiCard(p: OverlayElementProps["playingXi"]) {
  const { state, match, side } = p;
  const one = playingXi(match?.team1?.team_players);
  const two = playingXi(match?.team2?.team_players);
  if (side !== null) {
    const players = side === 1 ? one : two;
    if (!players.length) return null;
    const key = side === 1 ? "t1" : "t2";
    const name = (side === 1 ? state.team1_name : state.team2_name) ?? "";
    return (
      <CardPlace state={state}>
        <Card side={key} width={860} eyebrow={eyebrowOf(state, "Playing XI")} title={name}>
          <XiList players={players} side={key} />
        </Card>
      </CardPlace>
    );
  }
  if (!one.length && !two.length) return null;
  return (
    <CardPlace state={state}>
      <Card width={1460} eyebrow={eyebrowOf(state, "Team lineups")} title="Playing XI">
        <div className="grid grid-cols-2 gap-12">
          <div className="min-w-0">
            <TeamHead state={state} side="t1" name={state.team1_name ?? ""} />
            <XiList players={one} side="t1" />
          </div>
          <div className="min-w-0">
            <TeamHead state={state} side="t2" name={state.team2_name ?? ""} />
            <XiList players={two} side="t2" start={3} />
          </div>
        </div>
      </Card>
    </CardPlace>
  );
}

// ---- match-ups ---------------------------------------------------------------------

/** Two sides facing each other across a lit slash. */
function Versus({
  left,
  right,
}: {
  left: { side: SideKey; name: string; code: string; logo?: string | null; note?: ReactNode };
  right: { side: SideKey; name: string; code: string; logo?: string | null; note?: ReactNode };
}) {
  const half = (t: typeof left, end: boolean) => (
    <div
      style={{ ...sideStyle(t.side), "--k": "60px" } as CSSProperties}
      className={cn(
        s.team,
        end ? s.slantEnd : s.slantStart,
        end ? s.inRight : s.inLeft,
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-4 py-8",
        end ? "pl-20 pr-8" : "pl-8 pr-20",
      )}
    >
      <Crest name={t.name} side={t.side} code={t.code} logo={t.logo} size={150} className={s.pop} />
      <span className={cn(s.display, "relative z-10 max-w-full truncate px-4 text-[2.25rem] uppercase leading-tight")}>
        {t.name}
      </span>
      {t.note && <span className="relative z-10">{t.note}</span>}
    </div>
  );
  return (
    <div className={cn(s.lift, "relative flex items-stretch")} style={neonStyle("yellow")}>
      {half(left, false)}
      <div className="relative z-10 -mx-16 flex w-32 shrink-0 items-center justify-center">
        <span
          className={cn(s.display, s.pop, "flex h-28 w-28 items-center justify-center rounded-full text-[2.5rem] text-[color:var(--sb-ink)]")}
          style={{ background: "var(--sb-yellow)", boxShadow: "0 0 0 6px #0b0620, 0 0 34px var(--sb-yellow)", ...delay(300) }}
        >
          V
        </span>
      </div>
      {half(right, true)}
    </div>
  );
}

function sideInfo(state: LiveMatchState, side: "t1" | "t2") {
  const name = (side === "t1" ? state.team1_name : state.team2_name) ?? "";
  const short = side === "t1" ? state.team1_short_name : state.team2_short_name;
  const logo = side === "t1" ? state.team1_logo_url : state.team2_logo_url;
  return { side, name, code: teamCode(short, name), logo };
}

function TossCard(p: OverlayElementProps["toss"]) {
  const { state, match } = p;
  const winner = tossWinnerName(state, match);
  if (!winner) return null;
  const choice = state.toss_decision === "bowl" ? "bowl" : "bat";
  const key = sideOfName(state, winner) ?? "t1";
  const info = sideInfo(state, key === "t2" ? "t2" : "t1");
  return (
    <CardPlace state={state}>
      <Card side={key} width={1180} eyebrow={eyebrowOf(state, "Toss")} title={`${winner} won the toss`}>
        <div className="flex items-center gap-12 py-4">
          {/* The coin: the winner's crest on a lit disc. */}
          <div className={cn(s.pop, "relative flex h-[15rem] w-[15rem] shrink-0 items-center justify-center rounded-full")} style={{ background: "conic-gradient(from 200deg, #fff6c2, var(--sb-yellow), #e0a800, var(--sb-yellow), #fff6c2)", boxShadow: "0 0 0 8px #0b0620, 0 0 50px var(--sb-yellow-haze)", ...delay(200) }}>
            <Crest name={info.name} side={info.side} code={info.code} logo={info.logo} size={170} />
          </div>
          <div className="min-w-0 flex-1">
            <Tag neon="yellow" className={s.inLeft} style={delay(380)}>
              Chose to {choice}
            </Tag>
            <p className={cn(s.display, s.rise, "mt-5 text-[3.25rem] uppercase leading-[1.05]")} style={delay(440)}>
              {info.code} {choice === "bat" ? "bat first" : "bowl first"}
            </p>
            {(state.venue || state.umpire1_name) && (
              <p className={cn(s.semi, s.rise, "mt-5 text-[1.375rem] font-semibold text-[color:var(--sb-mist)]")} style={delay(520)}>
                {[
                  state.venue,
                  state.umpire1_name &&
                    `Umpires ${state.umpire1_name}${state.umpire2_name ? ` and ${state.umpire2_name}` : ""}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
      </Card>
    </CardPlace>
  );
}

function MatchIntroCard(p: OverlayElementProps["matchIntro"]) {
  const { state, match } = p;
  if (!state.team1_name || !state.team2_name) return null;
  const toss = tossWinnerName(state, match);
  const line = [
    state.venue,
    toss && `${toss} won the toss and chose to ${state.toss_decision === "bowl" ? "bowl" : "bat"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const title = state.title ?? `${state.team1_name} v ${state.team2_name}`;
  // The tag says what the title does not: the competition, else the format.
  const tag =
    state.tournament_name && !title.includes(state.tournament_name)
      ? state.tournament_name
      : state.match_format;
  return (
    <CardPlace state={state}>
      <div className="flex w-[1500px] max-w-full flex-col items-center">
        {tag && (
          <Tag neon="magenta" className={cn(s.inLeft, "mb-4")} style={delay(80)}>
            {tag}
          </Tag>
        )}
        <h2 className={cn(s.display, s.slam, "mb-8 max-w-full truncate text-center text-[3.25rem] uppercase leading-tight")} style={{ textShadow: "0 0 30px var(--sb-magenta-haze), 0 4px 0 #0b0620", ...delay(120) }}>
          {title}
        </h2>
        <div className="w-full">
          <Versus left={sideInfo(state, "t1")} right={sideInfo(state, "t2")} />
        </div>
        {line && (
          <p className={cn(s.glass, s.rise, s.semi, "mt-6 rounded-[4px] px-8 py-3 text-[1.375rem] font-bold")} style={delay(560)}>
            {line}
          </p>
        )}
      </div>
    </CardPlace>
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

function NextFixtureCard({ state, fixture }: { state: LiveMatchState; fixture: FixtureSnapshot }) {
  if (!fixture?.team1 || !fixture.team2) return null;
  const when = startText(fixture.startsAt);
  return (
    <CardPlace state={state}>
      <Card width={1240} neon="cyan" eyebrow={eyebrowOf(state, fixture.round ?? "Coming up")} title={fixture.title ?? "Next match"}>
        <div className="py-2">
          <Versus
            left={{ side: "t1", name: fixture.team1, code: teamCode(fixture.team1Short, fixture.team1), logo: fixture.team1Logo }}
            right={{ side: "t2", name: fixture.team2, code: teamCode(fixture.team2Short, fixture.team2), logo: fixture.team2Logo }}
          />
        </div>
        {(when || fixture.venue) && (
          <div className={cn(s.rise, "mt-6 flex items-center justify-center gap-4")} style={delay(520)}>
            {when && <Tag neon="cyan">{when}</Tag>}
            {fixture.venue && (
              <span className={cn(s.semi, "text-[1.5rem] font-bold text-[color:var(--sb-mist)]")}>{fixture.venue}</span>
            )}
          </div>
        )}
      </Card>
    </CardPlace>
  );
}

// ---- standings -------------------------------------------------------------------

function PointsTableCard({ state, table }: { state: LiveMatchState; table: PointsTableSnapshot }) {
  if (!table?.rows.length) return null;
  const cols = "3rem minmax(0,1fr) 3.5rem 3.5rem 3.5rem 6.5rem 5rem";
  return (
    <CardPlace state={state}>
      <Card width={1200} neon="lime" eyebrow={eyebrowOf(state, "Standings")} title={table.title}>
        <Heads
          template={cols}
          cols={[
            { label: "#" },
            { label: "Team" },
            { label: "P", className: "text-right" },
            { label: "W", className: "text-right" },
            { label: "L", className: "text-right" },
            { label: "NRR", className: "text-right" },
            { label: "Pts", className: "text-right" },
          ]}
        />
        <div className={cn(s.rows, "mt-1")}>
          {table.rows.map((r, i) => {
            const side = sideOfName(state, r.team) ?? undefined;
            return (
              <Row key={`${r.team}-${i}`} cols={cols} index={i} current={!!r.highlight} side={side ?? "t1"}>
                <span className={cn(s.figures, "text-[1.375rem]")} style={{ fontWeight: 800, color: i < 4 ? "var(--sb-lime)" : "var(--sb-mist)" }}>
                  {i + 1}
                </span>
                <span className={cn(s.semi, s.caps, "truncate text-[1.375rem] font-bold")}>{r.team}</span>
                <span className={num()}>{r.played}</span>
                <span className={num()}>{r.won}</span>
                <span className={num("text-[color:var(--sb-mist)]")}>{r.lost}</span>
                <span className={num("text-[color:var(--sb-mist)]")}>
                  {r.nrr === null || r.nrr === undefined ? "–" : `${r.nrr > 0 ? "+" : ""}${r.nrr.toFixed(3)}`}
                </span>
                <span className={num()} style={{ fontWeight: 800, color: "var(--sb-yellow)" }}>
                  {r.points}
                </span>
              </Row>
            );
          })}
        </div>
      </Card>
    </CardPlace>
  );
}

function LeaderboardCard({ state, board }: { state: LiveMatchState; board: LeaderboardSnapshot }) {
  if (!board?.rows.length) return null;
  const [top, ...rest] = board.rows.slice(0, 8);
  const sideOf = (team: string | null | undefined) => sideOfName(state, team) ?? "t1";
  return (
    <CardPlace state={state}>
      <Card width={1080} neon="magenta" eyebrow={eyebrowOf(state, "Leaders")} title={board.title}>
        {top && (
          <div
            style={{ ...sideStyle(sideOf(top.team)), "--k": "28px", ...delay(240) } as CSSProperties}
            className={cn(s.team, s.slant, s.inLeft, "mb-4 flex items-center gap-6 py-4 pl-12 pr-12")}
          >
            <span className={cn(s.display, "relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[color:var(--sb-ink)] text-[2rem] text-[color:var(--sb-yellow)]")}>
              1
            </span>
            <span className="relative z-10 min-w-0 flex-1">
              <span className={cn(s.display, "block truncate text-[2.25rem] uppercase leading-tight")}>{top.name}</span>
              {(top.team || top.detail) && (
                <span className={cn(s.semi, "block truncate text-[1.25rem] font-bold opacity-90")}>
                  {[top.team, top.detail].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
            <span className="relative z-10 text-right">
              <span className={cn(s.figures, "block text-[3.5rem] leading-none")} style={{ fontWeight: 800 }}>
                {top.value}
              </span>
              <span className={cn(s.label, "text-[1rem]")}>{board.metric}</span>
            </span>
          </div>
        )}
        <div className={s.rows}>
          {rest.map((r, i) => (
            <Row key={`${r.name}-${i}`} cols="3rem minmax(0,1fr) 7rem" index={i + 1}>
              <span className={cn(s.figures, "text-[1.375rem] text-[color:var(--sb-mist)]")} style={{ fontWeight: 800 }}>
                {i + 2}
              </span>
              <Name sub={[r.team, r.detail].filter(Boolean).join(" · ") || undefined}>{r.name}</Name>
              <span className={num("text-[1.75rem]")} style={{ fontWeight: 800 }}>
                {r.value}
              </span>
            </Row>
          ))}
        </div>
      </Card>
    </CardPlace>
  );
}

// ---- results and summaries -------------------------------------------------------

/** Best batters and bowlers of an innings. */
function Leaders({ innings, side }: { innings: Innings; side: SideKey }) {
  const bat = [...(innings.batting_performances ?? [])]
    .filter((b) => b.balls_faced > 0)
    .sort((a, b) => b.runs_scored - a.runs_scored)
    .slice(0, 3);
  const bowl = [...(innings.bowling_performances ?? [])]
    .filter((b) => b.balls_bowled > 0)
    .sort((a, b) => b.wickets_taken - a.wickets_taken || a.runs_conceded - b.runs_conceded)
    .slice(0, 3);
  const line = (name: string, fig: ReactNode, note: ReactNode, i: number) => (
    <li key={`${name}-${i}`} className={cn(s.rise, "flex items-center gap-3 py-1")} style={rowDelay(i)}>
      <span className={cn(s.semi, s.caps, "min-w-0 flex-1 truncate text-[1.25rem] font-bold")}>{name}</span>
      <span className={cn(s.figures, "text-[1.375rem]")} style={{ fontWeight: 800 }}>
        {fig}
      </span>
      <span className={cn(s.figures, "w-16 text-[1rem] text-[color:var(--sb-mist)]")} style={{ fontWeight: 500 }}>
        {note}
      </span>
    </li>
  );
  return (
    <div className="grid grid-cols-2 gap-8" style={sideStyle(side)}>
      <ul>
        {bat.map((b, i) => line(b.user?.full_name ?? "", `${b.runs_scored}${b.is_out ? "" : "*"}`, `(${b.balls_faced})`, i))}
      </ul>
      <ul style={sideStyle(otherSide(side))}>
        {bowl.map((b, i) =>
          line(b.user?.full_name ?? "", `${b.wickets_taken}-${b.runs_conceded}`, `(${oversText(b.balls_bowled)})`, i + 3),
        )}
      </ul>
    </div>
  );
}

function InningsBlock({
  state,
  match,
  innings,
  index,
}: {
  state: LiveMatchState;
  match: Match | null;
  innings: Innings;
  index: number;
}) {
  const { name, side } = inningsSide(state, innings, match);
  const short = side === "t2" ? state.team2_short_name : state.team1_short_name;
  const logo = side === "t2" ? state.team2_logo_url : state.team1_logo_url;
  return (
    <div className={cn(s.rise, "border-b border-white/10 py-4 last:border-0")} style={delay(200 + index * 140)}>
      <div className="mb-3 flex items-center gap-5" style={sideStyle(side)}>
        <Crest name={name} side={side} code={teamCode(short, name)} logo={logo} size={54} />
        <span className={cn(s.display, "min-w-0 flex-1 truncate text-[1.875rem] uppercase")}>{name}</span>
        <span className={cn(s.figures, "text-[2.5rem] leading-none")} style={{ fontWeight: 800, textShadow: "0 0 18px var(--haze)" }}>
          {scoreOf(innings)}
        </span>
        <span className={cn(s.label, "w-28 text-[1rem] text-[color:var(--sb-mist)]")}>{oversText(innings.total_balls)} ov</span>
      </div>
      <Leaders innings={innings} side={side} />
    </div>
  );
}

function ResultCard(p: OverlayElementProps["result"]) {
  const { state, match, innings } = p;
  if (!state.result_description) return null;
  const main = innings.filter((i) => i.innings_number <= 2);
  const winner = sideOfName(state, state.winning_team_name);
  const potm = match?.player_of_the_match?.full_name;
  return (
    <CardPlace state={state}>
      <Card side={winner} neon="yellow" width={1280} eyebrow={eyebrowOf(state, "Result")} title={state.result_description}>
        {main.length > 0 && (
          <div className="flex flex-col gap-3">
            {main.map((inn, i) => {
              const { name, side } = inningsSide(state, inn, match);
              const won = name === state.winning_team_name;
              const short = side === "t2" ? state.team2_short_name : state.team1_short_name;
              const logo = side === "t2" ? state.team2_logo_url : state.team1_logo_url;
              return (
                <div
                  key={inn.id}
                  style={{ ...sideStyle(side), "--k": "26px", ...delay(260 + i * 120) } as CSSProperties}
                  className={cn(won ? s.team : s.glass, s.slant, s.inLeft, "flex items-center gap-6 py-4 pl-10 pr-14")}
                >
                  <Crest name={name} side={side} code={teamCode(short, name)} logo={logo} size={60} className="relative z-10" />
                  <span className="relative z-10 min-w-0 flex-1">
                    <span className={cn(s.display, "block truncate text-[1.75rem] uppercase")}>{name}</span>
                    <span className={cn(s.label, "text-[1rem] opacity-85")}>
                      {won ? "Winner" : inningsLabel(inn.innings_number)}
                    </span>
                  </span>
                  <span className={cn(s.figures, "relative z-10 text-[3.25rem] leading-none")} style={{ fontWeight: 800 }}>
                    {scoreOf(inn)}
                  </span>
                  <span className={cn(s.figures, "relative z-10 text-[1.125rem] opacity-85")} style={{ fontWeight: 500 }}>
                    ({oversText(inn.total_balls)})
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {potm && (
          <div className={cn(s.rise, "mt-6 flex items-center gap-4")} style={delay(520)}>
            <Tag neon="yellow">Player of the match</Tag>
            <span className={cn(s.display, "truncate text-[1.75rem] uppercase")}>{potm}</span>
          </div>
        )}
      </Card>
    </CardPlace>
  );
}

function SummaryCard({
  state,
  match,
  innings,
  breakCard,
}: {
  state: LiveMatchState;
  match: Match | null;
  innings: Innings[];
  breakCard: boolean;
}) {
  const shown = innings.filter((i) => i.innings_number <= (breakCard ? 1 : 2));
  if (!shown.length) return null;
  const first = innings.find((i) => i.innings_number === 1);
  const chase =
    !breakCard && !state.result_description && state.runs_needed !== null && state.balls_remaining !== null;
  const aside = breakCard ? (
    first ? (
      <span style={neonStyle("yellow")} className="text-right">
        <span className={cn(s.label, "block text-[1rem] text-[color:var(--sb-yellow)]")}>Target</span>
        <span className={cn(s.figures, "block text-[3.5rem] leading-none text-[color:var(--sb-yellow)]")} style={{ fontWeight: 800, textShadow: "0 0 20px var(--sb-yellow-haze)" }}>
          {first.total_runs + 1}
        </span>
      </span>
    ) : null
  ) : chase ? (
    <span className={cn(s.label, "text-[1.25rem] text-[color:var(--sb-yellow)]")}>
      Need {state.runs_needed} from {state.balls_remaining}
    </span>
  ) : null;
  const firstSide = first ? inningsSide(state, first, match) : null;
  return (
    <CardPlace state={state}>
      <Card
        side={breakCard ? (firstSide?.side ?? null) : sideOfName(state, state.winning_team_name)}
        width={1400}
        eyebrow={eyebrowOf(state, breakCard ? "1st innings" : "Match summary")}
        title={
          breakCard
            ? "Innings break"
            : (state.result_description ?? `${state.team1_name} v ${state.team2_name}`)
        }
        aside={aside}
      >
        {shown.map((inn, i) => (
          <InningsBlock key={inn.id} state={state} match={match} innings={inn} index={i} />
        ))}
        {breakCard && first && (
          <p className={cn(s.rise, s.semi, "mt-2 text-[1.375rem] font-bold text-[color:var(--sb-mist)]")} style={delay(600)}>
            {(() => {
              const chasing = innings.find((i) => i.innings_number === 2);
              const name = chasing
                ? inningsSide(state, chasing, match).name
                : firstSide?.name === state.team1_name
                  ? state.team2_name
                  : state.team1_name;
              const overs = state.dls_overs ?? state.overs_per_innings;
              return `${name ?? "The chase"} need ${first.total_runs + 1} to win${overs ? ` from ${overs} overs` : ""}`;
            })()}
          </p>
        )}
      </Card>
    </CardPlace>
  );
}

// ---- the stand, the over, estimates --------------------------------------------------

function PartnershipCardView({ state, match, split }: { state: LiveMatchState; match: Match | null; split: boolean }) {
  if (state.partnership_runs === null || !state.striker_name || !state.non_striker_name) return null;
  const current = match?.innings?.find((i) => i.innings_number === state.innings_number);
  const stand = current?.partnerships?.find((p) => p.is_current);
  const share = (id: string | null | undefined) => {
    if (!stand || !id) return null;
    if (stand.batsman1_id === id) return { r: stand.batsman1_runs, b: stand.batsman1_balls };
    if (stand.batsman2_id === id) return { r: stand.batsman2_runs, b: stand.batsman2_balls };
    return null;
  };
  const rows = [
    { id: state.striker_id, name: state.striker_name },
    { id: state.non_striker_id, name: state.non_striker_name },
  ].map((r) => ({ ...r, own: share(r.id) }));
  const total = Math.max(1, state.partnership_runs ?? 0);
  const side = sideOfName(state, state.batting_team_name) ?? "t1";
  const known = rows.every((r) => r.own?.r != null);
  return (
    <CardPlace state={state}>
      <Card
        side={side}
        neon="lime"
        width={1180}
        eyebrow={eyebrowOf(state, split ? "Partnership split" : "Partnership")}
        title={`${rows[0]!.name} & ${rows[1]!.name}`}
        aside={
          <AsideScore
            score={<Num value={state.partnership_runs ?? 0} />}
            detail={`off ${state.partnership_balls ?? 0} balls`}
          />
        }
      >
        <div className="grid grid-cols-2 gap-8">
          {rows.map((r, i) => (
            <div key={r.id ?? r.name} className={cn(s.rise, "flex items-center gap-5")} style={delay(240 + i * 120)}>
              <span
                style={sideStyle(side)}
                className={cn(s.team, s.display, "flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-[1.75rem]")}
              >
                <span className="relative z-10">{initialsOf(r.name)}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn(s.semi, s.caps, "block truncate text-[1.625rem] font-bold")}>{r.name}</span>
                {r.own?.r != null && (
                  <span className="flex items-baseline gap-2">
                    <span className={cn(s.figures, "text-[3rem] leading-none")} style={{ fontWeight: 800 }}>
                      {r.own.r}
                    </span>
                    <span className={cn(s.figures, "text-[1.25rem] text-[color:var(--sb-mist)]")} style={{ fontWeight: 500 }}>
                      ({r.own.b ?? 0})
                    </span>
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
        {known && (
          <div className="mt-6" style={sideStyle(side)}>
            <div className="flex h-5 overflow-hidden rounded-[3px] bg-white/10">
              <span className={s.growX} style={{ width: `${Math.round(((rows[0]!.own!.r ?? 0) / total) * 100)}%`, background: "var(--sb-lime)", boxShadow: "0 0 14px var(--sb-lime)", ...delay(420) }} />
              <span className={s.growXEnd} style={{ width: `${Math.round(((rows[1]!.own!.r ?? 0) / total) * 100)}%`, marginLeft: "auto", background: "var(--glow)", boxShadow: "0 0 14px var(--glow)", ...delay(420) }} />
            </div>
          </div>
        )}
      </Card>
    </CardPlace>
  );
}

function ThisOverCard({ state, match }: { state: LiveMatchState; match: Match | null }) {
  const tokens = overTokens(state);
  if (!tokens.length) return null;
  const over = (state.current_over ?? 0) + 1;
  const econ = economyText(state.bowler_runs, state.bowler_balls);
  const bpo = ballsPerOverOf(match);
  return (
    <CardPlace state={state}>
      <Card
        neon="cyan"
        width={1100}
        eyebrow={eyebrowOf(state, `Over ${over}`)}
        title={`${state.this_over_runs ?? 0} ${state.this_over_runs === 1 ? "run" : "runs"} this over`}
        aside={<AsideScore score={`${state.total_runs ?? 0}/${state.total_wickets ?? 0}`} detail={teamCode(state.batting_team_short_name, state.batting_team_name)} />}
      >
        <div className="flex justify-center py-4">
          <BallChips tokens={tokens} slots={Math.max(bpo, tokens.length)} size={84} />
        </div>
        {state.current_bowler_name && (
          <div className={cn(s.rise, "mt-4 flex items-center gap-6 border-t border-white/10 pt-5")} style={delay(700)}>
            <Tag neon="cyan">Bowler</Tag>
            <span className={cn(s.display, "min-w-0 flex-1 truncate text-[1.75rem] uppercase")}>{state.current_bowler_name}</span>
            <span className={cn(s.figures, "text-[2rem]")} style={{ fontWeight: 800 }}>
              {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0}
            </span>
            <span className={cn(s.figures, "text-[1.25rem] text-[color:var(--sb-mist)]")} style={{ fontWeight: 500 }}>
              {oversText(state.bowler_balls)} ov{econ ? ` · Econ ${econ}` : ""}
            </span>
          </div>
        )}
      </Card>
    </CardPlace>
  );
}

function EstimateCard({ state }: { state: LiveMatchState }) {
  const est = winPredictorFromLive(state);
  if (!est) return null;
  const bat = sideOfName(state, state.batting_team_name) ?? "t1";
  const bowl = sideOfName(state, state.bowling_team_name) ?? "t2";
  const batCode = teamCode(state.batting_team_short_name, state.batting_team_name);
  const bowlCode = teamCode(state.bowling_team_short_name, state.bowling_team_name);
  if (est.kind === "projection") {
    const lo = Math.max(0, est.low - 20);
    const hi = est.high + 20;
    const at = (v: number) => `${((v - lo) / Math.max(1, hi - lo)) * 100}%`;
    return (
      <CardPlace state={state}>
        <Card neon="cyan" width={1180} eyebrow={eyebrowOf(state, "Estimate")} title="Projected score" aside={<AsideScore score={`${est.low}-${est.high}`} detail="Likely range" />}>
          <div className="relative mx-6 mb-4 mt-16 h-6 rounded-full bg-white/10">
            <span className={cn(s.growX, "absolute inset-y-0 rounded-full")} style={{ left: at(est.low), width: `calc(${at(est.high)} - ${at(est.low)})`, background: "linear-gradient(90deg, var(--sb-cyan), var(--sb-magenta))", boxShadow: "0 0 18px var(--sb-cyan-haze)", ...delay(300) }} />
            <span className={cn(s.pop, "absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center")} style={{ left: at(est.mid), ...delay(600) }}>
              <span className={cn(s.figures, "absolute bottom-9 text-[2.25rem]")} style={{ fontWeight: 800 }}>
                {est.mid}
              </span>
              <span className="h-10 w-10 rounded-full border-4 border-[color:var(--sb-ink)] bg-white" style={{ boxShadow: "0 0 18px #fff" }} />
            </span>
            <span className={cn(s.figures, "absolute -bottom-9 text-[1.25rem] text-[color:var(--sb-mist)]")} style={{ left: at(est.low), transform: "translateX(-50%)" }}>
              {est.low}
            </span>
            <span className={cn(s.figures, "absolute -bottom-9 text-[1.25rem] text-[color:var(--sb-mist)]")} style={{ left: at(est.high), transform: "translateX(-50%)" }}>
              {est.high}
            </span>
          </div>
          <p className={cn(s.semi, "mt-14 text-[1.375rem] font-semibold text-[color:var(--sb-mist)]")}>
            {state.batting_team_name} are {state.total_runs}/{state.total_wickets}. At this rate, with the overs and wickets left, they would most likely finish around {est.mid}.
          </p>
        </Card>
      </CardPlace>
    );
  }
  return (
    <CardPlace state={state}>
      <Card neon="magenta" width={1180} eyebrow={eyebrowOf(state, "Estimate")} title="Win predictor" aside={<span className={cn(s.label, "text-[1.25rem] text-[color:var(--sb-yellow)]")}>Need {est.runsNeeded} from {est.ballsLeft}</span>}>
        <div className="flex items-end justify-between">
          {[
            { code: batCode, pct: est.battingPct, side: bat },
            { code: bowlCode, pct: est.bowlingPct, side: bowl },
          ].map((t, i) => (
            <div key={t.code} className={cn(s.pop, "flex flex-col", i ? "items-end" : "items-start")} style={delay(200 + i * 120)}>
              <span className={cn(s.display, "text-[2rem] uppercase")} style={{ color: `var(--sb-${t.side}-glow)` }}>
                {t.code}
              </span>
              <span className={cn(s.figures, "text-[5rem] leading-none")} style={{ fontWeight: 800, textShadow: `0 0 24px var(--sb-${t.side}-haze)` }}>
                <Num value={t.pct} />%
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <TugBar left={est.battingPct} right={est.bowlingPct} leftSide={bat} rightSide={bowl} height={26} />
        </div>
        <p className={cn(s.semi, "mt-4 text-[1.125rem] font-semibold text-[color:var(--sb-mist)]")}>
          From the runs needed, balls and wickets left, against the first innings' scoring rate.
        </p>
      </Card>
    </CardPlace>
  );
}

export {
  BowlingCard,
  EstimateCard,
  FallOfWicketsCard,
  LeaderboardCard,
  MatchIntroCard,
  NextFixtureCard,
  PartnershipCardView,
  PlayingXiCard,
  PointsTableCard,
  ResultCard,
  ScorecardCard,
  SummaryCard,
  ThisOverCard,
  TossCard,
};
