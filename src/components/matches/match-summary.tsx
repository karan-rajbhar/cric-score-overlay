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
  XCircle,
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
            icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
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
            icon: <Target className="h-4 w-4 text-muted-foreground" />,
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
          icon: <XCircle className="h-4 w-4 text-red-600 dark:text-red-500" />,
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
        <Card className="overflow-hidden border-border bg-card shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-3 text-center">
              <Trophy className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-balance text-base sm:text-lg font-semibold text-foreground">
                {match.result_description}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Match Info / Chase Equation */}
      {isChasing && chasingTeam && chasingInnings && (
        <Card className="overflow-hidden border-border bg-card shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                <Badge
                  variant="outline"
                  className="px-2.5 py-0.5 text-xs font-medium"
                >
                  Chase
                </Badge>
                {chasingInnings.target_runs && (
                  <span className="text-xs text-muted-foreground">
                    Target:{" "}
                    <strong className="text-foreground tabular-nums font-score text-sm">
                      {chasingInnings.target_runs}
                    </strong>
                  </span>
                )}
              </div>

              <div className="text-center sm:text-left">
                <p className="text-lg sm:text-xl font-semibold text-foreground">
                  {chasingTeam.name} needs{" "}
                  <span className="font-score text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
                    {runsNeeded}
                  </span>{" "}
                  runs from{" "}
                  <span className="font-score text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
                    {chasingBallsRem}
                  </span>{" "}
                  balls
                </p>
              </div>

              {/* Chase progress needle bar */}
              {chasingInnings.target_runs && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium text-muted-foreground">
                    <span>
                      <strong className="font-semibold text-foreground tabular-nums">
                        {chasingInnings.total_runs}
                      </strong>{" "}
                      runs scored
                    </span>
                    <span className="tabular-nums">
                      {Math.min(
                        100,
                        Math.round(
                          (chasingInnings.total_runs /
                            chasingInnings.target_runs) *
                            100,
                        ),
                      )}
                      % of target
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            (chasingInnings.total_runs /
                              chasingInnings.target_runs) *
                              100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-1 text-xs font-medium text-muted-foreground sm:justify-start">
                <span>
                  Required RR:{" "}
                  <strong className="text-foreground tabular-nums">{rrr}</strong>
                </span>
                <span>•</span>
                <span>
                  Current RR:{" "}
                  <strong className="text-foreground tabular-nums">
                    {chasingCrr}
                  </strong>
                </span>
                {chasingInnings.target_runs && (
                  <>
                    <span>•</span>
                    <span>
                      Target:{" "}
                      <strong className="text-foreground tabular-nums">
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

      {/* Key Stats Grid - Team Innings Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Team 1 Summary */}
        <Card className="overflow-hidden border-border bg-card">
          <div
            className={`h-1 w-full ${
              match.winning_team_id === match.team1_id
                ? "bg-amber-500"
                : "bg-primary/40"
            }`}
          />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-foreground">
                  {match.team1.short_name?.slice(0, 3) ||
                    match.team1.name.slice(0, 3)}
                </div>
                <CardTitle className="text-base sm:text-lg">
                  {match.team1.name}
                </CardTitle>
              </div>
              {match.winning_team_id === match.team1_id && (
                <Badge className="border border-amber-500/30 bg-amber-500/15 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Winner
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              {team1Innings ? (
                <div className="flex items-baseline gap-2">
                  <span className="font-score text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-foreground">
                    {team1Innings.total_runs}/{team1Innings.total_wickets}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground tabular-nums">
                    ({formatDecimalOvers(team1Innings.total_overs)} ov)
                  </span>
                </div>
              ) : (
                <span className="inline-block rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  Yet to bat
                </span>
              )}
            </div>

            {team1Innings && (
              <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                {getTopScorer(team1Innings) && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Top Scorer
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {getTopScorer(team1Innings)?.user?.full_name} -{" "}
                      <strong className="font-semibold">
                        {getTopScorer(team1Innings)?.runs_scored}
                      </strong>
                      {!getTopScorer(team1Innings)?.is_out && "*"}(
                      {getTopScorer(team1Innings)?.balls_faced})
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border/40 pt-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Run Rate
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {team1RunRate}
                  </span>
                </div>
                {team1Innings.batting_performances &&
                  team1Innings.batting_performances.length > 0 && (
                    <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                      <span className="font-medium text-muted-foreground">
                        Boundaries
                      </span>
                      <span className="tabular-nums font-medium text-muted-foreground">
                        <strong className="text-foreground">
                          {team1Innings.batting_performances.reduce(
                            (acc, bp) => acc + (bp.fours || 0),
                            0,
                          )}
                        </strong>{" "}
                        fours,{" "}
                        <strong className="text-foreground">
                          {team1Innings.batting_performances.reduce(
                            (acc, bp) => acc + (bp.sixes || 0),
                            0,
                          )}
                        </strong>{" "}
                        sixes
                      </span>
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team 2 Summary */}
        <Card className="overflow-hidden border-border bg-card">
          <div
            className={`h-1 w-full ${
              match.winning_team_id === match.team2_id
                ? "bg-amber-500"
                : "bg-sky-500/40"
            }`}
          />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-foreground">
                  {match.team2.short_name?.slice(0, 3) ||
                    match.team2.name.slice(0, 3)}
                </div>
                <CardTitle className="text-base sm:text-lg">
                  {match.team2.name}
                </CardTitle>
              </div>
              {match.winning_team_id === match.team2_id && (
                <Badge className="border border-amber-500/30 bg-amber-500/15 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Winner
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              {team2Innings ? (
                <div className="flex items-baseline gap-2">
                  <span className="font-score text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-foreground">
                    {team2Innings.total_runs}/{team2Innings.total_wickets}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground tabular-nums">
                    ({formatDecimalOvers(team2Innings.total_overs)} ov)
                  </span>
                </div>
              ) : (
                <span className="inline-block rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  Yet to bat
                </span>
              )}
            </div>

            {team2Innings && (
              <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                {getTopScorer(team2Innings) && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Top Scorer
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {getTopScorer(team2Innings)?.user?.full_name} -{" "}
                      <strong className="font-semibold">
                        {getTopScorer(team2Innings)?.runs_scored}
                      </strong>
                      {!getTopScorer(team2Innings)?.is_out && "*"}(
                      {getTopScorer(team2Innings)?.balls_faced})
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border/40 pt-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Run Rate
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {team2RunRate}
                  </span>
                </div>
                {team2Innings.batting_performances &&
                  team2Innings.batting_performances.length > 0 && (
                    <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                      <span className="font-medium text-muted-foreground">
                        Boundaries
                      </span>
                      <span className="tabular-nums font-medium text-muted-foreground">
                        <strong className="text-foreground">
                          {team2Innings.batting_performances.reduce(
                            (acc, bp) => acc + (bp.fours || 0),
                            0,
                          )}
                        </strong>{" "}
                        fours,{" "}
                        <strong className="text-foreground">
                          {team2Innings.batting_performances.reduce(
                            (acc, bp) => acc + (bp.sixes || 0),
                            0,
                          )}
                        </strong>{" "}
                        sixes
                      </span>
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Best Performers Duel */}
      <Card className="border-border">
        <CardHeader className="border-b border-border/50 pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Best performers
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Batting */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">
                  Top batters
                </h4>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Runs (Balls)
                </span>
              </div>
              <div className="space-y-2">
                {match.innings?.flatMap((inn) =>
                  (inn.batting_performances || [])
                    .filter((bp) => bp.runs_scored > 0)
                    .sort((a, b) => b.runs_scored - a.runs_scored)
                    .slice(0, 3)
                    .map((bp, idx) => (
                      <div
                        key={bp.id}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                            {idx + 1}
                          </span>
                          <span className="truncate font-medium text-foreground">
                            {bp.user?.full_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(bp.fours > 0 || bp.sixes > 0) && (
                            <span className="hidden sm:inline-block text-[11px] text-muted-foreground tabular-nums">
                              {bp.fours}×4 {bp.sixes}×6
                            </span>
                          )}
                          <span className="tabular-nums font-semibold font-score text-base text-foreground">
                            {bp.runs_scored}
                            {!bp.is_out && "*"}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            ({bp.balls_faced})
                          </span>
                        </div>
                      </div>
                    )),
                )}
                {(!match.innings ||
                  match.innings.flatMap((inn) => inn.batting_performances || [])
                    .length === 0) && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No batting data available yet
                  </p>
                )}
              </div>
            </div>

            {/* Bowling */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">
                  Top bowlers
                </h4>
                <span className="text-[11px] font-medium text-muted-foreground">
                  W/R (Overs)
                </span>
              </div>
              <div className="space-y-2">
                {match.innings?.flatMap((inn) =>
                  (inn.bowling_performances || [])
                    .filter((bp) => bp.wickets_taken > 0)
                    .sort((a, b) => b.wickets_taken - a.wickets_taken)
                    .slice(0, 3)
                    .map((bp, idx) => (
                      <div
                        key={bp.id}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                            {idx + 1}
                          </span>
                          <span className="truncate font-medium text-foreground">
                            {bp.user?.full_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="tabular-nums font-semibold font-score text-base text-emerald-500">
                            {bp.wickets_taken}/{bp.runs_conceded}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            ({formatDecimalOvers(bp.overs_bowled)} ov)
                          </span>
                        </div>
                      </div>
                    )),
                )}
                {(!match.innings ||
                  match.innings.flatMap((inn) => inn.bowling_performances || [])
                    .length === 0) && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No bowling figures available yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Match Timeline / Key Moments */}
      <Card className="border-border">
        <CardHeader className="border-b border-border/50 pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Key Moments
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
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
                        className="px-1.5 py-0 text-[10px] font-medium"
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
