"use client";

import React, { useState, useRef } from "react";
import { cn } from "~/lib/utils";
import {
  SECTORS,
  type SectorInfo,
  polarToCartesian,
  describeDonutSegment,
  describeWedge,
  getSectorFromAngle,
} from "~/lib/wagon-wheel-utils";

export { SECTORS as WAGON_WHEEL_SECTORS, type SectorInfo };

interface WagonWheelSelectorProps {
  selectedZone?: string | null;
  onSelectZone: (zone: string | null) => void;
  className?: string;
  showLabels?: boolean;
}

export function WagonWheelSelector({
  selectedZone,
  onSelectZone,
  className,
  showLabels = true,
}: WagonWheelSelectorProps) {
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
  const [clickDistanceRatio, setClickDistanceRatio] = useState<number | null>(
    null,
  );
  const svgRef = useRef<SVGSVGElement | null>(null);

  // SVG coordinate constants
  const CX = 200;
  const CY = 200;
  const R_OUTER = 190;
  const R_GRASS = 142;
  const R_30YD = 94;
  const R_INNER_GUIDE = 50;
  const R_TEXT = (R_OUTER + R_GRASS) / 2;
  const BATTER_CONTACT_Y = CY + 14;

  const handleSectorClick = (
    sectorId: string,
    e?: React.MouseEvent | React.KeyboardEvent,
  ) => {
    if (e && "clientX" in e && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = 400 / rect.width;
      const scaleY = 400 / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      const dx = clickX - CX;
      const dy = clickY - CY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Clamp distance between 0.35 and 1.0 of grass radius
      const ratio = Math.max(0.35, Math.min(1.0, dist / R_GRASS));
      setClickDistanceRatio(ratio);
    } else {
      setClickDistanceRatio(0.92);
    }

    if (selectedZone === sectorId) {
      onSelectZone(null);
    } else {
      onSelectZone(sectorId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, sectorId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSectorClick(sectorId, e);
    }
  };

  // Click handler on SVG field directly to support clicking anywhere inside or at boundary
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = 400 / rect.width;
    const scaleY = 400 / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const dx = clickX - CX;
    const dy = CY - clickY; // Invert y since SVG y points downwards

    // Calculate angle from 12 o'clock clockwise
    let angle = (Math.atan2(dx, dy) * 180) / Math.PI;
    if (angle < 0) angle += 360;

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10) return; // Ignore clicks directly on the stumps/batsman

    const sector = getSectorFromAngle(angle);
    const ratio = Math.max(0.35, Math.min(1.0, dist / R_GRASS));
    setClickDistanceRatio(ratio);
    onSelectZone(sector.id);
  };

  // Find the selected sector info if any to draw trajectory
  const activeSector = SECTORS.find(
    (s) => s.id === (hoveredSector || selectedZone),
  );

  return (
    <div
      role="region"
      aria-label="Interactive Wagon Wheel Shot Direction Selector"
      className={cn("flex flex-col items-center select-none", className)}
    >
      {/* Visual Cricket Ground SVG */}
      <div className="relative aspect-square w-full max-w-[340px] sm:max-w-[380px]">
        <svg
          ref={svgRef}
          viewBox="0 0 400 400"
          className="h-full w-full drop-shadow-md cursor-pointer"
          role="img"
          aria-label="Cricket ground wagon wheel shot direction map"
          onClick={handleSvgClick}
        >
          <defs>
            <radialGradient id="turfSelectorGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3ca752" />
              <stop offset="70%" stopColor="#2e8b42" />
              <stop offset="100%" stopColor="#246e34" />
            </radialGradient>
            <radialGradient id="circleSelectorGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#48bb60" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#246e34" stopOpacity="0.05" />
            </radialGradient>
            <filter
              id="glowEffectSelector"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. Base Green Cricket Turf Ground Circle (Inside Boundary) */}
          <circle
            cx={CX}
            cy={CY}
            r={R_GRASS}
            fill="url(#turfSelectorGrad)"
            stroke="#1e293b"
            strokeWidth="2"
          />

          {/* 30-yard Inner Circle Guide */}
          <circle
            cx={CX}
            cy={CY}
            r={R_30YD}
            fill="url(#circleSelectorGrad)"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            strokeOpacity="0.5"
            className="pointer-events-none"
          />

          {/* Infield Inner Guide Circle */}
          <circle
            cx={CX}
            cy={CY}
            r={R_INNER_GUIDE}
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.8"
            strokeDasharray="3 3"
            strokeOpacity="0.25"
            className="pointer-events-none"
          />

          {/* 2. Interactive Sector Buttons (Spans BOTH Inside Boundary & At Boundary) */}
          {SECTORS.map((s) => {
            const isSelected = selectedZone === s.id;
            const isHovered = hoveredSector === s.id;

            // Wedge path inside the boundary (grass turf)
            const turfWedgeD = describeWedge(
              CX,
              CY,
              R_GRASS,
              s.angleStart,
              s.angleEnd,
            );

            // Donut segment path at the boundary (outer dark ring)
            const donutD = describeDonutSegment(
              CX,
              CY,
              R_GRASS,
              R_OUTER,
              s.angleStart,
              s.angleEnd,
            );

            return (
              <g
                key={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Select ${s.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSectorClick(s.id, e);
                }}
                onKeyDown={(e) => handleKeyDown(e, s.id)}
                onMouseEnter={() => setHoveredSector(s.id)}
                onMouseLeave={() => setHoveredSector(null)}
                className="cursor-pointer focus:outline-none"
              >
                {/* Sector wedge on turf (inside the boundary) */}
                <path
                  d={turfWedgeD}
                  fill={
                    isSelected
                      ? "rgba(16, 185, 129, 0.4)"
                      : isHovered
                        ? "rgba(16, 185, 129, 0.2)"
                        : "transparent"
                  }
                  stroke={isSelected ? "#10b981" : "transparent"}
                  strokeWidth={isSelected ? "1.5" : "0"}
                  className="transition-colors duration-150"
                />

                {/* Outer dark segment (at the boundary) */}
                <path
                  d={donutD}
                  fill={
                    isSelected
                      ? "#047857"
                      : isHovered
                        ? "#334155"
                        : "#1e293b"
                  }
                  stroke={isSelected ? "#10b981" : "#0f172a"}
                  strokeWidth={isSelected ? "2" : "1.2"}
                  className="transition-colors duration-150"
                />
              </g>
            );
          })}

          {/* Divider Lines extending from center through grass to outer boundary */}
          {SECTORS.map((s) => {
            const innerPt = polarToCartesian(CX, CY, R_GRASS, s.angleStart);
            const outerPt = polarToCartesian(CX, CY, R_OUTER, s.angleStart);
            return (
              <g key={`divider-${s.id}`} className="pointer-events-none">
                {/* Line across grass */}
                <line
                  x1={CX}
                  y1={CY}
                  x2={innerPt.x}
                  y2={innerPt.y}
                  stroke="#ffffff"
                  strokeOpacity="0.22"
                  strokeWidth="0.8"
                  strokeDasharray="3 3"
                />
                {/* Line across outer ring */}
                <line
                  x1={innerPt.x}
                  y1={innerPt.y}
                  x2={outerPt.x}
                  y2={outerPt.y}
                  stroke="#ffffff"
                  strokeOpacity="0.35"
                  strokeWidth="1.2"
                />
              </g>
            );
          })}

          {/* Outer Ring Sector Labels */}
          {showLabels &&
            SECTORS.map((s) => {
              const txtPos = polarToCartesian(CX, CY, R_TEXT, s.midAngle);
              const isSelected = selectedZone === s.id;
              const isHovered = hoveredSector === s.id;

              return (
                <text
                  key={`label-${s.id}`}
                  x={txtPos.x}
                  y={txtPos.y}
                  fill={
                    isSelected
                      ? "#a7f3d0"
                      : isHovered
                        ? "#38bdf8"
                        : "#f8fafc"
                  }
                  fontSize="8.5"
                  fontWeight={isSelected || isHovered ? "800" : "600"}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none select-none font-sans"
                >
                  {s.label}
                </text>
              );
            })}

          {/* Central Pitch (Creases & Stumps) */}
          <rect
            x={CX - 7}
            y={CY - 22}
            width={14}
            height={44}
            fill="#f5ebd7"
            rx={2}
            stroke="#d4af37"
            strokeWidth="1.2"
            className="pointer-events-none"
          />
          {/* Striker Batting Crease */}
          <line
            x1={CX - 8}
            y1={BATTER_CONTACT_Y}
            x2={CX + 8}
            y2={BATTER_CONTACT_Y}
            stroke="#b4833e"
            strokeWidth="1.2"
            className="pointer-events-none"
          />
          {/* Stumps */}
          <circle
            cx={CX}
            cy={CY - 17}
            r={1.6}
            fill="#ef4444"
            className="pointer-events-none"
          />
          <circle
            cx={CX}
            cy={CY + 17}
            r={1.6}
            fill="#ef4444"
            className="pointer-events-none"
          />

          {/* Striker Batting Crease Spot */}
          <circle
            cx={CX}
            cy={BATTER_CONTACT_Y}
            r={3.2}
            fill="#f59e0b"
            className="pointer-events-none"
          />

          {/* Active Shot Trajectory Vector (when selected or hovered) */}
          {activeSector && (
            <g className="pointer-events-none transition-all duration-200">
              {(() => {
                const ratio = clickDistanceRatio ?? 0.92;
                const endPt = polarToCartesian(
                  CX,
                  CY,
                  R_GRASS * ratio,
                  activeSector.midAngle,
                );
                return (
                  <>
                    <line
                      x1={CX}
                      y1={BATTER_CONTACT_Y}
                      x2={endPt.x}
                      y2={endPt.y}
                      stroke="#facc15"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle
                      cx={endPt.x}
                      cy={endPt.y}
                      r={5}
                      fill="#facc15"
                      stroke="#ffffff"
                      strokeWidth="1.8"
                      filter="url(#glowEffectSelector)"
                    />
                  </>
                );
              })()}
            </g>
          )}
        </svg>
      </div>

      <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
        Tap anywhere inside the boundary or at the boundary to select shot
      </p>
    </div>
  );
}
