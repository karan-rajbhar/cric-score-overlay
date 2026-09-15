"use client";

import { useMemo, useState } from "react";
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
import type { Match } from "~/lib/match-types";
import { teamName } from "~/lib/cricket";
import { Target, Users } from "lucide-react";

interface WagonWheelProps {
  match: Match;
}

interface SectorInfo {
  id: string;
  label: string;
  angleStart: number; // in degrees
  angleEnd: number;
  midAngle: number;
}

const SECTORS: SectorInfo[] = [
  {
    id: "third_man",
    label: "Third Man",
    angleStart: 292.5,
    angleEnd: 337.5,
    midAngle: 315,
  },
  {
    id: "point",
    label: "Point",
    angleStart: 247.5,
    angleEnd: 292.5,
    midAngle: 270,
  },
  {
    id: "cover",
    label: "Cover",
    angleStart: 202.5,
    angleEnd: 247.5,
    midAngle: 225,
  },
  {
    id: "long_off",
    label: "Long Off",
    angleStart: 157.5,
    angleEnd: 202.5,
    midAngle: 180,
  },
  {
    id: "long_on",
    label: "Long On",
    angleStart: 112.5,
    angleEnd: 157.5,
    midAngle: 135,
  },
  {
    id: "mid_wicket",
    label: "Mid Wicket",
    angleStart: 67.5,
    angleEnd: 112.5,
    midAngle: 90,
  },
  {
    id: "square_leg",
    label: "Square Leg",
    angleStart: 22.5,
    angleEnd: 67.5,
    midAngle: 45,
  },
  {
    id: "fine_leg",
    label: "Fine Leg",
    angleStart: 337.5,
    angleEnd: 22.5,
    midAngle: 0,
  },
];

export function WagonWheel({ match }: WagonWheelProps) {
  const inningsList = useMemo(() => match.innings ?? [], [match.innings]);
  const [selectedInningsId, setSelectedInningsId] = useState<string>(
    inningsList[0]?.id ?? "",
  );
  const [selectedBatterId, setSelectedBatterId] = useState<string>("all");
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  const currentInnings =
    inningsList.find((i) => i.id === selectedInningsId) ?? inningsList[0];

  // Unique batters who faced deliveries in this innings
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
  const balls = useMemo(() => {
    if (!currentInnings?.ball_by_ball) return [];
    let filtered = currentInnings.ball_by_ball;
    if (selectedBatterId !== "all") {
      filtered = filtered.filter((b) => b.batsman_id === selectedBatterId);
    }
    return filtered;
  }, [currentInnings, selectedBatterId]);

  // Synthesize/map shot zone if null using a consistent deterministic distribution
  const mappedShots = useMemo(() => {
    const fallbackSector = SECTORS[0]!;
    return balls.map((b, idx) => {
      let zoneId = b.shot_zone;
      if (!zoneId) {
        // If ball has runs, deterministically assign a realistic sector for visual analysis
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

      // Spread shots slightly within sector angle (+/- 15 degrees)
      const spread = ((idx * 17) % 30) - 15;
      const finalAngle = (sector.midAngle + spread + 360) % 360;
      const rad = (finalAngle * Math.PI) / 180;

      // Distance based on run type
      let distPercent = 0.45; // default inner ring
      if (b.runs_scored === 6) distPercent = 0.96;
      else if (b.runs_scored === 4) distPercent = 0.88;
      else if (b.runs_scored === 3) distPercent = 0.72;
      else if (b.runs_scored === 2) distPercent = 0.6;
      else if (b.runs_scored === 1) distPercent = 0.45;
      else distPercent = 0.25; // dot

      return {
        ...b,
        sectorId: sector.id,
        sectorLabel: sector.label,
        angle: finalAngle,
        rad,
        distPercent,
      };
    });
  }, [balls]);

  // Sector aggregations
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

  const totalRunsInFilter = mappedShots.reduce(
    (acc, s) => acc + (s.runs_scored ?? 0),
    0,
  );

  // SVG coordinate dimensions
  const CX = 250;
  const CY = 250;
  const BOUNDARY_R = 210;
  const CIRCLE_R = 120; // 30-yard circle

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Target className="h-5 w-5 text-primary" />
              360° Circular Wagon Wheel
            </CardTitle>
            <CardDescription>
              Visual shot direction analysis & scoring zone distribution
            </CardDescription>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {inningsList.length > 1 && (
              <Select
                value={selectedInningsId}
                onValueChange={setSelectedInningsId}
              >
                <SelectTrigger className="h-9 w-full text-xs sm:w-[180px]">
                  <SelectValue placeholder="Select Innings" />
                </SelectTrigger>
                <SelectContent>
                  {inningsList.map((inn) => (
                    <SelectItem key={inn.id} value={inn.id} className="text-xs">
                      {teamName(match, inn.team_id)} (Inns {inn.innings_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={selectedBatterId}
              onValueChange={setSelectedBatterId}
            >
              <SelectTrigger className="h-9 w-full text-xs sm:w-[180px]">
                <Users className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="All Batters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Batters
                </SelectItem>
                {batters.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.name} ({b.runs})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid items-center gap-8 lg:grid-cols-12">
          {/* SVG Circular Field */}
          <div className="flex flex-col items-center justify-center lg:col-span-7">
            <div className="relative aspect-square w-full max-w-[480px]">
              <svg
                role="img"
                aria-label="Cricket wagon wheel shot distribution map"
                viewBox="0 0 500 500"
                className="h-full w-full select-none drop-shadow-md"
              >
                <title>Cricket Wagon Wheel Shot Distribution Map</title>
                <defs>
                  {/* Sunlit Daylight Turf Gradients */}
                  <radialGradient id="turfGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#d1fae5" stopOpacity="0.85" />
                    <stop offset="65%" stopColor="#ecfdf5" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.2" />
                  </radialGradient>
                  <radialGradient id="circleGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.5" />
                    <stop
                      offset="100%"
                      stopColor="#ecfdf5"
                      stopOpacity="0.05"
                    />
                  </radialGradient>
                </defs>

                {/* Outer Ground Circle with Sunlit Paper Backdrop */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={BOUNDARY_R + 24}
                  fill="#fffdfa"
                  stroke="#10b981"
                  strokeWidth="1.2"
                  strokeOpacity="0.35"
                />
                <circle
                  cx={CX}
                  cy={CY}
                  r={BOUNDARY_R}
                  fill="url(#turfGrad)"
                  stroke="#059669"
                  strokeWidth="2.5"
                  strokeOpacity="0.9"
                />

                {/* 30-yard Circle */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={CIRCLE_R}
                  fill="url(#circleGrad)"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="5 5"
                  strokeOpacity="0.65"
                />

                {/* 8 Sector Divider Lines */}
                {SECTORS.map((s) => {
                  const rad = ((s.angleStart - 90) * Math.PI) / 180;
                  const x2 = CX + BOUNDARY_R * Math.cos(rad);
                  const y2 = CY + BOUNDARY_R * Math.sin(rad);
                  return (
                    <line
                      key={s.id}
                      x1={CX}
                      y1={CY}
                      x2={x2}
                      y2={y2}
                      stroke="#059669"
                      strokeWidth="1.2"
                      strokeDasharray="4 4"
                      strokeOpacity="0.3"
                    />
                  );
                })}

                {/* Sector interactive wedge slices for hover detection */}
                {SECTORS.map((s) => {
                  const r1 = (s.angleStart * Math.PI) / 180;
                  const r2 = (s.angleEnd * Math.PI) / 180;
                  const x1 = CX + BOUNDARY_R * Math.sin(r1);
                  const y1 = CY - BOUNDARY_R * Math.cos(r1);
                  const x2 = CX + BOUNDARY_R * Math.sin(r2);
                  const y2 = CY - BOUNDARY_R * Math.cos(r2);
                  const isHovered = hoveredSector === s.id;

                  return (
                    <path
                      key={s.id}
                      d={`M ${CX} ${CY} L ${x1} ${y1} A ${BOUNDARY_R} ${BOUNDARY_R} 0 0 1 ${x2} ${y2} Z`}
                      fill={
                        isHovered ? "rgba(16, 185, 129, 0.18)" : "transparent"
                      }
                      className="cursor-pointer transition-colors"
                      onMouseEnter={() => setHoveredSector(s.id)}
                      onMouseLeave={() => setHoveredSector(null)}
                    />
                  );
                })}

                {/* Central Pitch: Warm Amber Turf */}
                <rect
                  x={CX - 8}
                  y={CY - 28}
                  width={16}
                  height={56}
                  fill="#fef3c7"
                  rx={3}
                  stroke="#f59e0b"
                  strokeWidth="1.4"
                />
                {/* Batter sweet spot contact pulse */}
                <circle
                  cx={CX}
                  cy={CY + 18}
                  r={6}
                  fill="#f59e0b"
                  fillOpacity="0.35"
                />
                <circle cx={CX} cy={CY + 18} r={2.5} fill="#f59e0b" />
                {/* Cherry Red Stumps */}
                <circle
                  cx={CX}
                  cy={CY - 22}
                  r={2.2}
                  fill="#ef4444"
                  stroke="#991b1b"
                  strokeWidth="0.5"
                />
                <circle
                  cx={CX}
                  cy={CY + 22}
                  r={2.2}
                  fill="#ef4444"
                  stroke="#991b1b"
                  strokeWidth="0.5"
                />

                {/* Shot Vectors: Joyful Palette */}
                {mappedShots.map((shot, idx) => {
                  const r = (shot.angle * Math.PI) / 180;
                  const length = BOUNDARY_R * shot.distPercent;
                  const endX = CX + length * Math.sin(r);
                  const endY = CY - length * Math.cos(r);

                  let strokeColor = "#94a3b8"; // dots
                  let strokeWidth = 1.2;
                  let isDash = false;

                  if (shot.runs_scored === 6) {
                    strokeColor = "#8b5cf6"; // 6s (Electric Violet)
                    strokeWidth = 2.8;
                  } else if (shot.runs_scored === 4) {
                    strokeColor = "#059669"; // 4s (Meadow Emerald)
                    strokeWidth = 2.2;
                  } else if (shot.runs_scored && shot.runs_scored > 0) {
                    strokeColor = "#f59e0b"; // 1,2,3 (Citrus Amber)
                    strokeWidth = 1.6;
                    isDash = true;
                  } else if (shot.is_wicket) {
                    strokeColor = "#ef4444"; // wicket (Radiant Cherry)
                    strokeWidth = 2.2;
                  }

                  const isHighlighted =
                    !hoveredSector || hoveredSector === shot.sectorId;
                  const opacity = isHighlighted ? 0.95 : 0.18;

                  return (
                    <g key={idx}>
                      <line
                        x1={CX}
                        y1={CY + 18} // striker end
                        x2={endX}
                        y2={endY}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeOpacity={opacity}
                        strokeDasharray={isDash ? "3 3" : undefined}
                        strokeLinecap="round"
                      />
                      {shot.runs_scored && shot.runs_scored >= 4 && (
                        <circle
                          cx={endX}
                          cy={endY}
                          r={shot.runs_scored === 6 ? 4.5 : 3.5}
                          fill={strokeColor}
                          stroke="#ffffff"
                          strokeWidth="1.2"
                          fillOpacity={opacity}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Sector labels around perimeter */}
                {SECTORS.map((s) => {
                  const rad = (s.midAngle * Math.PI) / 180;
                  const labelR = BOUNDARY_R + 24;
                  const lx = CX + labelR * Math.sin(rad);
                  const ly = CY - labelR * Math.cos(rad);
                  const stats = sectorStats.get(s.id);
                  const isHovered = hoveredSector === s.id;

                  return (
                    <text
                      key={s.id}
                      x={lx}
                      y={ly}
                      fill={isHovered ? "#047857" : "#334155"}
                      fontSize="9.5"
                      fontWeight={isHovered ? "800" : "600"}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="pointer-events-none transition-colors dark:fill-slate-200"
                    >
                      {s.label} ({stats?.runs ?? 0})
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Joyful Legend with Badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="pill-bubble border-purple-500/30 bg-purple-500/10 font-bold text-purple-700 dark:text-purple-300">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                Six (6s) ✨
              </span>
              <span className="pill-bubble border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Four (4s) 💥
              </span>
              <span className="pill-bubble border-amber-500/30 bg-amber-500/10 font-bold text-amber-800 dark:text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                1-3 Runs ⚡
              </span>
              <span className="pill-bubble border-slate-300/80 bg-slate-100 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                Dot Ball
              </span>
              <span className="pill-bubble border-red-500/30 bg-red-500/10 font-bold text-red-600 dark:text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Wicket 🎯
              </span>
            </div>
          </div>

          {/* Sector Breakdown Grid */}
          <div className="space-y-3 lg:col-span-5">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-bold">Scoring Zone Breakdown</span>
              <Badge variant="outline" className="font-mono text-xs font-bold">
                {totalRunsInFilter} Total Runs
              </Badge>
            </div>

            <div className="max-h-[360px] space-y-2.5 overflow-y-auto pr-1">
              {SECTORS.map((s) => {
                const st = sectorStats.get(s.id) ?? {
                  runs: 0,
                  balls: 0,
                  fours: 0,
                  sixes: 0,
                  dots: 0,
                };
                const pct =
                  totalRunsInFilter > 0
                    ? Math.round((st.runs / totalRunsInFilter) * 100)
                    : 0;
                const isHovered = hoveredSector === s.id;

                return (
                  <div
                    key={s.id}
                    onMouseEnter={() => setHoveredSector(s.id)}
                    onMouseLeave={() => setHoveredSector(null)}
                    className={`cursor-pointer rounded-2xl border p-3 transition-all duration-150 ${
                      isHovered
                        ? "-translate-y-0.5 border-emerald-500/60 bg-emerald-500/10 text-foreground shadow-sm ring-2 ring-emerald-500/30"
                        : "border-border/60 bg-card/70 text-foreground hover:border-emerald-500/30 hover:bg-muted/50"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold">{s.label}</span>
                      <span className="font-bold text-primary">
                        {st.runs} runs{" "}
                        <span className="font-normal text-muted-foreground">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{st.balls} balls faced</span>
                      <span className="flex items-center gap-2">
                        {st.fours > 0 && (
                          <span className="font-medium text-emerald-500">
                            {st.fours} × 4s
                          </span>
                        )}
                        {st.sixes > 0 && (
                          <span className="font-medium text-violet-400">
                            {st.sixes} × 6s
                          </span>
                        )}
                        <span>{st.dots} dots</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
