"use client";

import React, { useState, useRef } from "react";
import { cn } from "~/lib/utils";
import { FIELD } from "./wagon-wheel-field";
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
  const [clickAngle, setClickAngle] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // SVG coordinate constants
  const CX = 200;
  const CY = 200;
  const R_OUTER = 190;
  const R_GRASS = 142;
  const R_30YD = 94;
  const R_INNER_GUIDE = 50;
  const R_TEXT = (R_OUTER + R_GRASS) / 2;
  // The striker's crease, at the bottom end of the pitch: the field is seen
  // from behind the striker (see SECTORS), so shots start here.
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
      let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      setClickAngle(angle);
    } else {
      setClickDistanceRatio(0.92);
      setClickAngle(null);
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
    setClickAngle(angle);
    onSelectZone(sector.id);
  };

  // Find the selected sector info if any to draw trajectory
  const activeSector = SECTORS.find(
    (s) => s.id === (hoveredSector || selectedZone),
  );

  return (
    <div
      role="region"
      aria-label="Where the ball went"
      className={cn("flex select-none flex-col items-center", className)}
    >
      {/* Visual Cricket Ground SVG */}
      <div className="relative aspect-square w-full max-w-[340px] sm:max-w-[380px]">
        <svg
          ref={svgRef}
          viewBox="0 0 400 400"
          className="h-full w-full cursor-pointer"
          role="img"
          aria-label="Cricket ground wagon wheel shot direction map"
          onClick={handleSvgClick}
        >
          {/* 1. Base Green Cricket Turf Ground Circle (Inside Boundary) */}
          <circle
            cx={CX}
            cy={CY}
            r={R_GRASS}
            strokeWidth="1"
            className={FIELD.grass}
          />

          {/* 30-yard Inner Circle Guide */}
          <circle
            cx={CX}
            cy={CY}
            r={R_30YD}
            strokeWidth="1.2"
            strokeDasharray="4 4"
            className={cn("pointer-events-none", FIELD.ring30)}
          />

          {/* Infield Inner Guide Circle */}
          <circle
            cx={CX}
            cy={CY}
            r={R_INNER_GUIDE}
            strokeWidth="0.8"
            strokeDasharray="3 3"
            className={cn("pointer-events-none", FIELD.guide)}
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
                // Keyboard focus shows the hover highlight (an outline does
                // not draw on an SVG group).
                onFocus={() => setHoveredSector(s.id)}
                onBlur={() => setHoveredSector(null)}
                className="cursor-pointer focus:outline-none"
              >
                {/* Sector wedge on turf (inside the boundary) */}
                <path
                  d={turfWedgeD}
                  className={cn(
                    "transition-colors duration-150",
                    isSelected
                      ? "fill-primary/15"
                      : isHovered
                        ? "fill-primary/5"
                        : "fill-transparent",
                  )}
                />

                {/* Outer dark segment (at the boundary) */}
                <path
                  d={donutD}
                  strokeWidth="2"
                  className={cn(
                    "transition-colors duration-150",
                    isSelected
                      ? "fill-primary stroke-card"
                      : isHovered
                        ? "fill-accent stroke-card"
                        : FIELD.ring,
                  )}
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
                  strokeWidth="0.8"
                  strokeDasharray="3 3"
                  className={FIELD.radial}
                />
                {/* Line across outer ring */}
                <line
                  x1={innerPt.x}
                  y1={innerPt.y}
                  x2={outerPt.x}
                  y2={outerPt.y}
                  strokeWidth="2"
                  className={FIELD.divider}
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
                  fontSize="9"
                  fontWeight={isSelected || isHovered ? "700" : "600"}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={cn(
                    "pointer-events-none select-none font-sans",
                    isSelected
                      ? "fill-primary-foreground"
                      : isHovered
                        ? FIELD.labelSelected
                        : FIELD.label,
                  )}
                >
                  {s.label}
                </text>
              );
            })}

          {/* Pitch: the bowler's end at the top, the striker's crease and
              stumps at the bottom, where every shot starts */}
          <g className="pointer-events-none">
            <rect
              x={CX - 7}
              y={CY - 22}
              width={14}
              height={44}
              rx={2}
              strokeWidth="1"
              className={FIELD.pitch}
            />
            <line
              x1={CX - 8}
              y1={CY - 14}
              x2={CX + 8}
              y2={CY - 14}
              strokeWidth="1"
              className={FIELD.crease}
            />
            <line
              x1={CX - 8}
              y1={BATTER_CONTACT_Y}
              x2={CX + 8}
              y2={BATTER_CONTACT_Y}
              strokeWidth="1.2"
              className={FIELD.crease}
            />
            <circle cx={CX} cy={CY - 17} r={1.4} className={FIELD.farStumps} />
            <g className={FIELD.stumps}>
              <rect x={CX - 4.5} y={CY + 16} width={1.6} height={5} rx={0.5} />
              <rect x={CX - 0.8} y={CY + 16} width={1.6} height={5} rx={0.5} />
              <rect x={CX + 2.9} y={CY + 16} width={1.6} height={5} rx={0.5} />
            </g>
            <circle
              cx={CX}
              cy={BATTER_CONTACT_Y}
              r={3.2}
              strokeWidth="1.5"
              className={FIELD.batter}
            />
          </g>

          {/* Active Shot Trajectory Vector (when selected or hovered) */}
          {activeSector && (
            <g className="pointer-events-none transition-all duration-200">
              {(() => {
                const ratio = clickDistanceRatio ?? 0.92;
                const angle =
                  clickAngle !== null && selectedZone === activeSector.id
                    ? clickAngle
                    : activeSector.midAngle;
                const endPt = polarToCartesian(CX, CY, R_GRASS * ratio, angle);
                return (
                  <>
                    <line
                      x1={CX}
                      y1={BATTER_CONTACT_Y}
                      x2={endPt.x}
                      y2={endPt.y}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className={FIELD.aim}
                    />
                    <circle
                      cx={endPt.x}
                      cy={endPt.y}
                      r={5}
                      strokeWidth="1.8"
                      className={FIELD.aimEnd}
                    />
                  </>
                );
              })()}
            </g>
          )}
        </svg>
      </div>

      <p className="mt-1.5 text-2xs font-medium text-muted-foreground">
        Seen from behind the batter, who is at the bottom end. Tap where the
        ball went.
      </p>
    </div>
  );
}
