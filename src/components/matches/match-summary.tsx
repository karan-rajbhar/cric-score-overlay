"use client";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Trophy, Target, Clock, TrendingUp } from "lucide-react";
import type { Innings, Match } from "~/lib/match-types";
import {
  formatDecimalOvers,
  inningsBalls,
  runRate,
  ballsRemaining,
  requiredRunRate,
} from "~/lib/cricket";

interface MatchSummaryProps {
  match: Match;
}

export function MatchSummary({ match }: MatchSummaryProps) {
  const getInningsForTeam = (teamId: string) => {
    return match.innings?.find((i) => i.team_id === teamId) || null;
  };

  const team1Innings = getInningsForTeam(match.team1_id);
  const team2Innings = getInningsForTeam(match.team2_id);

  // Identify chasing innings (innings with target_runs, or second innings)
  const secondInnings = match.innings?.find((i) => i.innings_number === 2);
  const chasingInnings =
    match.innings?.find((i) => i.target_runs != null) ?? secondInnings;
  const isChasing =
    match.status === "live" && chasingInnings?.target_runs != null;

  const chasingTeam = chasingInnings
    ? chasingInnings.team_id === match.team1_id
      ? match.team1
      : match.team2
    : null;

  const runsNeeded =
    chasingInnings?.target_runs != null
      ? Math.max(0, chasingInnings.target_runs - chasingInnings.total_runs)
      : 0;

  const chasingBallsBowled = chasingInnings ? inningsBalls(chasingInnings) : 0;
  const chasingBallsRem = ballsRemaining(
    match.overs_per_innings,
    chasingBallsBowled,
  );
  const rrr = requiredRunRate(runsNeeded, chasingBallsRem);
  const chasingCrr = runRate(chasingInnings?.total_runs, chasingBallsBowled);

  const team1Balls = inningsBalls(team1Innings);
  const team1RunRate = runRate(team1Innings?.total_runs, team1Balls);

  const team2Balls = inningsBalls(team2Innings);
  const team2RunRate = runRate(team2Innings?.total_runs, team2Balls);

  const getTopScorer = (innings: Innings | null) => {
    if (!innings?.batting_performances?.length) return null;
    return innings.batting_performances.reduce(
      (best, current) =>
        current.runs_scored > (best?.runs_scored || 0) ? current : best,
      innings.batting_performances[0],
    );
  };

  return (
    <div className="space-y-6">
      {/* Result Banner */}
      {match.status === "completed" && match.result_description && (
        <Card className="border-cricket-primary/30 bg-gradient-to-r from-cricket-primary/20 to-cricket-secondary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-3">
              <Trophy className="h-6 w-6 text-cricket-primary" />
              <p className="text-lg font-semibold text-foreground">
                {match.result_description}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Match Info */}
      {isChasing && chasingTeam && chasingInnings && (
        <Card className="border-red-500/30 bg-gradient-to-r from-red-500/20 to-orange-500/20">
          <CardContent className="py-4">
            <div className="flex flex-col items-center justify-center gap-1.5 text-center">
              <div className="flex items-center justify-center gap-2">
                <Target className="h-6 w-6 shrink-0 text-red-500" />
                <p className="text-lg font-semibold">
                  {chasingTeam.name} needs{" "}
                  <span className="font-bold text-red-500">{runsNeeded}</span>{" "}
                  runs from{" "}
                  <span className="font-bold text-red-500">
                    {chasingBallsRem}
                  </span>{" "}
                  balls
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
                <span>
                  Required RR:{" "}
                  <strong className="text-foreground">{rrr}</strong>
                </span>
                <span>•</span>
                <span>
                  Current RR:{" "}
                  <strong className="text-foreground">{chasingCrr}</strong>
                </span>
                {chasingInnings.target_runs && (
                  <>
                    <span>•</span>
                    <span>
                      Target:{" "}
                      <strong className="text-foreground">
                        {chasingInnings.target_runs}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Team 1 Summary */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{match.team1.name}</CardTitle>
              {match.winning_team_id === match.team1_id && (
                <Badge className="bg-cricket-primary/10 text-cricket-primary">
                  Winner
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-3xl font-bold">
              {team1Innings ? (
                <>
                  {team1Innings.total_runs}/{team1Innings.total_wickets}
                  <span className="ml-2 text-lg text-muted-foreground">
                    ({formatDecimalOvers(team1Innings.total_overs)} ov)
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Yet to bat</span>
              )}
            </div>

            {team1Innings && (
              <div className="space-y-2 text-sm">
                {getTopScorer(team1Innings) && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Top Scorer</span>
                    <span className="font-medium">
                      {getTopScorer(team1Innings)?.user?.full_name} -{" "}
                      {getTopScorer(team1Innings)?.runs_scored}
                      {!getTopScorer(team1Innings)?.is_out && "*"}(
                      {getTopScorer(team1Innings)?.balls_faced})
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Run Rate</span>
                  <span className="font-medium">{team1RunRate}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team 2 Summary */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{match.team2.name}</CardTitle>
              {match.winning_team_id === match.team2_id && (
                <Badge className="bg-cricket-primary/10 text-cricket-primary">
                  Winner
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-3xl font-bold">
              {team2Innings ? (
                <>
                  {team2Innings.total_runs}/{team2Innings.total_wickets}
                  <span className="ml-2 text-lg text-muted-foreground">
                    ({formatDecimalOvers(team2Innings.total_overs)} ov)
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Yet to bat</span>
              )}
            </div>

            {team2Innings && (
              <div className="space-y-2 text-sm">
                {getTopScorer(team2Innings) && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Top Scorer</span>
                    <span className="font-medium">
                      {getTopScorer(team2Innings)?.user?.full_name} -{" "}
                      {getTopScorer(team2Innings)?.runs_scored}
                      {!getTopScorer(team2Innings)?.is_out && "*"}(
                      {getTopScorer(team2Innings)?.balls_faced})
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Run Rate</span>
                  <span className="font-medium">{team2RunRate}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Best Performers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Best performers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Batting */}
            <div>
              <h4 className="mb-3 text-xs font-semibold text-muted-foreground">
                Top batters
              </h4>
              <div className="space-y-2">
                {match.innings?.flatMap((inn) =>
                  (inn.batting_performances || [])
                    .filter((bp) => bp.runs_scored > 0)
                    .sort((a, b) => b.runs_scored - a.runs_scored)
                    .slice(0, 3)
                    .map((bp) => (
                      <div
                        key={bp.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{bp.user?.full_name}</span>
                        <span className="tabular font-medium">
                          {bp.runs_scored}
                          {!bp.is_out && "*"} ({bp.balls_faced})
                        </span>
                      </div>
                    )),
                )}
              </div>
            </div>

            {/* Bowling */}
            <div>
              <h4 className="mb-3 text-xs font-semibold text-muted-foreground">
                Top bowlers
              </h4>
              <div className="space-y-2">
                {match.innings?.flatMap((inn) =>
                  (inn.bowling_performances || [])
                    .filter((bp) => bp.wickets_taken > 0)
                    .sort((a, b) => b.wickets_taken - a.wickets_taken)
                    .slice(0, 3)
                    .map((bp) => (
                      <div
                        key={bp.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{bp.user?.full_name}</span>
                        <span className="tabular font-medium">
                          {bp.wickets_taken}/{bp.runs_conceded} (
                          {formatDecimalOvers(bp.overs_bowled)} ov)
                        </span>
                      </div>
                    )),
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Match Timeline/Key Moments - Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Key Moments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <p>
              Key moments and highlights will appear here during live matches
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
