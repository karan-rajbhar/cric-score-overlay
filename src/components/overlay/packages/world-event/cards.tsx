"use client";

/**
 * World event's full-screen cards: batting and bowling cards (alternating
 * lavender rows, the batters in at the crease on the event accent, the
 * total in a highlighted box), the fall of wickets, playing XIs with role
 * chips, the toss, the match intro, the result, the match summary, the
 * innings break, the partnership and this over.
 */

import type { ReactNode } from "react";
import { formatFowOvers } from "~/lib/cricket";
import type { BattingPerformance, Innings, Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { economyText, overTokens, oversText, strikeRateText } from "../../overlay-kit";
import { tossWinnerName } from "../../presentation-card-views";
import { inningsLabel } from "../../scorecard-cards";
import type { LiveMatchState } from "../../types";
import type { OverlayElementProps } from "../types";
import {
  battingAndBowling,
  dismissalText,
  fixed2,
  mainInnings,
  matchTitleOf,
  ordinal,
  scoreText,
  sideOfInnings,
  teamsOf,
  winnerSide,
  xiOf,
  type SideInfo,
  type XiEntry,
} from "./data";
import { standShares } from "./lower-thirds";
import { chaseLine, inningsLeaders } from "../shared/derive";
import {
  Balls,
  BUG_HEIGHT,
  CardFrame,
  Crest,
  delay,
  Fig,
  Root,
  side,
  Tab,
  useLocalTime,
} from "./kit";
import { FULL_FRAME, lowerThirdAnchor, SAFE } from "../shared/layout";

const TH = "we-label we-ink-muted px-3 py-2.5 text-right text-[16px]";
const TD = "we-fig px-3 py-2 text-right text-[24px]";

/** The side batting in `innings`, as team info. */
function teamOfInnings(state: LiveMatchState, innings: Innings, match: Match | null): SideInfo {
  const n = sideOfInnings(state, innings, match);
  return teamsOf(state)[n - 1]!;
}

/** "Metro T20 League · 1st innings". */
function eyebrow(state: LiveMatchState, label: string): string {
  const source = state.tournament_name ?? state.title;
  return source ? `${label}  ·  ${source}` : label;
}

/** The total in the event's highlighted box. */
function TotalBox({ innings, label = "Total" }: { innings: Innings; label?: string }) {
  return (
    <span className="we-accent we-sheen relative flex items-baseline gap-3 px-6 py-2">
      <span className="we-label">{label}</span>
      <span className="we-fig text-[34px] leading-none">{scoreText(innings.total_runs, innings.total_wickets)}</span>
      <span className="we-figl text-[20px] opacity-85">({oversText(innings.total_balls)} ov)</span>
    </span>
  );
}

// ---- batting and bowling cards -----------------------------------------------

function BattingRows({ innings, start = 300 }: { innings: Innings; start?: number }) {
  const rows = (innings.batting_performances ?? []).filter(
    (b) => b.balls_faced > 0 || b.is_out || b.is_current_batsman,
  );
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={cn(TH, "text-left")}>Batter</th>
          <th className={cn(TH, "text-left")}>
            <span className="sr-only">How out</span>
          </th>
          <th className={TH}>R</th>
          <th className={TH}>B</th>
          <th className={cn(TH, "normal-case")}>4s</th>
          <th className={cn(TH, "normal-case")}>6s</th>
          <th className={TH}>SR</th>
        </tr>
      </thead>
      <tbody className="we-rows">
        {rows.map((b, i) => (
          <tr
            key={b.id}
            className={cn("we-a-rise", b.is_current_batsman && !b.is_out && "we-row-hl")}
            style={delay(start + i * 40)}
          >
            <td className="we-name we-trunc max-w-[300px] px-3 py-2 text-left text-[23px]">
              {b.user?.full_name ?? ""}
              {b.is_current_batsman && !b.is_out && b.is_striker ? " *" : ""}
            </td>
            <td className="we-ink-muted we-trunc max-w-[360px] px-3 py-2 text-left text-[20px] font-semibold">
              {dismissalText(b, innings)}
            </td>
            <td className={cn(TD, "text-[28px]")}>{b.runs_scored}</td>
            <td className={cn(TD, "we-figl")}>{b.balls_faced}</td>
            <td className={cn(TD, "we-figl")}>{b.fours}</td>
            <td className={cn(TD, "we-figl")}>{b.sixes}</td>
            <td className={cn(TD, "we-figl")}>{strikeRateText(b.runs_scored, b.balls_faced) ?? "–"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BowlingRows({ innings, start = 300 }: { innings: Innings; start?: number }) {
  const rows = (innings.bowling_performances ?? []).filter((b) => b.balls_bowled > 0 || b.is_current_bowler);
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={cn(TH, "text-left")}>Bowler</th>
          <th className={TH}>O</th>
          <th className={TH}>M</th>
          <th className={TH}>R</th>
          <th className={TH}>W</th>
          <th className={TH}>Econ</th>
        </tr>
      </thead>
      <tbody className="we-rows">
        {rows.map((b, i) => (
          <tr key={b.id} className={cn("we-a-rise", b.is_current_bowler && "we-row-hl")} style={delay(start + i * 40)}>
            <td className="we-name we-trunc max-w-[300px] px-3 py-2 text-left text-[23px]">{b.user?.full_name ?? ""}</td>
            <td className={cn(TD, "we-figl")}>{oversText(b.balls_bowled)}</td>
            <td className={cn(TD, "we-figl")}>{b.maidens}</td>
            <td className={cn(TD, "we-figl")}>{b.runs_conceded}</td>
            <td className={cn(TD, "text-[28px]")}>{b.wickets_taken}</td>
            <td className={cn(TD, "we-figl")}>{economyText(b.runs_conceded, b.balls_bowled) ?? "–"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function extrasLine(innings: Innings): string {
  return `Extras ${innings.extras_total ?? 0}  (b ${innings.extras_byes ?? 0}, lb ${innings.extras_leg_byes ?? 0}, w ${innings.extras_wides ?? 0}, nb ${innings.extras_no_balls ?? 0})`;
}

/** Playing XI members of the batting side who have not batted. */
function yetToBat(innings: Innings, match: Match | null, n: 1 | 2): string[] {
  const team = n === 1 ? match?.team1 : match?.team2;
  const batted = new Set(
    (innings.batting_performances ?? [])
      .filter((b: BattingPerformance) => b.balls_faced > 0 || b.is_out || b.is_current_batsman)
      .map((b) => b.user_id),
  );
  return xiOf(team)
    .filter((p) => !batted.has(p.userId))
    .map((p) => p.name);
}

function InningsHeader({ team, other, label }: { team: SideInfo; other: SideInfo; label: string }) {
  return (
    <span className="flex min-w-0 items-baseline gap-4">
      <span className="we-trunc">{team.name}</span>
      <span className="we-muted shrink-0 text-[26px] font-bold normal-case tracking-normal">
        {label} v {other.code}
      </span>
    </span>
  );
}

export function WorldEventScorecard(p: OverlayElementProps["scorecard"]) {
  const team = teamOfInnings(p.state, p.innings, p.match);
  const other = teamsOf(p.state)[team.n === 1 ? 1 : 0]!;
  const ytb = yetToBat(p.innings, p.match, team.n);
  const done = p.innings.is_completed;
  return (
    <CardFrame
      state={p.state}
      testId="we-scorecard"
      eyebrow={eyebrow(p.state, inningsLabel(p.innings.innings_number))}
      crest={<Crest n={team.n} logo={team.logo} code={team.code} name={team.name} size={76} className="we-a-pop" style={delay(200)} />}
      title={<InningsHeader team={team} other={other} label="batting" />}
      width={p.full ? 1728 : 1440}
      bodyClassName="px-6 py-4"
      footer={
        <>
          <span className="we-figl we-muted text-[20px]">{extrasLine(p.innings)}</span>
          {ytb.length > 0 && (
            <span className="we-trunc min-w-0 flex-1 text-[20px] font-semibold">
              <span className="we-label we-muted mr-3">{done ? "Did not bat" : "Yet to bat"}</span>
              {ytb.join(", ")}
            </span>
          )}
          <span className="ml-auto shrink-0">
            <TotalBox innings={p.innings} />
          </span>
        </>
      }
    >
      {p.full ? (
        <div className="grid grid-cols-[1.55fr_1fr] gap-8">
          <BattingRows innings={p.innings} />
          <div className="border-l pl-8 we-hair-ink">
            <BowlingRows innings={p.innings} start={420} />
          </div>
        </div>
      ) : (
        <BattingRows innings={p.innings} />
      )}
    </CardFrame>
  );
}

export function WorldEventBowlingCard(p: OverlayElementProps["bowlingCard"]) {
  const batting = teamOfInnings(p.state, p.innings, p.match);
  const team = teamsOf(p.state)[batting.n === 1 ? 1 : 0]!;
  return (
    <CardFrame
      state={p.state}
      testId="we-bowling-card"
      eyebrow={eyebrow(p.state, inningsLabel(p.innings.innings_number))}
      crest={<Crest n={team.n} logo={team.logo} code={team.code} name={team.name} size={76} className="we-a-pop" style={delay(200)} />}
      title={<InningsHeader team={team} other={batting} label="bowling" />}
      width={1240}
      bodyClassName="px-6 py-4"
      footer={
        <>
          <span className="we-figl we-muted text-[20px]">{extrasLine(p.innings)}</span>
          <span className="ml-auto">
            <TotalBox innings={p.innings} label={batting.code} />
          </span>
        </>
      }
    >
      <BowlingRows innings={p.innings} />
    </CardFrame>
  );
}

// ---- fall of wickets ---------------------------------------------------------

export function WorldEventFallOfWickets(p: OverlayElementProps["fallOfWickets"]) {
  const fow = [...(p.innings.fall_of_wickets ?? [])].sort((a, b) => a.wicket_number - b.wicket_number);
  if (!fow.length) return null;
  const team = teamOfInnings(p.state, p.innings, p.match);
  const total = Math.max(1, p.innings.total_runs ?? 1);
  return (
    <CardFrame
      state={p.state}
      testId="we-fow"
      eyebrow={eyebrow(p.state, inningsLabel(p.innings.innings_number))}
      crest={<Crest n={team.n} logo={team.logo} code={team.code} name={team.name} size={76} className="we-a-pop" style={delay(200)} />}
      title={<span className="we-trunc">Fall of wickets</span>}
      aside={
        <span className="flex flex-col items-end">
          <span className="we-label we-muted">{team.code}</span>
          <span className="we-fig text-[44px] leading-none">{scoreText(p.innings.total_runs, p.innings.total_wickets)}</span>
        </span>
      }
      width={1560}
    >
      <div className="relative mb-6 mt-2 h-[14px] bg-[#e4e0f5]" style={side(team.n)}>
        <span className="we-a-grow-x absolute inset-y-0 left-0 w-full" style={{ background: "var(--we-side-light)", ...delay(300) }} />
        {fow.map((f, i) => (
          <span
            key={f.wicket_number}
            className="absolute top-1/2 h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${Math.min(100, (f.runs_at_fall / total) * 100)}%` }}
          >
            <span className="we-a-pop block h-full w-full rounded-full bg-[#d4142a] shadow-[0_0_0_3px_#fff]" style={delay(500 + i * 60)} />
          </span>
        ))}
      </div>
      <ol className="grid grid-cols-5 gap-3">
        {fow.map((f, i) => (
          <li key={f.wicket_number} className="we-a-rise flex min-w-0 flex-col border-t-[5px] border-[#d4142a] bg-[#f2f0fb] px-4 py-3" style={delay(380 + i * 50)}>
            <span className="we-fig text-[38px] leading-none">
              {f.runs_at_fall}-{f.wicket_number}
            </span>
            <span className="we-name we-trunc mt-1.5 text-[20px]">{f.batsman?.full_name ?? ""}</span>
            <span className="we-figl we-ink-muted text-[18px]">{formatFowOvers(f.overs_at_fall)} ov</span>
          </li>
        ))}
      </ol>
    </CardFrame>
  );
}

// ---- playing XI ----------------------------------------------------------------

/** A playing role's chip colour: batters indigo, bowlers teal, all-rounders the accent, keepers gold. */
function roleTone(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("all")) return "we-accent";
  if (r.includes("keep")) return "we-gold";
  if (r.includes("bowl")) return "bg-[#0d6b5e] text-white";
  return "bg-[#140a4f] text-white";
}

function RoleChip({ role }: { role: string | null }) {
  if (!role) return null;
  return <span className={cn("we-label shrink-0 px-2.5 py-1 text-[15px]", roleTone(role))}>{role}</span>;
}

function XiRow({ p, i, start, big }: { p: XiEntry; i: number; start: number; big?: boolean }) {
  return (
    <li className="we-a-rise flex min-w-0 items-center gap-4 px-4" style={{ ...delay(start + i * 40), height: big ? 50 : 46 }}>
      <span className="we-fig w-8 shrink-0 text-right text-[22px] text-[#a9108f]">{i + 1}</span>
      <span className={cn("we-name we-trunc flex-1", big ? "text-[26px]" : "text-[23px]")}>
        {p.name}
        {p.mark && <span className="ml-2 text-[0.85em] font-bold normal-case text-[#dc0078]">{p.mark}</span>}
      </span>
      <RoleChip role={p.role} />
    </li>
  );
}

function XiColumn({ team, players, start }: { team: SideInfo; players: XiEntry[]; start: number }) {
  return (
    <div className="min-w-0">
      <div className="we-team we-a-wipe-r flex h-[74px] items-center gap-4 px-5" style={{ ...side(team.n), ...delay(start - 120) }}>
        <Crest n={team.n} logo={team.logo} code={team.code} name={team.name} size={52} />
        <span className="we-x we-trunc text-[28px]">{team.name}</span>
      </div>
      <ol className="we-rows">
        {players.map((p, i) => (
          <XiRow key={p.id} p={p} i={i} start={start} />
        ))}
      </ol>
    </div>
  );
}

const ORDER_GROUPS: Array<[string, number, number]> = [
  ["Top order", 0, 3],
  ["Middle order", 3, 7],
  ["Lower order", 7, 11],
];

export function WorldEventPlayingXi(p: OverlayElementProps["playingXi"]) {
  const [t1, t2] = teamsOf(p.state);
  const one = xiOf(p.match?.team1);
  const two = xiOf(p.match?.team2);
  if (p.side === null) {
    if (!one.length && !two.length) return null;
    return (
      <CardFrame state={p.state} testId="we-xi" eyebrow={eyebrow(p.state, "Team line-ups")} title="Playing XI" width={1600} bodyClassName="px-0 py-0">
        <div className="grid grid-cols-2">
          <XiColumn team={t1} players={one} start={320} />
          <div className="border-l we-hair-ink">
            <XiColumn team={t2} players={two} start={380} />
          </div>
        </div>
      </CardFrame>
    );
  }
  const team = p.side === 1 ? t1 : t2;
  const players = p.side === 1 ? one : two;
  if (!players.length) return null;
  const groups = players.length === 11 ? ORDER_GROUPS : [["Batting order", 0, players.length] as [string, number, number]];
  return (
    <Root state={p.state} data-testid="we-xi-team" className="flex items-center justify-center" style={FULL_FRAME}>
      <section className="we-lift relative flex w-full max-w-[1500px] items-stretch">
        <div className="absolute -top-[38px] left-0 z-10">
          <Tab className="we-a-drop" style={delay(260)}>
            {eyebrow(p.state, "Playing XI")}
          </Tab>
        </div>
        <div className="we-a-slide-r flex w-[440px] shrink-0">
          <div className="we-team flex w-full flex-col items-center justify-center gap-6 px-8 py-10 text-center" style={side(team.n)}>
            <Crest n={team.n} logo={team.logo} code={team.code} name={team.name} size={200} className="we-a-pop" style={delay(260)} />
            <span className="we-x text-[44px] leading-[1.05] [text-wrap:balance]">{team.name}</span>
            <span className="we-label opacity-85">Playing XI</span>
          </div>
        </div>
        <div className="we-paper we-on-paper we-a-wipe-r flex min-w-0 flex-1 flex-col py-4" style={delay(120)}>
          {groups.map(([label, from, to], g) => (
            <div key={label} className="min-w-0">
              <div className="we-label we-a-fade flex items-center gap-3 px-6 pb-1 pt-3 text-[15px] text-[#a9108f]" style={delay(260 + g * 120)}>
                {label}
                <span className="h-[2px] flex-1 bg-[#ebe8f8]" />
              </div>
              <ol>
                {players.slice(from, to).map((pl, i) => (
                  <XiRow key={pl.id} p={pl} i={from + i} start={320} big />
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </Root>
  );
}

// ---- toss and match intro ---------------------------------------------------------

export function WorldEventToss(p: OverlayElementProps["toss"]) {
  const winner = tossWinnerName(p.state, p.match);
  if (!winner) return null;
  const [t1, t2] = teamsOf(p.state);
  const win = winner === t1.name ? t1 : t2;
  const lose = win.n === 1 ? t2 : t1;
  const choice = p.state.toss_decision === "bowl" ? "bowl" : "bat";
  return (
    <Root state={p.state} data-testid="we-toss" className="inset-x-0 flex justify-center" style={{ bottom: 250, padding: `0 ${SAFE.x}px` }}>
      <div className="relative w-full max-w-[1500px]">
        <div className="absolute -top-[38px] left-[140px] z-10">
          <Tab className="we-a-drop" style={delay(300)}>
            {eyebrow(p.state, "The toss")}
          </Tab>
        </div>
        <div className="we-lift flex h-[150px] items-stretch bg-[#0a0532]">
          <div className="we-a-slide-r relative z-10 flex w-[170px] shrink-0">
            <div className="we-team we-cut-r flex w-full items-center justify-center pr-4" style={{ ...side(win.n), ["--we-cut" as string]: "28px" }}>
              <Crest n={win.n} logo={win.logo} code={win.code} name={win.name} size={100} className="we-a-pop" style={delay(240)} />
            </div>
          </div>
          <div className="we-paper we-a-wipe-r -ml-[28px] flex min-w-0 flex-1 flex-col justify-center pl-14 pr-10" style={delay(100)}>
            <span className="we-name we-trunc text-[48px] leading-tight">{win.name}</span>
            <span className="we-label mt-1 text-[22px] text-[#a9108f]">Won the toss</span>
          </div>
          <div className="we-accent we-sheen we-a-wipe-l relative flex w-[260px] shrink-0 flex-col items-center justify-center" style={delay(260)}>
            <span className="we-label opacity-90">Elected to</span>
            <span className="we-x text-[64px] leading-none">{choice}</span>
          </div>
          <div className="we-a-slide-l flex w-[170px] shrink-0 opacity-90">
            <div className="we-night we-cut-l flex w-full items-center justify-center pl-4" style={{ ["--we-cut" as string]: "28px" }}>
              <Crest n={lose.n} logo={lose.logo} code={lose.code} name={lose.name} size={74} />
            </div>
          </div>
        </div>
        {(p.state.venue || p.state.umpire1_name) && (
          <div className="we-night2 we-a-wipe-down flex h-[50px] items-center gap-8 px-[170px] text-[20px] font-semibold" style={delay(320)}>
            {p.state.venue && <span className="we-trunc">{p.state.venue}</span>}
            {p.state.umpire1_name && (
              <span className="we-muted we-trunc">
                Umpires {p.state.umpire1_name}
                {p.state.umpire2_name ? ` and ${p.state.umpire2_name}` : ""}
              </span>
            )}
          </div>
        )}
      </div>
    </Root>
  );
}

function IntroSide({ team, at }: { team: SideInfo; at: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 flex-1", at === "left" ? "we-a-slide-r" : "we-a-slide-l")} style={delay(80)}>
      <div
        className={cn("we-team flex w-full flex-col items-center justify-center gap-6 py-10", at === "left" ? "we-chev-r pr-16" : "we-chev-l pl-16")}
        style={{ ...side(team.n), ["--we-cut" as string]: "70px" }}
      >
        <Crest n={team.n} logo={team.logo} code={team.code} name={team.name} size={220} className="we-a-pop" style={delay(320)} />
        <span className="we-x we-trunc max-w-full px-6 text-center text-[50px] leading-[1.05]">{team.name}</span>
      </div>
    </div>
  );
}

export function WorldEventMatchIntro(p: OverlayElementProps["matchIntro"]) {
  const start = useLocalTime(p.match?.scheduled_at);
  const [t1, t2] = teamsOf(p.state);
  if (!t1.name || !t2.name) return null;
  const toss = tossWinnerName(p.state, p.match);
  const info = [
    p.state.venue,
    start,
    toss && `${toss} won the toss and elected to ${p.state.toss_decision === "bowl" ? "bowl" : "bat"}`,
  ].filter(Boolean);
  const title = matchTitleOf(p.state);
  return (
    <Root state={p.state} data-testid="we-intro" className="flex flex-col items-center justify-center" style={FULL_FRAME}>
      <div className="mb-5 flex flex-col items-center gap-2">
        {p.state.tournament_name && (
          <span className="we-accent we-label we-trap we-a-drop px-10 py-2 text-[22px]" style={{ ["--we-cut" as string]: "14px", ...delay(200) }}>
            {p.state.tournament_name}
          </span>
        )}
        {title && (
          <span className="we-night we-x we-a-drop px-8 py-2 text-[26px]" style={delay(300)}>
            {title}
          </span>
        )}
      </div>
      <div className="we-lift relative flex h-[440px] w-full max-w-[1600px] items-stretch bg-[#0a0532]">
        <IntroSide team={t1} at="left" />
        <IntroSide team={t2} at="right" />
        <span className="absolute left-1/2 top-1/2 h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2">
          <span className="we-accent we-x we-a-pop flex h-full w-full items-center justify-center rounded-full text-[48px] shadow-[0_0_0_8px_#0a0532,0_12px_30px_rgba(6,3,30,0.5)]" style={delay(520)}>
            v
          </span>
        </span>
      </div>
      {info.length > 0 && (
        <div className="we-paper we-a-wipe-down flex w-full max-w-[1600px] items-center justify-center gap-10 px-10 py-4 text-[24px] font-bold" style={delay(420)}>
          {info.map((s, i) => (
            <span key={i} className={cn("we-trunc", i > 0 && "border-l-2 border-[#dc0078] pl-10")}>
              {s}
            </span>
          ))}
        </div>
      )}
    </Root>
  );
}

// ---- result, summary, innings break ---------------------------------------------

function SideScore({ state, innings, match, won, start }: { state: LiveMatchState; innings: Innings; match: Match | null; won: boolean; start: number }) {
  const team = teamOfInnings(state, innings, match);
  return (
    <div className="we-a-rise flex h-[88px] items-center gap-5 pr-6" style={delay(start)}>
      <div className="we-team flex h-full w-[110px] shrink-0 items-center justify-center" style={side(team.n)}>
        <Crest n={team.n} logo={team.logo} code={team.code} name={team.name} size={60} />
      </div>
      <span className="we-name we-trunc flex-1 text-[30px]">{team.name}</span>
      {won && <span className="we-gold we-label px-3 py-1 text-[15px]">Won</span>}
      <span className="we-fig text-[44px]">{scoreText(innings.total_runs, innings.total_wickets)}</span>
      <span className="we-figl we-ink-muted w-[110px] text-[22px]">({oversText(innings.total_balls)} ov)</span>
    </div>
  );
}

export function WorldEventResult(p: OverlayElementProps["result"]) {
  if (!p.state.result_description) return null;
  const won = winnerSide(p.state);
  const team = won ? teamsOf(p.state)[won - 1]! : null;
  const main = mainInnings(p.innings);
  const potm = p.match?.player_of_the_match?.full_name;
  return (
    <CardFrame
      state={p.state}
      testId="we-result"
      eyebrow={eyebrow(p.state, "Result")}
      crest={team && <Crest n={team.n} logo={team.logo} code={team.code} name={team.name} size={86} className="we-a-pop" style={delay(200)} />}
      title={<span className="block whitespace-normal [text-wrap:balance]">{p.state.result_description}</span>}
      width={1300}
      bodyClassName="px-0 py-0"
      footer={
        potm ? (
          <span className="flex items-center gap-4">
            <span className="we-gold we-label px-3 py-1">Player of the match</span>
            <span className="we-name text-[26px]">{potm}</span>
          </span>
        ) : undefined
      }
    >
      {main.length > 0 && (
        <div className="we-rows">
          {main.map((inn, i) => (
            <SideScore key={inn.id} state={p.state} innings={inn} match={p.match} won={won === sideOfInnings(p.state, inn, p.match)} start={320 + i * 90} />
          ))}
        </div>
      )}
    </CardFrame>
  );
}

function LeaderList({ innings, start }: { innings: Innings; start: number }) {
  const { batters, bowlers } = inningsLeaders(innings, 3, 3);
  const row = "we-a-rise flex h-[46px] items-center gap-3 px-5";
  return (
    <div className="grid grid-cols-2">
      <ol className="we-rows border-r we-hair-ink">
        {batters.map((b, i) => (
          <li key={b.id} className={row} style={delay(start + i * 40)}>
            <span className="we-name we-trunc flex-1 text-[22px]">{b.user?.full_name ?? ""}</span>
            <span className="we-fig text-[26px]">
              {b.runs_scored}
              {!b.is_out && "*"}
            </span>
            <span className="we-figl we-ink-muted w-[56px] text-[19px]">({b.balls_faced})</span>
          </li>
        ))}
      </ol>
      <ol className="we-rows">
        {bowlers.map((b, i) => (
          <li key={b.id} className={row} style={delay(start + 60 + i * 40)}>
            <span className="we-name we-trunc flex-1 text-[22px]">{b.user?.full_name ?? ""}</span>
            <span className="we-fig text-[26px]">
              {b.wickets_taken}-{b.runs_conceded}
            </span>
            <span className="we-figl we-ink-muted w-[64px] text-[19px]">({oversText(b.balls_bowled)})</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function InningsBand({ state, innings, match, start }: { state: LiveMatchState; innings: Innings; match: Match | null; start: number }) {
  const team = teamOfInnings(state, innings, match);
  return (
    <div>
      <div className="we-team we-a-wipe-r flex h-[64px] items-center gap-4 px-5" style={{ ...side(team.n), ...delay(start) }}>
        <Crest n={team.n} logo={team.logo} code={team.code} name={team.name} size={44} />
        <span className="we-x we-trunc flex-1 text-[26px]">{team.name}</span>
        <span className="we-fig text-[34px]">{scoreText(innings.total_runs, innings.total_wickets)}</span>
        <span className="we-figl text-[20px] opacity-85">({oversText(innings.total_balls)} ov)</span>
      </div>
      <LeaderList innings={innings} start={start + 120} />
    </div>
  );
}

export function WorldEventMatchSummary(p: OverlayElementProps["matchSummary"]) {
  const main = mainInnings(p.innings);
  if (!main.length) return null;
  const chase = chaseLine(p.state);
  const title = p.state.result_description ?? `${p.state.team1_name} v ${p.state.team2_name}`;
  return (
    <CardFrame
      state={p.state}
      testId="we-summary"
      eyebrow={eyebrow(p.state, "Match summary")}
      title={<span className="we-trunc block">{title}</span>}
      aside={
        !p.state.result_description && chase ? (
          <span className="we-label text-[20px] text-[#bdf7e8]">
            {chase.text}
          </span>
        ) : undefined
      }
      width={1500}
      bodyClassName="px-0 py-0"
    >
      <div className="flex flex-col gap-1">
        {main.map((inn, i) => (
          <InningsBand key={inn.id} state={p.state} innings={inn} match={p.match} start={300 + i * 200} />
        ))}
      </div>
    </CardFrame>
  );
}

export function WorldEventInningsBreak(p: OverlayElementProps["inningsBreak"]) {
  const first = mainInnings(p.innings).find((i) => i.innings_number === 1);
  if (!first) return null;
  const batFirst = teamOfInnings(p.state, first, p.match);
  const chasing = teamsOf(p.state)[batFirst.n === 1 ? 1 : 0]!;
  const target = p.state.target_runs ?? first.total_runs + 1;
  const overs = p.state.dls_overs ?? p.state.overs_per_innings;
  const rrr = overs ? fixed2((target * 6) / (overs * 6)) : null;
  return (
    <CardFrame
      state={p.state}
      testId="we-innings-break"
      eyebrow={eyebrow(p.state, "Innings break")}
      title={<span className="we-trunc block">{batFirst.name}</span>}
      crest={<Crest n={batFirst.n} logo={batFirst.logo} code={batFirst.code} name={batFirst.name} size={76} className="we-a-pop" style={delay(200)} />}
      aside={
        <span className="flex items-baseline gap-3">
          <span className="we-fig text-[50px] leading-none">{scoreText(first.total_runs, first.total_wickets)}</span>
          <span className="we-figl we-muted text-[22px]">({oversText(first.total_balls)} ov)</span>
        </span>
      }
      width={1500}
      bodyClassName="px-0 py-0"
      footer={
        <span className="flex w-full items-center gap-6">
          <Crest n={chasing.n} logo={chasing.logo} code={chasing.code} name={chasing.name} size={40} />
          <span className="we-name text-[24px]">{chasing.name} need</span>
          <span className="we-accent we-sheen we-fig relative px-5 py-1 text-[34px]">{target}</span>
          <span className="we-label we-muted">to win</span>
          {overs && (
            <span className="we-label ml-auto">
              {overs} overs{rrr ? `  ·  ${rrr} an over` : ""}
            </span>
          )}
        </span>
      }
    >
      <LeaderList innings={first} start={320} />
    </CardFrame>
  );
}

// ---- partnership, this over, player of the match --------------------------------

export function WorldEventPartnershipCard(p: OverlayElementProps["partnership"]) {
  const s = p.state;
  if (s.partnership_runs === null || !s.striker_name || !s.non_striker_name) return null;
  const { bat } = battingAndBowling(s);
  const shares = standShares(s, p.match);
  const total = Math.max(1, s.partnership_runs);
  const split = p.variant === "split";
  const person = (x: (typeof shares)[number], i: number) =>
    x && (
      <div className={cn("we-a-rise flex min-w-0 flex-col", i === 1 && "items-end text-right")} style={delay(380 + i * 80)}>
        <span className="we-name we-trunc max-w-full text-[30px]">{x.name}</span>
        {x.runs !== null && (
          <span className="flex items-baseline gap-2">
            <span className="we-fig text-[64px] leading-none">{x.runs}</span>
            <span className="we-figl we-ink-muted text-[24px]">({x.balls ?? 0})</span>
          </span>
        )}
        {!split && x.innings.runs !== null && (
          <span className="we-label we-ink-muted mt-1 text-[17px]">
            Innings {x.innings.runs} ({x.innings.balls ?? 0})
          </span>
        )}
      </div>
    );
  const a = shares[0]?.runs ?? null;
  const b = shares[1]?.runs ?? null;
  const known = a !== null && b !== null;
  return (
    <CardFrame
      state={s}
      testId={split ? "we-partnership-split" : "we-partnership-card"}
      eyebrow={eyebrow(s, `${ordinal((s.total_wickets ?? 0) + 1)} wicket`)}
      crest={<Crest n={bat.n} logo={bat.logo} code={bat.code} name={bat.name} size={76} className="we-a-pop" style={delay(200)} />}
      title="Partnership"
      aside={
        <span className="flex items-baseline gap-3">
          <Fig value={s.partnership_runs} className="we-fig text-[64px] leading-none" />
          <span className="we-label we-muted text-[20px]">off {s.partnership_balls ?? 0} balls</span>
        </span>
      }
      width={split ? 1500 : 1240}
      footer={
        <span className="we-label flex w-full gap-10 text-[19px]">
          <span>
            Stand run rate{" "}
            <span className="we-fig text-[26px]">
              {s.partnership_balls ? fixed2((s.partnership_runs * 6) / s.partnership_balls) : "–"}
            </span>
          </span>
          <span className="ml-auto">
            {bat.code} <span className="we-fig text-[26px]">{scoreText(s.total_runs, s.total_wickets)}</span>{" "}
            <span className="we-muted">({oversText(s.total_balls)} ov)</span>
          </span>
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-10 py-2">
        {person(shares[0] ?? null, 0)}
        {person(shares[1] ?? null, 1)}
      </div>
      {known && (
        <div className="mt-5 flex h-[22px] overflow-hidden" style={side(bat.n)}>
          <span className="we-a-grow-x h-full" style={{ width: `${(a / total) * 100}%`, background: "var(--we-side-light)", ...delay(560) }} />
          <span className="h-full w-[4px] bg-white" />
          <span className="we-accent we-a-grow-xr h-full flex-1" style={delay(560)} />
        </div>
      )}
      {known && (
        <div className="we-label we-ink-muted mt-2 flex justify-between text-[16px]">
          <span>{Math.round((a / total) * 100)}% of the stand</span>
          <span>{Math.round((b / total) * 100)}% of the stand</span>
        </div>
      )}
    </CardFrame>
  );
}

export function WorldEventThisOverCard({ state }: { state: LiveMatchState }) {
  const tokens = overTokens(state);
  if (!tokens.length) return null;
  const { bat, bowl } = battingAndBowling(state);
  const over = (state.current_over ?? 0) + (state.current_ball ? 1 : 0);
  const econ = economyText(state.bowler_runs, state.bowler_balls);
  const runs = state.this_over_runs ?? 0;
  return (
    <CardFrame
      state={state}
      testId="we-this-over-card"
      eyebrow={eyebrow(state, `Over ${Math.max(1, over)}`)}
      crest={<Crest n={bowl.n} logo={bowl.logo} code={bowl.code} name={bowl.name} size={76} className="we-a-pop" style={delay(200)} />}
      title={`${runs} ${runs === 1 ? "run" : "runs"} this over`}
      aside={
        <span className="flex flex-col items-end">
          <span className="we-label we-muted">{bat.code}</span>
          <span className="we-fig text-[48px] leading-none">{scoreText(state.total_runs, state.total_wickets)}</span>
        </span>
      }
      width={1240}
      footer={
        state.current_bowler_name ? (
          <span className="flex w-full items-baseline gap-6">
            <span className="we-name text-[26px]">{state.current_bowler_name}</span>
            <span className="we-fig text-[30px]">
              {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0}
            </span>
            <span className="we-figl we-muted text-[22px]">
              ({oversText(state.bowler_balls)}){econ ? `  ·  econ ${econ}` : ""}
            </span>
          </span>
        ) : undefined
      }
    >
      <div className="flex justify-center py-6">
        <Balls tokens={tokens} slots={6} size={96} stagger={320} />
      </div>
    </CardFrame>
  );
}

export function WorldEventPlayerOfTheMatch(p: OverlayElementProps["playerOfTheMatch"]) {
  const potm = p.match?.player_of_the_match;
  if (!potm?.full_name) return null;
  const all = p.innings;
  const bat = all.flatMap((i) => i.batting_performances ?? []).find((b) => b.user_id === potm.id);
  const bowl = all.flatMap((i) => i.bowling_performances ?? []).find((b) => b.user_id === potm.id);
  const batInnings = bat ? all.find((i) => i.id === bat.innings_id) : undefined;
  const bowlInnings = bowl ? all.find((i) => i.id === bowl.innings_id) : undefined;
  const team: SideInfo | null = batInnings
    ? teamOfInnings(p.state, batInnings, p.match)
    : bowlInnings
      ? teamsOf(p.state)[teamOfInnings(p.state, bowlInnings, p.match).n === 1 ? 1 : 0]!
      : null;
  const cells: Array<{ label: string; value: ReactNode }> = [];
  if (bat && bat.balls_faced > 0) {
    cells.push({ label: "Batting", value: `${bat.runs_scored}${bat.is_out ? "" : "*"} (${bat.balls_faced})` });
  }
  if (bowl && bowl.balls_bowled > 0) {
    cells.push({ label: "Bowling", value: `${bowl.wickets_taken}-${bowl.runs_conceded} (${oversText(bowl.balls_bowled)})` });
  }
  return (
    <Root state={p.state} data-testid="we-potm" className="flex flex-col items-start" style={{ ...lowerThirdAnchor(BUG_HEIGHT, 34), width: 1240 }}>
      <div className="relative z-10 ml-[150px]">
        <Tab tone="gold" className="we-a-drop" style={delay(320)}>
          Player of the match
        </Tab>
      </div>
      <div className="we-lift flex w-full items-stretch bg-[#0a0532]">
        <div className="we-a-slide-r flex w-[150px] shrink-0">
          <div className="we-gold flex w-full items-center justify-center">
            {team ? <Crest n={team.n} logo={team.logo} code={team.code} name={team.name} size={86} className="we-a-pop" style={delay(240)} /> : null}
          </div>
        </div>
        <div className="we-paper we-a-wipe-r flex min-w-0 flex-1 flex-col justify-center px-8 py-3" style={delay(80)}>
          <span className="we-name we-trunc text-[48px] leading-[1.05]">{potm.full_name}</span>
          <span className="we-figl we-ink-muted we-trunc text-[22px] font-semibold">
            {[team?.name, p.state.result_description].filter(Boolean).join("  ·  ")}
          </span>
        </div>
        {cells.map((c, i) => (
          <div key={c.label} className="we-night we-a-wipe-l flex shrink-0 flex-col items-end justify-center border-l px-8 we-hair" style={delay(200 + i * 80)}>
            <span className="we-label we-muted">{c.label}</span>
            <span className="we-fig mt-1 text-[40px] leading-none">{c.value}</span>
          </div>
        ))}
      </div>
    </Root>
  );
}
