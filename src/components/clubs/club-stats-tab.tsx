"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Initials } from "~/components/ui/initials";
import { StatTile } from "~/components/ui/stat-tile";
import { Activity } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { LeaderboardView } from "~/components/leaderboard/leaderboard-view";
import { LeaderboardData } from "~/lib/leaderboard";

export interface ClubBatterLeader {
  userId: string;
  name: string;
  avatar?: string | null;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  inningsCount: number;
  highestScore: number;
  strikeRate: string;
}

export interface ClubBowlerLeader {
  userId: string;
  name: string;
  avatar?: string | null;
  wickets: number;
  overs: string;
  runs: number;
  economy: string;
}

export interface ClubMilestones {
  totalMatches: number;
  completedMatches: number;
  totalRuns: number;
  totalWickets: number;
  highestTeamScore?: {
    runs: number;
    wickets: number;
    overs: number;
    teamName?: string;
  } | null;
}

interface ClubStatsTabProps {
  clubName: string;
  milestones: ClubMilestones;
  battingLeaders: ClubBatterLeader[];
  bowlingLeaders: ClubBowlerLeader[];
  leaderboardData?: LeaderboardData | null;
}

export function ClubStatsTab({
  clubName,
  milestones,
  battingLeaders,
  bowlingLeaders,
  leaderboardData,
}: ClubStatsTabProps) {
  const hasData =
    milestones.totalMatches > 0 ||
    battingLeaders.length > 0 ||
    bowlingLeaders.length > 0 ||
    (leaderboardData &&
      (leaderboardData.batting.length > 0 ||
        leaderboardData.bowling.length > 0 ||
        leaderboardData.fielding.length > 0));

  if (!hasData) {
    return (
      <EmptyState
        icon={Activity}
        title="No Club Statistics Recorded"
        description={`Play matches under ${clubName} to accumulate run tallies, wicket leaderboards, and historical milestones.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold sm:text-lg">
          Club statistics & records
        </h2>
        <p className="text-xs text-muted-foreground">
          Aggregated performances, milestones, and leaderboards across matches
          hosted by {clubName}.
        </p>
      </div>

      {/* Key Milestones Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Matches played"
          value={milestones.totalMatches}
          hint={`${milestones.completedMatches} completed`}
        />
        <StatTile
          label="Runs scored"
          value={milestones.totalRuns}
          hint="Across all club fixtures"
        />
        <StatTile
          label="Wickets taken"
          value={milestones.totalWickets}
          hint="Dismissals recorded"
        />
        <StatTile
          label="Highest total"
          value={
            milestones.highestTeamScore
              ? `${milestones.highestTeamScore.runs}/${milestones.highestTeamScore.wickets}`
              : "—"
          }
          hint={milestones.highestTeamScore?.teamName ?? "No completed innings"}
        />
      </div>

      {/* Leaderboards */}
      {leaderboardData ? (
        <LeaderboardView
          title="Club Player Leaderboards"
          subtitle={`All-time batting, bowling, fielding, and MVP statistics for ${clubName}`}
          data={leaderboardData}
          showHighlights={true}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Top Batters */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Leading run scorers
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {battingLeaders.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No batting scorecards available yet.
                </div>
              ) : (
                <div className="divide-y divide-border text-xs">
                  {battingLeaders.slice(0, 5).map((b, idx) => (
                    <div
                      key={b.userId}
                      className="flex items-center justify-between p-3.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted font-bold text-2xs text-muted-foreground">
                          {idx + 1}
                        </span>
                        <Initials name={b.name} fallback="P" className="h-8 w-8" />
                        <div>
                          <div className="font-semibold text-foreground">
                            {b.name}
                          </div>
                          <div className="text-2xs text-muted-foreground">
                            {b.inningsCount} inn • HS: {b.highestScore} • SR:{" "}
                            {b.strikeRate}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-sm tabular-nums text-foreground">
                          {b.runs}
                        </div>
                        <div className="text-2xs text-muted-foreground">
                          {b.fours} 4s, {b.sixes} 6s
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Bowlers */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Leading wicket takers
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {bowlingLeaders.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No bowling scorecards available yet.
                </div>
              ) : (
                <div className="divide-y divide-border text-xs">
                  {bowlingLeaders.slice(0, 5).map((bw, idx) => (
                    <div
                      key={bw.userId}
                      className="flex items-center justify-between p-3.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted font-bold text-2xs text-muted-foreground">
                          {idx + 1}
                        </span>
                        <Initials name={bw.name} fallback="B" className="h-8 w-8" />
                        <div>
                          <div className="font-semibold text-foreground">
                            {bw.name}
                          </div>
                          <div className="text-2xs text-muted-foreground">
                            {bw.overs} ov • Econ: {bw.economy}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-sm tabular-nums text-foreground">
                          {bw.wickets}{" "}
                          <span className="text-xs font-normal">wkts</span>
                        </div>
                        <div className="text-2xs text-muted-foreground">
                          {bw.runs} runs conceded
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
