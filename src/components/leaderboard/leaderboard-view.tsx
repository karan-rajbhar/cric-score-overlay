"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Flame,
  Target,
  Award,
  Crown,
  Shield,
  Search,
  Zap,
  Activity,
  Sparkles,
} from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import {
  LeaderboardData,
  BattingSortOption,
  BowlingSortOption,
  FieldingSortOption,
  MvpSortOption,
  sortBattingEntries,
  sortBowlingEntries,
  sortFieldingEntries,
  sortMvpEntries,
} from "~/lib/leaderboard";

interface LeaderboardViewProps {
  title?: string;
  subtitle?: string;
  data: LeaderboardData;
  showHighlights?: boolean;
}

export function LeaderboardView({
  title = "Statistics & Leaderboards",
  subtitle = "Comprehensive performance records, milestones, and MVP rankings across all fixtures.",
  data,
  showHighlights = true,
}: LeaderboardViewProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "batting" | "bowling" | "fielding" | "mvp"
  >("overview");
  const [searchQuery, setSearchQuery] = useState("");

  // Sort States
  const [battingSort, setBattingSort] = useState<BattingSortOption>("runs");
  const [bowlingSort, setBowlingSort] = useState<BowlingSortOption>("wickets");
  const [fieldingSort, setFieldingSort] =
    useState<FieldingSortOption>("totalDismissals");
  const [mvpSort, setMvpSort] = useState<MvpSortOption>("totalPoints");

  const hasAnyData =
    data.batting.length > 0 ||
    data.bowling.length > 0 ||
    data.fielding.length > 0 ||
    data.mvp.length > 0;

  // Filtered & Sorted Lists
  const filteredBatting = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = query
      ? data.batting.filter((b) => b.name.toLowerCase().includes(query))
      : data.batting;
    return sortBattingEntries(list, battingSort);
  }, [data.batting, searchQuery, battingSort]);

  const filteredBowling = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = query
      ? data.bowling.filter((b) => b.name.toLowerCase().includes(query))
      : data.bowling;
    return sortBowlingEntries(list, bowlingSort);
  }, [data.bowling, searchQuery, bowlingSort]);

  const filteredFielding = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = query
      ? data.fielding.filter((f) => f.name.toLowerCase().includes(query))
      : data.fielding;
    return sortFieldingEntries(list, fieldingSort);
  }, [data.fielding, searchQuery, fieldingSort]);

  const filteredMvp = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = query
      ? data.mvp.filter((m) => m.name.toLowerCase().includes(query))
      : data.mvp;
    return sortMvpEntries(list, mvpSort);
  }, [data.mvp, searchQuery, mvpSort]);

  if (!hasAnyData) {
    return (
      <EmptyState
        icon={Activity}
        title="No Leaderboard Statistics Available"
        description="Detailed leaderboards for batting, bowling, fielding, and MVP will automatically appear as match scorecards are recorded."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Title and Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl text-balance">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search player name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs"
          />
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <div
            role="tablist"
            className="inline-flex h-9 w-full justify-start rounded-lg bg-muted/80 p-1 sm:w-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === "overview"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "batting"}
              onClick={() => setActiveTab("batting")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === "batting"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              Batting
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {data.batting.length}
              </Badge>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "bowling"}
              onClick={() => setActiveTab("bowling")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === "bowling"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Target className="h-3.5 w-3.5 text-purple-500" />
              Bowling
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {data.bowling.length}
              </Badge>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "fielding"}
              onClick={() => setActiveTab("fielding")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === "fielding"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield className="h-3.5 w-3.5 text-cyan-500" />
              Fielding
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {data.fielding.length}
              </Badge>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "mvp"}
              onClick={() => setActiveTab("mvp")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === "mvp"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Crown className="h-3.5 w-3.5 text-emerald-500" />
              MVP
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {data.mvp.length}
              </Badge>
            </button>
          </div>
        </div>

        {/* 1. OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Highlight Cards Grid */}
            {showHighlights && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* Orange Cap */}
                <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className="gap-1 bg-amber-500 text-black hover:bg-amber-400">
                        <Flame className="h-3 w-3 fill-current" />
                        Orange Cap
                      </Badge>
                      <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        Most Runs
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    {data.highlights.orangeCap ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-bold text-foreground">
                            {data.highlights.orangeCap.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {data.highlights.orangeCap.innings} inn • Avg:{" "}
                            {data.highlights.orangeCap.averageDisplay} • SR:{" "}
                            {data.highlights.orangeCap.strikeRateDisplay}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black tabular-nums text-amber-500">
                            {data.highlights.orangeCap.runs}
                          </div>
                          <div className="text-[10px] text-muted-foreground">runs</div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-xs text-muted-foreground">
                        No batting records yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Purple Cap */}
                <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-card to-card">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className="gap-1 bg-purple-600 text-white hover:bg-purple-500">
                        <Award className="h-3 w-3 fill-current" />
                        Purple Cap
                      </Badge>
                      <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400">
                        Most Wickets
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    {data.highlights.purpleCap ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-bold text-foreground">
                            {data.highlights.purpleCap.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {data.highlights.purpleCap.overs} ov • Econ:{" "}
                            {data.highlights.purpleCap.economyDisplay} • BBI:{" "}
                            {data.highlights.purpleCap.bestBowling.display}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black tabular-nums text-purple-400">
                            {data.highlights.purpleCap.wickets}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            wickets
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-xs text-muted-foreground">
                        No bowling records yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Tournament MVP Leader */}
                <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card sm:col-span-2 lg:col-span-1">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-500">
                        <Crown className="h-3 w-3 fill-current" />
                        MVP Leader
                      </Badge>
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        Top Impact Player
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    {data.highlights.mvpLeader ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-bold text-foreground">
                            {data.highlights.mvpLeader.name}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {data.highlights.mvpLeader.summary}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black tabular-nums text-emerald-500">
                            {data.highlights.mvpLeader.totalPoints}
                          </div>
                          <div className="text-[10px] text-muted-foreground">pts</div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-xs text-muted-foreground">
                        No impact records yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Most Sixes */}
                <Card className="border-border/80 bg-card/60">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Maximum Sixes
                      </span>
                      <Zap className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <div className="truncate font-bold text-foreground">
                        {data.highlights.mostSixes?.name ?? "—"}
                      </div>
                      <div className="text-xl font-black tabular-nums text-blue-500">
                        {data.highlights.mostSixes?.sixes ?? 0}
                      </div>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {data.highlights.mostSixes
                        ? `${data.highlights.mostSixes.fours} fours • SR ${data.highlights.mostSixes.strikeRateDisplay}`
                        : "No sixes hit"}
                    </div>
                  </CardContent>
                </Card>

                {/* Best Bowling in an Innings */}
                <Card className="border-border/80 bg-card/60">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Best Bowling (BBI)
                      </span>
                      <Target className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <div className="truncate font-bold text-foreground">
                        {data.highlights.bestBowling?.name ?? "—"}
                      </div>
                      <div className="text-xl font-black tabular-nums text-indigo-500">
                        {data.highlights.bestBowling?.bestBowling.display ?? "—"}
                      </div>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {data.highlights.bestBowling
                        ? `${data.highlights.bestBowling.wickets} total wkts • Econ ${data.highlights.bestBowling.economyDisplay}`
                        : "No bowling figures recorded"}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Fielder */}
                <Card className="border-border/80 bg-card/60">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Top Fielder
                      </span>
                      <Shield className="h-4 w-4 text-cyan-500" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <div className="truncate font-bold text-foreground">
                        {data.highlights.topFielder?.name ?? "—"}
                      </div>
                      <div className="text-xl font-black tabular-nums text-cyan-500">
                        {data.highlights.topFielder?.totalDismissals ?? 0}
                      </div>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {data.highlights.topFielder
                        ? `${data.highlights.topFielder.catches} catches • ${data.highlights.topFielder.stumpings} st • ${data.highlights.topFielder.runOuts} ro`
                        : "No dismissals recorded"}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Quick Previews: Top Batters & Top Bowlers */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Top 5 Batters */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold">
                    <Flame className="h-4 w-4 text-amber-500" />
                    Leading Run Scorers
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("batting")}
                    className="h-7 text-xs font-medium"
                  >
                    View all ({data.batting.length})
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {data.batting.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No batting data available yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border text-xs">
                      {data.batting.slice(0, 5).map((b, idx) => (
                        <div
                          key={b.userId}
                          className="flex items-center justify-between p-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted font-bold text-[10px] text-muted-foreground">
                              {idx + 1}
                            </span>
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                              {(b.name ?? "P")[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">
                                {b.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {b.innings} inn • HS: {b.highestScoreDisplay} • SR:{" "}
                                {b.strikeRateDisplay}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold tabular-nums text-foreground">
                              {b.runs}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {b.fours}×4, {b.sixes}×6
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top 5 Bowlers */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold">
                    <Target className="h-4 w-4 text-purple-500" />
                    Leading Wicket Takers
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("bowling")}
                    className="h-7 text-xs font-medium"
                  >
                    View all ({data.bowling.length})
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {data.bowling.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No bowling data available yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border text-xs">
                      {data.bowling.slice(0, 5).map((bw, idx) => (
                        <div
                          key={bw.userId}
                          className="flex items-center justify-between p-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted font-bold text-[10px] text-muted-foreground">
                              {idx + 1}
                            </span>
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                              {(bw.name ?? "B")[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">
                                {bw.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {bw.overs} ov • Econ: {bw.economyDisplay} • BBI:{" "}
                                {bw.bestBowling.display}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold tabular-nums text-foreground">
                              {bw.wickets}{" "}
                              <span className="text-[11px] font-normal text-muted-foreground">
                                wkts
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {bw.runsConceded} runs
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
        )}

        {/* 2. BATTING TAB */}
        {activeTab === "batting" && (
          <div className="space-y-4">
            {/* Filter & Sort Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">
                Rank by:
              </span>
              {(
                [
                  { id: "runs", label: "Most Runs" },
                  { id: "centuries", label: "100s" },
                  { id: "fifties", label: "50s" },
                  { id: "highestScore", label: "Highest Score" },
                  { id: "average", label: "Batting Avg" },
                  { id: "strikeRate", label: "Strike Rate" },
                  { id: "sixes", label: "Most 6s" },
                  { id: "fours", label: "Most 4s" },
                  { id: "balls", label: "Balls Faced" },
                ] as const
              ).map((chip) => (
                <Button
                  key={chip.id}
                  variant={battingSort === chip.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBattingSort(chip.id)}
                  className="h-7 text-[11px]"
                >
                  {chip.label}
                </Button>
              ))}
            </div>

            {/* Full Batting Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">#</th>
                        <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                        <th className="px-2.5 py-2.5 text-center">Mat</th>
                        <th className="px-2.5 py-2.5 text-center">Inn</th>
                        <th className="px-2.5 py-2.5 text-center">NO</th>
                        <th className="px-3 py-2.5 text-right font-bold text-foreground">
                          Runs
                        </th>
                        <th className="px-2.5 py-2.5 text-center">HS</th>
                        <th className="px-2.5 py-2.5 text-right">Avg</th>
                        <th className="px-2.5 py-2.5 text-right">BF</th>
                        <th className="px-2.5 py-2.5 text-right">SR</th>
                        <th className="px-2 py-2.5 text-center">100</th>
                        <th className="px-2 py-2.5 text-center">50</th>
                        <th className="px-2 py-2.5 text-center">4s</th>
                        <th className="px-2 py-2.5 text-center">6s</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredBatting.length === 0 ? (
                        <tr>
                          <td
                            colSpan={14}
                            className="py-8 text-center text-xs text-muted-foreground"
                          >
                            No batting records found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredBatting.map((b, idx) => (
                          <tr
                            key={b.userId}
                            className="hover:bg-muted/40 transition-colors"
                          >
                            <td className="px-3 py-2 text-center font-bold text-muted-foreground">
                              {idx === 0 ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                                  1
                                </span>
                              ) : (
                                idx + 1
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">
                                  {(b.name ?? "P")[0]?.toUpperCase()}
                                </div>
                                <span className="font-semibold text-foreground truncate max-w-[160px]">
                                  {b.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-2.5 py-2 text-center tabular-nums text-muted-foreground">
                              {b.matches}
                            </td>
                            <td className="px-2.5 py-2 text-center tabular-nums text-muted-foreground">
                              {b.innings}
                            </td>
                            <td className="px-2.5 py-2 text-center tabular-nums text-muted-foreground">
                              {b.notOuts}
                            </td>
                            <td className="px-3 py-2 text-right font-black tabular-nums text-sm text-foreground">
                              {b.runs}
                            </td>
                            <td className="px-2.5 py-2 text-center tabular-nums font-semibold">
                              {b.highestScoreDisplay}
                            </td>
                            <td className="px-2.5 py-2 text-right tabular-nums">
                              {b.averageDisplay}
                            </td>
                            <td className="px-2.5 py-2 text-right tabular-nums text-muted-foreground">
                              {b.balls}
                            </td>
                            <td className="px-2.5 py-2 text-right tabular-nums font-medium">
                              {b.strikeRateDisplay}
                            </td>
                            <td className="px-2 py-2 text-center tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                              {b.centuries}
                            </td>
                            <td className="px-2 py-2 text-center tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                              {b.fifties}
                            </td>
                            <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">
                              {b.fours}
                            </td>
                            <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">
                              {b.sixes}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 3. BOWLING TAB */}
        {activeTab === "bowling" && (
          <div className="space-y-4">
            {/* Filter & Sort Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">
                Rank by:
              </span>
              {(
                [
                  { id: "wickets", label: "Most Wickets" },
                  { id: "bestBowling", label: "Best Bowling (BBI)" },
                  { id: "average", label: "Bowling Avg" },
                  { id: "economy", label: "Economy Rate" },
                  { id: "maidens", label: "Maidens" },
                  { id: "threeWickets", label: "3-Wkt Hauls" },
                  { id: "fiveWickets", label: "5-Wkt Hauls" },
                  { id: "balls", label: "Balls Bowled" },
                ] as const
              ).map((chip) => (
                <Button
                  key={chip.id}
                  variant={bowlingSort === chip.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBowlingSort(chip.id)}
                  className="h-7 text-[11px]"
                >
                  {chip.label}
                </Button>
              ))}
            </div>

            {/* Full Bowling Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">#</th>
                        <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                        <th className="px-2.5 py-2.5 text-center">Mat</th>
                        <th className="px-2.5 py-2.5 text-center">Inn</th>
                        <th className="px-2.5 py-2.5 text-center">Overs</th>
                        <th className="px-2.5 py-2.5 text-center">Balls</th>
                        <th className="px-2.5 py-2.5 text-center">Mdns</th>
                        <th className="px-2.5 py-2.5 text-right">Runs</th>
                        <th className="px-3 py-2.5 text-right font-bold text-foreground">
                          Wkts
                        </th>
                        <th className="px-2.5 py-2.5 text-center">BBI</th>
                        <th className="px-2.5 py-2.5 text-right">Avg</th>
                        <th className="px-2.5 py-2.5 text-right">Econ</th>
                        <th className="px-2 py-2.5 text-center">3w</th>
                        <th className="px-2 py-2.5 text-center">5w</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredBowling.length === 0 ? (
                        <tr>
                          <td
                            colSpan={14}
                            className="py-8 text-center text-xs text-muted-foreground"
                          >
                            No bowling records found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredBowling.map((bw, idx) => (
                          <tr
                            key={bw.userId}
                            className="hover:bg-muted/40 transition-colors"
                          >
                            <td className="px-3 py-2 text-center font-bold text-muted-foreground">
                              {idx === 0 ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold">
                                  1
                                </span>
                              ) : (
                                idx + 1
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">
                                  {(bw.name ?? "B")[0]?.toUpperCase()}
                                </div>
                                <span className="font-semibold text-foreground truncate max-w-[160px]">
                                  {bw.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-2.5 py-2 text-center tabular-nums text-muted-foreground">
                              {bw.matches}
                            </td>
                            <td className="px-2.5 py-2 text-center tabular-nums text-muted-foreground">
                              {bw.innings}
                            </td>
                            <td className="px-2.5 py-2 text-center tabular-nums font-medium">
                              {bw.overs}
                            </td>
                            <td className="px-2.5 py-2 text-center tabular-nums text-muted-foreground">
                              {bw.balls}
                            </td>
                            <td className="px-2.5 py-2 text-center tabular-nums text-muted-foreground">
                              {bw.maidens}
                            </td>
                            <td className="px-2.5 py-2 text-right tabular-nums text-muted-foreground">
                              {bw.runsConceded}
                            </td>
                            <td className="px-3 py-2 text-right font-black tabular-nums text-sm text-foreground">
                              {bw.wickets}
                            </td>
                            <td className="px-2.5 py-2 text-center tabular-nums font-semibold text-purple-600 dark:text-purple-400">
                              {bw.bestBowling.display}
                            </td>
                            <td className="px-2.5 py-2 text-right tabular-nums">
                              {bw.averageDisplay}
                            </td>
                            <td className="px-2.5 py-2 text-right tabular-nums font-medium">
                              {bw.economyDisplay}
                            </td>
                            <td className="px-2 py-2 text-center tabular-nums font-semibold text-muted-foreground">
                              {bw.threeWickets}
                            </td>
                            <td className="px-2 py-2 text-center tabular-nums font-semibold text-purple-500">
                              {bw.fiveWickets}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 4. FIELDING TAB */}
        {activeTab === "fielding" && (
          <div className="space-y-4">
            {/* Filter & Sort Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">
                Rank by:
              </span>
              {(
                [
                  { id: "totalDismissals", label: "Total Dismissals" },
                  { id: "catches", label: "Catches" },
                  { id: "stumpings", label: "Stumpings" },
                  { id: "runOuts", label: "Run Outs" },
                ] as const
              ).map((chip) => (
                <Button
                  key={chip.id}
                  variant={fieldingSort === chip.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFieldingSort(chip.id)}
                  className="h-7 text-[11px]"
                >
                  {chip.label}
                </Button>
              ))}
            </div>

            {/* Full Fielding Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">#</th>
                        <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                        <th className="px-3 py-2.5 text-center">Matches</th>
                        <th className="px-3 py-2.5 text-right font-bold text-foreground">
                          Total Dismissals
                        </th>
                        <th className="px-3 py-2.5 text-center">Catches (Ct)</th>
                        <th className="px-3 py-2.5 text-center">Stumpings (St)</th>
                        <th className="px-3 py-2.5 text-center">Run Outs (RO)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredFielding.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center text-xs text-muted-foreground"
                          >
                            No fielding records found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredFielding.map((f, idx) => (
                          <tr
                            key={f.userId}
                            className="hover:bg-muted/40 transition-colors"
                          >
                            <td className="px-3 py-2 text-center font-bold text-muted-foreground">
                              {idx === 0 ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold">
                                  1
                                </span>
                              ) : (
                                idx + 1
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">
                                  {(f.name ?? "F")[0]?.toUpperCase()}
                                </div>
                                <span className="font-semibold text-foreground truncate max-w-[180px]">
                                  {f.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                              {f.matches}
                            </td>
                            <td className="px-3 py-2 text-right font-black tabular-nums text-sm text-cyan-600 dark:text-cyan-400">
                              {f.totalDismissals}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums font-semibold">
                              {f.catches}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums font-semibold text-purple-600 dark:text-purple-400">
                              {f.stumpings}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                              {f.runOuts}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 5. MVP TAB */}
        {activeTab === "mvp" && (
          <div className="space-y-4">
            {/* Filter & Sort Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">
                Rank by:
              </span>
              {(
                [
                  { id: "totalPoints", label: "Total MVP Points" },
                  { id: "battingPoints", label: "Batting Impact" },
                  { id: "bowlingPoints", label: "Bowling Impact" },
                  { id: "fieldingPoints", label: "Fielding Impact" },
                ] as const
              ).map((chip) => (
                <Button
                  key={chip.id}
                  variant={mvpSort === chip.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMvpSort(chip.id)}
                  className="h-7 text-[11px]"
                >
                  {chip.label}
                </Button>
              ))}
            </div>

            {/* Full MVP Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">#</th>
                        <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                        <th className="px-3 py-2.5 text-center">Matches</th>
                        <th className="px-3 py-2.5 text-right font-bold text-foreground">
                          Total Points
                        </th>
                        <th className="px-3 py-2.5 text-center">Bat Pts</th>
                        <th className="px-3 py-2.5 text-center">Bowl Pts</th>
                        <th className="px-3 py-2.5 text-center">Field Pts</th>
                        <th className="px-3 py-2.5 min-w-[180px]">Key Stats</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredMvp.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-8 text-center text-xs text-muted-foreground"
                          >
                            No MVP records found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredMvp.map((m, idx) => (
                          <tr
                            key={m.userId}
                            className="hover:bg-muted/40 transition-colors"
                          >
                            <td className="px-3 py-2 text-center font-bold text-muted-foreground">
                              {idx === 0 ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                                  👑
                                </span>
                              ) : (
                                idx + 1
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">
                                  {(m.name ?? "P")[0]?.toUpperCase()}
                                </div>
                                <span className="font-semibold text-foreground truncate max-w-[160px]">
                                  {m.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                              {m.matches}
                            </td>
                            <td className="px-3 py-2 text-right font-black tabular-nums text-sm text-emerald-600 dark:text-emerald-400">
                              {m.totalPoints}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums font-medium text-amber-600 dark:text-amber-400">
                              {m.battingPoints}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums font-medium text-purple-600 dark:text-purple-400">
                              {m.bowlingPoints}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums font-medium text-cyan-600 dark:text-cyan-400">
                              {m.fieldingPoints}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              <span className="truncate block max-w-[240px]">
                                {m.summary}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
