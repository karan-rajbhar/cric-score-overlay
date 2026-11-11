"use client";

import { shortDate } from "~/lib/dates";
import { setUrlParam } from "~/lib/url-state";
import { useRef, useState, useTransition } from "react";
import type * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { TabSkeleton } from "~/components/ui/on-demand-tabs";
import { MatchStatusChip } from "~/components/ds/chip";
import { TeamCrest } from "~/components/ds/avatar";
import { ListCard, ListRow } from "~/components/ds/list";
import { MatchCard } from "~/components/matches/match-card";
import type { Match } from "~/lib/match-types";
import { Button } from "~/components/ui/button";
import { PinnedTabs } from "~/components/ds/tabs";
import { Tabs, TabsContent } from "~/components/ui/tabs";
import { TeamLogo } from "~/components/teams/team-logo";
import { EmptyState } from "~/components/ui/empty-state";
import {
  formatHowOut,
  formatPlayerRole,
  strikeRate,
  economyRate,
  ballsFromOvers,
  namedFormat,
} from "~/lib/cricket";
import { ArrowRight, Swords, Users, Activity } from "lucide-react";

export interface PlayerTeamMembership {
  id: string;
  role_in_team?: string | null;
  jersey_number?: number | null;
  batting_order?: number | null;
  team: {
    id: string;
    name: string;
    short_name?: string | null;
    logo_url?: string | null;
    team_type?: string | null;
    description?: string | null;
    club?: {
      id: string;
      name: string;
    } | null;
  };
}

interface PerformanceTeam {
  id: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
}

/** The match of a batting or bowling record. */
export interface PerformanceMatch {
  id: string;
  title: string;
  match_format: string;
  scheduled_at?: string | null;
  status: string;
  venue?: string | null;
  result_description?: string | null;
  winning_team_id?: string | null;
  team1: PerformanceTeam;
  team2: PerformanceTeam;
}

export interface PlayerBattingPerformance {
  id: string;
  match_id: string;
  innings_id: string;
  batting_position?: number | null;
  runs_scored: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  is_out: boolean;
  dismissal_type?: string | null;
  bowler?: { id: string; full_name: string } | null;
  fielder?: { id: string; full_name: string } | null;
  match?: PerformanceMatch | null;
}

export interface PlayerBowlingPerformance {
  id: string;
  match_id: string;
  innings_id: string;
  overs_bowled: number;
  balls_bowled: number;
  runs_conceded: number;
  wickets_taken: number;
  maidens: number;
  wides: number;
  no_balls: number;
  match?: PerformanceMatch | null;
}

export interface PlayerMatchItem {
  id: string;
  title: string;
  match_format: string;
  overs_per_innings: number;
  status: string;
  venue?: string | null;
  scheduled_at?: string | null;
  result_description?: string | null;
  winning_team_id?: string | null;
  tournament_id?: string | null;
  tournament?: { id: string; name: string } | null;
  team1: {
    id: string;
    name: string;
    short_name?: string | null;
    logo_url?: string | null;
  };
  team2: {
    id: string;
    name: string;
    short_name?: string | null;
    logo_url?: string | null;
  };
  innings?: Array<{
    id: string;
    team_id: string;
    innings_number: number;
    total_runs: number;
    total_wickets: number;
    total_overs: number;
  }>;
  playerBatting?: {
    runs_scored: number;
    balls_faced: number;
    is_out: boolean;
  } | null;
  playerBowling?: {
    wickets_taken: number;
    runs_conceded: number;
    overs_bowled: number;
  } | null;
}

interface PlayerActivityTabsProps {
  teams: PlayerTeamMembership[];
  batting: PlayerBattingPerformance[];
  bowling: PlayerBowlingPerformance[];
  matches: PlayerMatchItem[];
  /** Whether `matches` and the rows' match details have been read. */
  matchesLoaded: boolean;
  /** Whether the Matches tab has anything to show, read or not. */
  hasMatches: boolean;
  initialTab?: string;
  /** The career figures: the first tab, open by default. */
  statistics?: React.ReactNode;
}

function formatDate(dateStr?: string | null) {
  return shortDate(dateStr) || "Date to be confirmed";
}

/** First cell of a batting or bowling row: the opponent and the match. */
function MatchOpponentCell({
  match,
  opponent,
}: {
  match?: PerformanceMatch | null;
  opponent: PerformanceTeam | null;
}) {
  return (
    <TableCell>
      <div className="flex items-center gap-2.5">
        {opponent && (
          <TeamLogo
            name={opponent.name}
            shortName={opponent.short_name}
            logoUrl={opponent.logo_url}
            className="h-7 w-7 shrink-0 text-xs"
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">
            vs {opponentName(match, opponent)}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{formatDate(match?.scheduled_at)}</span>
            {match && namedFormat(match) && (
              <>
                <span>•</span>
                <span>{namedFormat(match)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </TableCell>
  );
}

/** Last cells of a batting or bowling row: the result and the scorecard link. */
function MatchResultCells({ match }: { match?: PerformanceMatch | null }) {
  return (
    <>
      <TableCell>
        <div
          className="max-w-[200px] truncate text-xs text-muted-foreground"
          title={match?.result_description ?? ""}
        >
          {match?.result_description ?? (
            <MatchStatusChip status={match?.status ?? "scheduled"} />
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        {match && (
          <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Link
              href={`/matches/${match.id}`}
              title="View the scorecard"
            >
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </TableCell>
    </>
  );
}

/** "2 fours, 1 six"; empty when there were none. */
function boundariesOf(fours: number, sixes: number) {
  const parts: string[] = [];
  if (fours) parts.push(`${fours} ${fours === 1 ? "four" : "fours"}`);
  if (sixes) parts.push(`${sixes} ${sixes === 1 ? "six" : "sixes"}`);
  return parts.join(", ");
}

function opponentName(
  match: PerformanceMatch | null | undefined,
  opponent: PerformanceTeam | null,
) {
  return opponent ? opponent.name : (match?.title ?? "Match");
}

/**
 * One innings or spell on a phone (P2): the opponent beside the figures,
 * then the date, the details and the result on a line that may wrap, so
 * nothing sits off the edge of a table. The table takes over from `lg`, where it fits.
 */
function PerformanceRow({
  match,
  opponent,
  figure,
  aside,
  details,
  figureClassName,
}: {
  match?: PerformanceMatch | null;
  opponent: PerformanceTeam | null;
  figure: string;
  /** Beside the figure, smaller: balls faced, overs bowled. */
  aside: string;
  details: Array<string | false | null | undefined>;
  figureClassName?: string;
}) {
  const body = (
    <>
      {opponent && (
        <TeamLogo
          name={opponent.name}
          shortName={opponent.short_name}
          logoUrl={opponent.logo_url}
          className="mt-0.5 h-8 w-8 shrink-0 text-xs"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            vs {opponentName(match, opponent)}
          </p>
          <p className="shrink-0 tabular-nums">
            <span
              className={`font-score text-base font-bold ${figureClassName ?? "text-foreground"}`}
            >
              {figure}
            </span>{" "}
            <span className="text-xs text-muted-foreground">{aside}</span>
          </p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[formatDate(match?.scheduled_at), ...details]
            .filter(Boolean)
            .join(" · ")}
          {match && !match.result_description && (
            <MatchStatusChip status={match.status} className="ml-1.5" />
          )}
        </p>
      </div>
    </>
  );
  const row = "flex items-start gap-3 px-4 py-3";
  return match ? (
    <Link
      href={`/matches/${match.id}`}
      className={`${row} transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none`}
    >
      {body}
    </Link>
  ) : (
    <div className={row}>{body}</div>
  );
}

const TABS_LISTING_MATCHES = ["batting", "bowling", "matches"];

export function PlayerActivityTabs({
  teams,
  batting,
  bowling,
  matches,
  matchesLoaded,
  hasMatches,
  initialTab,
  statistics,
}: PlayerActivityTabsProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  /** Whether this page has, or has asked for, the tabs that list matches. */
  const askedForMatches = useRef(matchesLoaded);
  // Determine default active tab
  const defaultTab = statistics
    ? "statistics"
    : batting.length > 0
      ? "batting"
      : bowling.length > 0
        ? "bowling"
        : hasMatches
          ? "matches"
          : "teams";

  // Only the tabs with something in them.
  const tabs = [
    statistics && { value: "statistics", label: "Stats" },
    batting.length > 0 && { value: "batting", label: "Batting" },
    bowling.length > 0 && { value: "bowling", label: "Bowling" },
    hasMatches && { value: "matches", label: "Matches" },
    teams.length > 0 && { value: "teams", label: "Teams" },
  ].filter((t) => !!t);

  const [activeTab, setActiveTab] = useState(() =>
    tabs.some((t) => t.value === initialTab) ? initialTab! : defaultTab,
  );
  const changeTab = (tab: string) => {
    setActiveTab(tab);
    if (TABS_LISTING_MATCHES.includes(tab) && !askedForMatches.current) {
      // Their documents are read when one first opens: the page renders
      // again for this tab, and the other two then have them too.
      askedForMatches.current = true;
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      startTransition(() => {
        router.replace(`${url.pathname}${url.search}`, { scroll: false });
      });
      return;
    }
    setUrlParam("tab", tab, defaultTab);
  };

  // Helper to determine opponent team name
  const getOpponent = (match?: PerformanceMatch | null) => {
    if (!match) return null;
    const playerTeamIds = new Set(teams.map((t) => t.team.id));
    if (playerTeamIds.has(match.team1.id)) return match.team2;
    if (playerTeamIds.has(match.team2.id)) return match.team1;
    return match.team2; // Fallback
  };

  return (
    <Tabs value={activeTab} onValueChange={changeTab} className="w-full">
      <PinnedTabs label="Player sections" tabs={tabs} />

      {statistics && (
        <TabsContent value="statistics" className="mt-6 space-y-6">
          {statistics}
        </TabsContent>
      )}

      {!matchesLoaded &&
        TABS_LISTING_MATCHES.map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            <TabSkeleton />
          </TabsContent>
        ))}

      {/* =================== BATTING INNINGS TAB =================== */}
      {matchesLoaded && (
      <>
      <TabsContent value="batting" className="mt-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">
          Batting innings
        </h3>

        {batting.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No batting innings yet"
            description="Innings from scored matches will appear here."
          />
        ) : (
          <>
          <ListCard className="lg:hidden">
            {batting.map((bp) => (
              <PerformanceRow
                key={bp.id}
                match={bp.match}
                opponent={getOpponent(bp.match)}
                figure={`${bp.runs_scored}${bp.is_out ? "" : "*"}`}
                aside={`(${bp.balls_faced})`}
                figureClassName={
                  bp.runs_scored >= 50 ? "text-warning" : undefined
                }
                details={[
                  boundariesOf(bp.fours, bp.sixes),
                  formatHowOut(
                    bp.is_out,
                    bp.dismissal_type,
                    bp.bowler?.full_name,
                    bp.fielder?.full_name,
                  ),
                  bp.match?.result_description,
                ]}
              />
            ))}
          </ListCard>
          <div className="hidden overflow-hidden rounded-lg border bg-card shadow-sm lg:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="min-w-[180px]">
                      Match / opponent
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      Runs
                    </TableHead>
                    <TableHead className="text-center">Balls</TableHead>
                    <TableHead className="text-center">SR</TableHead>
                    <TableHead className="text-center">4s</TableHead>
                    <TableHead className="text-center">6s</TableHead>
                    <TableHead className="min-w-[180px]">Dismissal</TableHead>
                    <TableHead className="min-w-[180px]">Result</TableHead>
                    <TableHead className="w-[80px] text-right">
                      <span className="sr-only">Scorecard</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batting.map((bp) => {
                    const opponent = getOpponent(bp.match);
                    const howOut = formatHowOut(
                      bp.is_out,
                      bp.dismissal_type,
                      bp.bowler?.full_name,
                      bp.fielder?.full_name,
                    );

                    return (
                      <TableRow key={bp.id} className="hover:bg-muted/30">
                        {/* Match & Opponent */}
                        <MatchOpponentCell
                          match={bp.match}
                          opponent={opponent}
                        />

                        {/* Runs */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={`tabular-nums text-base font-semibold ${
                                bp.runs_scored >= 50
                                  ? "text-warning dark:text-warning"
                                  : "text-foreground"
                              }`}
                            >
                              {bp.runs_scored}
                              {!bp.is_out && "*"}
                            </span>
                            {!bp.is_out && (
                              <Badge
                                variant="success"
                              >
                                not out
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Balls */}
                        <TableCell className="tabular-nums text-center font-medium text-muted-foreground">
                          {bp.balls_faced}
                        </TableCell>

                        {/* Strike Rate */}
                        <TableCell className="tabular-nums text-center text-xs font-semibold">
                          {strikeRate(bp.runs_scored, bp.balls_faced)}
                        </TableCell>

                        {/* 4s */}
                        <TableCell className="tabular-nums text-center text-xs">
                          {bp.fours}
                        </TableCell>

                        {/* 6s */}
                        <TableCell className="tabular-nums text-center text-xs">
                          {bp.sixes}
                        </TableCell>

                        {/* Dismissal */}
                        <TableCell>
                          <span
                            className={`text-xs ${
                              !bp.is_out
                                ? "font-semibold text-success dark:text-success"
                                : "text-muted-foreground"
                            }`}
                          >
                            {howOut}
                          </span>
                        </TableCell>

                        <MatchResultCells match={bp.match} />
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          </>
        )}
      </TabsContent>

      {/* =================== BOWLING SPELLS TAB =================== */}
      <TabsContent value="bowling" className="mt-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">
          Bowling spells
        </h3>

        {bowling.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No bowling yet"
            description="Bowling spells and wickets from matches will appear here as the player bowls."
          />
        ) : (
          <>
          <ListCard className="lg:hidden">
            {bowling.map((bp) => (
              <PerformanceRow
                key={bp.id}
                match={bp.match}
                opponent={getOpponent(bp.match)}
                figure={`${bp.wickets_taken}/${bp.runs_conceded}`}
                aside={`(${Number(bp.overs_bowled).toFixed(1)} ov)`}
                figureClassName={
                  bp.wickets_taken >= 3 ? "text-primary" : undefined
                }
                details={[
                  bp.maidens > 0 &&
                    `${bp.maidens} ${bp.maidens === 1 ? "maiden" : "maidens"}`,
                  `econ ${economyRate(
                    bp.runs_conceded,
                    bp.balls_bowled || ballsFromOvers(Number(bp.overs_bowled)),
                  )}`,
                  bp.match?.result_description,
                ]}
              />
            ))}
          </ListCard>
          <div className="hidden overflow-hidden rounded-lg border bg-card shadow-sm lg:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="min-w-[180px]">
                      Match / opponent
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      Figures (W/R)
                    </TableHead>
                    <TableHead className="text-center">Overs</TableHead>
                    <TableHead className="text-center">Maidens</TableHead>
                    <TableHead className="text-center">Runs</TableHead>
                    <TableHead className="text-center">Wickets</TableHead>
                    <TableHead className="text-center">Econ</TableHead>
                    <TableHead className="text-center">
                      Extras (wd/nb)
                    </TableHead>
                    <TableHead className="min-w-[180px]">Result</TableHead>
                    <TableHead className="w-[80px] text-right">
                      <span className="sr-only">Scorecard</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bowling.map((bp) => {
                    const opponent = getOpponent(bp.match);

                    return (
                      <TableRow key={bp.id} className="hover:bg-muted/30">
                        {/* Match / Opponent */}
                        <MatchOpponentCell
                          match={bp.match}
                          opponent={opponent}
                        />

                        {/* Figures */}
                        <TableCell className="text-center">
                          <span
                            className={`tabular-nums text-base font-semibold ${
                              bp.wickets_taken >= 3
                                ? "text-primary"
                                : "text-foreground"
                            }`}
                          >
                            {bp.wickets_taken}/{bp.runs_conceded}
                          </span>
                        </TableCell>

                        {/* Overs */}
                        <TableCell className="tabular-nums text-center font-medium">
                          {Number(bp.overs_bowled).toFixed(1)}
                        </TableCell>

                        {/* Maidens */}
                        <TableCell className="tabular-nums text-center">
                          {bp.maidens}
                        </TableCell>

                        {/* Runs Conceded */}
                        <TableCell className="tabular-nums text-center text-muted-foreground">
                          {bp.runs_conceded}
                        </TableCell>

                        {/* Wickets */}
                        <TableCell className="tabular-nums text-center font-semibold text-foreground">
                          {bp.wickets_taken}
                        </TableCell>

                        {/* Economy */}
                        <TableCell className="tabular-nums text-center text-xs font-semibold">
                          {economyRate(
                            bp.runs_conceded,
                            bp.balls_bowled ||
                              ballsFromOvers(Number(bp.overs_bowled)),
                          )}
                        </TableCell>

                        {/* Extras */}
                        <TableCell className="tabular-nums text-center text-xs text-muted-foreground">
                          {bp.wides}/{bp.no_balls}
                        </TableCell>

                        <MatchResultCells match={bp.match} />
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          </>
        )}
      </TabsContent>

      {/* =================== MATCHES TAB =================== */}
      <TabsContent value="matches" className="mt-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">
          Matches
        </h3>

        {matches.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="No matches yet"
            description="Matches scheduled or played by this player and their teams will appear here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {matches.map((m) => {
              const figures = [
                m.playerBatting &&
                  `Batting ${m.playerBatting.runs_scored}${m.playerBatting.is_out ? "" : "*"} (${m.playerBatting.balls_faced})`,
                m.playerBowling &&
                  `Bowling ${m.playerBowling.wickets_taken}/${m.playerBowling.runs_conceded} (${Number(m.playerBowling.overs_bowled).toFixed(1)})`,
              ].filter(Boolean);
              return (
                <MatchCard
                  key={m.id}
                  match={m as unknown as Match}
                  showActions={false}
                  detail={
                    figures.length > 0 ? (
                      <p className="mt-1 font-score text-xs tabular-nums text-muted-foreground">
                        {figures.join(" · ")}
                      </p>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </TabsContent>

      </>
      )}

      {/* =================== TEAMS TAB =================== */}
      <TabsContent value="teams" className="mt-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">
          Teams
        </h3>

        {teams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Not in a team yet"
            description="Teams appear here once a team adds this player to its squad."
          />
        ) : (
          <ListCard aria-label="Teams">
            {teams.map((tm) => {
              const role =
                tm.role_in_team === "captain"
                  ? "Captain (c)"
                  : tm.role_in_team === "vice_captain"
                    ? "Vice-captain (vc)"
                    : tm.role_in_team === "wicket_keeper"
                      ? "Wicket-keeper (wk)"
                      : formatPlayerRole(tm.role_in_team);
              return (
                <ListRow
                  key={tm.id}
                  href={`/teams/${tm.team.id}`}
                  leading={
                    <TeamCrest
                      name={tm.team.name}
                      shortName={tm.team.short_name}
                      logoUrl={tm.team.logo_url}
                      size="sm"
                    />
                  }
                  title={tm.team.name}
                  subtitle={[
                    role,
                    tm.jersey_number != null ? `#${tm.jersey_number}` : null,
                    tm.team.club?.name,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              );
            })}
          </ListCard>
        )}
      </TabsContent>
    </Tabs>
  );
}
