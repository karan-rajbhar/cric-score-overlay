"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import type { Match } from "~/lib/match-types";
import {
  dismissalText,
  economyRate,
  formatDecimalOvers,
  oversFromBalls,
  byBattingOrder,
  strikeRate,
  teamName,
} from "~/lib/cricket";

interface MatchScorecardProps {
  match: Match;
}

export function MatchScorecard({ match }: MatchScorecardProps) {
  const sortedInnings = [...(match.innings || [])].sort(
    (a, b) => a.innings_number - b.innings_number,
  );

  if (sortedInnings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No innings data available yet
        </CardContent>
      </Card>
    );
  }

  const currentInningsNum = match.current_innings ?? sortedInnings[0]?.innings_number;
  const activeInningsExists = sortedInnings.some((inn) => inn.innings_number === currentInningsNum);
  const defaultTab = activeInningsExists
    ? `innings-${currentInningsNum}`
    : `innings-${sortedInnings[sortedInnings.length - 1]?.innings_number ?? 1}`;

  return (
    <Tabs
      defaultValue={defaultTab}
      className="w-full"
    >
      <TabsList className="mb-4 grid h-auto w-full max-w-md grid-cols-2">
        {sortedInnings.map((innings) => {
          const t =
            innings.team_id === match.team1_id ? match.team1 : match.team2;
          const shortName = t?.short_name || t?.name;
          return (
            <TabsTrigger
              key={innings.id}
              value={`innings-${innings.innings_number}`}
              className="min-w-0"
            >
              <span className="truncate">
                {shortName} {innings.total_runs}/{innings.total_wickets}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {sortedInnings.map((innings) => {
        const battedUserIds = new Set(
          innings.batting_performances?.map((bp) => bp.user_id),
        );
        const battingTeam =
          innings.team_id === match.team1_id ? match.team1 : match.team2;
        const dnbPlayers = battingTeam.team_players?.filter(
          (tp) => !battedUserIds.has(tp.user_id),
        );

        return (
          <TabsContent
            key={innings.id}
            value={`innings-${innings.innings_number}`}
          >
            <div className="space-y-6">
              {/* Innings Header */}
              <Card className="overflow-hidden border-border bg-card">
                <CardHeader className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground">
                        {battingTeam.short_name?.slice(0, 3) ||
                          battingTeam.name.slice(0, 3)}
                      </div>
                      <div>
                        <CardTitle className="text-lg sm:text-xl">
                          {teamName(match, innings.team_id)} Innings
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Innings {innings.innings_number}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl sm:text-4xl font-bold tabular-nums font-score text-foreground">
                        {innings.total_runs}/{innings.total_wickets}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground tabular-nums font-medium">
                        ({formatDecimalOvers(innings.total_overs)} overs)
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Batting Card */}
              <Card className="content-visibility-auto overflow-hidden border-border">
                <CardHeader className="border-b border-border/50 py-3.5">
                  <CardTitle className="text-base sm:text-lg">Batting</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-auto min-w-[120px] px-3 py-2.5 text-xs font-medium text-muted-foreground sm:w-[220px] sm:px-4 sm:text-xs">
                          Batter
                        </TableHead>
                        <TableHead className="px-1.5 py-2.5 text-center text-xs font-medium text-muted-foreground sm:px-2 sm:text-xs">
                          R
                        </TableHead>
                        <TableHead className="px-1.5 py-2.5 text-center text-xs font-medium text-muted-foreground sm:px-2 sm:text-xs">
                          B
                        </TableHead>
                        <TableHead className="px-1.5 py-2.5 text-center text-xs font-medium text-muted-foreground sm:px-2 sm:text-xs">
                          4s
                        </TableHead>
                        <TableHead className="px-1.5 py-2.5 text-center text-xs font-medium text-muted-foreground sm:px-2 sm:text-xs">
                          6s
                        </TableHead>
                        <TableHead className="px-1.5 py-2.5 text-center text-xs font-medium text-muted-foreground sm:px-2 sm:text-xs">
                          SR
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...(innings.batting_performances || [])]
                        .sort(byBattingOrder)
                        .map((bp) => (
                          <TableRow
                            key={bp.id}
                            className="transition-colors hover:bg-muted/30"
                          >
                            <TableCell className="px-3 py-2.5 sm:px-4 sm:py-3">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold sm:text-sm text-foreground">
                                    {bp.user?.full_name}
                                  </span>
                                  {!bp.is_out && (
                                    <Badge
                                      variant="outline"
                                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0 text-2xs sm:text-xs font-semibold"
                                    >
                                      not out
                                    </Badge>
                                  )}
                                </div>
                                {bp.is_out && (
                                  <p className="text-2xs text-muted-foreground sm:text-xs">
                                    {dismissalText(
                                      bp,
                                      innings.fall_of_wickets ?? [],
                                    )}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="tabular-nums font-score px-1.5 py-2.5 text-center text-sm font-bold sm:px-2 sm:py-3 sm:text-base text-foreground">
                              {bp.runs_scored}
                            </TableCell>
                            <TableCell className="tabular-nums px-1.5 py-2.5 text-center text-xs text-muted-foreground sm:px-2 sm:py-3 sm:text-sm">
                              {bp.balls_faced}
                            </TableCell>
                            <TableCell className="tabular-nums px-1.5 py-2.5 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                              {bp.fours > 0 ? (
                                <span className="inline-block rounded px-1.5 py-0.5 font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10">
                                  {bp.fours}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60">0</span>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums px-1.5 py-2.5 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                              {bp.sixes > 0 ? (
                                <span className="inline-block rounded px-1.5 py-0.5 font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10">
                                  {bp.sixes}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60">0</span>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums px-1.5 py-2.5 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                              {(() => {
                                const sr = strikeRate(bp.runs_scored, bp.balls_faced);
                                const srNum = parseFloat(sr);
                                const srColor = isNaN(srNum)
                                  ? "text-muted-foreground"
                                  : srNum >= 150
                                    ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                    : srNum >= 100
                                      ? "text-foreground font-semibold"
                                      : "text-muted-foreground";
                                return <span className={srColor}>{sr}</span>;
                              })()}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Extras */}
              <Card className="border-border bg-card">
                <CardContent className="py-3 px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-muted-foreground">
                        Extras
                      </span>
                      <span className="tabular-nums font-score text-base sm:text-lg font-bold text-foreground">
                        {innings.extras_total || 0}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm tabular-nums">
                      <span className="rounded bg-muted/60 px-2 py-0.5">
                        wd {innings.extras_wides || 0}
                      </span>
                      <span className="rounded bg-muted/60 px-2 py-0.5">
                        nb {innings.extras_no_balls || 0}
                      </span>
                      <span className="rounded bg-muted/60 px-2 py-0.5">
                        b {innings.extras_byes || 0}
                      </span>
                      <span className="rounded bg-muted/60 px-2 py-0.5">
                        lb {innings.extras_leg_byes || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bowling Card */}
              <Card className="content-visibility-auto overflow-hidden border-border">
                <CardHeader className="border-b border-border/50 py-3.5">
                  <CardTitle className="text-base sm:text-lg">Bowling</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-auto min-w-[120px] px-3 py-2.5 text-xs font-medium text-muted-foreground sm:w-[220px] sm:px-4 sm:text-xs">
                          Bowler
                        </TableHead>
                        <TableHead className="px-1.5 py-2.5 text-center text-xs font-medium text-muted-foreground sm:px-2 sm:text-xs">
                          O
                        </TableHead>
                        <TableHead className="px-1.5 py-2.5 text-center text-xs font-medium text-muted-foreground sm:px-2 sm:text-xs">
                          M
                        </TableHead>
                        <TableHead className="px-1.5 py-2.5 text-center text-xs font-medium text-muted-foreground sm:px-2 sm:text-xs">
                          R
                        </TableHead>
                        <TableHead className="px-1.5 py-2.5 text-center text-xs font-medium text-muted-foreground sm:px-2 sm:text-xs">
                          W
                        </TableHead>
                        <TableHead className="px-1.5 py-2.5 text-center text-xs font-medium text-muted-foreground sm:px-2 sm:text-xs">
                          Econ
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* In the order they came on, as on a scorecard. */}
                      {(innings.bowling_performances || [])
                        .map((bp) => (
                          <TableRow
                            key={bp.id}
                            className="transition-colors hover:bg-muted/30"
                          >
                            <TableCell className="px-3 py-2.5 text-xs font-semibold text-foreground sm:px-4 sm:py-3 sm:text-sm">
                              {bp.user?.full_name}
                            </TableCell>
                            <TableCell className="tabular-nums px-1.5 py-2.5 text-center text-xs text-muted-foreground sm:px-2 sm:py-3 sm:text-sm">
                              {oversFromBalls(bp.balls_bowled ?? 0)}
                            </TableCell>
                            <TableCell className="tabular-nums px-1.5 py-2.5 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                              {bp.maidens > 0 ? (
                                <span className="font-bold text-primary">
                                  {bp.maidens}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60">
                                  {bp.maidens}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums px-1.5 py-2.5 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                              {bp.runs_conceded}
                            </TableCell>
                            <TableCell className="tabular-nums font-score px-1.5 py-2.5 text-center text-sm font-bold sm:px-2 sm:py-3 sm:text-base">
                              {bp.wickets_taken > 0 ? (
                                <span className="inline-flex items-center justify-center rounded-md bg-destructive/15 text-destructive font-bold px-1.5 py-0.5">
                                  {bp.wickets_taken}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums px-1.5 py-2.5 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                              {(() => {
                                const econ = economyRate(
                                  bp.runs_conceded,
                                  bp.balls_bowled,
                                );
                                const econNum = parseFloat(econ);
                                const econColor = isNaN(econNum)
                                  ? "text-muted-foreground"
                                  : econNum <= 6.0
                                    ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                    : econNum > 10.0
                                      ? "text-destructive font-medium"
                                      : "text-foreground";
                                return <span className={econColor}>{econ}</span>;
                              })()}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Fall of Wickets */}
              {innings.fall_of_wickets && innings.fall_of_wickets.length > 0 && (
                <Card className="content-visibility-auto border-border">
                  <CardHeader className="border-b border-border/50 py-3.5">
                    <CardTitle className="text-base sm:text-lg">
                      Fall of wickets
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-2.5">
                      {innings.fall_of_wickets
                        .sort((a, b) => a.wicket_number - b.wicket_number)
                        .map((fow) => (
                          <Badge
                            key={fow.id}
                            variant="outline"
                            className="gap-1.5 border-border/70 bg-muted/30 px-3 py-1.5 text-xs sm:text-sm font-normal"
                          >
                            <strong className="font-score font-bold tabular-nums text-foreground">
                              {fow.runs_at_fall}/{fow.wicket_number}
                            </strong>
                            <span className="text-muted-foreground">
                              ({fow.batsman?.full_name},{" "}
                              {formatDecimalOvers(fow.overs_at_fall)} ov)
                            </span>
                          </Badge>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Did Not Bat (DNB) */}
              {dnbPlayers && dnbPlayers.length > 0 && (
                <Card className="border-border bg-muted/20">
                  <CardContent className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-muted-foreground">
                        Did not bat:
                      </span>
                      {dnbPlayers.map((p, idx) => (
                        <span key={p.id} className="text-foreground font-medium">
                          {p.user?.full_name || "Player"}
                          {idx < dnbPlayers.length - 1 && ","}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
