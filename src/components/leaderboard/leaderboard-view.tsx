"use client";

import { useState, useMemo } from "react";
import { Initials } from "~/components/ui/initials";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Search,
  Activity,
  SlidersHorizontal,
} from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import {
  LeaderboardData,
  BattingLeaderboardEntry,
  BowlingLeaderboardEntry,
  FieldingLeaderboardEntry,
  MvpLeaderboardEntry,
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

// ---------------------------------------------------------------------------
// Metric Configuration Records with Unambiguous Contextual Data
// ---------------------------------------------------------------------------

interface MetricConfig<T> {
  label: string;
  description: string;
  heroLabel: string;
  getHeroStat: (item: T) => { value: string; label: string };
  getContextStats: (item: T) => { label: string; value: string }[];
}

const BATTING_CONFIGS: Record<BattingSortOption, MetricConfig<BattingLeaderboardEntry>> = {
  runs: {
    label: "Most Runs",
    description:
      "Ranked by Total Runs Scored. Displays overall tournament aggregate figures including innings, average, and strike rate.",
    heroLabel: "Total Runs Scored",
    getHeroStat: (b) => ({ value: `${b.runs}`, label: "Tournament Runs" }),
    getContextStats: (b) => [
      { label: "Innings", value: `${b.innings}` },
      { label: "Batting Avg", value: b.averageDisplay },
      { label: "Strike Rate", value: b.strikeRateDisplay },
      { label: "50s / 100s", value: `${b.fifties} / ${b.centuries}` },
    ],
  },
  highestScore: {
    label: "Highest Score",
    description:
      "Ranked by Highest Individual Score in a single knock. Every column in this view focuses strictly on that peak innings.",
    heroLabel: "Peak Innings Knock",
    getHeroStat: (b) => ({
      value: b.highestScoreDisplay,
      label: b.highestScoreBalls
        ? `${b.highestScoreBalls} balls in knock • SR ${b.highestScoreStrikeRateDisplay}`
        : "Highest Innings",
    }),
    getContextStats: (b) => [
      {
        label: "Balls in Knock",
        value: b.highestScoreBalls ? `${b.highestScoreBalls}` : "—",
      },
      {
        label: "Knock Strike Rate",
        value: b.highestScoreStrikeRateDisplay ?? "—",
      },
      {
        label: "Knock Boundaries",
        value: `${b.highestScoreFours ?? 0}×4, ${b.highestScoreSixes ?? 0}×6`,
      },
      { label: "Tournament Runs", value: `${b.runs} (${b.innings} inn)` },
    ],
  },
  average: {
    label: "Batting Avg",
    description:
      "Ranked by Batting Average (Total Runs divided by Number of Times Dismissed). Demonstrates run consistency.",
    heroLabel: "Batting Average",
    getHeroStat: (b) => ({ value: b.averageDisplay, label: "Runs Per Dismissal" }),
    getContextStats: (b) => [
      { label: "Tournament Runs", value: `${b.runs}` },
      {
        label: "Times Dismissed",
        value: `${Math.max(0, b.innings - b.notOuts)}`,
      },
      { label: "Innings (Not Outs)", value: `${b.innings} (${b.notOuts} NO)` },
      { label: "Strike Rate", value: b.strikeRateDisplay },
    ],
  },
  strikeRate: {
    label: "Strike Rate",
    description:
      "Ranked by Batting Strike Rate. Measures scoring velocity in runs scored per 100 balls faced.",
    heroLabel: "Batting Strike Rate",
    getHeroStat: (b) => ({ value: b.strikeRateDisplay, label: "Runs / 100 Balls" }),
    getContextStats: (b) => [
      { label: "Runs Scored", value: `${b.runs}` },
      { label: "Balls Faced", value: `${b.balls}` },
      { label: "Boundary %", value: b.boundaryPercent },
      { label: "Boundaries", value: `${b.fours}×4, ${b.sixes}×6` },
    ],
  },
  centuries: {
    label: "100s",
    description:
      "Ranked by Centuries (100+ run innings). Highlights match-defining individual centuries.",
    heroLabel: "Centuries Scored",
    getHeroStat: (b) => ({
      value: `${b.centuries}`,
      label: b.centuries === 1 ? "Century" : "Centuries",
    }),
    getContextStats: (b) => [
      { label: "Half-Centuries (50s)", value: `${b.fifties}` },
      { label: "Highest Score", value: b.highestScoreDisplay },
      { label: "Total Runs", value: `${b.runs}` },
      { label: "Innings Batted", value: `${b.innings}` },
    ],
  },
  fifties: {
    label: "50s",
    description:
      "Ranked by Half-Centuries (50-99 run innings). Displays consistent half-century milestones.",
    heroLabel: "Half-Centuries",
    getHeroStat: (b) => ({
      value: `${b.fifties}`,
      label: b.fifties === 1 ? "Half-Century" : "Half-Centuries",
    }),
    getContextStats: (b) => [
      { label: "Centuries (100s)", value: `${b.centuries}` },
      { label: "Highest Score", value: b.highestScoreDisplay },
      { label: "Total Runs", value: `${b.runs}` },
      { label: "Innings Batted", value: `${b.innings}` },
    ],
  },
  sixes: {
    label: "Most 6s",
    description:
      "Ranked by Total Sixes struck across all fixtures. Quantifies maximum boundary power.",
    heroLabel: "Sixes Struck",
    getHeroStat: (b) => ({
      value: `${b.sixes}`,
      label: b.sixes === 1 ? "Six Hit" : "Sixes Hit",
    }),
    getContextStats: (b) => [
      { label: "Runs from Sixes", value: `${b.sixes * 6}` },
      { label: "Fours Hit", value: `${b.fours}` },
      { label: "Total Runs", value: `${b.runs}` },
      { label: "Strike Rate", value: b.strikeRateDisplay },
    ],
  },
  fours: {
    label: "Most 4s",
    description:
      "Ranked by Total Fours struck across all fixtures. Quantifies boundary accumulation.",
    heroLabel: "Fours Struck",
    getHeroStat: (b) => ({
      value: `${b.fours}`,
      label: b.fours === 1 ? "Four Hit" : "Fours Hit",
    }),
    getContextStats: (b) => [
      { label: "Runs from Fours", value: `${b.fours * 4}` },
      { label: "Sixes Hit", value: `${b.sixes}` },
      { label: "Total Runs", value: `${b.runs}` },
      { label: "Balls Faced", value: `${b.balls}` },
    ],
  },
  balls: {
    label: "Balls Faced",
    description:
      "Ranked by Deliveries Faced at the crease. Quantifies occupation of the crease.",
    heroLabel: "Deliveries Faced",
    getHeroStat: (b) => ({ value: `${b.balls}`, label: "Balls Faced" }),
    getContextStats: (b) => [
      { label: "Overs Faced", value: `${(b.balls / 6).toFixed(1)}` },
      { label: "Runs Scored", value: `${b.runs}` },
      { label: "Strike Rate", value: b.strikeRateDisplay },
      { label: "Innings", value: `${b.innings}` },
    ],
  },
};

const BOWLING_CONFIGS: Record<BowlingSortOption, MetricConfig<BowlingLeaderboardEntry>> = {
  wickets: {
    label: "Most Wickets",
    description:
      "Ranked by Total Wickets Taken. Displays overall tournament aggregate bowling figures.",
    heroLabel: "Wickets Taken",
    getHeroStat: (bw) => ({
      value: `${bw.wickets}`,
      label: bw.wickets === 1 ? "Wicket" : "Wickets Taken",
    }),
    getContextStats: (bw) => [
      { label: "Overs Bowled", value: bw.overs },
      { label: "Bowling Avg", value: bw.averageDisplay },
      { label: "Economy Rate", value: bw.economyDisplay },
      { label: "Best Match Spell", value: bw.bestBowling.display },
    ],
  },
  bestBowling: {
    label: "Best Bowling (BBI)",
    description:
      "Ranked by Best Bowling Figures in a single innings. Focuses strictly on that peak match spell.",
    heroLabel: "Best Match Spell",
    getHeroStat: (bw) => ({
      value: bw.bestBowling.display,
      label: bw.bestBowling.overs
        ? `${bw.bestBowling.overs} ov • Econ ${bw.bestBowling.economy}`
        : "Best Match Spell",
    }),
    getContextStats: (bw) => [
      {
        label: "Overs in Spell",
        value: bw.bestBowling.overs ? `${bw.bestBowling.overs}` : "—",
      },
      {
        label: "Spell Economy",
        value: bw.bestBowling.economy ? `${bw.bestBowling.economy}` : "—",
      },
      { label: "Tournament Wkts", value: `${bw.wickets}` },
      { label: "Tournament Overs", value: bw.overs },
    ],
  },
  average: {
    label: "Bowling Avg",
    description:
      "Ranked by Bowling Average (Runs Conceded divided by Wickets Taken). Demonstrates breakthrough efficiency.",
    heroLabel: "Bowling Average",
    getHeroStat: (bw) => ({ value: bw.averageDisplay, label: "Runs / Wicket" }),
    getContextStats: (bw) => [
      { label: "Runs Conceded", value: `${bw.runsConceded}` },
      { label: "Wickets Taken", value: `${bw.wickets}` },
      { label: "Overs Bowled", value: bw.overs },
      { label: "Economy Rate", value: bw.economyDisplay },
    ],
  },
  economy: {
    label: "Economy Rate",
    description:
      "Ranked by Economy Rate (Runs Conceded per Over Bowled). Measures run containment.",
    heroLabel: "Economy Rate",
    getHeroStat: (bw) => ({ value: bw.economyDisplay, label: "Runs / Over (RPO)" }),
    getContextStats: (bw) => [
      { label: "Overs Bowled", value: bw.overs },
      { label: "Runs Conceded", value: `${bw.runsConceded}` },
      { label: "Wickets Taken", value: `${bw.wickets}` },
      { label: "Maiden Overs", value: `${bw.maidens}` },
    ],
  },
  maidens: {
    label: "Maidens",
    description:
      "Ranked by Maiden Overs (overs with 0 runs conceded). Demonstrates sustained pressure.",
    heroLabel: "Maiden Overs",
    getHeroStat: (bw) => ({
      value: `${bw.maidens}`,
      label: bw.maidens === 1 ? "Maiden Over" : "Maiden Overs",
    }),
    getContextStats: (bw) => [
      { label: "Overs Bowled", value: bw.overs },
      { label: "Economy Rate", value: bw.economyDisplay },
      { label: "Wickets Taken", value: `${bw.wickets}` },
      { label: "Runs Conceded", value: `${bw.runsConceded}` },
    ],
  },
  threeWickets: {
    label: "3-Wkt Hauls",
    description:
      "Ranked by Most 3-Wicket Hauls in an innings. Shows multi-wicket match impact.",
    heroLabel: "3-Wkt Hauls",
    getHeroStat: (bw) => ({
      value: `${bw.threeWickets}`,
      label: bw.threeWickets === 1 ? "3-Wkt Haul" : "3-Wkt Hauls",
    }),
    getContextStats: (bw) => [
      { label: "5-Wkt Hauls", value: `${bw.fiveWickets}` },
      { label: "Total Wickets", value: `${bw.wickets}` },
      { label: "Best Match Spell", value: bw.bestBowling.display },
      { label: "Innings Bowled", value: `${bw.innings}` },
    ],
  },
  fiveWickets: {
    label: "5-Wkt Hauls",
    description:
      "Ranked by Most 5-Wicket Hauls in an innings. Celebrates dominant bowling performances.",
    heroLabel: "5-Wkt Hauls",
    getHeroStat: (bw) => ({
      value: `${bw.fiveWickets}`,
      label: bw.fiveWickets === 1 ? "5-Wkt Haul" : "5-Wkt Hauls",
    }),
    getContextStats: (bw) => [
      { label: "3-Wkt Hauls", value: `${bw.threeWickets}` },
      { label: "Total Wickets", value: `${bw.wickets}` },
      { label: "Best Match Spell", value: bw.bestBowling.display },
      { label: "Bowling Avg", value: bw.averageDisplay },
    ],
  },
  balls: {
    label: "Balls Bowled",
    description:
      "Ranked by Legal Deliveries Bowled. Quantifies overall bowling workload.",
    heroLabel: "Deliveries Bowled",
    getHeroStat: (bw) => ({
      value: `${bw.balls}`,
      label: `${bw.overs} Overs Bowled`,
    }),
    getContextStats: (bw) => [
      { label: "Overs Bowled", value: bw.overs },
      { label: "Runs Conceded", value: `${bw.runsConceded}` },
      { label: "Wickets Taken", value: `${bw.wickets}` },
      { label: "Economy Rate", value: bw.economyDisplay },
    ],
  },
};

const FIELDING_CONFIGS: Record<FieldingSortOption, MetricConfig<FieldingLeaderboardEntry>> = {
  totalDismissals: {
    label: "Total Dismissals",
    description:
      "Ranked by Combined Fielding Dismissals (Catches + Stumpings + Run Outs).",
    heroLabel: "Total Dismissals",
    getHeroStat: (f) => ({
      value: `${f.totalDismissals}`,
      label: f.totalDismissals === 1 ? "Dismissal" : "Total Dismissals",
    }),
    getContextStats: (f) => [
      { label: "Catches (Ct)", value: `${f.catches}` },
      { label: "Stumpings (St)", value: `${f.stumpings}` },
      { label: "Run Outs (RO)", value: `${f.runOuts}` },
      { label: "Matches", value: `${f.matches}` },
    ],
  },
  catches: {
    label: "Catches",
    description:
      "Ranked by Most Catches Taken in the outfield or behind the stumps.",
    heroLabel: "Catches Taken",
    getHeroStat: (f) => ({
      value: `${f.catches}`,
      label: f.catches === 1 ? "Catch" : "Catches",
    }),
    getContextStats: (f) => [
      { label: "Matches Played", value: `${f.matches}` },
      { label: "Total Dismissals", value: `${f.totalDismissals}` },
      { label: "Stumpings", value: `${f.stumpings}` },
      { label: "Run Outs", value: `${f.runOuts}` },
    ],
  },
  stumpings: {
    label: "Stumpings",
    description: "Ranked by Most Wicketkeeper Stumpings executed.",
    heroLabel: "Stumpings Executed",
    getHeroStat: (f) => ({
      value: `${f.stumpings}`,
      label: f.stumpings === 1 ? "Stumping" : "Stumpings",
    }),
    getContextStats: (f) => [
      { label: "Matches Played", value: `${f.matches}` },
      { label: "Catches Taken", value: `${f.catches}` },
      { label: "Total Dismissals", value: `${f.totalDismissals}` },
    ],
  },
  runOuts: {
    label: "Run Outs",
    description: "Ranked by Direct Hit and Assisted Fielding Run Outs.",
    heroLabel: "Run Outs Executed",
    getHeroStat: (f) => ({
      value: `${f.runOuts}`,
      label: f.runOuts === 1 ? "Run Out" : "Run Outs",
    }),
    getContextStats: (f) => [
      { label: "Matches Played", value: `${f.matches}` },
      { label: "Catches Taken", value: `${f.catches}` },
      { label: "Total Dismissals", value: `${f.totalDismissals}` },
    ],
  },
};

const MVP_CONFIGS: Record<MvpSortOption, MetricConfig<MvpLeaderboardEntry>> = {
  totalPoints: {
    label: "Total MVP Points",
    description:
      "Ranked by Combined MVP Performance Points (Batting + Bowling + Fielding impact).",
    heroLabel: "Total Points",
    getHeroStat: (m) => ({
      value: `${m.totalPoints}`,
      label: "Total MVP Points",
    }),
    getContextStats: (m) => [
      { label: "Batting Pts", value: `${m.battingPoints}` },
      { label: "Bowling Pts", value: `${m.bowlingPoints}` },
      { label: "Fielding Pts", value: `${m.fieldingPoints}` },
      { label: "Impact Summary", value: m.summary },
    ],
  },
  battingPoints: {
    label: "Batting Impact",
    description:
      "Ranked by MVP Points earned through Batting performance and milestones.",
    heroLabel: "Batting Points",
    getHeroStat: (m) => ({
      value: `${m.battingPoints}`,
      label: "Batting Impact Points",
    }),
    getContextStats: (m) => [
      { label: "Runs Scored", value: `${m.runs}` },
      { label: "Total MVP Pts", value: `${m.totalPoints}` },
      { label: "Bowling Pts", value: `${m.bowlingPoints}` },
    ],
  },
  bowlingPoints: {
    label: "Bowling Impact",
    description:
      "Ranked by MVP Points earned through Wickets, Economy, and Maidens.",
    heroLabel: "Bowling Points",
    getHeroStat: (m) => ({
      value: `${m.bowlingPoints}`,
      label: "Bowling Impact Points",
    }),
    getContextStats: (m) => [
      { label: "Wickets Taken", value: `${m.wickets}` },
      { label: "Total MVP Pts", value: `${m.totalPoints}` },
      { label: "Batting Pts", value: `${m.battingPoints}` },
    ],
  },
  fieldingPoints: {
    label: "Fielding Impact",
    description:
      "Ranked by MVP Points earned through Catches, Stumpings, and Run Outs.",
    heroLabel: "Fielding Points",
    getHeroStat: (m) => ({
      value: `${m.fieldingPoints}`,
      label: "Fielding Impact Points",
    }),
    getContextStats: (m) => [
      {
        label: "Dismissals",
        value: `${m.catches + m.stumpings + m.runOuts}`,
      },
      { label: "Total MVP Pts", value: `${m.totalPoints}` },
      { label: "Catches", value: `${m.catches}` },
    ],
  },
};

// ---------------------------------------------------------------------------
// Category Leader Spotlight Component
// ---------------------------------------------------------------------------

function LeaderSpotlightBanner({
  title,
  description,
  leader,
  heroValue,
  heroLabel,
  contextStats,
}: {
  title: string;
  description: string;
  leader?: { name: string; avatar?: string | null } | null;
  heroValue?: string;
  heroLabel?: string;
  contextStats?: { label: string; value: string }[];
}) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Description & Category Header */}
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground max-w-xl text-balance">
            {description}
          </p>
        </div>

        {/* Right: #1 Leader Spotlight Card */}
        {leader && heroValue && (
          <div className="flex items-center gap-3 self-start sm:self-auto rounded-lg border border-border/60 bg-card/90 p-2.5 sm:min-w-[290px]">
            <div className="relative shrink-0">
              <Initials name={leader.name} fallback="P" className="h-10 w-10" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-foreground">
                  {leader.name}
                </span>
                <span
                  className="text-sm font-bold tabular-nums text-foreground"
                >
                  {heroValue}
                </span>
              </div>
              <div className="text-2xs text-muted-foreground truncate">
                {heroLabel}
              </div>
              {contextStats && contextStats.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-2xs text-muted-foreground border-t border-border/40 pt-1">
                  {contextStats.slice(0, 3).map((st) => (
                    <span key={st.label} className="truncate">
                      <span className="font-semibold text-foreground tabular-nums">
                        {st.value}
                      </span>{" "}
                      {st.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Leaderboard View Component
// ---------------------------------------------------------------------------

/** One ranked player on phones: rank, name, the metric and its context. */
function RankCard({
  rank,
  name,
  fallback,
  subtitle,
  hero,
  stats,
}: {
  rank: number;
  name: string;
  fallback: string;
  subtitle: string;
  hero: { value: string; label: string };
  stats: { label: string; value: string }[];
}) {
  return (
    <Card className="border-border/80 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-foreground font-semibold text-2xs">
            {rank}
          </span>
          <Initials name={name} fallback={fallback} className="h-8 w-8" />
          <div className="min-w-0">
            <div className="font-bold text-foreground text-sm truncate">
              {name}
            </div>
            <div className="text-2xs text-muted-foreground truncate">
              {subtitle}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-base font-bold tabular-nums text-foreground">
            {hero.value}
          </div>
          <div className="text-2xs text-muted-foreground">{hero.label}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-2 text-2xs">
        {stats.map((st) => (
          <div key={st.label} className="flex justify-between">
            <span className="text-muted-foreground">{st.label}:</span>
            <span className="font-semibold tabular-nums text-foreground">
              {st.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** The leaderboard's tab, search, sort and table mode, and the lists they give. */
function useLeaderboardState(
  data: LeaderboardViewProps["data"],
  showHighlights: boolean,
) {
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

  // Table Presentation Mode: 'focused' (contextual columns for active stat) vs 'all' (complete standard sheet)
  const [battingTableMode, setBattingTableMode] = useState<"focused" | "all">(
    "focused",
  );
  const [bowlingTableMode, setBowlingTableMode] = useState<"focused" | "all">(
    "focused",
  );

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

  return {
    data,
    showHighlights,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    battingSort,
    setBattingSort,
    bowlingSort,
    setBowlingSort,
    fieldingSort,
    setFieldingSort,
    mvpSort,
    setMvpSort,
    battingTableMode,
    setBattingTableMode,
    bowlingTableMode,
    setBowlingTableMode,
    hasAnyData,
    filteredBatting,
    filteredBowling,
    filteredFielding,
    filteredMvp,
  };
}

type LeaderboardState = ReturnType<typeof useLeaderboardState>;

const LEADERBOARD_TABS = [
  { id: "overview", label: "Overview" },
  { id: "batting", label: "Batting" },
  { id: "bowling", label: "Bowling" },
  { id: "fielding", label: "Fielding" },
  { id: "mvp", label: "MVP" },
] as const;

function OverviewTab({ view }: { view: LeaderboardState }) {
  const { data, showHighlights, setActiveTab } = view;
  return (
    <div className="space-y-6">
      {/* Highlight Cards Grid */}
      {showHighlights && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Orange Cap */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  Orange Cap
                </span>
                <span className="text-xs text-muted-foreground">
                  Most runs
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {data.highlights.orangeCap ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-foreground">
                      {data.highlights.orangeCap.name}
                    </div>
                    <div className="text-2xs text-muted-foreground">
                      {data.highlights.orangeCap.innings} inn • Avg:{" "}
                      {data.highlights.orangeCap.averageDisplay} • SR:{" "}
                      {data.highlights.orangeCap.strikeRateDisplay}
                    </div>
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-foreground">
                    {data.highlights.orangeCap.runs}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No batting records yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Purple Cap */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  Purple Cap
                </span>
                <span className="text-xs text-muted-foreground">
                  Most wickets
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {data.highlights.purpleCap ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-foreground">
                      {data.highlights.purpleCap.name}
                    </div>
                    <div className="text-2xs text-muted-foreground">
                      {data.highlights.purpleCap.overs} ov • Avg:{" "}
                      {data.highlights.purpleCap.averageDisplay} • Econ:{" "}
                      {data.highlights.purpleCap.economyDisplay}
                    </div>
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-foreground">
                    {data.highlights.purpleCap.wickets}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No bowling records yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* MVP Leader */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  MVP leader
                </span>
                <span className="text-xs text-muted-foreground">
                  All-round points
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {data.highlights.mvpLeader ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-foreground">
                      {data.highlights.mvpLeader.name}
                    </div>
                    <div className="text-2xs text-muted-foreground">
                      {data.highlights.mvpLeader.summary}
                    </div>
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-foreground">
                    {data.highlights.mvpLeader.totalPoints}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No MVP records yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Most Sixes */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Most sixes (max)
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div className="truncate font-semibold text-foreground">
                  {data.highlights.mostSixes?.name ?? "—"}
                </div>
                <div className="text-xl font-bold tabular-nums text-foreground">
                  {data.highlights.mostSixes?.sixes ?? 0}
                </div>
              </div>
              <div className="mt-0.5 text-2xs text-muted-foreground">
                {data.highlights.mostSixes
                  ? `${data.highlights.mostSixes.runs} total runs • ${data.highlights.mostSixes.fours} fours`
                  : "No sixes recorded"}
              </div>
            </CardContent>
          </Card>

          {/* Highest Individual Score */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Highest individual score
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div className="truncate font-semibold text-foreground">
                  {data.highlights.highestScore?.name ?? "—"}
                </div>
                <div className="text-xl font-bold tabular-nums text-foreground">
                  {data.highlights.highestScore?.highestScoreDisplay ?? "—"}
                </div>
              </div>
              <div className="mt-0.5 text-2xs text-muted-foreground">
                {data.highlights.highestScore
                  ? data.highlights.highestScore.highestScoreBalls
                    ? `${data.highlights.highestScore.highestScoreBalls} balls • SR ${data.highlights.highestScore.highestScoreStrikeRateDisplay}`
                    : `${data.highlights.highestScore.runs} total runs in tournament`
                  : "No batting records"}
              </div>
            </CardContent>
          </Card>

          {/* Best Bowling Inning */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Best bowling figures
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div className="truncate font-semibold text-foreground">
                  {data.highlights.bestBowling?.name ?? "—"}
                </div>
                <div className="text-xl font-bold tabular-nums text-foreground">
                  {data.highlights.bestBowling?.bestBowling.display ?? "—"}
                </div>
              </div>
              <div className="mt-0.5 text-2xs text-muted-foreground">
                {data.highlights.bestBowling
                  ? `${data.highlights.bestBowling.wickets} total wkts • Econ ${data.highlights.bestBowling.economyDisplay}`
                  : "No bowling figures recorded"}
              </div>
            </CardContent>
          </Card>

          {/* Top Fielder */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Top fielder
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div className="truncate font-semibold text-foreground">
                  {data.highlights.topFielder?.name ?? "—"}
                </div>
                <div className="text-xl font-bold tabular-nums text-foreground">
                  {data.highlights.topFielder?.totalDismissals ?? 0}
                </div>
              </div>
              <div className="mt-0.5 text-2xs text-muted-foreground">
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
            <CardTitle className="text-base font-semibold">
              Leading run scorers
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
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted font-bold text-2xs text-muted-foreground">
                        {idx + 1}
                      </span>
                      <Initials name={b.name} fallback="P" className="h-7 w-7" />
                      <div>
                        <div className="font-semibold text-foreground">
                          {b.name}
                        </div>
                        <div className="text-2xs text-muted-foreground">
                          {b.innings} inn • HS: {b.highestScoreDisplay} • SR:{" "}
                          {b.strikeRateDisplay}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold tabular-nums text-foreground">
                        {b.runs}
                      </div>
                      <div className="text-2xs text-muted-foreground">
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
            <CardTitle className="text-base font-semibold">
              Leading wicket takers
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
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted font-bold text-2xs text-muted-foreground">
                        {idx + 1}
                      </span>
                      <Initials name={bw.name} fallback="B" className="h-7 w-7" />
                      <div>
                        <div className="font-semibold text-foreground">
                          {bw.name}
                        </div>
                        <div className="text-2xs text-muted-foreground">
                          {bw.overs} ov • Econ: {bw.economyDisplay} • BBI:{" "}
                          {bw.bestBowling.display}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold tabular-nums text-foreground">
                        {bw.wickets}
                      </div>
                      <div className="text-2xs text-muted-foreground">
                        Avg {bw.averageDisplay}
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

function BattingTab({ view }: { view: LeaderboardState }) {
  const { battingSort, setBattingSort, battingTableMode, setBattingTableMode, filteredBatting } = view;
  return (
    <div className="space-y-4">
      {/* Filter & Sort Chips + Table View Mode Toggle */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <span className="shrink-0 mr-1 text-xs font-semibold text-muted-foreground">
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
              className="shrink-0 whitespace-nowrap h-8 min-h-[32px] sm:h-7 text-2xs font-semibold"
            >
              {chip.label}
            </Button>
          ))}
        </div>

        {/* View Toggle: Focused Perspective vs All Columns */}
        {battingSort !== "runs" && (
          <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-border/70 bg-muted/40 p-1">
            <SlidersHorizontal className="h-3 w-3 text-muted-foreground ml-1 shrink-0" />
            <button
              type="button"
              onClick={() => setBattingTableMode("focused")}
              className={`rounded-md px-2.5 py-1 text-2xs font-medium min-h-[32px] sm:min-h-0 transition-all ${
                battingTableMode === "focused"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Focused knock view
            </button>
            <button
              type="button"
              onClick={() => setBattingTableMode("all")}
              className={`rounded-md px-2.5 py-1 text-2xs font-medium min-h-[32px] sm:min-h-0 transition-all ${
                battingTableMode === "all"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All columns
            </button>
          </div>
        )}
      </div>

      {/* Active Metric Leader Spotlight Banner */}
      <LeaderSpotlightBanner
        title={`Batting Leaderboard • ${BATTING_CONFIGS[battingSort].label}`}
        description={BATTING_CONFIGS[battingSort].description}
        leader={filteredBatting[0]}
        heroValue={
          filteredBatting[0]
            ? BATTING_CONFIGS[battingSort].getHeroStat(filteredBatting[0]).value
            : undefined
        }
        heroLabel={
          filteredBatting[0]
            ? BATTING_CONFIGS[battingSort].getHeroStat(filteredBatting[0]).label
            : undefined
        }
        contextStats={
          filteredBatting[0]
            ? BATTING_CONFIGS[battingSort].getContextStats(filteredBatting[0])
            : undefined
        }
      />

      {/* Responsive Cards for Mobile View (< md) */}
      <div className="grid gap-2.5 md:hidden">
        {filteredBatting.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-xs text-muted-foreground">
            No batting records found matching your search.
          </div>
        ) : (
          filteredBatting.map((b, idx) => {
            const hero = BATTING_CONFIGS[battingSort].getHeroStat(b);
            const stats = BATTING_CONFIGS[battingSort].getContextStats(b);
            return (
              <RankCard
                key={b.userId}
                rank={idx + 1}
                name={b.name}
                fallback="P"
                subtitle={`${b.matches} matches • ${b.innings} innings`}
                hero={hero}
                stats={stats}
              />
            );
          })
        )}
      </div>

      {/* Desktop Table: Focused Knock Perspective for Highest Score */}
      {battingSort === "highestScore" && battingTableMode === "focused" ? (
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/50 text-2xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 w-10 text-center">#</th>
                    <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                    <th className="px-3 py-2.5 text-center bg-muted text-foreground font-semibold">
                      High score (HS)
                    </th>
                    <th className="px-3 py-2.5 text-center">Balls (knock)</th>
                    <th className="px-3 py-2.5 text-right">SR (knock)</th>
                    <th className="px-3 py-2.5 text-center">Knock 4s</th>
                    <th className="px-3 py-2.5 text-center">Knock 6s</th>
                    <th className="px-3 py-2.5 text-center">Innings</th>
                    <th className="px-3 py-2.5 text-right font-bold text-foreground">
                      Total tournament runs
                    </th>
                    <th className="px-3 py-2.5 text-right">Overall avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBatting.map((b, idx) => (
                    <tr
                      key={b.userId}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-3 py-2 text-center font-bold text-muted-foreground">
                        {idx === 0 ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-foreground font-semibold">
                            1
                          </span>
                        ) : (
                          idx + 1
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Initials name={b.name} fallback="P" className="h-6 w-6 text-2xs" />
                          <span className="font-semibold text-foreground truncate max-w-[160px]">
                            {b.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums font-bold text-sm bg-muted/60 text-foreground">
                        {b.highestScoreDisplay}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground font-medium">
                        {b.highestScoreBalls ? `${b.highestScoreBalls} balls` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {b.highestScoreStrikeRateDisplay ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                        {b.highestScoreFours ?? 0}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                        {b.highestScoreSixes ?? 0}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                        {b.innings}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-foreground">
                        {b.runs}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {b.averageDisplay}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Full Batting Table for Desktop (>= md) */
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/50 text-2xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 w-10 text-center">#</th>
                    <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                    <th className="px-2.5 py-2.5 text-center">Mat</th>
                    <th className="px-2.5 py-2.5 text-center">Inn</th>
                    <th className="px-2.5 py-2.5 text-center">NO</th>
                    <th
                      className={`px-3 py-2.5 text-right transition-colors ${
                        battingSort === "runs"
                          ? "bg-muted text-foreground font-semibold"
                          : "font-bold text-foreground"
                      }`}
                    >
                      Runs
                    </th>
                    <th
                      className={`px-2.5 py-2.5 text-center transition-colors ${
                        battingSort === "highestScore"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      HS
                    </th>
                    <th
                      className={`px-2.5 py-2.5 text-right transition-colors ${
                        battingSort === "average"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      Avg
                    </th>
                    <th
                      className={`px-2.5 py-2.5 text-right transition-colors ${
                        battingSort === "balls"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      BF
                    </th>
                    <th
                      className={`px-2.5 py-2.5 text-right transition-colors ${
                        battingSort === "strikeRate"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      SR
                    </th>
                    <th
                      className={`px-2 py-2.5 text-center transition-colors ${
                        battingSort === "centuries"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      100
                    </th>
                    <th
                      className={`px-2 py-2.5 text-center transition-colors ${
                        battingSort === "fifties"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      50
                    </th>
                    <th
                      className={`px-2 py-2.5 text-center transition-colors ${
                        battingSort === "fours"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      4s
                    </th>
                    <th
                      className={`px-2 py-2.5 text-center transition-colors ${
                        battingSort === "sixes"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      6s
                    </th>
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
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-foreground font-semibold">
                              1
                            </span>
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Initials name={b.name} fallback="P" className="h-6 w-6 text-2xs" />
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
                        <td
                          className={`px-3 py-2 text-right tabular-nums font-bold text-sm ${
                            battingSort === "runs"
                              ? "bg-muted/60 text-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {b.runs}
                        </td>
                        <td
                          className={`px-2.5 py-2 text-center tabular-nums font-semibold ${
                            battingSort === "highestScore"
                              ? "bg-muted/60 text-foreground"
                              : ""
                          }`}
                        >
                          {b.highestScoreDisplay}
                        </td>
                        <td
                          className={`px-2.5 py-2 text-right tabular-nums ${
                            battingSort === "average"
                              ? "bg-muted/60 font-bold text-foreground"
                              : ""
                          }`}
                        >
                          {b.averageDisplay}
                        </td>
                        <td
                          className={`px-2.5 py-2 text-right tabular-nums ${
                            battingSort === "balls"
                              ? "bg-muted/60 font-bold text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {b.balls}
                        </td>
                        <td
                          className={`px-2.5 py-2 text-right tabular-nums ${
                            battingSort === "strikeRate"
                              ? "bg-muted/60 font-bold text-foreground"
                              : "font-medium"
                          }`}
                        >
                          {b.strikeRateDisplay}
                        </td>
                        <td
                          className={`px-2 py-2 text-center tabular-nums ${
                            battingSort === "centuries"
                              ? "bg-muted/60 font-bold text-foreground"
                              : "font-semibold text-foreground"
                          }`}
                        >
                          {b.centuries}
                        </td>
                        <td
                          className={`px-2 py-2 text-center tabular-nums ${
                            battingSort === "fifties"
                              ? "bg-muted/60 font-bold text-foreground"
                              : "font-semibold text-foreground"
                          }`}
                        >
                          {b.fifties}
                        </td>
                        <td
                          className={`px-2 py-2 text-center tabular-nums ${
                            battingSort === "fours"
                              ? "bg-muted/60 font-bold text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {b.fours}
                        </td>
                        <td
                          className={`px-2 py-2 text-center tabular-nums ${
                            battingSort === "sixes"
                              ? "bg-muted/60 font-bold text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
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
      )}
    </div>
  );
}

function BowlingTab({ view }: { view: LeaderboardState }) {
  const { bowlingSort, setBowlingSort, bowlingTableMode, setBowlingTableMode, filteredBowling } = view;
  return (
    <div className="space-y-4">
      {/* Filter & Sort Chips + Table View Mode Toggle */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <span className="shrink-0 mr-1 text-xs font-semibold text-muted-foreground">
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
              className="shrink-0 whitespace-nowrap h-8 min-h-[32px] sm:h-7 text-2xs font-semibold"
            >
              {chip.label}
            </Button>
          ))}
        </div>

        {/* View Toggle for Bowling */}
        {bowlingSort === "bestBowling" && (
          <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-border/70 bg-muted/40 p-1">
            <SlidersHorizontal className="h-3 w-3 text-muted-foreground ml-1 shrink-0" />
            <button
              type="button"
              onClick={() => setBowlingTableMode("focused")}
              className={`rounded-md px-2.5 py-1 text-2xs font-medium min-h-[32px] sm:min-h-0 transition-all ${
                bowlingTableMode === "focused"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Focused spell view
            </button>
            <button
              type="button"
              onClick={() => setBowlingTableMode("all")}
              className={`rounded-md px-2.5 py-1 text-2xs font-medium min-h-[32px] sm:min-h-0 transition-all ${
                bowlingTableMode === "all"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All columns
            </button>
          </div>
        )}
      </div>

      {/* Active Metric Leader Spotlight Banner */}
      <LeaderSpotlightBanner
        title={`Bowling Leaderboard • ${BOWLING_CONFIGS[bowlingSort].label}`}
        description={BOWLING_CONFIGS[bowlingSort].description}
        leader={filteredBowling[0]}
        heroValue={
          filteredBowling[0]
            ? BOWLING_CONFIGS[bowlingSort].getHeroStat(filteredBowling[0]).value
            : undefined
        }
        heroLabel={
          filteredBowling[0]
            ? BOWLING_CONFIGS[bowlingSort].getHeroStat(filteredBowling[0]).label
            : undefined
        }
        contextStats={
          filteredBowling[0]
            ? BOWLING_CONFIGS[bowlingSort].getContextStats(filteredBowling[0])
            : undefined
        }
      />

      {/* Responsive Cards for Mobile View (< md) */}
      <div className="grid gap-2.5 md:hidden">
        {filteredBowling.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-xs text-muted-foreground">
            No bowling records found matching your search.
          </div>
        ) : (
          filteredBowling.map((bw, idx) => {
            const hero = BOWLING_CONFIGS[bowlingSort].getHeroStat(bw);
            const stats = BOWLING_CONFIGS[bowlingSort].getContextStats(bw);
            return (
              <RankCard
                key={bw.userId}
                rank={idx + 1}
                name={bw.name}
                fallback="B"
                subtitle={`${bw.matches} matches • ${bw.innings} innings`}
                hero={hero}
                stats={stats}
              />
            );
          })
        )}
      </div>

      {/* Desktop Table: Focused Spell View for Best Bowling (BBI) */}
      {bowlingSort === "bestBowling" && bowlingTableMode === "focused" ? (
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/50 text-2xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 w-10 text-center">#</th>
                    <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                    <th className="px-3 py-2.5 text-center bg-muted text-foreground font-semibold">
                      Best figures (BBI)
                    </th>
                    <th className="px-3 py-2.5 text-center">Overs in spell</th>
                    <th className="px-3 py-2.5 text-right">Spell economy</th>
                    <th className="px-3 py-2.5 text-right font-bold text-foreground">
                      Total tournament wkts
                    </th>
                    <th className="px-3 py-2.5 text-center">Total overs</th>
                    <th className="px-3 py-2.5 text-right">Overall econ</th>
                    <th className="px-3 py-2.5 text-right">Bowling avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBowling.map((bw, idx) => (
                    <tr
                      key={bw.userId}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-3 py-2 text-center font-bold text-muted-foreground">
                        {idx === 0 ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-foreground font-semibold">
                            1
                          </span>
                        ) : (
                          idx + 1
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Initials name={bw.name} fallback="B" className="h-6 w-6 text-2xs" />
                          <span className="font-semibold text-foreground truncate max-w-[160px]">
                            {bw.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums font-bold text-sm bg-muted/60 text-foreground">
                        {bw.bestBowling.display}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground font-medium">
                        {bw.bestBowling.overs ? `${bw.bestBowling.overs} ov` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {bw.bestBowling.economy ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-foreground">
                        {bw.wickets}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                        {bw.overs}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {bw.economyDisplay}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {bw.averageDisplay}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Full Bowling Table for Desktop (>= md) */
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/50 text-2xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 w-10 text-center">#</th>
                    <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                    <th className="px-2.5 py-2.5 text-center">Mat</th>
                    <th className="px-2.5 py-2.5 text-center">Inn</th>
                    <th className="px-2.5 py-2.5 text-center">Overs</th>
                    <th
                      className={`px-2.5 py-2.5 text-center transition-colors ${
                        bowlingSort === "balls"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      Balls
                    </th>
                    <th
                      className={`px-2.5 py-2.5 text-center transition-colors ${
                        bowlingSort === "maidens"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      Mdns
                    </th>
                    <th className="px-2.5 py-2.5 text-right">Runs</th>
                    <th
                      className={`px-3 py-2.5 text-right transition-colors ${
                        bowlingSort === "wickets"
                          ? "bg-muted text-foreground font-semibold"
                          : "font-bold text-foreground"
                      }`}
                    >
                      Wkts
                    </th>
                    <th
                      className={`px-2.5 py-2.5 text-center transition-colors ${
                        bowlingSort === "bestBowling"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      BBI
                    </th>
                    <th
                      className={`px-2.5 py-2.5 text-right transition-colors ${
                        bowlingSort === "average"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      Avg
                    </th>
                    <th
                      className={`px-2.5 py-2.5 text-right transition-colors ${
                        bowlingSort === "economy"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      Econ
                    </th>
                    <th
                      className={`px-2 py-2.5 text-center transition-colors ${
                        bowlingSort === "threeWickets"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      3w
                    </th>
                    <th
                      className={`px-2 py-2.5 text-center transition-colors ${
                        bowlingSort === "fiveWickets"
                          ? "bg-muted text-foreground font-semibold"
                          : ""
                      }`}
                    >
                      5w
                    </th>
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
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-foreground font-semibold">
                              1
                            </span>
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Initials name={bw.name} fallback="B" className="h-6 w-6 text-2xs" />
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
                        <td
                          className={`px-2.5 py-2 text-center tabular-nums ${
                            bowlingSort === "balls"
                              ? "bg-muted/60 font-bold text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {bw.balls}
                        </td>
                        <td
                          className={`px-2.5 py-2 text-center tabular-nums ${
                            bowlingSort === "maidens"
                              ? "bg-muted/60 font-bold text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {bw.maidens}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-muted-foreground">
                          {bw.runsConceded}
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums font-bold text-sm ${
                            bowlingSort === "wickets"
                              ? "bg-muted/60 text-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {bw.wickets}
                        </td>
                        <td
                          className={`px-2.5 py-2 text-center tabular-nums font-semibold ${
                            bowlingSort === "bestBowling"
                              ? "bg-muted/60 text-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {bw.bestBowling.display}
                        </td>
                        <td
                          className={`px-2.5 py-2 text-right tabular-nums ${
                            bowlingSort === "average"
                              ? "bg-muted/60 font-bold text-foreground"
                              : ""
                          }`}
                        >
                          {bw.averageDisplay}
                        </td>
                        <td
                          className={`px-2.5 py-2 text-right tabular-nums ${
                            bowlingSort === "economy"
                              ? "bg-muted/60 font-bold text-foreground"
                              : "font-medium"
                          }`}
                        >
                          {bw.economyDisplay}
                        </td>
                        <td
                          className={`px-2 py-2 text-center tabular-nums ${
                            bowlingSort === "threeWickets"
                              ? "bg-muted/60 font-bold text-foreground"
                              : "font-semibold text-muted-foreground"
                          }`}
                        >
                          {bw.threeWickets}
                        </td>
                        <td
                          className={`px-2 py-2 text-center tabular-nums ${
                            bowlingSort === "fiveWickets"
                              ? "bg-muted/60 font-bold text-foreground"
                              : "font-semibold text-foreground"
                          }`}
                        >
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
      )}
    </div>
  );
}

function FieldingTab({ view }: { view: LeaderboardState }) {
  const { fieldingSort, setFieldingSort, filteredFielding } = view;
  return (
    <div className="space-y-4">
      {/* Filter & Sort Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <span className="shrink-0 mr-1 text-xs font-semibold text-muted-foreground">
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
            className="shrink-0 whitespace-nowrap h-8 min-h-[32px] sm:h-7 text-2xs font-semibold"
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {/* Active Metric Leader Spotlight Banner */}
      <LeaderSpotlightBanner
        title={`Fielding Leaderboard • ${FIELDING_CONFIGS[fieldingSort].label}`}
        description={FIELDING_CONFIGS[fieldingSort].description}
        leader={filteredFielding[0]}
        heroValue={
          filteredFielding[0]
            ? FIELDING_CONFIGS[fieldingSort].getHeroStat(filteredFielding[0]).value
            : undefined
        }
        heroLabel={
          filteredFielding[0]
            ? FIELDING_CONFIGS[fieldingSort].getHeroStat(filteredFielding[0]).label
            : undefined
        }
        contextStats={
          filteredFielding[0]
            ? FIELDING_CONFIGS[fieldingSort].getContextStats(filteredFielding[0])
            : undefined
        }
      />

      {/* Responsive Cards for Mobile View (< md) */}
      <div className="grid gap-2.5 md:hidden">
        {filteredFielding.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-xs text-muted-foreground">
            No fielding records found matching your search.
          </div>
        ) : (
          filteredFielding.map((f, idx) => {
            const hero = FIELDING_CONFIGS[fieldingSort].getHeroStat(f);
            const stats = FIELDING_CONFIGS[fieldingSort].getContextStats(f);
            return (
              <RankCard
                key={f.userId}
                rank={idx + 1}
                name={f.name}
                fallback="F"
                subtitle={`${f.matches} matches`}
                hero={hero}
                stats={stats}
              />
            );
          })
        )}
      </div>

      {/* Full Fielding Table for Desktop (>= md) */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/50 text-2xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">#</th>
                  <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                  <th className="px-3 py-2.5 text-center">Matches</th>
                  <th
                    className={`px-3 py-2.5 text-right transition-colors ${
                      fieldingSort === "totalDismissals"
                        ? "bg-muted text-foreground font-semibold"
                        : "font-bold text-foreground"
                    }`}
                  >
                    Total dismissals
                  </th>
                  <th
                    className={`px-3 py-2.5 text-center transition-colors ${
                      fieldingSort === "catches"
                        ? "bg-muted text-foreground font-semibold"
                        : ""
                    }`}
                  >
                    Catches (Ct)
                  </th>
                  <th
                    className={`px-3 py-2.5 text-center transition-colors ${
                      fieldingSort === "stumpings"
                        ? "bg-muted text-foreground font-semibold"
                        : ""
                    }`}
                  >
                    Stumpings (St)
                  </th>
                  <th
                    className={`px-3 py-2.5 text-center transition-colors ${
                      fieldingSort === "runOuts"
                        ? "bg-muted text-foreground font-semibold"
                        : ""
                    }`}
                  >
                    Run outs (RO)
                  </th>
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
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-foreground font-semibold">
                            1
                          </span>
                        ) : (
                          idx + 1
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Initials name={f.name} fallback="F" className="h-6 w-6 text-2xs" />
                          <span className="font-semibold text-foreground truncate max-w-[180px]">
                            {f.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                        {f.matches}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums font-bold text-sm ${
                          fieldingSort === "totalDismissals"
                            ? "bg-muted/60 text-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {f.totalDismissals}
                      </td>
                      <td
                        className={`px-3 py-2 text-center tabular-nums font-semibold ${
                          fieldingSort === "catches"
                            ? "bg-muted/60 text-foreground"
                            : ""
                        }`}
                      >
                        {f.catches}
                      </td>
                      <td
                        className={`px-3 py-2 text-center tabular-nums font-semibold ${
                          fieldingSort === "stumpings"
                            ? "bg-muted/60 text-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {f.stumpings}
                      </td>
                      <td
                        className={`px-3 py-2 text-center tabular-nums font-semibold ${
                          fieldingSort === "runOuts"
                            ? "bg-muted/60 text-foreground"
                            : "text-foreground"
                        }`}
                      >
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
  );
}

function MvpTab({ view }: { view: LeaderboardState }) {
  const { mvpSort, setMvpSort, filteredMvp } = view;
  return (
    <div className="space-y-4">
      {/* Filter & Sort Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <span className="shrink-0 mr-1 text-xs font-semibold text-muted-foreground">
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
            className="shrink-0 whitespace-nowrap h-8 min-h-[32px] sm:h-7 text-2xs font-semibold"
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {/* Active Metric Leader Spotlight Banner */}
      <LeaderSpotlightBanner
        title={`MVP Leaderboard • ${MVP_CONFIGS[mvpSort].label}`}
        description={MVP_CONFIGS[mvpSort].description}
        leader={filteredMvp[0]}
        heroValue={
          filteredMvp[0]
            ? MVP_CONFIGS[mvpSort].getHeroStat(filteredMvp[0]).value
            : undefined
        }
        heroLabel={
          filteredMvp[0]
            ? MVP_CONFIGS[mvpSort].getHeroStat(filteredMvp[0]).label
            : undefined
        }
        contextStats={
          filteredMvp[0]
            ? MVP_CONFIGS[mvpSort].getContextStats(filteredMvp[0])
            : undefined
        }
      />

      {/* Responsive Cards for Mobile View (< md) */}
      <div className="grid gap-2.5 md:hidden">
        {filteredMvp.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-xs text-muted-foreground">
            No MVP records found matching your search.
          </div>
        ) : (
          filteredMvp.map((m, idx) => {
            const hero = MVP_CONFIGS[mvpSort].getHeroStat(m);
            const stats = MVP_CONFIGS[mvpSort].getContextStats(m);
            return (
              <RankCard
                key={m.userId}
                rank={idx + 1}
                name={m.name}
                fallback="P"
                subtitle={m.summary}
                hero={hero}
                stats={stats}
              />
            );
          })
        )}
      </div>

      {/* Full MVP Table for Desktop (>= md) */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/50 text-2xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">#</th>
                  <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                  <th className="px-3 py-2.5 text-center">Matches</th>
                  <th
                    className={`px-3 py-2.5 text-right transition-colors ${
                      mvpSort === "totalPoints"
                        ? "bg-muted text-foreground font-semibold"
                        : "font-bold text-foreground"
                    }`}
                  >
                    Total points
                  </th>
                  <th
                    className={`px-3 py-2.5 text-center transition-colors ${
                      mvpSort === "battingPoints"
                        ? "bg-muted text-foreground font-semibold"
                        : ""
                    }`}
                  >
                    Bat pts
                  </th>
                  <th
                    className={`px-3 py-2.5 text-center transition-colors ${
                      mvpSort === "bowlingPoints"
                        ? "bg-muted text-foreground font-semibold"
                        : ""
                    }`}
                  >
                    Bowl pts
                  </th>
                  <th
                    className={`px-3 py-2.5 text-center transition-colors ${
                      mvpSort === "fieldingPoints"
                        ? "bg-muted text-foreground font-semibold"
                        : ""
                    }`}
                  >
                    Field pts
                  </th>
                  <th className="px-3 py-2.5 min-w-[180px]">Key stats</th>
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
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-foreground font-semibold">
                            1
                          </span>
                        ) : (
                          idx + 1
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Initials name={m.name} fallback="P" className="h-6 w-6 text-2xs" />
                          <span className="font-semibold text-foreground truncate max-w-[160px]">
                            {m.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                        {m.matches}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums font-bold text-sm ${
                          mvpSort === "totalPoints"
                            ? "bg-muted/60 text-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {m.totalPoints}
                      </td>
                      <td
                        className={`px-3 py-2 text-center tabular-nums ${
                          mvpSort === "battingPoints"
                            ? "bg-muted/60 font-bold text-foreground"
                            : "font-medium text-foreground"
                        }`}
                      >
                        {m.battingPoints}
                      </td>
                      <td
                        className={`px-3 py-2 text-center tabular-nums ${
                          mvpSort === "bowlingPoints"
                            ? "bg-muted/60 font-bold text-foreground"
                            : "font-medium text-foreground"
                        }`}
                      >
                        {m.bowlingPoints}
                      </td>
                      <td
                        className={`px-3 py-2 text-center tabular-nums ${
                          mvpSort === "fieldingPoints"
                            ? "bg-muted/60 font-bold text-foreground"
                            : "font-medium text-foreground"
                        }`}
                      >
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
  );
}

export function LeaderboardView({
  title = "Statistics & Leaderboards",
  subtitle = "Comprehensive performance records, milestones, and MVP rankings across all fixtures.",
  data,
  showHighlights = true,
}: LeaderboardViewProps) {
  const view = useLeaderboardState(data, showHighlights);
  const { activeTab, setActiveTab, searchQuery, setSearchQuery, hasAnyData } =
    view;

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
          <h2 className="text-lg font-semibold tracking-tight text-foreground text-balance">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search player name..."
            aria-label="Search players"
            type="search"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs"
          />
        </div>
      </div>

      {/* Main Tabs Navigation (arrow keys move between tabs) */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="space-y-6"
      >
        <div className="overflow-x-auto pb-1 no-scrollbar">
          <TabsList className="inline-flex h-10 w-full min-w-max justify-start gap-1 rounded-xl bg-muted/80 p-1 text-muted-foreground sm:w-auto">
            {LEADERBOARD_TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="min-h-[36px] gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all data-[state=active]:bg-card data-[state=active]:shadow-xs"
              >
                {tab.label}
                {tab.id !== "overview" && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-2xs">
                    {data[tab.id].length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab view={view} />
        </TabsContent>
        <TabsContent value="batting" className="mt-0">
          <BattingTab view={view} />
        </TabsContent>
        <TabsContent value="bowling" className="mt-0">
          <BowlingTab view={view} />
        </TabsContent>
        <TabsContent value="fielding" className="mt-0">
          <FieldingTab view={view} />
        </TabsContent>
        <TabsContent value="mvp" className="mt-0">
          <MvpTab view={view} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
