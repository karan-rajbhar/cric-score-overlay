"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Flame,
  Target,
  Crown,
  Shield,
  Search,
  Activity,
  Sparkles,
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
  icon: Icon,
  accentColor = "amber",
  title,
  description,
  leader,
  heroValue,
  heroLabel,
  contextStats,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accentColor: "amber" | "purple" | "cyan" | "emerald";
  title: string;
  description: string;
  leader?: { name: string; avatar?: string | null } | null;
  heroValue?: string;
  heroLabel?: string;
  contextStats?: { label: string; value: string }[];
}) {
  const colorMap = {
    amber: {
      border: "border-amber-500/30",
      bg: "from-amber-500/10 via-card to-card",
      iconColor: "text-amber-500",
      heroColor: "text-amber-600 dark:text-amber-400",
      accentDot: "bg-amber-500",
    },
    purple: {
      border: "border-purple-500/30",
      bg: "from-purple-500/10 via-card to-card",
      iconColor: "text-purple-500",
      heroColor: "text-purple-600 dark:text-purple-400",
      accentDot: "bg-purple-500",
    },
    cyan: {
      border: "border-cyan-500/30",
      bg: "from-cyan-500/10 via-card to-card",
      iconColor: "text-cyan-500",
      heroColor: "text-cyan-600 dark:text-cyan-400",
      accentDot: "bg-cyan-500",
    },
    emerald: {
      border: "border-emerald-500/30",
      bg: "from-emerald-500/10 via-card to-card",
      iconColor: "text-emerald-500",
      heroColor: "text-emerald-600 dark:text-emerald-400",
      accentDot: "bg-emerald-500",
    },
  }[accentColor];

  return (
    <div
      className={`rounded-xl border ${colorMap.border} bg-gradient-to-br ${colorMap.bg} p-4 shadow-xs`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Description & Category Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${colorMap.iconColor}`} />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              {title}
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-xl text-balance">
            {description}
          </p>
        </div>

        {/* Right: #1 Leader Spotlight Card */}
        {leader && heroValue && (
          <div className="flex items-center gap-3 self-start sm:self-auto rounded-lg border border-border/60 bg-card/90 p-2.5 sm:min-w-[290px]">
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
                {(leader.name ?? "P")[0]?.toUpperCase()}
              </div>
              <div
                className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ${colorMap.accentDot} text-[9px] font-black text-black`}
              >
                1
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-bold text-foreground">
                  {leader.name}
                </span>
                <span
                  className={`text-sm font-black tabular-nums ${colorMap.heroColor}`}
                >
                  {heroValue}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {heroLabel}
              </div>
              {contextStats && contextStats.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground border-t border-border/40 pt-1">
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
                  ? "bg-card text-foreground shadow-xs"
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
                  ? "bg-card text-foreground shadow-xs"
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
                  ? "bg-card text-foreground shadow-xs"
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
                  ? "bg-card text-foreground shadow-xs"
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
                  ? "bg-card text-foreground shadow-xs"
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
                        <div className="text-2xl font-black tabular-nums text-amber-500">
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
                <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-card to-card">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className="gap-1 bg-purple-600 text-white hover:bg-purple-500">
                        <Target className="h-3 w-3 fill-current" />
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
                            {data.highlights.purpleCap.overs} ov • Avg:{" "}
                            {data.highlights.purpleCap.averageDisplay} • Econ:{" "}
                            {data.highlights.purpleCap.economyDisplay}
                          </div>
                        </div>
                        <div className="text-2xl font-black tabular-nums text-purple-500">
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
                <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-500">
                        <Crown className="h-3 w-3 fill-current" />
                        MVP Leader
                      </Badge>
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        All-Round Impact
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
                          <div className="text-[11px] text-muted-foreground">
                            {data.highlights.mvpLeader.summary}
                          </div>
                        </div>
                        <div className="text-2xl font-black tabular-nums text-emerald-500">
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
                <Card className="border-border/80 bg-card/60">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Most Sixes (Max)
                      </span>
                      <Flame className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <div className="truncate font-bold text-foreground">
                        {data.highlights.mostSixes?.name ?? "—"}
                      </div>
                      <div className="text-xl font-black tabular-nums text-orange-500">
                        {data.highlights.mostSixes?.sixes ?? 0}
                      </div>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {data.highlights.mostSixes
                        ? `${data.highlights.mostSixes.runs} total runs • ${data.highlights.mostSixes.fours} fours`
                        : "No sixes recorded"}
                    </div>
                  </CardContent>
                </Card>

                {/* Highest Individual Score */}
                <Card className="border-border/80 bg-card/60">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Highest Individual Score
                      </span>
                      <Sparkles className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <div className="truncate font-bold text-foreground">
                        {data.highlights.highestScore?.name ?? "—"}
                      </div>
                      <div className="text-xl font-black tabular-nums text-amber-500">
                        {data.highlights.highestScore?.highestScoreDisplay ?? "—"}
                      </div>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {data.highlights.highestScore
                        ? data.highlights.highestScore.highestScoreBalls
                          ? `${data.highlights.highestScore.highestScoreBalls} balls • SR ${data.highlights.highestScore.highestScoreStrikeRateDisplay}`
                          : `${data.highlights.highestScore.runs} total runs in tournament`
                        : "No batting records"}
                    </div>
                  </CardContent>
                </Card>

                {/* Best Bowling Inning */}
                <Card className="border-border/80 bg-card/60">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Best Bowling Figures
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
                              {bw.wickets}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
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
        )}

        {/* 2. BATTING TAB */}
        {activeTab === "batting" && (
          <div className="space-y-4">
            {/* Filter & Sort Chips + Table View Mode Toggle */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
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

              {/* View Toggle: Focused Perspective vs All Columns */}
              {battingSort !== "runs" && (
                <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-border/70 bg-muted/40 p-1">
                  <SlidersHorizontal className="h-3 w-3 text-muted-foreground ml-1" />
                  <button
                    type="button"
                    onClick={() => setBattingTableMode("focused")}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                      battingTableMode === "focused"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Focused Knock View
                  </button>
                  <button
                    type="button"
                    onClick={() => setBattingTableMode("all")}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                      battingTableMode === "all"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All Columns
                  </button>
                </div>
              )}
            </div>

            {/* Active Metric Leader Spotlight Banner */}
            <LeaderSpotlightBanner
              icon={Flame}
              accentColor="amber"
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
                    <Card key={b.userId} className="border-border/80 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                            {(b.name ?? "P")[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-foreground text-sm truncate">
                              {b.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {b.matches} matches • {b.innings} innings
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-base font-black tabular-nums text-amber-600 dark:text-amber-400">
                            {hero.value}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {hero.label}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-2 text-[11px]">
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
                })
              )}
            </div>

            {/* Desktop Table: Focused Knock Perspective for Highest Score */}
            {battingSort === "highestScore" && battingTableMode === "focused" ? (
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2.5 w-10 text-center">#</th>
                          <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                          <th className="px-3 py-2.5 text-center bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold border-x border-amber-500/30">
                            High Score (HS)
                          </th>
                          <th className="px-3 py-2.5 text-center">Balls (Knock)</th>
                          <th className="px-3 py-2.5 text-right">SR (Knock)</th>
                          <th className="px-3 py-2.5 text-center">Knock 4s</th>
                          <th className="px-3 py-2.5 text-center">Knock 6s</th>
                          <th className="px-3 py-2.5 text-center">Innings</th>
                          <th className="px-3 py-2.5 text-right font-bold text-foreground">
                            Total Tournament Runs
                          </th>
                          <th className="px-3 py-2.5 text-right">Overall Avg</th>
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
                            <td className="px-3 py-2 text-center tabular-nums font-black text-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 border-x border-amber-500/20">
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
                      <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2.5 w-10 text-center">#</th>
                          <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                          <th className="px-2.5 py-2.5 text-center">Mat</th>
                          <th className="px-2.5 py-2.5 text-center">Inn</th>
                          <th className="px-2.5 py-2.5 text-center">NO</th>
                          <th
                            className={`px-3 py-2.5 text-right transition-colors ${
                              battingSort === "runs"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold border-x border-amber-500/30"
                                : "font-bold text-foreground"
                            }`}
                          >
                            Runs
                          </th>
                          <th
                            className={`px-2.5 py-2.5 text-center transition-colors ${
                              battingSort === "highestScore"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold border-x border-amber-500/30"
                                : ""
                            }`}
                          >
                            HS
                          </th>
                          <th
                            className={`px-2.5 py-2.5 text-right transition-colors ${
                              battingSort === "average"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold border-x border-amber-500/30"
                                : ""
                            }`}
                          >
                            Avg
                          </th>
                          <th
                            className={`px-2.5 py-2.5 text-right transition-colors ${
                              battingSort === "balls"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold border-x border-amber-500/30"
                                : ""
                            }`}
                          >
                            BF
                          </th>
                          <th
                            className={`px-2.5 py-2.5 text-right transition-colors ${
                              battingSort === "strikeRate"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold border-x border-amber-500/30"
                                : ""
                            }`}
                          >
                            SR
                          </th>
                          <th
                            className={`px-2 py-2.5 text-center transition-colors ${
                              battingSort === "centuries"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold border-x border-amber-500/30"
                                : ""
                            }`}
                          >
                            100
                          </th>
                          <th
                            className={`px-2 py-2.5 text-center transition-colors ${
                              battingSort === "fifties"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold border-x border-amber-500/30"
                                : ""
                            }`}
                          >
                            50
                          </th>
                          <th
                            className={`px-2 py-2.5 text-center transition-colors ${
                              battingSort === "fours"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold border-x border-amber-500/30"
                                : ""
                            }`}
                          >
                            4s
                          </th>
                          <th
                            className={`px-2 py-2.5 text-center transition-colors ${
                              battingSort === "sixes"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold border-x border-amber-500/30"
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
                              <td
                                className={`px-3 py-2 text-right tabular-nums font-black text-sm ${
                                  battingSort === "runs"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-x border-amber-500/20"
                                    : "text-foreground"
                                }`}
                              >
                                {b.runs}
                              </td>
                              <td
                                className={`px-2.5 py-2 text-center tabular-nums font-semibold ${
                                  battingSort === "highestScore"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-x border-amber-500/20"
                                    : ""
                                }`}
                              >
                                {b.highestScoreDisplay}
                              </td>
                              <td
                                className={`px-2.5 py-2 text-right tabular-nums ${
                                  battingSort === "average"
                                    ? "bg-amber-500/10 font-bold text-foreground border-x border-amber-500/20"
                                    : ""
                                }`}
                              >
                                {b.averageDisplay}
                              </td>
                              <td
                                className={`px-2.5 py-2 text-right tabular-nums ${
                                  battingSort === "balls"
                                    ? "bg-amber-500/10 font-bold text-foreground border-x border-amber-500/20"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {b.balls}
                              </td>
                              <td
                                className={`px-2.5 py-2 text-right tabular-nums ${
                                  battingSort === "strikeRate"
                                    ? "bg-amber-500/10 font-bold text-foreground border-x border-amber-500/20"
                                    : "font-medium"
                                }`}
                              >
                                {b.strikeRateDisplay}
                              </td>
                              <td
                                className={`px-2 py-2 text-center tabular-nums ${
                                  battingSort === "centuries"
                                    ? "bg-amber-500/10 font-black text-amber-600 dark:text-amber-400 border-x border-amber-500/20"
                                    : "font-semibold text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {b.centuries}
                              </td>
                              <td
                                className={`px-2 py-2 text-center tabular-nums ${
                                  battingSort === "fifties"
                                    ? "bg-amber-500/10 font-black text-blue-600 dark:text-blue-400 border-x border-amber-500/20"
                                    : "font-semibold text-blue-600 dark:text-blue-400"
                                }`}
                              >
                                {b.fifties}
                              </td>
                              <td
                                className={`px-2 py-2 text-center tabular-nums ${
                                  battingSort === "fours"
                                    ? "bg-amber-500/10 font-bold text-foreground border-x border-amber-500/20"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {b.fours}
                              </td>
                              <td
                                className={`px-2 py-2 text-center tabular-nums ${
                                  battingSort === "sixes"
                                    ? "bg-amber-500/10 font-bold text-foreground border-x border-amber-500/20"
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
        )}

        {/* 3. BOWLING TAB */}
        {activeTab === "bowling" && (
          <div className="space-y-4">
            {/* Filter & Sort Chips + Table View Mode Toggle */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
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

              {/* View Toggle for Bowling */}
              {bowlingSort === "bestBowling" && (
                <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-border/70 bg-muted/40 p-1">
                  <SlidersHorizontal className="h-3 w-3 text-muted-foreground ml-1" />
                  <button
                    type="button"
                    onClick={() => setBowlingTableMode("focused")}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                      bowlingTableMode === "focused"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Focused Spell View
                  </button>
                  <button
                    type="button"
                    onClick={() => setBowlingTableMode("all")}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                      bowlingTableMode === "all"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All Columns
                  </button>
                </div>
              )}
            </div>

            {/* Active Metric Leader Spotlight Banner */}
            <LeaderSpotlightBanner
              icon={Target}
              accentColor="purple"
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
                    <Card key={bw.userId} className="border-border/80 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                            {(bw.name ?? "B")[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-foreground text-sm truncate">
                              {bw.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {bw.matches} matches • {bw.innings} innings
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-base font-black tabular-nums text-purple-600 dark:text-purple-400">
                            {hero.value}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {hero.label}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-2 text-[11px]">
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
                })
              )}
            </div>

            {/* Desktop Table: Focused Spell View for Best Bowling (BBI) */}
            {bowlingSort === "bestBowling" && bowlingTableMode === "focused" ? (
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2.5 w-10 text-center">#</th>
                          <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                          <th className="px-3 py-2.5 text-center bg-purple-500/15 text-purple-600 dark:text-purple-400 font-extrabold border-x border-purple-500/30">
                            Best Figures (BBI)
                          </th>
                          <th className="px-3 py-2.5 text-center">Overs in Spell</th>
                          <th className="px-3 py-2.5 text-right">Spell Economy</th>
                          <th className="px-3 py-2.5 text-right font-bold text-foreground">
                            Total Tournament Wkts
                          </th>
                          <th className="px-3 py-2.5 text-center">Total Overs</th>
                          <th className="px-3 py-2.5 text-right">Overall Econ</th>
                          <th className="px-3 py-2.5 text-right">Bowling Avg</th>
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
                            <td className="px-3 py-2 text-center tabular-nums font-black text-sm bg-purple-500/10 text-purple-600 dark:text-purple-400 border-x border-purple-500/20">
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
                      <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2.5 w-10 text-center">#</th>
                          <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                          <th className="px-2.5 py-2.5 text-center">Mat</th>
                          <th className="px-2.5 py-2.5 text-center">Inn</th>
                          <th className="px-2.5 py-2.5 text-center">Overs</th>
                          <th
                            className={`px-2.5 py-2.5 text-center transition-colors ${
                              bowlingSort === "balls"
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 font-extrabold border-x border-purple-500/30"
                                : ""
                            }`}
                          >
                            Balls
                          </th>
                          <th
                            className={`px-2.5 py-2.5 text-center transition-colors ${
                              bowlingSort === "maidens"
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 font-extrabold border-x border-purple-500/30"
                                : ""
                            }`}
                          >
                            Mdns
                          </th>
                          <th className="px-2.5 py-2.5 text-right">Runs</th>
                          <th
                            className={`px-3 py-2.5 text-right transition-colors ${
                              bowlingSort === "wickets"
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 font-extrabold border-x border-purple-500/30"
                                : "font-bold text-foreground"
                            }`}
                          >
                            Wkts
                          </th>
                          <th
                            className={`px-2.5 py-2.5 text-center transition-colors ${
                              bowlingSort === "bestBowling"
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 font-extrabold border-x border-purple-500/30"
                                : ""
                            }`}
                          >
                            BBI
                          </th>
                          <th
                            className={`px-2.5 py-2.5 text-right transition-colors ${
                              bowlingSort === "average"
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 font-extrabold border-x border-purple-500/30"
                                : ""
                            }`}
                          >
                            Avg
                          </th>
                          <th
                            className={`px-2.5 py-2.5 text-right transition-colors ${
                              bowlingSort === "economy"
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 font-extrabold border-x border-purple-500/30"
                                : ""
                            }`}
                          >
                            Econ
                          </th>
                          <th
                            className={`px-2 py-2.5 text-center transition-colors ${
                              bowlingSort === "threeWickets"
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 font-extrabold border-x border-purple-500/30"
                                : ""
                            }`}
                          >
                            3w
                          </th>
                          <th
                            className={`px-2 py-2.5 text-center transition-colors ${
                              bowlingSort === "fiveWickets"
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 font-extrabold border-x border-purple-500/30"
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
                              <td
                                className={`px-2.5 py-2 text-center tabular-nums ${
                                  bowlingSort === "balls"
                                    ? "bg-purple-500/10 font-bold text-foreground border-x border-purple-500/20"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {bw.balls}
                              </td>
                              <td
                                className={`px-2.5 py-2 text-center tabular-nums ${
                                  bowlingSort === "maidens"
                                    ? "bg-purple-500/10 font-bold text-foreground border-x border-purple-500/20"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {bw.maidens}
                              </td>
                              <td className="px-2.5 py-2 text-right tabular-nums text-muted-foreground">
                                {bw.runsConceded}
                              </td>
                              <td
                                className={`px-3 py-2 text-right tabular-nums font-black text-sm ${
                                  bowlingSort === "wickets"
                                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-x border-purple-500/20"
                                    : "text-foreground"
                                }`}
                              >
                                {bw.wickets}
                              </td>
                              <td
                                className={`px-2.5 py-2 text-center tabular-nums font-semibold ${
                                  bowlingSort === "bestBowling"
                                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-x border-purple-500/20"
                                    : "text-purple-600 dark:text-purple-400"
                                }`}
                              >
                                {bw.bestBowling.display}
                              </td>
                              <td
                                className={`px-2.5 py-2 text-right tabular-nums ${
                                  bowlingSort === "average"
                                    ? "bg-purple-500/10 font-bold text-foreground border-x border-purple-500/20"
                                    : ""
                                }`}
                              >
                                {bw.averageDisplay}
                              </td>
                              <td
                                className={`px-2.5 py-2 text-right tabular-nums ${
                                  bowlingSort === "economy"
                                    ? "bg-purple-500/10 font-bold text-foreground border-x border-purple-500/20"
                                    : "font-medium"
                                }`}
                              >
                                {bw.economyDisplay}
                              </td>
                              <td
                                className={`px-2 py-2 text-center tabular-nums ${
                                  bowlingSort === "threeWickets"
                                    ? "bg-purple-500/10 font-bold text-foreground border-x border-purple-500/20"
                                    : "font-semibold text-muted-foreground"
                                }`}
                              >
                                {bw.threeWickets}
                              </td>
                              <td
                                className={`px-2 py-2 text-center tabular-nums ${
                                  bowlingSort === "fiveWickets"
                                    ? "bg-purple-500/10 font-bold text-purple-600 dark:text-purple-400 border-x border-purple-500/20"
                                    : "font-semibold text-purple-500"
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

            {/* Active Metric Leader Spotlight Banner */}
            <LeaderSpotlightBanner
              icon={Shield}
              accentColor="cyan"
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
                    <Card key={f.userId} className="border-border/80 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                            {(f.name ?? "F")[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-foreground text-sm truncate">
                              {f.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {f.matches} matches
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-base font-black tabular-nums text-cyan-600 dark:text-cyan-400">
                            {hero.value}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {hero.label}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-2 text-[11px]">
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
                })
              )}
            </div>

            {/* Full Fielding Table for Desktop (>= md) */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">#</th>
                        <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                        <th className="px-3 py-2.5 text-center">Matches</th>
                        <th
                          className={`px-3 py-2.5 text-right transition-colors ${
                            fieldingSort === "totalDismissals"
                              ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-extrabold border-x border-cyan-500/30"
                              : "font-bold text-foreground"
                          }`}
                        >
                          Total Dismissals
                        </th>
                        <th
                          className={`px-3 py-2.5 text-center transition-colors ${
                            fieldingSort === "catches"
                              ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-extrabold border-x border-cyan-500/30"
                              : ""
                          }`}
                        >
                          Catches (Ct)
                        </th>
                        <th
                          className={`px-3 py-2.5 text-center transition-colors ${
                            fieldingSort === "stumpings"
                              ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-extrabold border-x border-cyan-500/30"
                              : ""
                          }`}
                        >
                          Stumpings (St)
                        </th>
                        <th
                          className={`px-3 py-2.5 text-center transition-colors ${
                            fieldingSort === "runOuts"
                              ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-extrabold border-x border-cyan-500/30"
                              : ""
                          }`}
                        >
                          Run Outs (RO)
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
                            <td
                              className={`px-3 py-2 text-right tabular-nums font-black text-sm ${
                                fieldingSort === "totalDismissals"
                                  ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-x border-cyan-500/20"
                                  : "text-cyan-600 dark:text-cyan-400"
                              }`}
                            >
                              {f.totalDismissals}
                            </td>
                            <td
                              className={`px-3 py-2 text-center tabular-nums font-semibold ${
                                fieldingSort === "catches"
                                  ? "bg-cyan-500/10 text-foreground border-x border-cyan-500/20"
                                  : ""
                              }`}
                            >
                              {f.catches}
                            </td>
                            <td
                              className={`px-3 py-2 text-center tabular-nums font-semibold ${
                                fieldingSort === "stumpings"
                                  ? "bg-cyan-500/10 text-purple-600 dark:text-purple-400 border-x border-cyan-500/20"
                                  : "text-purple-600 dark:text-purple-400"
                              }`}
                            >
                              {f.stumpings}
                            </td>
                            <td
                              className={`px-3 py-2 text-center tabular-nums font-semibold ${
                                fieldingSort === "runOuts"
                                  ? "bg-cyan-500/10 text-amber-600 dark:text-amber-400 border-x border-cyan-500/20"
                                  : "text-amber-600 dark:text-amber-400"
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

            {/* Active Metric Leader Spotlight Banner */}
            <LeaderSpotlightBanner
              icon={Crown}
              accentColor="emerald"
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
                    <Card key={m.userId} className="border-border/80 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                            {idx === 0 ? "👑" : idx + 1}
                          </span>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                            {(m.name ?? "P")[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-foreground text-sm truncate">
                              {m.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {m.summary}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-base font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                            {hero.value}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {hero.label}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-2 text-[11px]">
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
                })
              )}
            </div>

            {/* Full MVP Table for Desktop (>= md) */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">#</th>
                        <th className="px-3 py-2.5 min-w-[150px]">Player</th>
                        <th className="px-3 py-2.5 text-center">Matches</th>
                        <th
                          className={`px-3 py-2.5 text-right transition-colors ${
                            mvpSort === "totalPoints"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold border-x border-emerald-500/30"
                              : "font-bold text-foreground"
                          }`}
                        >
                          Total Points
                        </th>
                        <th
                          className={`px-3 py-2.5 text-center transition-colors ${
                            mvpSort === "battingPoints"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold border-x border-emerald-500/30"
                              : ""
                          }`}
                        >
                          Bat Pts
                        </th>
                        <th
                          className={`px-3 py-2.5 text-center transition-colors ${
                            mvpSort === "bowlingPoints"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold border-x border-emerald-500/30"
                              : ""
                          }`}
                        >
                          Bowl Pts
                        </th>
                        <th
                          className={`px-3 py-2.5 text-center transition-colors ${
                            mvpSort === "fieldingPoints"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold border-x border-emerald-500/30"
                              : ""
                          }`}
                        >
                          Field Pts
                        </th>
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
                            <td
                              className={`px-3 py-2 text-right tabular-nums font-black text-sm ${
                                mvpSort === "totalPoints"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-x border-emerald-500/20"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {m.totalPoints}
                            </td>
                            <td
                              className={`px-3 py-2 text-center tabular-nums ${
                                mvpSort === "battingPoints"
                                  ? "bg-emerald-500/10 font-bold text-amber-600 dark:text-amber-400 border-x border-emerald-500/20"
                                  : "font-medium text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {m.battingPoints}
                            </td>
                            <td
                              className={`px-3 py-2 text-center tabular-nums ${
                                mvpSort === "bowlingPoints"
                                  ? "bg-emerald-500/10 font-bold text-purple-600 dark:text-purple-400 border-x border-purple-500/20"
                                  : "font-medium text-purple-600 dark:text-purple-400"
                              }`}
                            >
                              {m.bowlingPoints}
                            </td>
                            <td
                              className={`px-3 py-2 text-center tabular-nums ${
                                mvpSort === "fieldingPoints"
                                  ? "bg-emerald-500/10 font-bold text-cyan-600 dark:text-cyan-400 border-x border-emerald-500/20"
                                  : "font-medium text-cyan-600 dark:text-cyan-400"
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
        )}
      </div>
    </div>
  );
}
