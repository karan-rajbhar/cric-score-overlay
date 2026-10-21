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
import { ChevronDown, ChevronUp, RotateCcw, Users } from "lucide-react";
import { cn } from "~/lib/utils";
import { FIELD, SHOT_FILL, shotStyle } from "./wagon-wheel-field";

import {
  SECTORS,
  polarToCartesian,
  describeDonutSegment,
  describeWedge,
} from "~/lib/wagon-wheel-utils";

type PlacedShot = BallEvent & { side: "off" | "leg" };

function sideRuns(shots: PlacedShot[], side: "off" | "leg") {
  return shots
    .filter((s) => s.side === side)
    .reduce((acc, s) => acc + (s.runs_scored ?? 0), 0);
}

/** Runs, balls and strike rate of `balls`; off / leg side runs of `placed`. */
function totalsOf(balls: BallEvent[], placed: PlacedShot[]) {
  const runs = balls.reduce((acc, s) => acc + (s.runs_scored ?? 0), 0);
  return {
    runs,
    balls: balls.length,
    sr: balls.length > 0 ? ((runs / balls.length) * 100).toFixed(1) : "0.0",
    off: sideRuns(placed, "off"),
    leg: sideRuns(placed, "leg"),
  };
}

interface WagonWheelProps {
  match: Match;
  balls?: BallEvent[];
}

export function WagonWheel({ match, balls: initialBalls }: WagonWheelProps) {
  const inningsList = useMemo(() => match.innings ?? [], [match.innings]);
  const defaultInningsId = useMemo(() => {
    const active = inningsList.find((i) => i.innings_number === match.current_innings);
    return active?.id ?? inningsList[0]?.id ?? "";
  }, [inningsList, match.current_innings]);

  const [selectedInningsId, setSelectedInningsId] = useState<string>(defaultInningsId);
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

  // Only shots the scorer gave a direction are drawn or split by side; a
  // shot without one is counted in the totals but placed nowhere.
  const mappedShots = useMemo(() => {
    return batterBalls.flatMap((b, idx) => {
      const sector = SECTORS.find((s) => s.id === b.shot_zone);
      if (!sector) return [];

      // Spread the lines within the sector (+/- 14 degrees) so they do not
      // sit on top of each other; only the sector is recorded.
      const spread = ((idx * 17) % 28) - 14;
      const finalAngle = (sector.midAngle + spread + 360) % 360;

      // Ray length by runs scored
      let distPercent = 0.46; // single / default
      if (b.runs_scored === 6) distPercent = 0.98;
      else if (b.runs_scored === 4) distPercent = 0.92;
      else if (b.runs_scored === 3) distPercent = 0.76;
      else if (b.runs_scored === 2) distPercent = 0.62;
      else if (b.runs_scored === 1) distPercent = 0.46;
      else distPercent = 0.28; // dot

      return [
        {
          ...b,
          sectorId: sector.id,
          sectorLabel: sector.label,
          side: sector.side,
          angle: finalAngle,
          distPercent,
        },
      ];
    });
  }, [batterBalls]);

  // Scoring shots off the bat with no direction recorded (the scorer is
  // only asked for those).
  const unplacedShots = useMemo(
    () =>
      batterBalls.filter((b) => (b.runs_scored ?? 0) > 0 && !b.shot_zone)
        .length,
    [batterBalls],
  );

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

  // Counts of each run category, from every ball
  const runCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 6: 0, dots: 0 };
    batterBalls.forEach((s) => {
      const r = s.runs_scored;
      if (r === 1) counts[1] += 1;
      else if (r === 2) counts[2] += 1;
      else if (r === 3) counts[3] += 1;
      else if (r === 4) counts[4] += 1;
      else if (r === 6) counts[6] += 1;
      else if (r === 0 && !s.extras) counts.dots += 1;
    });
    return counts;
  }, [batterBalls]);

  // Runs, balls and strike rate from every ball (a zone filter can only
  // count placed shots); off / leg side from placed shots only.
  const { totalRuns, totalBalls, strikeRate, offSideRuns, legSideRuns } =
    useMemo(() => {
      const byRuns = <T extends BallEvent>(list: T[]) =>
        activeRunFilter === null
          ? list
          : list.filter((s) => s.runs_scored === activeRunFilter);
      const placed = byRuns(mappedShots).filter(
        (s) => selectedSectorId === null || s.sectorId === selectedSectorId,
      );
      const t = totalsOf(
        selectedSectorId === null ? byRuns(batterBalls) : placed,
        placed,
      );
      return {
        totalRuns: t.runs,
        totalBalls: t.balls,
        strikeRate: t.sr,
        offSideRuns: t.off,
        legSideRuns: t.leg,
      };
    }, [batterBalls, mappedShots, activeRunFilter, selectedSectorId]);

  // Overall totals without run/sector filters (for main card top view)
  const overallTotals = useMemo(
    () => totalsOf(batterBalls, mappedShots),
    [batterBalls, mappedShots],
  );

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
  // The striker's crease, at the top end of the pitch: the field is seen
  // as the camera behind the bowler shows it (see SECTORS), so shots start
  // here.
  const BATTER_CONTACT_Y = CY - 16;

  // Selected sector name for label display
  const activeSectorInfo = SECTORS.find((s) => s.id === selectedSectorId);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
        <CardTitle className="text-base font-semibold">Wagon wheel</CardTitle>
        <CardDescription className="text-sm">
          Where the runs went, seen as on TV from behind the bowler. Tap a
          zone or a run value to filter.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 p-4 pt-2 sm:p-5 sm:pt-2">
        {/* Wagon Wheel SVG Canvas */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative aspect-square w-full max-w-[390px] sm:max-w-[440px]">
            <svg
              role="img"
              aria-label="Cricket wagon wheel shot distribution map"
              viewBox="0 0 500 500"
              className="h-full w-full select-none"
            >
              <title>Cricket wagon wheel shot distribution map</title>

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
                    strokeWidth="2"
                    className={cn(
                      "cursor-pointer transition-colors duration-150",
                      isSelected ? FIELD.ringSelected : cn(FIELD.ring, FIELD.ringHover),
                    )}
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
                strokeWidth="1"
                className={FIELD.rim}
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
                    strokeWidth="2"
                    className={FIELD.divider}
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
                    fontSize="18"
                    fontWeight="600"
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={cn(
                      "pointer-events-none select-none font-score tabular-nums",
                      isSelected ? FIELD.labelSelected : FIELD.label,
                    )}
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
                strokeWidth="1"
                className={FIELD.grass}
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
                    className={cn(
                      "cursor-pointer transition-colors duration-150",
                      isSelected ? FIELD.wedgeSelected : FIELD.wedge,
                    )}
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
                strokeWidth="1.2"
                strokeDasharray="4 4"
                className={FIELD.ring30}
              />
              {/* Inner Guide Circle */}
              <circle
                cx={CX}
                cy={CY}
                r={R_INNER_GUIDE}
                strokeWidth="1"
                strokeDasharray="3 3"
                className={FIELD.guide}
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
                    strokeWidth="0.8"
                    strokeDasharray="3 3"
                    className={FIELD.radial}
                  />
                );
              })}

              {/* 6. Central Pitch & Creases */}
              <rect
                x={CX - 8}
                y={CY - 26}
                width={16}
                height={52}
                rx={2.5}
                strokeWidth="1"
                className={FIELD.pitch}
              />
              {/* Bowling crease (bottom, the bowler's end) */}
              <line
                x1={CX - 8}
                y1={CY + 16}
                x2={CX + 8}
                y2={CY + 16}
                strokeWidth="1.2"
                className={FIELD.crease}
              />
              {/* Batting crease (top, the striker's end) */}
              <line
                x1={CX - 8}
                y1={BATTER_CONTACT_Y}
                x2={CX + 8}
                y2={BATTER_CONTACT_Y}
                strokeWidth="1.2"
                className={FIELD.crease}
              />
              {/* Stumps: the striker's at the top, the bowler's end below */}
              <circle cx={CX} cy={CY + 20} r={1.8} className={FIELD.farStumps} />
              <g className={FIELD.stumps}>
                <rect x={CX - 5} y={CY - 25} width={1.8} height={6} rx={0.6} />
                <rect x={CX - 0.9} y={CY - 25} width={1.8} height={6} rx={0.6} />
                <rect x={CX + 3.2} y={CY - 25} width={1.8} height={6} rx={0.6} />
              </g>

              {/* Striker Batting Crease Spot */}
              <circle
                cx={CX}
                cy={BATTER_CONTACT_Y}
                r={4}
                strokeWidth="1.5"
                className={FIELD.batter}
              />

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

                const { cls: strokeClass, width: strokeWidth } = shotStyle(
                  shot.runs_scored ?? 0,
                  Boolean(shot.is_wicket),
                );

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
                      strokeWidth={strokeWidth}
                      strokeOpacity={opacity}
                      strokeLinecap="round"
                      className={strokeClass}
                    />
                    {/* Small round marker at the end of boundaries */}
                    {shot.runs_scored &&
                      shot.runs_scored >= 4 &&
                      isVisible && (
                        <circle
                          cx={endPt.x}
                          cy={endPt.y}
                          r={shot.runs_scored === 6 ? 3.5 : 2.8}
                          strokeWidth="1"
                          fillOpacity={opacity}
                          className={cn(
                            shot.runs_scored >= 6 ? "fill-six" : "fill-four",
                            "stroke-card",
                          )}
                        />
                      )}
                  </g>
                );
              })}
            </svg>
          </div>

          {unplacedShots > 0 && (
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              {mappedShots.length === 0
                ? "No shot directions recorded for this innings."
                : `${unplacedShots} scoring ${unplacedShots === 1 ? "shot has" : "shots have"} no direction recorded and ${unplacedShots === 1 ? "is" : "are"} not shown.`}
            </p>
          )}

          {/* Active Sector Indicator (if filtered by sector) */}
          {selectedSectorId && activeSectorInfo && (
            <div className="mt-2 flex items-center gap-2">
              <Badge
                variant="secondary"
                className="gap-1.5 px-2.5 py-1 text-xs font-medium"
              >
                Sector: {activeSectorInfo.label} ({sectorStats.get(selectedSectorId)?.runs ?? 0} runs)
                <button
                  type="button"
                  onClick={() => setSelectedSectorId(null)}
                  className="ml-1 rounded-full p-0.5 hover:bg-accent"
                  aria-label="Clear sector filter"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}
        </div>

        {/* Metrics: runs, balls, strike rate | off side, leg side runs */}
        <div className="rounded-2xl bg-muted p-3 sm:p-4">
          <div className="grid grid-cols-2 divide-x divide-border/60">
            {/* Left Section: Runs, Balls, SR */}
            <div className="grid grid-cols-3 text-center px-1 sm:px-2">
              <div>
                <div className="text-2xs font-medium text-muted-foreground">
                  Runs
                </div>
                <div className="font-score text-lg font-semibold tabular-nums text-foreground sm:text-2xl">
                  {activeRunFilter !== null || selectedSectorId !== null
                    ? totalRuns
                    : overallTotals.runs}
                </div>
              </div>
              <div>
                <div className="text-2xs font-medium text-muted-foreground">
                  Balls
                </div>
                <div className="font-score text-lg font-semibold tabular-nums text-foreground sm:text-2xl">
                  {activeRunFilter !== null || selectedSectorId !== null
                    ? totalBalls
                    : overallTotals.balls}
                </div>
              </div>
              <div>
                <div className="text-2xs font-medium text-muted-foreground">
                  SR
                </div>
                <div className="font-score text-lg font-semibold tabular-nums text-foreground sm:text-2xl">
                  {activeRunFilter !== null || selectedSectorId !== null
                    ? strikeRate
                    : overallTotals.sr}
                </div>
              </div>
            </div>

            {/* Right Section: Off-S, Leg-S */}
            <div className="grid grid-cols-2 text-center px-1 sm:px-2">
              <div>
                <div className="text-2xs font-medium text-muted-foreground">
                  Off side
                </div>
                <div className="font-score text-lg font-semibold tabular-nums text-foreground sm:text-2xl">
                  {activeRunFilter !== null || selectedSectorId !== null
                    ? offSideRuns
                    : overallTotals.off}
                </div>
              </div>
              <div>
                <div className="text-2xs font-medium text-muted-foreground">
                  Leg side
                </div>
                <div className="font-score text-lg font-semibold tabular-nums text-foreground sm:text-2xl">
                  {activeRunFilter !== null || selectedSectorId !== null
                    ? legSideRuns
                    : overallTotals.leg}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Run filter: tap a value to show only those shots. */}
        <div
          role="group"
          aria-label="Filter shots by runs"
          className="grid grid-cols-5 gap-1.5 sm:gap-2"
        >
          {([1, 2, 3, 4, 6] as const).map((r) => {
            const active = activeRunFilter === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => handleToggleRunFilter(r)}
                aria-pressed={active}
                aria-label={`Show ${r}s only (${runCounts[r]})`}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary-soft ring-1 ring-primary/40"
                    : "bg-muted hover:bg-accent",
                )}
              >
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className={cn("h-2 w-2 rounded-full", SHOT_FILL[String(r)])}
                  />
                  {r}s
                </span>
                <span className="font-score text-base font-semibold tabular-nums text-foreground">
                  {runCounts[r]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filters: innings and batter */}
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
                <SelectValue placeholder="Team" />
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
                <SelectValue placeholder="All players" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs sm:text-sm font-medium">
                  All players
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
            <span>Detailed scoring zones breakdown</span>
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
                        ? "border-primary/40 bg-primary-soft text-foreground"
                        : "border-border/60 bg-card hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-block h-2 w-2 rounded-full",
                            s.side === "off"
                              ? "bg-series-1"
                              : "bg-series-2",
                          )}
                        />
                        {s.label}
                      </span>
                      <span className="font-score font-semibold tabular-nums">
                        {st.runs} runs{" "}
                        <span className="text-2xs text-muted-foreground font-normal">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-2xs text-muted-foreground">
                      <span>{st.balls} balls</span>
                      <span className="flex items-center gap-2">
                        {st.fours > 0 && (
                          <span className="font-medium text-four">
                            {st.fours}×4s
                          </span>
                        )}
                        {st.sixes > 0 && (
                          <span className="font-medium text-six">
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
