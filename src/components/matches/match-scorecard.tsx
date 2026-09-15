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

  return (
    <Tabs
      defaultValue={`innings-${sortedInnings[0]?.innings_number}`}
      className="w-full"
    >
      <TabsList className="mb-4 grid h-auto w-full max-w-md grid-cols-2 gap-1 p-1">
        {sortedInnings.map((innings) => {
          const t =
            innings.team_id === match.team1_id ? match.team1 : match.team2;
          const shortName = t?.short_name || t?.name;
          return (
            <TabsTrigger
              key={innings.id}
              value={`innings-${innings.innings_number}`}
              className="flex min-w-0 items-center justify-center px-2 py-1.5 text-xs font-semibold sm:px-3 sm:text-sm"
            >
              <span className="truncate">
                {shortName} {innings.total_runs}/{innings.total_wickets}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {sortedInnings.map((innings) => (
        <TabsContent
          key={innings.id}
          value={`innings-${innings.innings_number}`}
        >
          <div className="space-y-6">
            {/* Innings Header */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {teamName(match, innings.team_id)} Innings
                  </CardTitle>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {innings.total_runs}/{innings.total_wickets}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ({formatDecimalOvers(innings.total_overs)} overs)
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Batting Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Batting</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-auto min-w-[110px] px-2 py-2 text-xs sm:w-[200px] sm:px-4 sm:py-3 sm:text-sm">
                        Batter
                      </TableHead>
                      <TableHead className="px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                        R
                      </TableHead>
                      <TableHead className="px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                        B
                      </TableHead>
                      <TableHead className="px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                        4s
                      </TableHead>
                      <TableHead className="px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                        6s
                      </TableHead>
                      <TableHead className="px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                        SR
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(innings.batting_performances || [])
                      .sort((a, b) => {
                        if (a.batting_position && b.batting_position) {
                          return a.batting_position - b.batting_position;
                        }
                        return b.runs_scored - a.runs_scored;
                      })
                      .map((bp) => (
                        <TableRow key={bp.id}>
                          <TableCell className="px-2 py-2 sm:px-4 sm:py-3">
                            <div>
                              <span className="text-xs font-medium sm:text-sm">
                                {bp.user?.full_name}
                                {!bp.is_out && (
                                  <Badge
                                    variant="outline"
                                    className="ml-1 px-1.5 py-0 text-[10px] sm:ml-2 sm:text-xs"
                                  >
                                    not out
                                  </Badge>
                                )}
                              </span>
                              {bp.is_out && (
                                <p className="text-[11px] text-muted-foreground sm:text-xs">
                                  {dismissalText(
                                    bp,
                                    innings.fall_of_wickets ?? [],
                                  )}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="tabular px-1.5 py-2 text-center text-xs font-semibold sm:px-2 sm:py-3 sm:text-sm">
                            {bp.runs_scored}
                          </TableCell>
                          <TableCell className="tabular px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                            {bp.balls_faced}
                          </TableCell>
                          <TableCell className="tabular px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                            {bp.fours}
                          </TableCell>
                          <TableCell className="tabular px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                            {bp.sixes}
                          </TableCell>
                          <TableCell className="tabular px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                            {strikeRate(bp.runs_scored, bp.balls_faced)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Extras */}
            <Card>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Extras</span>
                  <div className="flex items-center gap-4">
                    <span className="tabular font-semibold">
                      {innings.extras_total || 0}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      (wd {innings.extras_wides || 0}, nb{" "}
                      {innings.extras_no_balls || 0}, b{" "}
                      {innings.extras_byes || 0}, lb{" "}
                      {innings.extras_leg_byes || 0})
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bowling Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bowling</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-auto min-w-[110px] px-2 py-2 text-xs sm:w-[200px] sm:px-4 sm:py-3 sm:text-sm">
                        Bowler
                      </TableHead>
                      <TableHead className="px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                        O
                      </TableHead>
                      <TableHead className="px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                        M
                      </TableHead>
                      <TableHead className="px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                        R
                      </TableHead>
                      <TableHead className="px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                        W
                      </TableHead>
                      <TableHead className="px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                        Econ
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(innings.bowling_performances || [])
                      .sort((a, b) => b.wickets_taken - a.wickets_taken)
                      .map((bp) => (
                        <TableRow key={bp.id}>
                          <TableCell className="px-2 py-2 text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                            {bp.user?.full_name}
                          </TableCell>
                          <TableCell className="tabular px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                            {oversFromBalls(bp.balls_bowled ?? 0)}
                          </TableCell>
                          <TableCell className="tabular px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                            {bp.maidens}
                          </TableCell>
                          <TableCell className="tabular px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                            {bp.runs_conceded}
                          </TableCell>
                          <TableCell className="tabular px-1.5 py-2 text-center text-xs font-semibold sm:px-2 sm:py-3 sm:text-sm">
                            {bp.wickets_taken}
                          </TableCell>
                          <TableCell className="tabular px-1.5 py-2 text-center text-xs sm:px-2 sm:py-3 sm:text-sm">
                            {economyRate(bp.runs_conceded, bp.balls_bowled)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Fall of Wickets */}
            {innings.fall_of_wickets && innings.fall_of_wickets.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Fall of wickets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {innings.fall_of_wickets
                      .sort((a, b) => a.wicket_number - b.wicket_number)
                      .map((fow) => (
                        <Badge
                          key={fow.id}
                          variant="outline"
                          className="px-3 py-1 text-sm"
                        >
                          {fow.runs_at_fall}/{fow.wicket_number} (
                          {fow.batsman?.full_name},{" "}
                          {formatDecimalOvers(fow.overs_at_fall)} ov)
                        </Badge>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
