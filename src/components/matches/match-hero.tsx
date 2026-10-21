import type * as React from "react";
import { PlayerAwardCard } from "~/components/ds/player-award";
import {
  HeroScore,
  HeroTime,
  InningsScore,
  MatchNote,
  ScoreHero,
  type HeroSideProps,
  type InningsRef,
  type TeamRef,
} from "~/components/ds/score";
import {
  ballsRemaining,
  formatMatchResult,
  inningsBalls,
  oversFromBalls,
  runRate,
} from "~/lib/cricket";
import type { Innings, Match, Team } from "~/lib/match-types";
import { playerAwardOf } from "~/lib/player-award";

type Side = { team: Team; innings: Innings | undefined };

/** A team as the crests want it (logo, short code). */
export const teamRef = (t: Team): TeamRef => ({
  name: t.name,
  shortName: t.short_name,
  logoUrl: t.logo_url,
});

/** An innings as the score components want it ("18.2" overs). */
export const ref = (inn: Innings, bpo: number): InningsRef => ({
  runs: inn.total_runs ?? 0,
  wickets: inn.total_wickets ?? 0,
  overs: oversFromBalls(inningsBalls(inn, bpo), bpo),
});

/** The sentence under a live score: the chase, or the run rate so far. */
export function liveLine(
  match: Pick<Match, "overs_per_innings">,
  batting: Side,
  bpo: number,
): string | null {
  const inn = batting.innings;
  if (!inn) return null;
  const target = inn.target_runs;
  const balls = inningsBalls(inn, bpo);
  if (!target) return `Run rate ${runRate(inn.total_runs, balls, bpo)}`;
  const need = target - (inn.total_runs ?? 0);
  if (need <= 0) return null;
  const runs = `${need} ${need === 1 ? "run" : "runs"}`;
  const left = match.overs_per_innings
    ? ballsRemaining(match.overs_per_innings, balls, bpo)
    : 0;
  return left > 0
    ? `${batting.team.name} need ${runs} from ${left} ${left === 1 ? "ball" : "balls"}`
    : `${batting.team.name} need ${runs}`;
}

/** "Mehta" from "Arjun Mehta": the hero has room for a surname. */
const surname = (name?: string | null) =>
  name?.trim().split(/\s+/).at(-1) ?? null;

/**
 * Under a side in the hero: its top scorer ("Mehta 58* (41)") and its best
 * bowler, from the innings it bowled in ("Desai 1/24").
 */
export function performerLines(
  match: Pick<Match, "innings" | "team1_id" | "team2_id">,
  teamId: string,
): string[] {
  const main = (match.innings ?? []).filter((i) => i.innings_number <= 2);
  const batted = main.find((i) => i.team_id === teamId);
  const bowled = main.find((i) => i.team_id !== teamId);
  const lines: string[] = [];
  const bat = [...(batted?.batting_performances ?? [])].sort(
    (a, b) => b.runs_scored - a.runs_scored || a.balls_faced - b.balls_faced,
  )[0];
  if (bat && bat.runs_scored > 0 && surname(bat.user?.full_name)) {
    lines.push(
      `${surname(bat.user?.full_name)} ${bat.runs_scored}${bat.is_out ? "" : "*"} (${bat.balls_faced})`,
    );
  }
  const bowl = [...(bowled?.bowling_performances ?? [])].sort(
    (a, b) =>
      b.wickets_taken - a.wickets_taken || a.runs_conceded - b.runs_conceded,
  )[0];
  if (bowl && bowl.wickets_taken > 0 && surname(bowl.user?.full_name)) {
    lines.push(
      `${surname(bowl.user?.full_name)} ${bowl.wickets_taken}/${bowl.runs_conceded}`,
    );
  }
  return lines;
}

function scheduledTime(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    time: d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" }),
    date: d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  };
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
  className?: string;
  children?: React.ReactNode;
}) {
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const competition =
    match.tournament?.name ?? match.club?.name ?? match.title ?? "Match";
  const stage = `${match.match_format} · ${match.overs_per_innings} overs`;
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
      return {
        team: teamRef(s.team),
        dim: true,
        detail: s.innings
          ? `${s.innings.total_runs}/${s.innings.total_wickets} (${ref(s.innings, bpo).overs})`
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
            innings={ref(s.innings, bpo)}
            dim={lost}
            className={won ? "font-semibold" : undefined}
          />
        ),
      };
    }
    return { team: teamRef(s.team) };
  };

  const withPerformers = (s: Side, i: number): HeroSideProps => {
    const props = side(s, i);
    const lines = performers ? performerLines(match, s.team.id) : [];
    return lines.length
      ? { ...props, extra: lines.map((l) => <p key={l}>{l}</p>) }
      : props;
  };

  const start = scheduledTime(match.scheduled_at);
  const award = playerAwardOf(match);
  const centre = batting?.innings ? (
    <HeroScore innings={ref(batting.innings, bpo)} />
  ) : match.status === "scheduled" && start ? (
    <HeroTime time={start.time} />
  ) : undefined;

  const line = batting ? liveLine(match, batting, bpo) : null;
  const note =
    match.status === "completed" && match.result_description ? (
      <div>
        <MatchNote tone="result">{formatMatchResult(match)}</MatchNote>
        {award && <PlayerAwardCard award={award} className="mt-4" />}
      </div>
    ) : line ? (
      <MatchNote tone="live">{line}</MatchNote>
    ) : match.status === "scheduled" ? (
      <MatchNote>
        {[start?.date, match.venue].filter(Boolean).join(" · ") || "Upcoming"}
      </MatchNote>
    ) : null;

  return (
    <ScoreHero
      plain={plain}
      competition={competition}
      stage={stage}
      status={match.status}
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
