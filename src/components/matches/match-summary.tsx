"use client";

import { useMemo, useState } from "react";
import type * as React from "react";
import { Coins, Flag, Target, TrendingUp, XCircle } from "lucide-react";
import { TeamCrest } from "~/components/ds/avatar";
import { Button } from "~/components/ds/button";
import { Card } from "~/components/ds/card";
import { PlayerLink } from "~/components/ds/player-link";
import { Chip } from "~/components/ds/chip";
import { ListCard, ListRow } from "~/components/ds/list";
import { RankList } from "~/components/ds/standings";
import type { Match } from "~/lib/match-types";
import {
  formatBowlerOvers,
  formatDecimalOvers,
  formatDismissalType,
  sidesInBattingOrder,
} from "~/lib/cricket";
import { playerHrefOf } from "~/lib/player-href";
import { buildExportSummary, type ExportTeamStats } from "~/lib/match-report";
import { cn } from "~/lib/utils";
import { MatchLivePanel } from "./match-live-panel";
import { teamRef } from "./match-hero";

interface MatchSummaryProps {
  match: Match;
}

type Moment = {
  id: string;
  label: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
};

/** Toss, fifties and hundreds, three-wicket hauls, wickets, innings ends. */
function keyMomentsOf(match: Match): Moment[] {
  const moments: Moment[] = [];
  const teamOf = (id: string) =>
    id === match.team1_id ? match.team1 : match.team2;

  if (match.toss_winner_team_id) {
    const winner =
      match.toss_winner_team_id === match.team1_id
        ? match.team1
        : match.toss_winner_team_id === match.team2_id
          ? match.team2
          : null;
    if (winner) {
      moments.push({
        id: "toss",
        label: "Toss",
        title: `${winner.name} won the toss and chose to ${match.toss_decision ?? "bat"}`,
        icon: <Coins className="h-4 w-4 text-warning" />,
      });
    }
  }

  [...(match.innings ?? [])]
    .sort((a, b) => a.innings_number - b.innings_number)
    .forEach((inn) => {
      const team = teamOf(inn.team_id);
      [...(inn.fall_of_wickets ?? [])]
        .sort((x, y) => x.overs_at_fall - y.overs_at_fall)
        .forEach((fow) => {
          const bowler = fow.bowler?.full_name
            ? ` b ${fow.bowler.full_name}`
            : "";
          moments.push({
            id: `fow-${fow.id}`,
            label: `Over ${formatDecimalOvers(fow.overs_at_fall)}`,
            title: `${fow.batsman?.full_name ?? "Batter"}${bowler}`,
            description: `${fow.runs_at_fall}/${fow.wicket_number}${fow.dismissal_type ? ` · ${formatDismissalType(fow.dismissal_type)}` : ""}`,
            icon: <XCircle className="h-4 w-4 text-wicket" />,
          });
        });
      inn.batting_performances?.forEach((bp) => {
        if (bp.runs_scored >= 50) {
          moments.push({
            id: `milestone-${bp.id}`,
            label: bp.runs_scored >= 100 ? "Hundred" : "Fifty",
            title: `${bp.user?.full_name ?? "Batter"} ${bp.runs_scored}${bp.is_out ? "" : "*"} (${bp.balls_faced})`,
            description: `${bp.fours} fours, ${bp.sixes} sixes for ${team.name}`,
            icon: <TrendingUp className="h-4 w-4 text-success" />,
          });
        }
      });
      inn.bowling_performances?.forEach((bp) => {
        if (bp.wickets_taken >= 3) {
          moments.push({
            id: `bowl-${bp.id}`,
            label: `${bp.wickets_taken} wickets`,
            title: `${bp.user?.full_name ?? "Bowler"} ${bp.wickets_taken}/${bp.runs_conceded}`,
            description: `in ${formatDecimalOvers(bp.overs_bowled)} overs`,
            icon: <Target className="h-4 w-4 text-primary" />,
          });
        }
      });
      if (inn.is_completed) {
        moments.push({
          id: `inn-end-${inn.id}`,
          label: `Innings ${inn.innings_number}`,
          title: `${team.name} ${inn.total_runs}/${inn.total_wickets}`,
          description: `${formatDecimalOvers(inn.total_overs)} overs`,
          icon: <Flag className="h-4 w-4 text-muted-foreground" />,
        });
      }
    });
  return moments;
}

type Figure = {
  name: string;
  href?: string;
  fig: string;
  sub: string;
  strong: boolean;
};

function FigureColumn({ title, rows }: { title: string; rows: Figure[] }) {
  return (
    <div className="min-w-0">
      <h4 className="text-xs text-muted-foreground">{title}</h4>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">None</p>
      ) : (
        <ol className="mt-1">
          {rows.map((r) => (
            <li
              key={r.name}
              className="flex items-baseline gap-2 border-t border-border py-2 first:border-t-0 max-md:flex-wrap max-md:gap-x-1.5 max-md:gap-y-0 max-md:py-1.5"
            >
              {/* Half a phone's width: the name on its own line, not cut. */}
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground max-md:basis-full">
                <PlayerLink name={r.name} href={r.href} />
              </span>
              <span
                className={cn(
                  "font-score text-base font-semibold tabular-nums",
                  r.strong ? "text-primary" : "text-foreground",
                )}
              >
                {r.fig}
              </span>
              <span className="w-12 shrink-0 text-right font-score text-xs tabular-nums text-muted-foreground max-md:w-auto">
                {r.sub}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * One side as on the share-summary image: crest, name and score, then its
 * top three batters and bowlers side by side.
 */
function TeamSummaryCard({
  team,
  stats,
  won,
}: {
  team: Match["team1"];
  stats: ExportTeamStats;
  won: boolean;
}) {
  // "178/5 (20.0)": the score large, the overs under it.
  const [score, overs] = stats.scoreLine.replace(")", "").split(" (");
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <TeamCrest {...teamRef(team)} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
            {team.name}
          </span>
          {won && (
            <Chip tone="success" size="sm" className="mt-1">
              Won
            </Chip>
          )}
        </span>
        <span className="shrink-0 text-right font-score tabular-nums">
          <span className="block text-xl font-semibold leading-none text-foreground">
            {score}
          </span>
          {overs && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {overs} ov
            </span>
          )}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-1 md:gap-4 xl:grid-cols-2">
        <FigureColumn
          title="Top batters"
          rows={stats.batters.map((b) => ({
            name: b.name,
            href: playerHrefOf(b.userId),
            fig: `${b.runs}${b.notOut ? "*" : ""}`,
            sub: `(${b.balls})`,
            strong: b.runs >= 50,
          }))}
        />
        <FigureColumn
          title="Top bowlers"
          rows={stats.bowlers.map((b) => ({
            name: b.name,
            href: playerHrefOf(b.userId),
            fig: `${b.wickets}/${b.runs}`,
            sub: `(${b.overs})`,
            strong: b.wickets >= 3,
          }))}
        />
      </div>
    </Card>
  );
}

/** Both sides in batting order, as on the share-summary image. */
function TeamSummaries({ match }: { match: Match }) {
  const summary = buildExportSummary(match, "");
  const [first, second] = sidesInBattingOrder(match);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TeamSummaryCard
        team={first.team}
        stats={summary.team1}
        won={match.winning_team_id === first.team.id}
      />
      <TeamSummaryCard
        team={second.team}
        stats={summary.team2}
        won={match.winning_team_id === second.team.id}
      />
    </div>
  );
}

/** The match's three best batters and bowlers across the main innings. */
function BestPerformers({ match }: { match: Match }) {
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const main = (match.innings ?? []).filter((i) => i.innings_number <= 2);
  const teamName = (id: string) =>
    id === match.team1_id ? match.team1.name : match.team2.name;
  const other = (id: string) =>
    id === match.team1_id ? match.team2_id : match.team1_id;

  const batters = main
    .flatMap((inn) =>
      (inn.batting_performances ?? []).map((b) => ({ b, team: inn.team_id })),
    )
    .filter(({ b }) => b.runs_scored > 0)
    .sort((x, y) => y.b.runs_scored - x.b.runs_scored)
    .slice(0, 3)
    .map(({ b, team }) => ({
      name: b.user?.full_name ?? "Batter",
      href: playerHrefOf(b.user_id),
      avatarUrl: b.user?.avatar_url,
      team: teamName(team),
      value: `${b.runs_scored}${b.is_out ? "" : "*"}`,
      detail: `${b.balls_faced} balls`,
    }));
  const bowlers = main
    .flatMap((inn) =>
      (inn.bowling_performances ?? []).map((b) => ({
        b,
        team: other(inn.team_id),
      })),
    )
    .filter(({ b }) => b.wickets_taken > 0)
    .sort(
      (x, y) =>
        y.b.wickets_taken - x.b.wickets_taken ||
        x.b.runs_conceded - y.b.runs_conceded,
    )
    .slice(0, 3)
    .map(({ b, team }) => ({
      name: b.user?.full_name ?? "Bowler",
      href: playerHrefOf(b.user_id),
      avatarUrl: b.user?.avatar_url,
      team: teamName(team),
      value: `${b.wickets_taken}/${b.runs_conceded}`,
      detail: `${formatBowlerOvers(b, bpo)} ov`,
    }));

  if (batters.length === 0 && bowlers.length === 0) return null;
  // Not on phones: each side's card above already names them.
  return (
    <div className="hidden gap-4 md:grid md:grid-cols-2">
      {batters.length > 0 && (
        <RankList title="Top batters" unit="Runs" rows={batters} />
      )}
      {bowlers.length > 0 && (
        <RankList title="Top bowlers" unit="Wickets" rows={bowlers} />
      )}
    </div>
  );
}

/** Key moments a phone shows before "Show all". */
const PHONE_MOMENTS = 5;

function KeyMoments({
  moments,
  finished,
}: {
  moments: Moment[];
  /** Over (a result, or abandoned): nothing more is coming. */
  finished: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const cut = !showAll && moments.length > PHONE_MOMENTS;
  return (
    <section aria-labelledby="key-moments" className="space-y-3">
      <h3 id="key-moments" className="text-base font-semibold text-foreground">
        Key moments
      </h3>
      {moments.length === 0 ? (
        <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          {finished
            ? "No toss, wickets or milestones were recorded for this match."
            : "The toss, wickets and milestones appear here as the match goes on."}
        </p>
      ) : (
        <ListCard>
          {moments.map((m, i) => (
            <ListRow
              key={m.id}
              className={cn(
                "[contain-intrinsic-size:auto_3.5rem] [content-visibility:auto]",
                cut && i >= PHONE_MOMENTS && "max-md:hidden",
              )}
              leading={
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  {m.icon}
                </span>
              }
              title={<span className="whitespace-normal">{m.title}</span>}
              subtitle={m.description}
              trailing={
                <span className="text-xs text-muted-foreground">{m.label}</span>
              }
            />
          ))}
        </ListCard>
      )}
      {cut && (
        <Button
          variant="soft"
          size="sm"
          className="w-full md:hidden"
          onClick={() => setShowAll(true)}
        >
          Show all {moments.length} moments
        </Button>
      )}
    </section>
  );
}

/**
 * The Summary tab. While an innings is in play it is the live panel
 * (crease, bowler, this over, rates); otherwise both sides as on the
 * share-summary image, then the match's best batters and bowlers. Key
 * moments follow either way. The result and the player
 * of the match are in the hero above.
 */
export function MatchSummary({ match }: MatchSummaryProps) {
  const moments = useMemo(() => keyMomentsOf(match), [match]);
  // An innings in play (not a break between innings).
  const live =
    match.status === "live" &&
    (match.innings ?? []).some((i) => !i.is_completed);
  const innings = [...(match.innings ?? [])]
    .filter((i) => i.innings_number <= 2)
    .sort((a, b) => a.innings_number - b.innings_number);

  return (
    <div className="space-y-6">
      {live ? (
        <MatchLivePanel match={match} />
      ) : (
        innings.length > 0 && (
          <>
            <TeamSummaries match={match} />
            <BestPerformers match={match} />
          </>
        )
      )}
      {/* While live the latest first. */}
      <KeyMoments
        moments={live ? [...moments].reverse() : moments}
        finished={["completed", "abandoned", "cancelled"].includes(match.status)}
      />
    </div>
  );
}
