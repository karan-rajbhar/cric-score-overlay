"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import {
  Sparkles,
  Layers,
  List,
  Flame,
  Info,
} from "lucide-react";
import type { Match } from "~/lib/match-types";
import {
  calculateSuperstars,
  type SuperstarPlayer,
  type SuperstarRole,
} from "~/lib/cricket";
import Image from "next/image";
import { cn } from "~/lib/utils";

interface MatchSuperstarsProps {
  match: Match;
}

function RoleBadge({ role }: { role: SuperstarRole }) {
  switch (role) {
    case "WK":
      return (
        <Badge
          variant="outline"
          className="border-sky-500/40 bg-sky-500/15 text-[10px] font-bold text-sky-700 dark:text-sky-300"
        >
          WK
        </Badge>
      );
    case "BAT":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/15 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
        >
          BAT
        </Badge>
      );
    case "AR":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/15 text-[10px] font-bold text-amber-700 dark:text-amber-300"
        >
          AR
        </Badge>
      );
    case "BOWL":
      return (
        <Badge
          variant="outline"
          className="border-purple-500/40 bg-purple-500/15 text-[10px] font-bold text-purple-700 dark:text-purple-300"
        >
          BOWL
        </Badge>
      );
  }
}

/**
 * Realistic Vector Cricket Jersey matching the reference Stumps screenshot
 */
function CricketJerseySvg({
  isTeam1 = true,
  number = 1,
}: {
  isTeam1?: boolean;
  number?: number;
}) {
  const gradientId = isTeam1 ? "jerseyRedGrad" : "jerseyBlueGrad";
  const trimColor = isTeam1 ? "#7f1d1d" : "#1e3a8a";

  return (
    <svg
      viewBox="0 0 100 105"
      className="h-14 w-14 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)] transition-transform duration-200 group-hover:scale-110 sm:h-16 sm:w-16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Red Jersey Gradient for Team 1 */}
        <linearGradient id="jerseyRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="35%" stopColor="#b91c1c" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>

        {/* Blue Jersey Gradient for Team 2 */}
        <linearGradient
          id="jerseyBlueGrad"
          x1="0%" y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="35%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>

        {/* Fabric Folds Shadow Overlay */}
        <linearGradient id="fabricFolds" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.25" />
          <stop offset="25%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#000000" stopOpacity="0.15" />
          <stop offset="75%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Jersey Body & Sleeves */}
      <path
        d="M 28 16 L 8 36 L 22 46 L 28 38 L 28 98 L 72 98 L 72 38 L 78 46 L 92 36 L 72 16 L 58 16 C 56 26 44 26 42 16 Z"
        fill={`url(#${gradientId})`}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.2"
      />

      {/* Vertical Fabric Texture Folds */}
      <path
        d="M 28 38 L 28 98 L 72 98 L 72 38 Z"
        fill="url(#fabricFolds)"
      />

      {/* Sleeve Hem Left */}
      <path
        d="M 8 36 L 15 42 L 22 46 L 15 40 Z"
        fill={trimColor}
        opacity="0.8"
      />
      {/* Sleeve Hem Right */}
      <path
        d="M 92 36 L 85 42 L 78 46 L 85 40 Z"
        fill={trimColor}
        opacity="0.8"
      />

      {/* Collar Detail */}
      <path
        d="M 42 16 C 44 26 56 26 58 16 L 62 16 C 60 29 40 29 38 16 Z"
        fill="#0f172a"
        opacity="0.6"
      />

      {/* Jersey Number on Chest */}
      <text
        x="50"
        y="66"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize="24"
        fontWeight="900"
        letterSpacing="0.5"
        className="font-sans select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
      >
        {number}
      </text>
    </svg>
  );
}

/**
 * Player Pitch Card Node matching the Stumps Superstars reference screenshot
 */
function SuperstarPlayerNode({
  player,
  isTeam1,
  jerseyNumber,
  onClick,
}: {
  player: SuperstarPlayer;
  isTeam1: boolean;
  jerseyNumber: number;
  onClick: () => void;
}) {
  // Impact rating formatted to 1 decimal place (e.g. 12.6, 9.2, 4.0)
  const rating = (player.totalPoints / 10).toFixed(1);
  const isTopRanked = player.rank === 1;

  // Milestone badge calculation (e.g. 50 runs, 100 runs, 3w wickets, 2c catches)
  const milestone = useMemo(() => {
    if (player.stats.runs >= 100) return "100";
    if (player.stats.runs >= 50) return "50";
    if (player.stats.wickets >= 3) return `${player.stats.wickets}w`;
    if (player.stats.catches >= 2) return `${player.stats.catches}c`;
    if (player.stats.runs >= 30) return `${player.stats.runs}`;
    return null;
  }, [player.stats]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-center text-center cursor-pointer focus:outline-none transition-transform active:scale-95"
      title={`Click to view ${player.playerName} points breakdown`}
    >
      {/* Jersey with floating badges */}
      <div className="relative">
        <CricketJerseySvg
          isTeam1={isTeam1}
          number={jerseyNumber}
        />

        {/* Top-Left Rating Pill (Green badge with gold star ⭐ for #1) */}
        <div className="absolute -left-3 -top-1 z-10 flex items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10.5px] font-black text-white shadow-md ring-1 ring-white/30">
          <span>{rating}</span>
          {isTopRanked && (
            <span className="text-yellow-300 text-[11px] leading-none">⭐</span>
          )}
        </div>

        {/* Top-Right Key Milestone Badge (e.g. 50 runs, 3w wickets) */}
        {milestone && (
          <div
            title={`Milestone: ${milestone}`}
            className="absolute -right-2 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-300 px-1 text-[9.5px] font-black text-slate-900 shadow-md ring-1 ring-white/40"
          >
            {milestone}
          </div>
        )}
      </div>

      {/* Player Name Glassmorphism Tag */}
      <div className="mt-1 flex max-w-[95px] items-center justify-center rounded-lg bg-black/45 px-2 py-0.5 text-white shadow-md backdrop-blur-sm border border-white/10 sm:max-w-[115px]">
        <span className="truncate text-[10.5px] font-semibold tracking-tight sm:text-[11.5px]">
          {player.playerName}
        </span>
      </div>
    </button>
  );
}

/**
 * Points Breakdown & Rules Modal
 */
function SuperstarPointsDialog({
  player,
  open,
  onOpenChange,
}: {
  player: SuperstarPlayer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!player) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            {player.avatarUrl ? (
              <Image
                src={player.avatarUrl}
                alt={player.playerName}
                width={44}
                height={44}
                className="h-11 w-11 rounded-full object-cover border-2 border-primary"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 font-black text-primary">
                {player.playerName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <span>{player.playerName}</span>
                <RoleBadge role={player.role} />
                {player.isCaptain && (
                  <Badge className="bg-red-600 text-white font-black text-[10px]">
                    C (2X)
                  </Badge>
                )}
                {player.isViceCaptain && (
                  <Badge className="bg-slate-800 text-white font-black text-[10px]">
                    VC (1.5X)
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {player.teamName} • Rank #{player.rank} in Superstar 11
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Points Highlight Banner */}
          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-950 dark:text-amber-100">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Superstar Impact Rating
                </p>
                <p className="text-xl font-black text-foreground">
                  {(player.totalPoints / 10).toFixed(1)}{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    ({player.totalPoints} pts)
                  </span>
                </p>
              </div>
            </div>
            {player.isCaptain && (
              <span className="rounded-lg bg-red-600/90 px-2 py-1 text-xs font-black text-white">
                Captain Multiplier: 2X
              </span>
            )}
            {player.isViceCaptain && (
              <span className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-black text-white">
                Vice-Captain Multiplier: 1.5X
              </span>
            )}
          </div>

          {/* Breakdown Table */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Performance Breakdown
            </h4>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="flex items-center gap-1.5 font-medium">
                  🏏 Batting Points
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {player.stats.runs}r ({player.stats.balls}b) • {player.stats.fours}x4 • {player.stats.sixes}x6
                  </span>
                  <span className="font-bold tabular text-primary">
                    +{player.breakdown.batting} pts
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="flex items-center gap-1.5 font-medium">
                  🎯 Bowling Points
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {player.stats.wickets}w • {player.stats.overs}ov ({player.stats.runsConceded}r)
                  </span>
                  <span className="font-bold tabular text-primary">
                    +{player.breakdown.bowling} pts
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-1.5 font-medium">
                  🧤 Fielding & Dismissals
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {player.stats.catches} catches • {player.stats.stumpings} stumpings • {player.stats.runOuts} run outs
                  </span>
                  <span className="font-bold tabular text-primary">
                    +{player.breakdown.fielding} pts
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-100 p-3 text-[11px] text-muted-foreground dark:bg-slate-900 border border-border/60">
            Points and ratings calculated dynamically using international cricket fantasy and match impact standards.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Scoring Rules Info Dialog
 */
function SuperstarInfoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Superstar 11 Impact System
          </DialogTitle>
          <DialogDescription className="text-xs">
            How player impact ratings are calculated across both teams
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2 text-xs text-muted-foreground">
          <div className="rounded-xl border border-border/70 p-3 space-y-1.5">
            <p className="font-bold text-foreground">🏏 Batting Points</p>
            <p>• 1 Point per Run scored</p>
            <p>• +1 Bonus point per Boundary (4s)</p>
            <p>• +2 Bonus points per Maximum (6s)</p>
            <p>• +8 Bonus for 30+ runs, +16 for 50+ Half-Century, +32 for Century</p>
          </div>

          <div className="rounded-xl border border-border/70 p-3 space-y-1.5">
            <p className="font-bold text-foreground">🎯 Bowling Points</p>
            <p>• 25 Points per Wicket taken (excluding run-outs)</p>
            <p>• 12 Points per Maiden Over</p>
            <p>• +4 Bonus for 3-Wicket haul, +8 for 4-Wicket haul, +16 for 5-Wicket haul</p>
            <p>• Economy rate bonus for disciplined spells</p>
          </div>

          <div className="rounded-xl border border-border/70 p-3 space-y-1.5">
            <p className="font-bold text-foreground">🧤 Fielding Points</p>
            <p>• 8 Points per Catch</p>
            <p>• 12 Points per Stumping / Direct Hit Run-out</p>
          </div>

          <div className="rounded-xl border border-border/70 p-3 space-y-1.5">
            <p className="font-bold text-foreground">⭐ Star Multipliers</p>
            <p>• Captain (Top Performer): 2X Points</p>
            <p>• Vice-Captain (2nd Top Performer): 1.5X Points</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MatchSuperstars({ match }: MatchSuperstarsProps) {
  const [viewMode, setViewMode] = useState<"pitch" | "list">("pitch");
  const [selectedPlayer, setSelectedPlayer] = useState<SuperstarPlayer | null>(
    null,
  );
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [teamFilter, setTeamFilter] = useState<"all" | "team1" | "team2">(
    "all",
  );

  const superstarData = useMemo(() => {
    return calculateSuperstars(match);
  }, [match]);

  const {
    superstars,
    totalPoints,
  } = superstarData;

  // Filtered superstars based on selected team filter
  const displayedSuperstars = useMemo(() => {
    if (teamFilter === "team1") {
      return superstars.filter((p) => p.teamId === match.team1_id);
    }
    if (teamFilter === "team2") {
      return superstars.filter((p) => p.teamId === match.team2_id);
    }
    return superstars;
  }, [superstars, teamFilter, match.team1_id, match.team2_id]);

  // Arrange players into standard visual cricket formations:
  // Row 1: Wicketkeeper / Opener (1 player)
  // Row 2: Top Batters (2 players)
  // Row 3: Middle Order / All-rounders (3 players)
  // Row 4: Bowlers (2-3 players)
  // Row 5: Tailenders / Bowlers (remaining)
  const formationRows = useMemo(() => {
    const list = displayedSuperstars;
    if (list.length === 0) return [];
    if (list.length <= 4) {
      return [list];
    }
    const r1 = list.slice(0, 1);
    const r2 = list.slice(1, 3);
    const r3 = list.slice(3, 6);
    const r4 = list.slice(6, 8);
    const r5 = list.slice(8, 11);
    return [r1, r2, r3, r4, r5].filter((r) => r.length > 0);
  }, [displayedSuperstars]);

  if (superstars.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold">Superstars XI</h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground sm:text-sm">
            Superstars XI will be automatically generated once match action
            begins and player performances are recorded.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top Header & Team Filter Bar matching Stumps screenshot */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Team Filter Pills */}
        <div className="flex items-center overflow-hidden rounded-xl border border-border/80 bg-slate-900/90 p-1 shadow-sm w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setTeamFilter("all")}
            className={cn(
              "flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-all text-center",
              teamFilter === "all"
                ? "bg-[#3e7250] text-white shadow-sm"
                : "text-slate-300 hover:text-white",
            )}
          >
            All Players
          </button>
          <button
            type="button"
            onClick={() => setTeamFilter("team1")}
            className={cn(
              "flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 text-center",
              teamFilter === "team1"
                ? "bg-slate-800 text-white shadow-sm ring-1 ring-red-500/50"
                : "text-slate-300 hover:text-white",
            )}
          >
            <span className="w-1 h-3.5 bg-red-600 rounded-full inline-block" />
            <span className="truncate uppercase">{match.team1.name}</span>
          </button>
          <button
            type="button"
            onClick={() => setTeamFilter("team2")}
            className={cn(
              "flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 text-center",
              teamFilter === "team2"
                ? "bg-slate-800 text-white shadow-sm ring-1 ring-blue-500/50"
                : "text-slate-300 hover:text-white",
            )}
          >
            <span className="w-1 h-3.5 bg-blue-600 rounded-full inline-block" />
            <span className="truncate uppercase">{match.team2.name}</span>
          </button>
        </div>

        {/* View Switcher & Title */}
        <div className="flex items-center justify-between sm:justify-end gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground sm:inline hidden">
              Superstar 11
            </span>
            <Badge variant="outline" className="text-[11px] font-bold">
              {superstars.length} / 11 Players
            </Badge>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-slate-900 p-1">
            <Button
              variant={viewMode === "pitch" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("pitch")}
              className="h-7 gap-1 px-2.5 text-xs font-bold text-white hover:text-white"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Pitch</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-7 gap-1 px-2.5 text-xs font-bold text-white hover:text-white"
            >
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Pitch View: Stumps-style Cricket Ground Field */}
      {viewMode === "pitch" ? (
        <Card className="overflow-hidden border-border/80 shadow-xl">
          <div className="relative min-h-[640px] sm:min-h-[700px] w-full overflow-hidden bg-[radial-gradient(ellipse_at_center,#2f855a_0%,#276749_65%,#1c4532_100%)] p-4 sm:p-6">
            {/* Info Icon Button (top-right of grass) */}
            <button
              type="button"
              onClick={() => setIsInfoOpen(true)}
              className="absolute right-4 top-4 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white focus:outline-none"
              title="Superstar 11 Points Rules"
              aria-label="Superstar 11 Points Rules"
            >
              <Info className="h-4 w-4" />
            </button>

            {/* Stadium Curved Boundary Line */}
            <div className="pointer-events-none absolute inset-3 sm:inset-5 rounded-[48px] sm:rounded-[64px] border-2 border-dashed border-white/25" />

            {/* 30-Yard Inner Circle Line */}
            <div className="pointer-events-none absolute inset-10 sm:inset-14 rounded-[50%] border border-white/15" />

            {/* Center Beige Pitch Rectangle */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-16 -translate-x-1/2 -translate-y-1/2 rounded border border-amber-900/30 bg-[#c2ad82]/70 shadow-inner backdrop-blur-[1px]">
              {/* Bowling Crease Lines */}
              <div className="absolute top-6 left-1 right-1 h-[1.5px] bg-white/80" />
              <div className="absolute bottom-6 left-1 right-1 h-[1.5px] bg-white/80" />

              {/* Stumps */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-0.5">
                <div className="h-1.5 w-1 rounded-full bg-red-600" />
                <div className="h-1.5 w-1 rounded-full bg-red-600" />
                <div className="h-1.5 w-1 rounded-full bg-red-600" />
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-0.5">
                <div className="h-1.5 w-1 rounded-full bg-red-600" />
                <div className="h-1.5 w-1 rounded-full bg-red-600" />
                <div className="h-1.5 w-1 rounded-full bg-red-600" />
              </div>
            </div>

            {/* Field Players Formations (5 Distinct Rows) */}
            <div className="relative z-10 flex h-full flex-col justify-between space-y-6 sm:space-y-8 py-2">
              {formationRows.map((rowPlayers, rowIndex) => (
                <div
                  key={`row-${rowIndex}`}
                  className="flex items-center justify-center gap-4 sm:gap-10 flex-wrap"
                >
                  {rowPlayers.map((player) => {
                    const isTeam1 = player.teamId === match.team1_id;
                    // Realistic jersey number derived from batting position or rank
                    const jerseyNum =
                      player.rank * 7 + (isTeam1 ? 13 : 2) % 99 || player.rank;

                    return (
                      <SuperstarPlayerNode
                        key={player.playerId}
                        player={player}
                        isTeam1={isTeam1}
                        jerseyNumber={jerseyNum}
                        onClick={() => setSelectedPlayer(player)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        /* List View (Detailed Superstar 11 Performance Table) */
        <div className="space-y-2.5">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-sm font-bold">
              Superstars Performance Rankings
            </span>
            <span className="text-xs text-muted-foreground">
              Total Points: {totalPoints} PTS
            </span>
          </div>

          <div className="grid gap-2">
            {displayedSuperstars.map((player) => {
              const isTeam1 = player.teamId === match.team1_id;
              const rating = (player.totalPoints / 10).toFixed(1);

              return (
                <div
                  key={player.playerId}
                  onClick={() => setSelectedPlayer(player)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-border/70 bg-card p-3 transition-all hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white",
                        player.rank === 1
                          ? "bg-amber-500"
                          : player.rank === 2
                            ? "bg-slate-500"
                            : player.rank === 3
                              ? "bg-amber-700"
                              : "bg-muted text-muted-foreground font-bold",
                      )}
                    >
                      {player.rank}
                    </span>

                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          isTeam1 ? "bg-red-600" : "bg-blue-600",
                        )}
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm">
                          <span>{player.playerName}</span>
                          <RoleBadge role={player.role} />
                          {player.isCaptain && (
                            <span className="rounded bg-red-600 px-1 py-0.2 text-[9px] font-black text-white">
                              C (2X)
                            </span>
                          )}
                          {player.isViceCaptain && (
                            <span className="rounded bg-slate-800 px-1 py-0.2 text-[9px] font-black text-white">
                              VC (1.5X)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {player.teamName} • {player.stats.runs} runs (
                          {player.stats.balls}b) • {player.stats.wickets} wkts
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end font-black text-sm text-foreground">
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">
                        {rating} {player.rank === 1 && "⭐"}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {player.totalPoints} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Player Points Breakdown Dialog */}
      <SuperstarPointsDialog
        player={selectedPlayer}
        open={!!selectedPlayer}
        onOpenChange={(open) => !open && setSelectedPlayer(null)}
      />

      {/* Rules Info Dialog */}
      <SuperstarInfoDialog
        open={isInfoOpen}
        onOpenChange={setIsInfoOpen}
      />
    </div>
  );
}
