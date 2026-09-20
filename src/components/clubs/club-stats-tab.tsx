"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Flame,
  Target,
  Trophy,
  Activity,
} from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";

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
}

export function ClubStatsTab({
  clubName,
  milestones,
  battingLeaders,
  bowlingLeaders,
}: ClubStatsTabProps) {
  const hasData =
    milestones.totalMatches > 0 ||
    battingLeaders.length > 0 ||
    bowlingLeaders.length > 0;

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
          Club Statistics & Records
        </h2>
        <p className="text-xs text-muted-foreground">
          Aggregated performances, milestones, and leaderboards across matches
          hosted by {clubName}.
        </p>
      </div>

      {/* Key Milestones Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Matches Played</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums">
              {milestones.totalMatches}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {milestones.completedMatches} completed
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Runs Scored</span>
              <Flame className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums">
              {milestones.totalRuns}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Across all club fixtures
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Wickets Taken</span>
              <Target className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums">
              {milestones.totalWickets}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Dismissals recorded
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Highest Total</span>
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums">
              {milestones.highestTeamScore
                ? `${milestones.highestTeamScore.runs}/${milestones.highestTeamScore.wickets}`
                : "—"}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {milestones.highestTeamScore?.teamName ?? "No completed innings"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Batters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Flame className="h-4 w-4 text-amber-500" />
                Leading Run Scorers
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                Top Batters
              </Badge>
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
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted font-bold text-[10px] text-muted-foreground">
                        {idx + 1}
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-bold text-xs">
                        {(b.name ?? "P")[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {b.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {b.inningsCount} inn • HS: {b.highestScore} • SR:{" "}
                          {b.strikeRate}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-sm tabular-nums text-foreground">
                        {b.runs}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
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
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Target className="h-4 w-4 text-emerald-500" />
                Leading Wicket Takers
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                Top Bowlers
              </Badge>
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
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted font-bold text-[10px] text-muted-foreground">
                        {idx + 1}
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-bold text-xs">
                        {(bw.name ?? "B")[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {bw.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {bw.overs} ov • Econ: {bw.economy}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-sm tabular-nums text-foreground">
                        {bw.wickets} <span className="text-xs font-normal">wkts</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
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
    </div>
  );
}
