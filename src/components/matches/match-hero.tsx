import Link from "next/link";
import { isLateFixture } from "~/lib/dates";
import { Shield, Trophy } from "lucide-react";
import type * as React from "react";
import { LocalDate } from "~/components/ds/local-date";
import { PlayerAwardCard } from "~/components/ds/player-award";
import { PlayerLink } from "~/components/ds/player-link";
import {
  HeroScore,
  HeroTime,
  InningsScore,
  MatchNote,
  scoreFigures,
  ScoreHero,
  type HeroSideProps,
  type InningsRef,
  type ScoreLineSide,
  type TeamRef,
} from "~/components/ds/score";
import {
  chaseLine,
  displayStatusOf,
  formatMatchResult,
  inningsBalls,
  matchFormatLabel,
  oversFromBalls,
  runRate,
} from "~/lib/cricket";
import { playerHrefOf } from "~/lib/player-href";
import type { Innings, Match, Team } from "~/lib/match-types";
import { playerAwardOf } from "~/lib/player-award";
import {
  dayLine,
  inningsScoreText,
  isForfeited,
  isTwoInningsMatch,
  lastMainInningsOf,
  standingLine,
} from "~/lib/multi-innings";

type Side = { team: Team; innings: Innings | undefined; earlier?: Innings[] };

/** A team as the crests want it (logo, short code). */
export const teamRef = (
  t: Pick<Team, "name" | "short_name" | "logo_url">,
): TeamRef => ({
  name: t.name,
  shortName: t.short_name,
  logoUrl: t.logo_url,
});

/**
 * An innings as the score components want it ("18.2" overs), with the
 * side's `earlier` innings in a two-innings match ("245 & ...").
 */
export const ref = (
  inn: Innings,
  bpo: number,
  earlier: readonly Innings[] = [],
): InningsRef => ({
  runs: inn.total_runs ?? 0,
  wickets: inn.total_wickets ?? 0,
  overs: oversFromBalls(inningsBalls(inn, bpo), bpo),
  ...(earlier.length
    ? { earlier: earlier.map((i) => inningsScoreText(i)).join(" & ") }
    : {}),
  ...(inn.declared && !isForfeited(inn) ? { declared: true } : {}),
});

/**
 * The sentence under a live score: the chase (over the overs it has, a DLS
 * revision's included), the run rate so far, or who bats first before the
 * first ball.
 */
export function liveLine(
  match: Pick<Match, "overs_per_innings" | "dls_revision"> &
    Partial<
      Pick<
        Match,
        | "innings"
        | "innings_per_side"
        | "status"
        | "current_day"
        | "play_break"
        | "match_format"
        | "days"
      >
    >,
  batting: Side,
  bpo: number,
): string | null {
  const inn = batting.innings;
  if (!inn) return null;
  if (isTwoInningsMatch(match)) return testLiveLine(match, inn, batting, bpo);
  if (inn.target_runs) return chaseLine(match, inn, batting.team.name, bpo);
  const balls = inningsBalls(inn, bpo);
  // Before the first ball a run rate of 0.00 says nothing.
  if (balls === 0 && (inn.total_runs ?? 0) === 0) {
    return inn.innings_number === 1 ? `${batting.team.name} bat first` : null;
  }
  return `Run rate ${runRate(inn.total_runs, balls, bpo)}`;
}

/**
 * A Test's line under the score: the day (and any break), then the lead,
 * deficit or chase ("Day 2 · Lions trail by 120 runs").
 */
function testLiveLine(
  match: Parameters<typeof liveLine>[0],
  inn: Innings,
  batting: Side,
  bpo: number,
): string | null {
  const name = batting.team.name;
  const fresh = inningsBalls(inn, bpo) === 0 && (inn.total_runs ?? 0) === 0;
  const where = inn.target_runs
    ? chaseLine(match, inn, name, bpo)
    : fresh && inn.innings_number === 1
      ? `${name} bat first`
      : standingLine(match.innings ?? [], inn, name);
  return [dayLine(match), where].filter(Boolean).join(" · ") || null;
}

/**
 * The match in one line (`ScoreLine`), for when the hero has scrolled away:
 * each side's code and score, quiet for the side not batting or that lost.
 */
export function scoreLineSides(
  match: Pick<Match, "status" | "winning_team_id" | "balls_per_over"> &
    Partial<Pick<Match, "innings_per_side">>,
  sides: [Side, Side],
): [ScoreLineSide, ScoreLineSide] {
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const live = match.status === "live" || match.status === "innings_break";
  const twoInnings = isTwoInningsMatch(match);
  const line = (s: Side): ScoreLineSide => {
    const inn = s.innings;
    const r = inn ? ref(inn, bpo, s.earlier) : null;
    return {
      code: s.team.short_name || s.team.name,
      // A Test's "245 & 180/4" says enough without the overs.
      score: r
        ? twoInnings
          ? scoreFigures(r)
          : `${scoreFigures(r)} (${r.overs})`
        : null,
      dim: live
        ? !inn || inn.is_completed
        : !!match.winning_team_id && match.winning_team_id !== s.team.id,
    };
  };
  return [line(sides[0]), line(sides[1])];
}

/** "Mehta" from "Arjun Mehta": the hero has room for a surname. */
const surname = (name?: string | null) =>
  name?.trim().split(/\s+/).at(-1) ?? null;

/**
 * Under a side in the hero: its top scorer ("Mehta 58* (41)") and its best
 * bowler, from the innings it bowled in ("Desai 1/24").
 */
export function performerLines(
  match: Pick<Match, "innings" | "team1_id" | "team2_id"> &
    Partial<Pick<Match, "innings_per_side">>,
  teamId: string,
): { text: string; href?: string }[] {
  // The match proper (a Test's four innings): the best single innings with
  // the bat, and the best figures in an innings with the ball.
  const main = (match.innings ?? []).filter(
    (i) => i.innings_number <= lastMainInningsOf(match),
  );
  const batted = main.filter((i) => i.team_id === teamId);
  const bowled = main.filter((i) => i.team_id !== teamId);
  const lines: { text: string; href?: string }[] = [];
  const bat = batted.flatMap((i) => i.batting_performances ?? []).sort(
    (a, b) => b.runs_scored - a.runs_scored || a.balls_faced - b.balls_faced,
  )[0];
  if (bat && bat.runs_scored > 0 && surname(bat.user?.full_name)) {
    lines.push({
      text: `${surname(bat.user?.full_name)} ${bat.runs_scored}${bat.is_out ? "" : "*"} (${bat.balls_faced})`,
      href: playerHrefOf(bat.user_id),
    });
  }
  const bowl = bowled.flatMap((i) => i.bowling_performances ?? []).sort(
    (a, b) =>
      b.wickets_taken - a.wickets_taken || a.runs_conceded - b.runs_conceded,
  )[0];
  if (bowl && bowl.wickets_taken > 0 && surname(bowl.user?.full_name)) {
    lines.push({
      text: `${surname(bowl.user?.full_name)} ${bowl.wickets_taken}/${bowl.runs_conceded}`,
      href: playerHrefOf(bowl.user_id),
    });
  }
  return lines;
}

/**
 * "19:30", "Saturday 10 August" (the year when not this one) and "Sat 10
 * Aug", in the viewer's time zone: the report renders this on the server.
 */
function scheduledTime(iso?: string | null) {
  if (!iso) return null;
  return {
    time: <LocalDate value={iso} format="time" />,
    date: <LocalDate value={iso} format="long" />,
    short: <LocalDate value={iso} format="card" />,
    shortTime: <LocalDate value={iso} format="cardTime" />,
  };
}

/** "Saturday 10 August · Central Park", "Was due Sat 10 Aug, 19:30", "Upcoming". */
function fixtureNote(
  start: ReturnType<typeof scheduledTime>,
  late: boolean,
  venue?: string | null,
): React.ReactNode {
  if (!start) return venue || "Upcoming";
  return (
    <>
      {late ? <>Was due {start.shortTime}</> : start.date}
      {venue && ` · ${venue}`}
    </>
  );
}

/**
 * The match page header in the design system's form: crests either side, the
 * batting side's score big in the middle while live, each side's score under
 * its name once finished, the start time before. Children (actions) go below.
 */
export function MatchHero({
  match,
  sides,
  plain = true,
  performers = true,
  page = false,
  quiet = false,
  className,
  children,
}: {
  match: Match;
  /** The two sides in batting order (sidesInBattingOrder). */
  sides: [Side, Side];
  /** False: on its own card (the report), not the top of a page. */
  plain?: boolean;
  /** Each side's top scorer and best bowler under its name. */
  performers?: boolean;
  /**
   * The top of the match page, where the tabs should start high: smaller
   * crests, and only what this header alone can say. The bar names the
   * match, Summary has the player of the match, and a result or a start
   * time needs no chip.
   */
  page?: boolean;
  /**
   * Under a header that already names the competition and the format (the
   * report's first page): no row for them, and a finished match's result
   * needs no "Result" chip.
   */
  quiet?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  // The tournament or club, linked (the only way there from the match on
  // phones, and on desktop since the header no longer repeats it).
  const parent = match.tournament
    ? { href: `/tournaments/${match.tournament.id}?tab=fixtures`, name: match.tournament.name }
    : match.club
      ? { href: `/clubs/${match.club.id}?tab=matches`, name: match.club.name }
      : null;
  const competition = parent ? (
    <Link
      href={parent.href}
      className="underline-offset-4 hover:underline focus-visible:underline"
    >
      {parent.name}
    </Link>
  ) : page ? undefined : (
    (match.title ?? "Match")
  );
  const stage = matchFormatLabel(match);
  const live = match.status === "live" || match.status === "innings_break";
  // While live: the side whose innings is open bats; the other shows its
  // total (or "Yet to bat").
  const battingIdx = live
    ? sides.findIndex((s) => s.innings && !s.innings.is_completed)
    : -1;
  const batting = battingIdx >= 0 ? sides[battingIdx] : undefined;

  const side = (s: Side, i: number): HeroSideProps => {
    if (live) {
      if (i === battingIdx) return { team: teamRef(s.team), detail: "Batting" };
      const r = s.innings ? ref(s.innings, bpo, s.earlier) : null;
      return {
        team: teamRef(s.team),
        dim: true,
        detail: r
          ? isTwoInningsMatch(match)
            ? scoreFigures(r)
            : `${scoreFigures(r)} (${r.overs})`
          : "Yet to bat",
      };
    }
    if (s.innings) {
      const won =
        match.status === "completed" && match.winning_team_id === s.team.id;
      const lost =
        match.status === "completed" &&
        !!match.winning_team_id &&
        match.winning_team_id !== s.team.id;
      return {
        team: teamRef(s.team),
        dim: lost,
        detail: (
          <InningsScore
            innings={ref(s.innings, bpo, s.earlier)}
            dim={lost}
            inline={page}
            className={won ? "font-semibold" : undefined}
          />
        ),
      };
    }
    return { team: teamRef(s.team) };
  };

  const withPerformers = (s: Side, i: number): HeroSideProps => {
    // On the match page each side's name opens its team (the only way there
    // from a match); elsewhere (the report) it stays text.
    const props = { ...side(s, i), href: page ? `/teams/${s.team.id}` : undefined };
    const lines = performers ? performerLines(match, s.team.id) : [];
    return lines.length
      ? {
          ...props,
          extra: lines.map((l) => (
            <p key={l.text}>
              <PlayerLink name={l.text} href={l.href} />
            </p>
          )),
        }
      : props;
  };

  const start = scheduledTime(match.scheduled_at);
  // Its time has passed and it has not started (M17).
  const late = isLateFixture(match);
  const award = page ? null : playerAwardOf(match);
  const centre = batting?.innings ? (
    <HeroScore innings={ref(batting.innings, bpo, batting.earlier)} />
  ) : match.status === "scheduled" && start ? (
    <HeroTime time={start.time} label={late ? "Not started" : "Upcoming"} />
  ) : undefined;

  const line = batting ? liveLine(match, batting, bpo) : null;
  // A finished match says how it ended: the result, or why there was none
  // ("Match abandoned: Rain").
  const finished =
    match.status === "completed" || match.status === "abandoned";
  const note =
    finished && match.result_description ? (
      <div>
        <MatchNote tone="result">{formatMatchResult(match)}</MatchNote>
        {/* When it was played (M4). */}
        {page && start && (
          <p className="mt-1 text-xs text-muted-foreground">{start.short}</p>
        )}
        {award && match.status === "completed" && (
          <PlayerAwardCard
            award={award}
            href={playerHrefOf(award.userId)}
            className="mt-4"
          />
        )}
      </div>
    ) : line ? (
      <MatchNote tone="live">{line}</MatchNote>
    ) : match.status === "scheduled" ? (
      <MatchNote>{fixtureNote(start, late, match.venue)}</MatchNote>
    ) : null;

  // No chip where the rest says enough: a fixture or a result on the match
  // page, a result under the report's header.
  const noChip =
    (page && (match.status === "scheduled" || Boolean(finished && note))) ||
    (quiet && finished);
  return (
    <ScoreHero
      plain={plain}
      competition={quiet ? undefined : competition}
      competitionIcon={!match.tournament && match.club ? Shield : Trophy}
      stage={quiet ? undefined : stage}
      status={noChip ? undefined : displayStatusOf(match)}
      compact={page}
      home={withPerformers(sides[0], 0)}
      away={withPerformers(sides[1], 1)}
      centre={centre}
      note={note}
      className={className}
    >
      {children}
    </ScoreHero>
  );
}
