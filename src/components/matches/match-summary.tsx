"use client";

import { useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Trophy,
  Target,
  Clock,
  TrendingUp,
  Coins,
  Flame,
  Zap,
  Flag,
  Award,
} from "lucide-react";
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

  const keyMoments = useMemo(() => {
    const moments: Array<{
      id: string;
      badge: string;
      title: string;
      description?: string;
      icon: React.ReactNode;
    }> = [];

    // 1. Toss
    if (match.toss_winner_team_id) {
      const tossWinner =
        match.toss_winner_team_id === match.team1_id
          ? match.team1
          : match.toss_winner_team_id === match.team2_id
            ? match.team2
            : null;
      if (tossWinner) {
        moments.push({
          id: "toss",
          badge: "Toss",
          title: `${tossWinner.name} won the toss and elected to ${match.toss_decision ?? "bat"} first`,
          icon: <Coins className="h-4 w-4 text-amber-500" />,
        });
      }
    }

    // 2. Innings milestones and wickets
    match.innings?.forEach((inn) => {
      const innTeam =
        inn.team_id === match.team1_id ? match.team1 : match.team2;

      // Batting Milestones (50+)
      inn.batting_performances?.forEach((bp) => {
        if (bp.runs_scored >= 50) {
          moments.push({
            id: `milestone-${bp.id}`,
            badge: bp.runs_scored >= 100 ? "Century" : "Fifty",
            title: `${bp.user?.full_name ?? "Batter"} scored ${bp.runs_scored}${!bp.is_out ? "*" : ""} (${bp.balls_faced}b)`,
            description: `${bp.fours} fours, ${bp.sixes} sixes for ${innTeam.name}`,
            icon: <Flame className="h-4 w-4 text-orange-500" />,
          });
        }
      });

      // Bowling Feats (3+ wickets)
      inn.bowling_performances?.forEach((bp) => {
        if (bp.wickets_taken >= 3) {
          moments.push({
            id: `bowl-${bp.id}`,
            badge: `${bp.wickets_taken} Wickets`,
            title: `${bp.user?.full_name ?? "Bowler"} took ${bp.wickets_taken}/${bp.runs_conceded}`,
            description: `in ${formatDecimalOvers(bp.overs_bowled)} overs`,
            icon: <Target className="h-4 w-4 text-emerald-500" />,
          });
        }
      });

      // Fall of Wickets
      inn.fall_of_wickets?.forEach((fow) => {
        const batterName = fow.batsman?.full_name ?? "Batter";
        const bowlerName = fow.bowler?.full_name
          ? ` b ${fow.bowler.full_name}`
          : "";
        moments.push({
          id: `fow-${fow.id}`,
          badge: `Over ${formatDecimalOvers(fow.overs_at_fall)}`,
          title: `Wicket ${fow.wicket_number}: ${batterName}${bowlerName} (${fow.runs_at_fall}/${fow.wicket_number})`,
          description: fow.dismissal_type
            ? `Dismissal: ${fow.dismissal_type}`
            : undefined,
          icon: <Zap className="h-4 w-4 text-red-500" />,
        });
      });

      // Innings Conclusion
      if (inn.is_completed) {
        moments.push({
          id: `inn-end-${inn.id}`,
          badge: `Innings ${inn.innings_number}`,
          title: `${innTeam.name} finished at ${inn.total_runs}/${inn.total_wickets} (${formatDecimalOvers(inn.total_overs)} ov)`,
          icon: <Flag className="h-4 w-4 text-blue-500" />,
        });
      }
    });

    // 3. Match Completion & POTM
    if (match.status === "completed" && match.result_description) {
      moments.push({
        id: "result",
        badge: "Result",
        title: match.result_description,
        icon: <Trophy className="h-4 w-4 text-amber-500" />,
      });
    }

    if (match.player_of_the_match?.full_name) {
      moments.push({
        id: "potm",
        badge: "POTM",
        title: `Player of the Match: ${match.player_of_the_match.full_name}`,
        icon: <Award className="h-4 w-4 text-amber-500" />,
      });
    }

    return moments;
  }, [match]);

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

      {/* Match Timeline / Key Moments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Key Moments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {keyMoments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Clock className="mx-auto mb-2 h-8 w-8 opacity-40" />
              <p className="font-medium text-foreground">
                No key moments recorded yet
              </p>
              <p className="mt-1 text-xs">
                Toss, milestones, wickets, and match turning points will appear
                here during live scoring.
              </p>
            </div>
          ) : (
            <div className="relative space-y-3 pl-2 sm:pl-4">
              <div className="absolute bottom-3 left-[17px] top-3 w-0.5 bg-border/60 sm:left-[25px]" />
              {keyMoments.map((m) => (
                <div
                  key={m.id}
                  className="group relative flex items-start gap-3 sm:gap-4"
                >
                  <div className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-sm sm:h-8 sm:w-8">
                    {m.icon}
                  </div>
                  <div className="flex-1 rounded-xl border border-border/60 bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider"
                      >
                        {m.badge}
                      </Badge>
                      <h4 className="text-sm font-semibold text-foreground">
                        {m.title}
                      </h4>
                    </div>
                    {m.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
