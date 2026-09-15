"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { TeamLogo } from "~/components/teams/team-logo";
import { EmptyState } from "~/components/ui/empty-state";
import {
  formatHowOut,
  formatPlayerRole,
  formatTeamType,
  formatStatus,
  strikeRate,
  economyRate,
  ballsFromOvers,
} from "~/lib/cricket";
import {
  CalendarDays,
  MapPin,
  ArrowRight,
  Swords,
  Users,
  Trophy,
  Activity,
  Flame,
} from "lucide-react";

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
  match?: {
    id: string;
    title: string;
    match_format: string;
    scheduled_at?: string | null;
    status: string;
    venue?: string | null;
    result_description?: string | null;
    winning_team_id?: string | null;
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
  } | null;
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
  match?: {
    id: string;
    title: string;
    match_format: string;
    scheduled_at?: string | null;
    status: string;
    venue?: string | null;
    result_description?: string | null;
    winning_team_id?: string | null;
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
  } | null;
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
  userId: string;
  teams: PlayerTeamMembership[];
  batting: PlayerBattingPerformance[];
  bowling: PlayerBowlingPerformance[];
  matches: PlayerMatchItem[];
  tournamentId?: string;
  teamId?: string;
  initialTab?: string;
}

export function PlayerActivityTabs({
  userId,
  teams,
  batting,
  bowling,
  matches,
  tournamentId,
  initialTab,
}: PlayerActivityTabsProps) {
  // Determine default active tab
  const defaultTab =
    initialTab ??
    (batting.length > 0
      ? "batting"
      : bowling.length > 0
        ? "bowling"
        : matches.length > 0
          ? "matches"
          : "teams");

  const [activeTab, setActiveTab] = useState(defaultTab);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "TBD";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Helper to determine opponent team name
  const getOpponent = (
    match?: {
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
    } | null,
  ) => {
    if (!match) return null;
    const playerTeamIds = new Set(teams.map((t) => t.team.id));
    if (playerTeamIds.has(match.team1.id)) return match.team2;
    if (playerTeamIds.has(match.team2.id)) return match.team1;
    return match.team2; // Fallback
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="border-b pb-4">
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2 gap-1 p-1 sm:inline-flex sm:w-auto">
          <TabsTrigger
            value="batting"
            className="gap-1.5 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm"
          >
            <Flame className="h-4 w-4 text-orange-500" />
            <span>Batting</span>
            <Badge
              variant="secondary"
              className="ml-1 h-5 px-1.5 text-xs font-semibold"
            >
              {batting.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="bowling"
            className="gap-1.5 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm"
          >
            <Activity className="h-4 w-4 text-blue-500" />
            <span>Bowling</span>
            <Badge
              variant="secondary"
              className="ml-1 h-5 px-1.5 text-xs font-semibold"
            >
              {bowling.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="matches"
            className="gap-1.5 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm"
          >
            <Swords className="h-4 w-4 text-emerald-500" />
            <span>Matches</span>
            <Badge
              variant="secondary"
              className="ml-1 h-5 px-1.5 text-xs font-semibold"
            >
              {matches.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="gap-1.5 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm"
          >
            <Users className="h-4 w-4 text-purple-500" />
            <span>Teams</span>
            <Badge
              variant="secondary"
              className="ml-1 h-5 px-1.5 text-xs font-semibold"
            >
              {teams.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </div>

      {/* =================== BATTING INNINGS TAB =================== */}
      <TabsContent value="batting" className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">
              Recent Batting Innings
            </h3>
            <p className="text-xs text-muted-foreground">
              Detailed performance history including balls faced, boundaries,
              dismissals, and match results
            </p>
          </div>
          {batting.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {batting.length} Innings recorded
            </Badge>
          )}
        </div>

        {batting.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="No Batting Innings Recorded"
            description="Batting performances from completed and live scorecards will automatically appear here."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="min-w-[180px]">
                      Match / Opponent
                    </TableHead>
                    <TableHead className="text-center font-bold">
                      Runs
                    </TableHead>
                    <TableHead className="text-center">Balls</TableHead>
                    <TableHead className="text-center">SR</TableHead>
                    <TableHead className="text-center">4s</TableHead>
                    <TableHead className="text-center">6s</TableHead>
                    <TableHead className="min-w-[180px]">Dismissal</TableHead>
                    <TableHead className="min-w-[180px]">Result</TableHead>
                    <TableHead className="w-[80px] text-right"></TableHead>
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
                                vs{" "}
                                {opponent
                                  ? opponent.name
                                  : (bp.match?.title ?? "Match")}
                              </p>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span>
                                  {formatDate(bp.match?.scheduled_at)}
                                </span>
                                {bp.match?.match_format && (
                                  <>
                                    <span>•</span>
                                    <span>{bp.match.match_format}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Runs */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={`tabular text-base font-bold ${
                                bp.runs_scored >= 50
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-foreground"
                              }`}
                            >
                              {bp.runs_scored}
                              {!bp.is_out && "*"}
                            </span>
                            {!bp.is_out && (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/40 bg-emerald-500/10 px-1 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                              >
                                not out
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Balls */}
                        <TableCell className="tabular text-center font-medium text-muted-foreground">
                          {bp.balls_faced}
                        </TableCell>

                        {/* Strike Rate */}
                        <TableCell className="tabular text-center text-xs font-semibold">
                          {strikeRate(bp.runs_scored, bp.balls_faced)}
                        </TableCell>

                        {/* 4s */}
                        <TableCell className="tabular text-center text-xs">
                          {bp.fours}
                        </TableCell>

                        {/* 6s */}
                        <TableCell className="tabular text-center text-xs">
                          {bp.sixes}
                        </TableCell>

                        {/* Dismissal */}
                        <TableCell>
                          <span
                            className={`text-xs ${
                              !bp.is_out
                                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {howOut}
                          </span>
                        </TableCell>

                        {/* Result */}
                        <TableCell>
                          <div
                            className="max-w-[200px] truncate text-xs text-muted-foreground"
                            title={bp.match?.result_description ?? ""}
                          >
                            {bp.match?.result_description ?? (
                              <Badge variant="outline" className="text-[10px]">
                                {formatStatus(bp.match?.status ?? "scheduled")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Action Link */}
                        <TableCell className="text-right">
                          {bp.match && (
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                            >
                              <Link
                                href={`/matches/${bp.match.id}?playerId=${userId}`}
                                title="View Match Scorecard"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </TabsContent>

      {/* =================== BOWLING SPELLS TAB =================== */}
      <TabsContent value="bowling" className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">
              Recent Bowling Spells
            </h3>
            <p className="text-xs text-muted-foreground">
              Overs, wickets, runs conceded, maidens, economy rates, and match
              context
            </p>
          </div>
          {bowling.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {bowling.length} Spells recorded
            </Badge>
          )}
        </div>

        {bowling.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No Bowling Figures Recorded"
            description="Bowling spells and wickets from matches will appear here as the player bowls."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="min-w-[180px]">
                      Match / Opponent
                    </TableHead>
                    <TableHead className="text-center font-bold">
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
                    <TableHead className="w-[80px] text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bowling.map((bp) => {
                    const opponent = getOpponent(bp.match);

                    return (
                      <TableRow key={bp.id} className="hover:bg-muted/30">
                        {/* Match / Opponent */}
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
                                vs{" "}
                                {opponent
                                  ? opponent.name
                                  : (bp.match?.title ?? "Match")}
                              </p>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span>
                                  {formatDate(bp.match?.scheduled_at)}
                                </span>
                                {bp.match?.match_format && (
                                  <>
                                    <span>•</span>
                                    <span>{bp.match.match_format}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Figures */}
                        <TableCell className="text-center">
                          <span
                            className={`tabular text-base font-bold ${
                              bp.wickets_taken >= 3
                                ? "font-extrabold text-primary"
                                : "text-foreground"
                            }`}
                          >
                            {bp.wickets_taken}/{bp.runs_conceded}
                          </span>
                        </TableCell>

                        {/* Overs */}
                        <TableCell className="tabular text-center font-medium">
                          {Number(bp.overs_bowled).toFixed(1)}
                        </TableCell>

                        {/* Maidens */}
                        <TableCell className="tabular text-center">
                          {bp.maidens}
                        </TableCell>

                        {/* Runs Conceded */}
                        <TableCell className="tabular text-center text-muted-foreground">
                          {bp.runs_conceded}
                        </TableCell>

                        {/* Wickets */}
                        <TableCell className="tabular text-center font-bold text-foreground">
                          {bp.wickets_taken}
                        </TableCell>

                        {/* Economy */}
                        <TableCell className="tabular text-center text-xs font-semibold">
                          {economyRate(
                            bp.runs_conceded,
                            bp.balls_bowled ||
                              ballsFromOvers(Number(bp.overs_bowled)),
                          )}
                        </TableCell>

                        {/* Extras */}
                        <TableCell className="tabular text-center text-xs text-muted-foreground">
                          {bp.wides}/{bp.no_balls}
                        </TableCell>

                        {/* Result */}
                        <TableCell>
                          <div
                            className="max-w-[200px] truncate text-xs text-muted-foreground"
                            title={bp.match?.result_description ?? ""}
                          >
                            {bp.match?.result_description ?? (
                              <Badge variant="outline" className="text-[10px]">
                                {formatStatus(bp.match?.status ?? "scheduled")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Action Link */}
                        <TableCell className="text-right">
                          {bp.match && (
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                            >
                              <Link
                                href={`/matches/${bp.match.id}?playerId=${userId}`}
                                title="View Match Scorecard"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </TabsContent>

      {/* =================== MATCHES TAB =================== */}
      <TabsContent value="matches" className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">
              Match Appearances
            </h3>
            <p className="text-xs text-muted-foreground">
              Matches involving the player and their teams with personal
              performance records
            </p>
          </div>
          {matches.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {matches.length} Matches
            </Badge>
          )}
        </div>

        {matches.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="No Matches Found"
            description="Matches scheduled or played by this player and their teams will appear here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {matches.map((m) => {
              const inn1 = m.innings?.find((i) => i.team_id === m.team1.id);
              const inn2 = m.innings?.find((i) => i.team_id === m.team2.id);

              return (
                <Card
                  key={m.id}
                  className="overflow-hidden transition-all hover:border-primary/50 hover:shadow-sm"
                >
                  <CardContent className="p-0">
                    {/* Header Strip */}
                    <div className="flex items-center justify-between border-b px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            m.status === "live"
                              ? "default"
                              : m.status === "completed"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-[11px]"
                        >
                          {m.status === "live" && (
                            <span className="mr-1 h-2 w-2 animate-ping rounded-full bg-red-400" />
                          )}
                          {formatStatus(m.status)}
                        </Badge>
                        {m.tournament && (
                          <span className="flex max-w-[130px] items-center gap-1 truncate font-medium text-muted-foreground">
                            <Trophy className="h-3 w-3 shrink-0 text-amber-500" />
                            {m.tournament.name}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {m.match_format} · {m.overs_per_innings} ov
                      </span>
                    </div>

                    {/* Teams & Scores */}
                    <div className="space-y-2.5 p-4">
                      {/* Team 1 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamLogo
                            name={m.team1.name}
                            shortName={m.team1.short_name}
                            logoUrl={m.team1.logo_url}
                            className="h-6 w-6 text-xs"
                          />
                          <span className="truncate text-sm font-medium">
                            {m.team1.name}
                          </span>
                        </div>
                        {inn1 ? (
                          <div className="tabular text-right text-xs font-bold">
                            {inn1.total_runs}/{inn1.total_wickets}
                            <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                              ({inn1.total_overs.toFixed(1)})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </div>

                      {/* Team 2 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamLogo
                            name={m.team2.name}
                            shortName={m.team2.short_name}
                            logoUrl={m.team2.logo_url}
                            className="h-6 w-6 text-xs"
                          />
                          <span className="truncate text-sm font-medium">
                            {m.team2.name}
                          </span>
                        </div>
                        {inn2 ? (
                          <div className="tabular text-right text-xs font-bold">
                            {inn2.total_runs}/{inn2.total_wickets}
                            <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                              ({inn2.total_overs.toFixed(1)})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Player's Performance in this match (if played) */}
                    {(m.playerBatting || m.playerBowling) && (
                      <div className="flex flex-wrap items-center gap-2 border-t bg-primary/5 px-4 py-2 text-xs">
                        <span className="font-semibold text-primary">
                          Player:
                        </span>
                        {m.playerBatting && (
                          <Badge
                            variant="outline"
                            className="border-primary/20 bg-background text-[11px] font-medium"
                          >
                            Bat: {m.playerBatting.runs_scored}
                            {!m.playerBatting.is_out && "*"} (
                            {m.playerBatting.balls_faced}b)
                          </Badge>
                        )}
                        {m.playerBowling && (
                          <Badge
                            variant="outline"
                            className="border-primary/20 bg-background text-[11px] font-medium"
                          >
                            Bowl: {m.playerBowling.wickets_taken}/
                            {m.playerBowling.runs_conceded} (
                            {Number(m.playerBowling.overs_bowled).toFixed(1)}ov)
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Result or Timing */}
                    <div className="border-t bg-muted/20 px-4 py-2">
                      {m.result_description ? (
                        <p className="truncate text-xs font-medium text-primary">
                          {m.result_description}
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {m.venue && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {m.venue}
                            </span>
                          )}
                          <span className="tabular inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {formatDate(m.scheduled_at)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer Action */}
                    <div className="border-t px-4 py-2">
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="h-7 w-full justify-between text-xs font-medium hover:bg-primary/10 hover:text-primary"
                      >
                        <Link href={`/matches/${m.id}?playerId=${userId}`}>
                          <span>View Scorecard</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>

      {/* =================== TEAMS TAB =================== */}
      <TabsContent value="teams" className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">
              Teams & Squads
            </h3>
            <p className="text-xs text-muted-foreground">
              Teams and clubs this player is affiliated with, including
              leadership roles and jersey numbers
            </p>
          </div>
          {teams.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {teams.length} Teams
            </Badge>
          )}
        </div>

        {teams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Team Memberships Found"
            description="When this player is added to squad rosters by team managers, they will be shown here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {teams.map((tm) => {
              const teamUrl = `/teams/${tm.team.id}${tournamentId ? `?tournamentId=${encodeURIComponent(tournamentId)}` : ""}`;

              return (
                <Card
                  key={tm.id}
                  className="transition-all hover:border-primary/50 hover:shadow-sm"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <TeamLogo
                          name={tm.team.name}
                          shortName={tm.team.short_name}
                          logoUrl={tm.team.logo_url}
                          className="h-12 w-12 text-sm"
                        />
                        <div>
                          <CardTitle className="text-base font-bold leading-tight">
                            <Link
                              href={teamUrl}
                              className="transition-colors hover:text-primary"
                            >
                              {tm.team.name}
                            </Link>
                          </CardTitle>
                          {tm.team.club && (
                            <p className="text-xs text-muted-foreground">
                              {tm.team.club.name}
                            </p>
                          )}
                        </div>
                      </div>

                      {tm.jersey_number !== undefined &&
                        tm.jersey_number !== null && (
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs font-bold"
                            title="Jersey Number"
                          >
                            #{tm.jersey_number}
                          </Badge>
                        )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {tm.role_in_team === "captain" && (
                        <Badge className="border-yellow-200 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                          Captain
                        </Badge>
                      )}
                      {tm.role_in_team === "vice_captain" && (
                        <Badge className="border-blue-200 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          Vice Captain
                        </Badge>
                      )}
                      {tm.role_in_team === "wicket_keeper" && (
                        <Badge variant="outline">Wicket Keeper</Badge>
                      )}
                      {(!tm.role_in_team ||
                        !["captain", "vice_captain", "wicket_keeper"].includes(
                          tm.role_in_team,
                        )) && (
                        <Badge variant="outline">
                          {formatPlayerRole(tm.role_in_team)}
                        </Badge>
                      )}
                      <Badge variant="secondary">
                        {formatTeamType(tm.team.team_type)}
                      </Badge>
                    </div>

                    {tm.team.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {tm.team.description}
                      </p>
                    )}

                    <div className="border-t pt-3">
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="h-8 w-full justify-between text-xs font-medium hover:bg-primary/10 hover:text-primary"
                      >
                        <Link href={teamUrl}>
                          <span>View Team & Squad</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
