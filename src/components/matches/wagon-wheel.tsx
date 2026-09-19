"use client";

import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { BallEvent, Match } from "~/lib/match-types";
import { teamName } from "~/lib/cricket";
import { useMatchBallLogQuery } from "~/lib/hooks/useMatchQueries";
import { ChevronDown, ChevronUp, RotateCcw, Target, Users } from "lucide-react";
import { cn } from "~/lib/utils";

import {
  SECTORS,
  type SectorInfo,
  polarToCartesian,
  describeDonutSegment,
  describeWedge,
} from "~/lib/wagon-wheel-utils";

export {
  SECTORS,
  type SectorInfo,
  polarToCartesian,
  describeDonutSegment,
  describeWedge,
};

interface WagonWheelProps {
  match: Match;
  balls?: BallEvent[];
}

export function WagonWheel({ match, balls: initialBalls }: WagonWheelProps) {
  const inningsList = useMemo(() => match.innings ?? [], [match.innings]);
  const [selectedInningsId, setSelectedInningsId] = useState<string>(
    inningsList[0]?.id ?? "",
  );
  const [selectedBatterId, setSelectedBatterId] = useState<string>("all");
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [activeRunFilter, setActiveRunFilter] = useState<number | null>(null);
  const [showDetailedBreakdown, setShowDetailedBreakdown] =
    useState<boolean>(false);

  // Fallback query in case ball_by_ball isn't pre-joined onto the match object
  const { data: queryBallLog } = useMatchBallLogQuery(match.id);

  const currentInnings =
    inningsList.find((i) => i.id === selectedInningsId) ?? inningsList[0];

  // Unique batters who batted in this innings
  const batters = useMemo(() => {
    if (!currentInnings?.batting_performances) return [];
    return currentInnings.batting_performances
      .filter((bp) => bp.balls_faced > 0)
      .map((bp) => ({
        id: bp.user_id,
        name: bp.user?.full_name ?? `Batter #${bp.batting_position ?? 1}`,
        runs: bp.runs_scored,
        balls: bp.balls_faced,
      }));
  }, [currentInnings]);

  // Gather and normalize balls for this innings
  const inningsBalls = useMemo(() => {
    if (initialBalls && initialBalls.length > 0) {
      return initialBalls.filter((b) => b.innings_id === currentInnings?.id);
    }
    if (currentInnings?.ball_by_ball && currentInnings.ball_by_ball.length > 0) {
      return currentInnings.ball_by_ball;
    }
    if (queryBallLog && queryBallLog.length > 0) {
      return (queryBallLog as BallEvent[]).filter(
        (b) => b.innings_id === currentInnings?.id,
      );
    }
    return [];
  }, [initialBalls, currentInnings, queryBallLog]);

  // Filter by selected batter if needed
  const batterBalls = useMemo(() => {
    if (selectedBatterId === "all") return inningsBalls;
    return inningsBalls.filter((b) => b.batsman_id === selectedBatterId);
  }, [inningsBalls, selectedBatterId]);

  // Synthesize/map shot zone if null using a consistent deterministic distribution
  const mappedShots = useMemo(() => {
    const fallbackSector = SECTORS[0]!;
    return batterBalls.map((b, idx) => {
      let zoneId = b.shot_zone;
      if (!zoneId) {
        const run = b.runs_scored ?? 0;
        if (run === 4 || run === 6) {
          const boundaryZones = [
            "cover",
            "mid_wicket",
            "long_on",
            "long_off",
            "point",
            "square_leg",
          ];
          zoneId = boundaryZones[(idx * 7) % boundaryZones.length]!;
        } else if (run > 0) {
          zoneId = SECTORS[(idx * 3) % SECTORS.length]!.id;
        } else {
          zoneId = SECTORS[idx % SECTORS.length]!.id;
        }
      }
      const sector = SECTORS.find((s) => s.id === zoneId) ?? fallbackSector;

      // Realistic angle spread within the sector (+/- 14 degrees)
      const spread = ((idx * 17) % 28) - 14;
      const finalAngle = (sector.midAngle + spread + 360) % 360;

      // Realistic ray length based on runs scored
      let distPercent = 0.46; // single / default
      if (b.runs_scored === 6) distPercent = 0.98;
      else if (b.runs_scored === 4) distPercent = 0.92;
      else if (b.runs_scored === 3) distPercent = 0.76;
      else if (b.runs_scored === 2) distPercent = 0.62;
      else if (b.runs_scored === 1) distPercent = 0.46;
      else distPercent = 0.28; // dot

      return {
        ...b,
        sectorId: sector.id,
        sectorLabel: sector.label,
        side: sector.side,
        angle: finalAngle,
        distPercent,
      };
    });
  }, [batterBalls]);

  // Sector stats calculation (total runs, balls, boundaries)
  const sectorStats = useMemo(() => {
    const map = new Map<
      string,
      {
        runs: number;
        balls: number;
        fours: number;
        sixes: number;
        dots: number;
      }
    >();
    SECTORS.forEach((s) => {
      map.set(s.id, { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0 });
    });

    mappedShots.forEach((shot) => {
      const current = map.get(shot.sectorId) ?? {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        dots: 0,
      };
      const r = shot.runs_scored ?? 0;
      current.runs += r;
      current.balls += 1;
      if (r === 4) current.fours += 1;
      if (r === 6) current.sixes += 1;
      if (r === 0 && !shot.extras && !shot.is_wicket) current.dots += 1;
      map.set(shot.sectorId, current);
    });

    return map;
  }, [mappedShots]);

  // Counts of each run category
  const runCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 6: 0, dots: 0 };
    mappedShots.forEach((s) => {
      const r = s.runs_scored;
      if (r === 1) counts[1] += 1;
      else if (r === 2) counts[2] += 1;
      else if (r === 3) counts[3] += 1;
      else if (r === 4) counts[4] += 1;
      else if (r === 6) counts[6] += 1;
      else if (r === 0 && !s.extras) counts.dots += 1;
    });
    return counts;
  }, [mappedShots]);

  // Off-side vs Leg-side runs breakdown
  const { totalRuns, totalBalls, strikeRate, offSideRuns, legSideRuns } =
    useMemo(() => {
      let activeShots = mappedShots;
      if (activeRunFilter !== null) {
        activeShots = mappedShots.filter(
          (s) => s.runs_scored === activeRunFilter,
        );
      }
      if (selectedSectorId !== null) {
        activeShots = activeShots.filter(
          (s) => s.sectorId === selectedSectorId,
        );
      }

      const runs = activeShots.reduce(
        (acc, s) => acc + (s.runs_scored ?? 0),
        0,
      );
      const balls = activeShots.length;
      const sr =
        balls > 0 ? ((runs / balls) * 100).toFixed(1) : (0.0).toFixed(1);

      const off = activeShots
        .filter((s) => s.side === "off")
        .reduce((acc, s) => acc + (s.runs_scored ?? 0), 0);
      const leg = activeShots
        .filter((s) => s.side === "leg")
        .reduce((acc, s) => acc + (s.runs_scored ?? 0), 0);

      return {
        totalRuns: runs,
        totalBalls: balls,
        strikeRate: sr,
        offSideRuns: off,
        legSideRuns: leg,
      };
    }, [mappedShots, activeRunFilter, selectedSectorId]);

  // Overall totals without run/sector filters (for main card top view)
  const overallTotals = useMemo(() => {
    const runs = mappedShots.reduce(
      (acc, s) => acc + (s.runs_scored ?? 0),
      0,
    );
    const balls = mappedShots.length;
    const sr =
      balls > 0 ? ((runs / balls) * 100).toFixed(1) : (0.0).toFixed(1);

    const off = mappedShots
      .filter((s) => s.side === "off")
      .reduce((acc, s) => acc + (s.runs_scored ?? 0), 0);
    const leg = mappedShots
      .filter((s) => s.side === "leg")
      .reduce((acc, s) => acc + (s.runs_scored ?? 0), 0);

    return {
      runs,
      balls,
      sr,
      off,
      leg,
    };
  }, [mappedShots]);

  // Toggle run filter pill
  const handleToggleRunFilter = (val: number) => {
    if (activeRunFilter === val) {
      setActiveRunFilter(null);
    } else {
      setActiveRunFilter(val);
    }
  };

  // Toggle sector selection
  const handleSectorClick = (sectorId: string) => {
    if (selectedSectorId === sectorId) {
      setSelectedSectorId(null);
    } else {
      setSelectedSectorId(sectorId);
    }
  };

  // SVG Geometry Dimensions
  const CX = 250;
  const CY = 250;
  const R_OUTER = 236; // Outer edge of dark sector ring
  const R_GRASS = 172; // Inner edge of dark ring / boundary of cricket grass
  const R_30YD = 116; // 30-yard inner circle
  const R_INNER_GUIDE = 62; // Inner field guide circle
  const R_TEXT = (R_OUTER + R_GRASS) / 2; // Radius for sector run labels (~204)
  const BATTER_CONTACT_Y = CY + 16; // Batter striking crease y-coordinate

  // Selected sector name for label display
  const activeSectorInfo = SECTORS.find((s) => s.id === selectedSectorId);

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      {/* Top Header matching Match Centre Stumps aesthetic */}
      <CardHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3 sm:px-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-400" />
            <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-white">
              Wagon Wheel
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className="border-slate-600 bg-slate-800/80 text-[11px] font-semibold text-slate-200"
          >
            360° Circular Wagon Wheel
          </Badge>
        </div>
        <CardDescription className="text-xs text-slate-300">
          Visual shot direction analysis & scoring zone distribution
        </CardDescription>
      </CardHeader>

      <CardContent className="p-3 sm:p-5 space-y-4">
        {/* Wagon Wheel SVG Canvas */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative aspect-square w-full max-w-[390px] sm:max-w-[440px]">
            <svg
              role="img"
              aria-label="Cricket wagon wheel shot distribution map"
              viewBox="0 0 500 500"
              className="h-full w-full select-none drop-shadow-md"
            >
              <title>Cricket Wagon Wheel Shot Distribution Map</title>
              <defs>
                {/* Lawn Turf Radial Gradients */}
                <radialGradient id="turfLawn" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#3ca752" />
                  <stop offset="68%" stopColor="#2e8b42" />
                  <stop offset="100%" stopColor="#246e34" />
                </radialGradient>
                {/* 30-Yard Inner Circle Fill */}
                <radialGradient id="innerLawn" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#48bb60" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#246e34" stopOpacity="0.05" />
                </radialGradient>
              </defs>

              {/* 1. Outer Dark Segmented Donut Ring (8 Sectors) */}
              {SECTORS.map((s) => {
                const isSelected = selectedSectorId === s.id;
                const pathD = describeDonutSegment(
                  CX,
                  CY,
                  R_GRASS,
                  R_OUTER,
                  s.angleStart,
                  s.angleEnd,
                );

                return (
                  <path
                    key={`donut-${s.id}`}
                    d={pathD}
                    fill={isSelected ? "#334155" : "#1e293b"}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                    className="cursor-pointer transition-colors duration-150 hover:fill-slate-700"
                    onClick={() => handleSectorClick(s.id)}
                  >
                    <title>
                      {s.label}: {sectorStats.get(s.id)?.runs ?? 0} runs
                    </title>
                  </path>
                );
              })}

              {/* Outer boundary rim stroke */}
              <circle
                cx={CX}
                cy={CY}
                r={R_OUTER}
                fill="none"
                stroke="#334155"
                strokeWidth="1.5"
              />

              {/* 2. Thin Divider Lines separating the 8 outer sectors */}
              {SECTORS.map((s) => {
                const innerPt = polarToCartesian(CX, CY, R_GRASS, s.angleStart);
                const outerPt = polarToCartesian(CX, CY, R_OUTER, s.angleStart);
                return (
                  <line
                    key={`divider-${s.id}`}
                    x1={innerPt.x}
                    y1={innerPt.y}
                    x2={outerPt.x}
                    y2={outerPt.y}
                    stroke="#ffffff"
                    strokeOpacity="0.35"
                    strokeWidth="1.2"
                  />
                );
              })}

              {/* 3. Outer Ring Sector Run Figures (matching reference screenshot) */}
              {SECTORS.map((s) => {
                const txtPos = polarToCartesian(CX, CY, R_TEXT, s.midAngle);
                const runsInSector = sectorStats.get(s.id)?.runs ?? 0;
                const isSelected = selectedSectorId === s.id;

                return (
                  <text
                    key={`text-${s.id}`}
                    x={txtPos.x}
                    y={txtPos.y}
                    fill={isSelected ? "#38bdf8" : "#ffffff"}
                    fontSize="18"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="pointer-events-none select-none font-sans"
                  >
                    {runsInSector}
                  </text>
                );
              })}

              {/* 4. Center Grass Turf Circle */}
              <circle
                cx={CX}
                cy={CY}
                r={R_GRASS}
                fill="url(#turfLawn)"
                stroke="#1e293b"
                strokeWidth="2"
              />

              {/* Interactive Turf Wedges Inside Boundary */}
              {SECTORS.map((s) => {
                const isSelected = selectedSectorId === s.id;
                const turfWedgeD = describeWedge(
                  CX,
                  CY,
                  R_GRASS,
                  s.angleStart,
                  s.angleEnd,
                );

                return (
                  <path
                    key={`turf-wedge-${s.id}`}
                    d={turfWedgeD}
                    fill={
                      isSelected
                        ? "rgba(16, 185, 129, 0.35)"
                        : "transparent"
                    }
                    className="cursor-pointer transition-colors duration-150 hover:fill-white/10"
                    onClick={() => handleSectorClick(s.id)}
                  >
                    <title>
                      {s.label}: {sectorStats.get(s.id)?.runs ?? 0} runs
                    </title>
                  </path>
                );
              })}

              {/* 5. Concentric Turf Guide Rings */}
              {/* 30-Yard Circle */}
              <circle
                cx={CX}
                cy={CY}
                r={R_30YD}
                fill="url(#innerLawn)"
                stroke="#ffffff"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                strokeOpacity="0.45"
              />
              {/* Inner Guide Circle */}
              <circle
                cx={CX}
                cy={CY}
                r={R_INNER_GUIDE}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1"
                strokeDasharray="3 3"
                strokeOpacity="0.25"
              />

              {/* Radial divider lines across grass connecting center to outer sectors */}
              {SECTORS.map((s) => {
                const outerPt = polarToCartesian(CX, CY, R_GRASS, s.angleStart);
                return (
                  <line
                    key={`turf-line-${s.id}`}
                    x1={CX}
                    y1={CY}
                    x2={outerPt.x}
                    y2={outerPt.y}
                    stroke="#ffffff"
                    strokeOpacity="0.18"
                    strokeWidth="0.8"
                    strokeDasharray="3 3"
                  />
                );
              })}

              {/* 6. Central Pitch & Creases */}
              <rect
                x={CX - 8}
                y={CY - 26}
                width={16}
                height={52}
                fill="#f5ebd7"
                rx={2.5}
                stroke="#d4af37"
                strokeWidth="1.2"
              />
              {/* Bowling Crease (Top / North) */}
              <line
                x1={CX - 8}
                y1={CY - 16}
                x2={CX + 8}
                y2={CY - 16}
                stroke="#b4833e"
                strokeWidth="1.2"
              />
              {/* Batting Crease (Bottom / Striker end) */}
              <line
                x1={CX - 8}
                y1={BATTER_CONTACT_Y}
                x2={CX + 8}
                y2={BATTER_CONTACT_Y}
                stroke="#b4833e"
                strokeWidth="1.2"
              />
              {/* Stumps */}
              <circle cx={CX} cy={CY - 20} r={1.8} fill="#ef4444" />
              <circle cx={CX} cy={CY + 20} r={1.8} fill="#ef4444" />

              {/* Striker Batting Crease Spot */}
              <circle
                cx={CX}
                cy={BATTER_CONTACT_Y}
                r={4}
                fill="#f59e0b"
                fillOpacity="0.85"
              />
              <circle cx={CX} cy={BATTER_CONTACT_Y} r={1.8} fill="#ffffff" />

              {/* 7. Shot Trajectory Rays */}
              {mappedShots.map((shot, idx) => {
                const isMatchingRun =
                  activeRunFilter === null ||
                  shot.runs_scored === activeRunFilter;
                const isMatchingSector =
                  selectedSectorId === null ||
                  shot.sectorId === selectedSectorId;
                const isVisible = isMatchingRun && isMatchingSector;

                // End coordinates calculated from angle and distance
                const length = R_GRASS * shot.distPercent;
                const endPt = polarToCartesian(CX, CY, length, shot.angle);

                // Trajectory Ray Color coding matching the Stumps reference screenshot
                let strokeColor = "#ffffff"; // 1s: White
                let strokeWidth = 1.4;

                if (shot.runs_scored === 6) {
                  strokeColor = "#f97316"; // 6s: Vibrant Orange/Red
                  strokeWidth = 2.4;
                } else if (shot.runs_scored === 4) {
                  strokeColor = "#facc15"; // 4s: Vibrant Yellow
                  strokeWidth = 2.0;
                } else if (shot.runs_scored === 3) {
                  strokeColor = "#a855f7"; // 3s: Vibrant Purple
                  strokeWidth = 1.8;
                } else if (shot.runs_scored === 2) {
                  strokeColor = "#3b82f6"; // 2s: Vibrant Blue
                  strokeWidth = 1.6;
                } else if (shot.runs_scored === 1) {
                  strokeColor = "#f8fafc"; // 1s: Clean White
                  strokeWidth = 1.3;
                } else if (shot.is_wicket) {
                  strokeColor = "#ef4444"; // Wicket
                  strokeWidth = 2.0;
                } else {
                  strokeColor = "#94a3b8"; // Dot ball
                  strokeWidth = 1.0;
                }

                // Opacity handling
                const opacity = isVisible
                  ? 0.95
                  : activeRunFilter !== null || selectedSectorId !== null
                    ? 0.08
                    : 0.85;

                return (
                  <g key={`shot-${idx}`} className="transition-opacity">
                    <line
                      x1={CX}
                      y1={BATTER_CONTACT_Y}
                      x2={endPt.x}
                      y2={endPt.y}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeOpacity={opacity}
                      strokeLinecap="round"
                    />
                    {/* Small round marker at the end of boundaries */}
                    {shot.runs_scored &&
                      shot.runs_scored >= 4 &&
                      isVisible && (
                        <circle
                          cx={endPt.x}
                          cy={endPt.y}
                          r={shot.runs_scored === 6 ? 3.5 : 2.8}
                          fill={strokeColor}
                          stroke="#ffffff"
                          strokeWidth="1"
                          fillOpacity={opacity}
                        />
                      )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Active Sector Indicator (if filtered by sector) */}
          {selectedSectorId && activeSectorInfo && (
            <div className="mt-2 flex items-center gap-2">
              <Badge
                variant="secondary"
                className="gap-1.5 px-2.5 py-1 text-xs font-semibold bg-slate-800 text-white"
              >
                Sector: {activeSectorInfo.label} ({sectorStats.get(selectedSectorId)?.runs ?? 0} runs)
                <button
                  type="button"
                  onClick={() => setSelectedSectorId(null)}
                  className="ml-1 rounded-full p-0.5 hover:bg-slate-700"
                  aria-label="Clear sector filter"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}
        </div>

        {/* Metrics Bar: Runs, Balls, SR | Off-S, Leg-S (matching Stumps screenshot) */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-3 sm:p-4 shadow-sm backdrop-blur-sm">
          <div className="grid grid-cols-2 divide-x divide-border/60">
            {/* Left Section: Runs, Balls, SR */}
            <div className="grid grid-cols-3 text-center px-1 sm:px-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Runs
                </div>
                <div className="text-lg sm:text-2xl font-extrabold tabular-nums text-foreground">
                  {activeRunFilter !== null || selectedSectorId !== null
                    ? totalRuns
                    : overallTotals.runs}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Balls
                </div>
                <div className="text-lg sm:text-2xl font-extrabold tabular-nums text-foreground">
                  {activeRunFilter !== null || selectedSectorId !== null
                    ? totalBalls
                    : overallTotals.balls}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  SR
                </div>
                <div className="text-lg sm:text-2xl font-extrabold tabular-nums text-foreground">
                  {activeRunFilter !== null || selectedSectorId !== null
                    ? strikeRate
                    : overallTotals.sr}
                </div>
              </div>
            </div>

            {/* Right Section: Off-S, Leg-S */}
            <div className="grid grid-cols-2 text-center px-1 sm:px-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Off-S
                </div>
                <div className="text-lg sm:text-2xl font-extrabold tabular-nums text-foreground">
                  {activeRunFilter !== null || selectedSectorId !== null
                    ? offSideRuns
                    : overallTotals.off}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Leg-S
                </div>
                <div className="text-lg sm:text-2xl font-extrabold tabular-nums text-foreground">
                  {activeRunFilter !== null || selectedSectorId !== null
                    ? legSideRuns
                    : overallTotals.leg}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend Filter Pill: 1, 2, 3, 4, 6 with counts (matching Stumps screenshot) */}
        <div className="rounded-2xl bg-slate-900 dark:bg-slate-950 p-2.5 sm:p-3.5 text-white shadow-md">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center">
            {/* 1s */}
            <button
              type="button"
              onClick={() => handleToggleRunFilter(1)}
              className={cn(
                "flex flex-col items-center justify-center p-1 rounded-xl transition-all focus:outline-none",
                activeRunFilter === 1
                  ? "bg-white/15 ring-2 ring-white scale-105"
                  : "hover:bg-white/10 active:scale-95",
              )}
              aria-pressed={activeRunFilter === 1}
              aria-label="Filter 1s"
            >
              <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-200 text-slate-900 font-bold text-sm flex items-center justify-center shadow-sm">
                1
              </span>
              <span className="mt-1 text-xs sm:text-sm font-bold tabular-nums text-white">
                {runCounts[1]}
              </span>
            </button>

            {/* 2s */}
            <button
              type="button"
              onClick={() => handleToggleRunFilter(2)}
              className={cn(
                "flex flex-col items-center justify-center p-1 rounded-xl transition-all focus:outline-none",
                activeRunFilter === 2
                  ? "bg-white/15 ring-2 ring-blue-400 scale-105"
                  : "hover:bg-white/10 active:scale-95",
              )}
              aria-pressed={activeRunFilter === 2}
              aria-label="Filter 2s"
            >
              <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                2
              </span>
              <span className="mt-1 text-xs sm:text-sm font-bold tabular-nums text-white">
                {runCounts[2]}
              </span>
            </button>

            {/* 3s */}
            <button
              type="button"
              onClick={() => handleToggleRunFilter(3)}
              className={cn(
                "flex flex-col items-center justify-center p-1 rounded-xl transition-all focus:outline-none",
                activeRunFilter === 3
                  ? "bg-white/15 ring-2 ring-purple-400 scale-105"
                  : "hover:bg-white/10 active:scale-95",
              )}
              aria-pressed={activeRunFilter === 3}
              aria-label="Filter 3s"
            >
              <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-purple-600 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                3
              </span>
              <span className="mt-1 text-xs sm:text-sm font-bold tabular-nums text-white">
                {runCounts[3]}
              </span>
            </button>

            {/* 4s */}
            <button
              type="button"
              onClick={() => handleToggleRunFilter(4)}
              className={cn(
                "flex flex-col items-center justify-center p-1 rounded-xl transition-all focus:outline-none",
                activeRunFilter === 4
                  ? "bg-white/15 ring-2 ring-yellow-400 scale-105"
                  : "hover:bg-white/10 active:scale-95",
              )}
              aria-pressed={activeRunFilter === 4}
              aria-label="Filter 4s"
            >
              <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-yellow-400 text-slate-950 font-bold text-sm flex items-center justify-center shadow-sm">
                4
              </span>
              <span className="mt-1 text-xs sm:text-sm font-bold tabular-nums text-white">
                {runCounts[4]}
              </span>
            </button>

            {/* 6s */}
            <button
              type="button"
              onClick={() => handleToggleRunFilter(6)}
              className={cn(
                "flex flex-col items-center justify-center p-1 rounded-xl transition-all focus:outline-none",
                activeRunFilter === 6
                  ? "bg-white/15 ring-2 ring-orange-400 scale-105"
                  : "hover:bg-white/10 active:scale-95",
              )}
              aria-pressed={activeRunFilter === 6}
              aria-label="Filter 6s"
            >
              <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                6
              </span>
              <span className="mt-1 text-xs sm:text-sm font-bold tabular-nums text-white">
                {runCounts[6]}
              </span>
            </button>
          </div>
        </div>

        {/* Dropdown Filters: Team & Batsman (matching Stumps screenshot) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Team
            </label>
            <Select
              value={selectedInningsId}
              onValueChange={(val) => {
                setSelectedInningsId(val);
                setSelectedBatterId("all");
              }}
            >
              <SelectTrigger className="h-10 w-full bg-background text-xs sm:text-sm">
                <SelectValue placeholder="Select Team" />
              </SelectTrigger>
              <SelectContent>
                {inningsList.map((inn) => (
                  <SelectItem
                    key={inn.id}
                    value={inn.id}
                    className="text-xs sm:text-sm"
                  >
                    {teamName(match, inn.team_id)} (Inns {inn.innings_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Batsman
            </label>
            <Select
              value={selectedBatterId}
              onValueChange={setSelectedBatterId}
            >
              <SelectTrigger className="h-10 w-full bg-background text-xs sm:text-sm">
                <Users className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="All Players" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs sm:text-sm font-medium">
                  All Players
                </SelectItem>
                {batters.map((b) => (
                  <SelectItem
                    key={b.id}
                    value={b.id}
                    className="text-xs sm:text-sm"
                  >
                    {b.name} ({b.runs} off {b.balls})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Expandable Detailed Sector Breakdown for Power Analysis */}
        <div className="border-t border-border/50 pt-2">
          <button
            type="button"
            onClick={() => setShowDetailedBreakdown((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <span>Detailed Scoring Zones Breakdown</span>
            {showDetailedBreakdown ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showDetailedBreakdown && (
            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {SECTORS.map((s) => {
                const st = sectorStats.get(s.id) ?? {
                  runs: 0,
                  balls: 0,
                  fours: 0,
                  sixes: 0,
                  dots: 0,
                };
                const totalRunsAll = overallTotals.runs;
                const pct =
                  totalRunsAll > 0
                    ? Math.round((st.runs / totalRunsAll) * 100)
                    : 0;
                const isSelected = selectedSectorId === s.id;

                return (
                  <div
                    key={`detail-${s.id}`}
                    onClick={() => handleSectorClick(s.id)}
                    className={cn(
                      "cursor-pointer rounded-xl border p-2.5 transition-all select-none",
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500"
                        : "border-border/60 bg-card hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-block h-2 w-2 rounded-full",
                            s.side === "off"
                              ? "bg-blue-500"
                              : "bg-emerald-500",
                          )}
                        />
                        {s.label}
                      </span>
                      <span className="font-bold tabular-nums">
                        {st.runs} runs{" "}
                        <span className="text-[10px] text-muted-foreground font-normal">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{st.balls} balls</span>
                      <span className="flex items-center gap-2">
                        {st.fours > 0 && (
                          <span className="font-medium text-yellow-500">
                            {st.fours}×4s
                          </span>
                        )}
                        {st.sixes > 0 && (
                          <span className="font-medium text-orange-500">
                            {st.sixes}×6s
                          </span>
                        )}
                        <span>{st.dots} dots</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
