"use client";

import React, { useState } from "react";
import { cn } from "~/lib/utils";
import { SECTORS, type SectorInfo } from "./wagon-wheel";

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

  // SVG coordinate constants
  const CX = 200;
  const CY = 200;
  const BOUNDARY_R = 165;
  const CIRCLE_R = 95; // 30-yard inner circle

  const handleSectorClick = (sectorId: string) => {
    if (selectedZone === sectorId) {
      onSelectZone(null);
    } else {
      onSelectZone(sectorId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, sectorId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSectorClick(sectorId);
    }
  };

  // Find the selected sector info if any to draw trajectory
  const activeSector = SECTORS.find((s) => s.id === (hoveredSector || selectedZone));

  return (
    <div
      role="region"
      aria-label="Interactive Wagon Wheel Shot Direction Selector"
      className={cn("flex flex-col items-center select-none", className)}
    >
      {/* Visual Cricket Ground SVG */}
      <div className="relative aspect-square w-full max-w-[320px] sm:max-w-[360px]">
        <svg
          viewBox="0 0 400 400"
          className="h-full w-full drop-shadow-md"
          role="img"
          aria-label="Cricket ground wagon wheel shot direction map"
        >
          <defs>
            <radialGradient id="turfSelectorGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#d1fae5" stopOpacity="0.95" />
              <stop offset="65%" stopColor="#ecfdf5" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3" />
            </radialGradient>
            <radialGradient id="circleSelectorGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ecfdf5" stopOpacity="0.1" />
            </radialGradient>
            <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer Boundary Ground Circle */}
          <circle
            cx={CX}
            cy={CY}
            r={BOUNDARY_R + 15}
            fill="#fffdfa"
            stroke="#10b981"
            strokeWidth="1.2"
            strokeOpacity="0.3"
          />
          <circle
            cx={CX}
            cy={CY}
            r={BOUNDARY_R}
            fill="url(#turfSelectorGrad)"
            stroke="#059669"
            strokeWidth="2.5"
            strokeOpacity="0.85"
          />

          {/* 30-yard Inner Circle */}
          <circle
            cx={CX}
            cy={CY}
            r={CIRCLE_R}
            fill="url(#circleSelectorGrad)"
            stroke="#10b981"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            strokeOpacity="0.6"
          />

          {/* 8 Sector Radial Divider Lines */}
          {SECTORS.map((s) => {
            const rad = ((s.angleStart - 90) * Math.PI) / 180;
            const x2 = CX + BOUNDARY_R * Math.cos(rad);
            const y2 = CY + BOUNDARY_R * Math.sin(rad);
            return (
              <line
                key={`line-${s.id}`}
                x1={CX}
                y1={CY}
                x2={x2}
                y2={y2}
                stroke="#059669"
                strokeWidth="1"
                strokeDasharray="3 3"
                strokeOpacity="0.35"
              />
            );
          })}

          {/* 8 Interactive Wedge Paths */}
          {SECTORS.map((s) => {
            const r1 = (s.angleStart * Math.PI) / 180;
            const r2 = (s.angleEnd * Math.PI) / 180;
            const x1 = CX + BOUNDARY_R * Math.sin(r1);
            const y1 = CY - BOUNDARY_R * Math.cos(r1);
            const x2 = CX + BOUNDARY_R * Math.sin(r2);
            const y2 = CY - BOUNDARY_R * Math.cos(r2);

            const isSelected = selectedZone === s.id;
            const isHovered = hoveredSector === s.id;

            return (
              <g
                key={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Select ${s.label}`}
                onClick={() => handleSectorClick(s.id)}
                onKeyDown={(e) => handleKeyDown(e, s.id)}
                onMouseEnter={() => setHoveredSector(s.id)}
                onMouseLeave={() => setHoveredSector(null)}
                className="cursor-pointer focus:outline-none"
              >
                <path
                  d={`M ${CX} ${CY} L ${x1} ${y1} A ${BOUNDARY_R} ${BOUNDARY_R} 0 0 1 ${x2} ${y2} Z`}
                  fill={
                    isSelected
                      ? "rgba(16, 185, 129, 0.45)"
                      : isHovered
                        ? "rgba(16, 185, 129, 0.22)"
                        : "transparent"
                  }
                  stroke={isSelected ? "#059669" : "transparent"}
                  strokeWidth={isSelected ? "2" : "0"}
                  className="transition-colors duration-150"
                />
              </g>
            );
          })}

          {/* Central Pitch (Creases & Stumps) */}
          <rect
            x={CX - 7}
            y={CY - 22}
            width={14}
            height={44}
            fill="#fef3c7"
            rx={2.5}
            stroke="#f59e0b"
            strokeWidth="1.2"
          />
          {/* Striker Batting Crease */}
          <line
            x1={CX - 9}
            y1={CY + 14}
            x2={CX + 9}
            y2={CY + 14}
            stroke="#d97706"
            strokeWidth="1.2"
          />
          {/* Stumps */}
          <circle cx={CX} cy={CY - 18} r={1.8} fill="#ef4444" />
          <circle cx={CX} cy={CY + 18} r={1.8} fill="#ef4444" />

          {/* Active Shot Trajectory Vector (when selected or hovered) */}
          {activeSector && (
            <g className="pointer-events-none transition-all duration-200">
              {(() => {
                const rad = (activeSector.midAngle * Math.PI) / 180;
                const endX = CX + BOUNDARY_R * 0.9 * Math.sin(rad);
                const endY = CY - BOUNDARY_R * 0.9 * Math.cos(rad);
                return (
                  <>
                    <line
                      x1={CX}
                      y1={CY + 14}
                      x2={endX}
                      y2={endY}
                      stroke="#047857"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray="4 2"
                    />
                    <circle
                      cx={endX}
                      cy={endY}
                      r={5}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="2"
                      filter="url(#glowEffect)"
                    />
                  </>
                );
              })()}
            </g>
          )}

          {/* Sector Labels Around Perimeter */}
          {showLabels &&
            SECTORS.map((s) => {
              const rad = (s.midAngle * Math.PI) / 180;
              const labelR = BOUNDARY_R + 15;
              const lx = CX + labelR * Math.sin(rad);
              const ly = CY - labelR * Math.cos(rad);

              const isSelected = selectedZone === s.id;
              const isHovered = hoveredSector === s.id;
              const isHighlighted = isSelected || isHovered;

              return (
                <text
                  key={`label-${s.id}`}
                  x={lx}
                  y={ly}
                  fill={
                    isSelected
                      ? "#047857"
                      : isHighlighted
                        ? "#059669"
                        : "#475569"
                  }
                  fontSize={isSelected ? "9.5" : "8.5"}
                  fontWeight={isSelected ? "800" : isHighlighted ? "700" : "600"}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none transition-colors dark:fill-slate-200"
                >
                  {s.label}
                </text>
              );
            })}
        </svg>
      </div>

    </div>
  );
}
