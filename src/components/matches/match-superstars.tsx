"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
  Crown,
  Star,
  Layers,
  List,
  Flame,
} from "lucide-react";
import type { Match } from "~/lib/match-types";
import {
  calculateSuperstars,
  type SuperstarPlayer,
  type SuperstarRole,
} from "~/lib/cricket";
import Image from "next/image";

interface MatchSuperstarsProps {
  match: Match;
}

function formatDream11Name(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  const firstName = parts[0];
  const rest = parts.slice(1).join(" ");
  return `${firstName?.[0]?.toUpperCase() || ""}. ${rest}`;
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
 * Dream11 Signature Vector Cricket Jersey
 */
function Dream11JerseySvg({
  primaryColor = "#1e40af",
  secondaryColor = "#3b82f6",
  accentColor = "#fbbf24",
  teamCode = "T1",
  number,
}: {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  teamCode?: string;
  number?: number;
}) {
  return (
    <svg
      viewBox="0 0 100 86"
      className="h-10 w-11 drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)] transition-transform group-hover:scale-110 sm:h-12 sm:w-13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main Jersey Body */}
      <path
        d="M26 14 L12 32 L23 41 L29 32 L29 80 L71 80 L71 32 L77 41 L88 32 L74 14 L59 14 C57 23 43 23 41 14 Z"
        fill={primaryColor}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5"
      />
      {/* Sleeve Trim Left */}
      <path d="M12 32 L19 37 L22 33 L16 28 Z" fill={secondaryColor} />
      {/* Sleeve Trim Right */}
      <path d="M88 32 L81 37 L78 33 L84 28 Z" fill={secondaryColor} />
      {/* Collar Accent */}
      <path
        d="M41 14 C43 23 57 23 59 14 L65 14 C63 27 37 27 35 14 Z"
        fill={accentColor}
      />
      {/* Center Side Panel */}
      <path
        d="M47 28 L53 28 L53 78 L47 78 Z"
        fill={secondaryColor}
        opacity="0.6"
      />
      {/* Team Code on Chest */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="13"
        fontWeight="900"
        letterSpacing="0.5"
      >
        {teamCode}
      </text>
      {number !== undefined && (
        <text
          x="50"
          y="68"
          textAnchor="middle"
          fill={accentColor}
          fontSize="11"
          fontWeight="800"
        >
          {number}
        </text>
      )}
    </svg>
  );
}

/**
 * Dream11-style Player Pitch Node
 */
function Dream11PlayerNode({
  player,
  isTeam1,
  teamCode,
  onClick,
}: {
  player: SuperstarPlayer;
  isTeam1: boolean;
  teamCode: string;
  onClick: () => void;
}) {
  const primaryColor = isTeam1 ? "#1d4ed8" : "#b91c1c";
  const secondaryColor = isTeam1 ? "#60a5fa" : "#f87171";
  const accentColor = isTeam1 ? "#fbbf24" : "#fef08a";

  const formattedName = formatDream11Name(player.playerName);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-center text-center cursor-pointer focus:outline-none"
      title={`Click to view ${player.playerName} points breakdown`}
    >
      {/* Jersey Container with C / VC badges */}
      <div className="relative">
        <Dream11JerseySvg
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          accentColor={accentColor}
          teamCode={teamCode.slice(0, 3).toUpperCase()}
          number={player.rank}
        />

        {/* Dream11 Signature Captain Badge */}
        {player.isCaptain && (
          <div
            title="Captain (2X Points)"
            className="absolute -right-2 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow-md ring-2 ring-white"
          >
            C
          </div>
        )}

        {/* Dream11 Signature Vice-Captain Badge */}
        {player.isViceCaptain && (
          <div
            title="Vice-Captain (1.5X Points)"
            className="absolute -right-2 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white shadow-md ring-2 ring-white"
          >
            VC
          </div>
        )}
      </div>

      {/* Dream11 Name & Points Plate */}
      <div className="mt-1 flex flex-col items-center">
        {/* Dark Name Bar */}
        <div className="flex max-w-[85px] items-center justify-center rounded bg-[#111827]/95 px-1.5 py-0.5 text-white shadow-md border border-white/10 sm:max-w-[105px]">
          <span className="truncate text-[10px] font-bold leading-tight sm:text-[11px]">
            {formattedName}
          </span>
        </div>

        {/* White/Yellow Points Bar */}
        <div className="mt-0.5 flex items-center gap-1 rounded bg-white/95 px-1.5 py-0.2 shadow-sm dark:bg-slate-900/90 border border-black/10 dark:border-white/10">
          <span className="tabular text-[9px] font-black text-slate-950 dark:text-amber-300 sm:text-[10px]">
            {player.totalPoints} Pts
          </span>
          {player.isCaptain && (
            <span className="rounded bg-red-600 px-0.5 text-[8px] font-extrabold text-white">
              2X
            </span>
          )}
          {player.isViceCaptain && (
            <span className="rounded bg-slate-700 px-0.5 text-[8px] font-extrabold text-white">
              1.5X
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Dream11 Player Points Breakdown Modal
 */
function PlayerPointsDialog({
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
                {player.teamName} • Rank #{player.rank} in Superstars XI
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
                  Match Impact Points
                </p>
                <p className="text-xl font-black text-foreground">
                  {player.totalPoints} PTS
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
                    {player.stats.wickets}w / {player.stats.runsConceded}r ({player.stats.overs} ov)
                  </span>
                  <span className="font-bold tabular text-purple-600 dark:text-purple-400">
                    +{player.breakdown.bowling} pts
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="flex items-center gap-1.5 font-medium">
                  🧤 Fielding Points
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {player.stats.catches} ct • {player.stats.stumpings} st • {player.stats.runOuts} ro
                  </span>
                  <span className="font-bold tabular text-sky-600 dark:text-sky-400">
                    +{player.breakdown.fielding} pts
                  </span>
                </div>
              </div>

              {player.breakdown.winBonus > 0 && (
                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    🏆 Match Winning Team Bonus
                  </span>
                  <span className="font-bold tabular text-emerald-600 dark:text-emerald-400">
                    +{player.breakdown.winBonus} pts
                  </span>
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Points calculated using international Dream11 & Stumps cricket fantasy standards.
          </p>
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

  const superstarData = useMemo(() => {
    return calculateSuperstars(match);
  }, [match]);

  const {
    superstars,
    captain,
    viceCaptain,
    team1Count,
    team2Count,
    totalPoints,
    byRole,
  } = superstarData;

  const team1Short = match.team1.short_name || match.team1.name.slice(0, 3).toUpperCase();
  const team2Short = match.team2.short_name || match.team2.name.slice(0, 3).toUpperCase();

  const maxPoints = useMemo(() => {
    return superstars[0]?.totalPoints || 1;
  }, [superstars]);

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
    <div className="space-y-4">
      {/* Dream11 Top Match Status & Distribution Bar */}
      <Card className="overflow-hidden border-slate-800 bg-slate-950 text-white shadow-xl">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: Dream11 Match Logo & Superstars title */}
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-md">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black tracking-tight sm:text-lg">
                    Superstars XI
                  </h2>
                  <span className="rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-black uppercase text-white shadow-sm">
                    Dream11 Best XI
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Top 11 performers combined from {match.team1.name} & {match.team2.name}
                </p>
              </div>
            </div>

            {/* Right: Team Distribution Pill and View Mode */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Team Ratio Bar (Dream11 style: e.g. MT 6 : 5 DW) */}
              <div className="flex items-center overflow-hidden rounded-xl border border-white/10 bg-slate-900/90 shadow-inner">
                <div className="flex items-center gap-1.5 bg-blue-600/80 px-2.5 py-1 text-xs font-black text-white">
                  <span>{team1Short}</span>
                  <span className="rounded-full bg-black/30 px-1 text-[11px]">
                    {team1Count}
                  </span>
                </div>
                <span className="px-1 text-xs font-extrabold text-slate-500">
                  :
                </span>
                <div className="flex items-center gap-1.5 bg-red-600/80 px-2.5 py-1 text-xs font-black text-white">
                  <span className="rounded-full bg-black/30 px-1 text-[11px]">
                    {team2Count}
                  </span>
                  <span>{team2Short}</span>
                </div>
              </div>

              {/* View Switcher */}
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900 p-1">
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

          {/* Dream11 Secondary Info Bar */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="font-semibold text-slate-300">
                11 / 11 Players Selected
              </span>
              <span>•</span>
              <span className="font-bold text-amber-400">
                Total Fantasy Points: {totalPoints} PTS
              </span>
            </div>

            {/* Captain & VC indicators */}
            <div className="flex items-center gap-3">
              {captain && (
                <div className="flex items-center gap-1">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white">
                    C
                  </span>
                  <span className="text-xs font-bold text-slate-200">
                    {captain.playerName} (2X)
                  </span>
                </div>
              )}
              {viceCaptain && (
                <div className="flex items-center gap-1">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[9px] font-black text-white">
                    VC
                  </span>
                  <span className="text-xs font-bold text-slate-200">
                    {viceCaptain.playerName} (1.5X)
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pitch View: Dream11 Authentic Cricket Ground */}
      {viewMode === "pitch" ? (
        <Card className="overflow-hidden border-border/80 shadow-2xl">
          <div className="relative min-h-[580px] w-full overflow-hidden bg-[repeating-linear-gradient(0deg,#15421c,#15421c_28px,#194c20_28px,#194c20_56px)] p-3 sm:min-h-[640px] sm:p-5">
            {/* Outer Oval Boundary Line */}
            <div className="pointer-events-none absolute inset-3 rounded-[46%] border-2 border-dashed border-white/20 sm:inset-5" />

            {/* 30-Yard Inner Circle Line */}
            <div className="pointer-events-none absolute inset-10 rounded-[50%] border border-white/15 sm:inset-14" />

            {/* Center Beige Pitch Rectangle */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-52 w-16 -translate-x-1/2 -translate-y-1/2 rounded border border-amber-900/40 bg-[#c2ad82]/85 shadow-inner backdrop-blur-[1px]">
              {/* Bowling Crease Lines */}
              <div className="absolute top-5 left-1 right-1 h-[2px] bg-white/90" />
              <div className="absolute bottom-5 left-1 right-1 h-[2px] bg-white/90" />

              {/* Stumps */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-0.5">
                <div className="h-1.5 w-1 rounded-full bg-white" />
                <div className="h-1.5 w-1 rounded-full bg-white" />
                <div className="h-1.5 w-1 rounded-full bg-white" />
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-0.5">
                <div className="h-1.5 w-1 rounded-full bg-white" />
                <div className="h-1.5 w-1 rounded-full bg-white" />
                <div className="h-1.5 w-1 rounded-full bg-white" />
              </div>
            </div>

            {/* Field Players Formations */}
            <div className="relative z-10 flex h-full flex-col justify-between space-y-5">
              {/* 1. WICKET-KEEPERS */}
              <div className="flex flex-col items-center">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-[1px] w-12 bg-white/20 sm:w-20" />
                  <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-emerald-200 backdrop-blur-sm sm:text-[10px]">
                    WICKET-KEEPERS ({byRole.wk.length})
                  </span>
                  <div className="h-[1px] w-12 bg-white/20 sm:w-20" />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
                  {byRole.wk.length > 0 ? (
                    byRole.wk.map((p) => (
                      <Dream11PlayerNode
                        key={p.playerId}
                        player={p}
                        isTeam1={p.teamId === match.team1_id}
                        teamCode={
                          p.teamId === match.team1_id ? team1Short : team2Short
                        }
                        onClick={() => setSelectedPlayer(p)}
                      />
                    ))
                  ) : (
                    <span className="text-[11px] text-emerald-100/60 font-medium">
                      No wicket-keeper
                    </span>
                  )}
                </div>
              </div>

              {/* 2. BATTERS */}
              <div className="flex flex-col items-center">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-[1px] w-12 bg-white/20 sm:w-20" />
                  <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-emerald-200 backdrop-blur-sm sm:text-[10px]">
                    BATTERS ({byRole.bat.length})
                  </span>
                  <div className="h-[1px] w-12 bg-white/20 sm:w-20" />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
                  {byRole.bat.length > 0 ? (
                    byRole.bat.map((p) => (
                      <Dream11PlayerNode
                        key={p.playerId}
                        player={p}
                        isTeam1={p.teamId === match.team1_id}
                        teamCode={
                          p.teamId === match.team1_id ? team1Short : team2Short
                        }
                        onClick={() => setSelectedPlayer(p)}
                      />
                    ))
                  ) : (
                    <span className="text-[11px] text-emerald-100/60 font-medium">
                      No specialist batters
                    </span>
                  )}
                </div>
              </div>

              {/* 3. ALL-ROUNDERS */}
              <div className="flex flex-col items-center">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-[1px] w-12 bg-white/20 sm:w-20" />
                  <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-emerald-200 backdrop-blur-sm sm:text-[10px]">
                    ALL-ROUNDERS ({byRole.ar.length})
                  </span>
                  <div className="h-[1px] w-12 bg-white/20 sm:w-20" />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
                  {byRole.ar.length > 0 ? (
                    byRole.ar.map((p) => (
                      <Dream11PlayerNode
                        key={p.playerId}
                        player={p}
                        isTeam1={p.teamId === match.team1_id}
                        teamCode={
                          p.teamId === match.team1_id ? team1Short : team2Short
                        }
                        onClick={() => setSelectedPlayer(p)}
                      />
                    ))
                  ) : (
                    <span className="text-[11px] text-emerald-100/60 font-medium">
                      No all-rounders
                    </span>
                  )}
                </div>
              </div>

              {/* 4. BOWLERS */}
              <div className="flex flex-col items-center">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-[1px] w-12 bg-white/20 sm:w-20" />
                  <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-emerald-200 backdrop-blur-sm sm:text-[10px]">
                    BOWLERS ({byRole.bowl.length})
                  </span>
                  <div className="h-[1px] w-12 bg-white/20 sm:w-20" />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
                  {byRole.bowl.length > 0 ? (
                    byRole.bowl.map((p) => (
                      <Dream11PlayerNode
                        key={p.playerId}
                        player={p}
                        isTeam1={p.teamId === match.team1_id}
                        teamCode={
                          p.teamId === match.team1_id ? team1Short : team2Short
                        }
                        onClick={() => setSelectedPlayer(p)}
                      />
                    ))
                  ) : (
                    <span className="text-[11px] text-emerald-100/60 font-medium">
                      No specialist bowlers
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        /* List View (Detailed Dream11 Points Table) */
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Superstars Performance Rankings</span>
              <span className="text-xs font-normal text-muted-foreground">
                Ranked by Total Impact Points
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 p-3 sm:p-5">
            {superstars.map((p) => {
              const isTeam1 = p.teamId === match.team1_id;
              const pointPct = Math.round((p.totalPoints / maxPoints) * 100);

              return (
                <div
                  key={p.playerId}
                  onClick={() => setSelectedPlayer(p)}
                  className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-all hover:border-primary/40 hover:bg-muted/30 cursor-pointer sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    {/* Rank Badge */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted font-black text-sm">
                      {p.rank === 1 ? (
                        <Crown className="h-4 w-4 text-amber-500" />
                      ) : p.rank === 2 ? (
                        <Star className="h-4 w-4 text-slate-400" />
                      ) : (
                        <span className="tabular text-muted-foreground">
                          {p.rank}
                        </span>
                      )}
                    </div>

                    {/* Player Info */}
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-foreground">
                          {p.playerName}
                        </span>
                        <RoleBadge role={p.role} />
                        {p.isCaptain && (
                          <Badge className="bg-red-600 text-[10px] font-black text-white hover:bg-red-600">
                            CAPTAIN (2X)
                          </Badge>
                        )}
                        {p.isViceCaptain && (
                          <Badge className="bg-slate-800 text-[10px] font-black text-white hover:bg-slate-800">
                            VICE-CAPTAIN (1.5X)
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span
                          className={`font-semibold ${
                            isTeam1
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {p.teamName}
                        </span>
                        <span>•</span>
                        <span>{p.summary}</span>
                      </div>
                    </div>
                  </div>

                  {/* Impact Breakdown and Points */}
                  <div className="flex flex-col sm:items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span title="Batting points">
                          🏏 {p.breakdown.batting}
                        </span>
                        <span>•</span>
                        <span title="Bowling points">
                          🎯 {p.breakdown.bowling}
                        </span>
                        <span>•</span>
                        <span title="Fielding points">
                          🧤 {p.breakdown.fielding}
                        </span>
                        {p.breakdown.winBonus > 0 && (
                          <>
                            <span>•</span>
                            <span
                              title="Match winning bonus"
                              className="text-emerald-600 dark:text-emerald-400"
                            >
                              🏆 +{p.breakdown.winBonus}
                            </span>
                          </>
                        )}
                      </div>
                      <span className="tabular text-base font-black text-primary sm:text-lg">
                        {p.totalPoints}{" "}
                        <span className="text-xs font-semibold text-muted-foreground">
                          pts
                        </span>
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full sm:w-36 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-primary transition-all duration-300"
                        style={{ width: `${Math.max(pointPct, 5)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Interactive Points Dialog */}
      <PlayerPointsDialog
        player={selectedPlayer}
        open={Boolean(selectedPlayer)}
        onOpenChange={(open) => !open && setSelectedPlayer(null)}
      />
    </div>
  );
}
