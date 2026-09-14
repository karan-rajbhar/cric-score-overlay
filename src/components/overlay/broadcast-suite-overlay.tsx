"use client";

import React, { useMemo } from "react";
import type { BroadcastViewId, LiveMatchState, OverlayTheme } from "./types";
import type {
  Match,
  BattingPerformance,
  BowlingPerformance,
  TeamPlayer,
} from "~/lib/match-types";
import { X } from "lucide-react";

export interface BroadcastSuiteOverlayProps {
  state: LiveMatchState;
  match?: Match | null;
  activeView: BroadcastViewId;
  onSelectView?: (view: BroadcastViewId) => void;
  showControls?: boolean;
  onCloseCard?: () => void;
  theme?: OverlayTheme;
}

export const BROADCAST_VIEW_OPTIONS: Array<{
  id: BroadcastViewId;
  label: string;
}> = [
  { id: "1", label: "Scorebar" },
  { id: "2", label: "Batting Team 1(I1)" },
  { id: "6", label: "Squad Team 1" },
  { id: "3", label: "Bowling Team 1(I1)" },
  { id: "4", label: "Batting Team 2(I1)" },
  { id: "5", label: "Bowling Team 2(I1)" },
  { id: "7", label: "Squad Team 2" },
  { id: "13", label: "Intro" },
  { id: "14", label: "Innings Break" },
  { id: "15", label: "Drinks Break" },
  { id: "28", label: "Rain Delay" },
  { id: "16", label: "Batsman Stats" },
  { id: "17", label: "Runner Stats" },
  { id: "18", label: "Bowler Stats" },
  { id: "19", label: "Out Batsman" },
  { id: "24", label: "Batsman Career" },
  { id: "25", label: "Runner Career" },
  { id: "26", label: "Bowler Career" },
  { id: "27", label: "Out Batsman Career" },
  { id: "36", label: "Batsman Series" },
  { id: "37", label: "Runner Series" },
  { id: "38", label: "Bowler Series" },
  { id: "39", label: "Out Batsman Series" },
  { id: "23", label: "Partnership" },
  { id: "8", label: "Summary" },
  { id: "20", label: "Points Table" },
  { id: "21", label: "Over by Over" },
  { id: "22", label: "Worm" },
  { id: "29", label: "Player of the Match" },
];

export interface BroadcastThemeConfig {
  name: string;
  containerClass: string;
  containerStyle: React.CSSProperties;
  scoreTopClass: string;
  scoreTopStyle?: React.CSSProperties;
  centerBadgeClass: string;
  centerBadgeStyle: React.CSSProperties;
  wingStyle: React.CSSProperties;
  accentRunsClass: string;
  accentSecondaryClass: string;
  bottomBarClass: string;
  bottomBarStyle?: React.CSSProperties;
  cardBorderClass: string;
  cardHeaderClass: string;
  boundary4Class: string;
  boundary6Class: string;
  wicketClass: string;
  dotBallClass: string;
}

export const DEFAULT_BROADCAST_THEME: BroadcastThemeConfig = {
  name: "Star Sports (IPL)",
  containerClass:
    "border-2 border-blue-500/80 shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_35px_rgba(59,130,246,0.35)]",
  containerStyle: {
    background: "#050e24",
    borderColor: "rgba(59, 130, 246, 0.85)",
  },
  scoreTopClass: "bg-gradient-to-r from-[#071330] via-[#0d2254] to-[#071330]",
  centerBadgeClass:
    "shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_25px_rgba(245,158,11,0.5)]",
  centerBadgeStyle: {
    background: "linear-gradient(135deg, #1d4ed8 0%, #0c1a3b 100%)",
    borderColor: "#fbbf24",
    borderWidth: "3px",
  },
  wingStyle: { background: "rgba(251, 191, 36, 0.6)" },
  accentRunsClass: "text-amber-400 font-mono font-black",
  accentSecondaryClass: "text-sky-400 font-bold",
  bottomBarClass: "bg-[#020713] border-t border-blue-500/30",
  cardBorderClass:
    "border-2 border-blue-500/80 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(59,130,246,0.3)]",
  cardHeaderClass:
    "bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-900 border-b-2 border-amber-400",
  boundary4Class: "bg-blue-600 text-white font-black border-blue-400",
  boundary6Class:
    "bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black border-yellow-200",
  wicketClass: "bg-red-600 text-white font-black border-red-400",
  dotBallClass: "bg-white/10 text-slate-400 border-white/15",
};

export const BROADCAST_THEME_MAP: Record<string, BroadcastThemeConfig> = {
  starsports: DEFAULT_BROADCAST_THEME,
  sonysports: {
    name: "Sony Sports (LIV)",
    containerClass:
      "border-2 border-red-600/90 shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_35px_rgba(220,38,38,0.4)]",
    containerStyle: {
      background: "#101012",
      borderColor: "rgba(220, 38, 38, 0.9)",
    },
    scoreTopClass: "bg-gradient-to-r from-[#18181b] via-[#27272a] to-[#18181b]",
    centerBadgeClass:
      "shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_25px_rgba(220,38,38,0.5)]",
    centerBadgeStyle: {
      background: "linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)",
      borderColor: "#fca5a5",
      borderWidth: "3px",
    },
    wingStyle: { background: "rgba(220, 38, 38, 0.7)" },
    accentRunsClass: "text-red-400 font-mono font-black",
    accentSecondaryClass: "text-rose-300 font-bold",
    bottomBarClass: "bg-[#09090b] border-t-2 border-red-600",
    cardBorderClass:
      "border-2 border-red-600/80 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(220,38,38,0.35)]",
    cardHeaderClass:
      "bg-gradient-to-r from-red-900 via-zinc-950 to-red-900 border-b-2 border-red-500",
    boundary4Class: "bg-red-700 text-white font-black border-red-400",
    boundary6Class:
      "bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 text-white font-black border-rose-300",
    wicketClass: "bg-black text-red-500 border-2 border-red-500 font-black",
    dotBallClass: "bg-zinc-800 text-zinc-400 border-zinc-700",
  },
  foxcricket: {
    name: "Fox Cricket",
    containerClass:
      "border-2 border-orange-500/90 shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_35px_rgba(249,115,22,0.4)]",
    containerStyle: {
      background: "#0c0a09",
      borderColor: "rgba(249, 115, 22, 0.9)",
    },
    scoreTopClass: "bg-gradient-to-r from-[#1c1917] via-[#292524] to-[#1c1917]",
    centerBadgeClass:
      "shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_25px_rgba(249,115,22,0.5)]",
    centerBadgeStyle: {
      background: "linear-gradient(135deg, #ea580c 0%, #7c2d12 100%)",
      borderColor: "#fed7aa",
      borderWidth: "3px",
    },
    wingStyle: { background: "rgba(249, 115, 22, 0.7)" },
    accentRunsClass: "text-orange-400 font-mono font-black",
    accentSecondaryClass: "text-amber-300 font-bold",
    bottomBarClass: "bg-[#060504] border-t-2 border-orange-500",
    cardBorderClass:
      "border-2 border-orange-500/80 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(249,115,22,0.35)]",
    cardHeaderClass:
      "bg-gradient-to-r from-orange-950 via-stone-950 to-orange-950 border-b-2 border-orange-500",
    boundary4Class: "bg-orange-600 text-white font-black border-orange-400",
    boundary6Class:
      "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 text-black font-black border-amber-300",
    wicketClass: "bg-red-600 text-white font-black border-red-400",
    dotBallClass: "bg-stone-800 text-stone-400 border-stone-700",
  },
  skysports: {
    name: "Sky Sports (Ashes)",
    containerClass:
      "border-2 border-red-700/80 shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_35px_rgba(185,28,28,0.35)]",
    containerStyle: {
      background: "#050b1a",
      borderColor: "rgba(185, 28, 28, 0.85)",
    },
    scoreTopClass: "bg-gradient-to-r from-[#091533] via-[#102047] to-[#091533]",
    centerBadgeClass:
      "shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_25px_rgba(185,28,28,0.45)]",
    centerBadgeStyle: {
      background: "linear-gradient(135deg, #b91c1c 0%, #1e1b4b 100%)",
      borderColor: "#fca5a5",
      borderWidth: "3px",
    },
    wingStyle: { background: "rgba(185, 28, 28, 0.6)" },
    accentRunsClass: "text-red-400 font-mono font-black",
    accentSecondaryClass: "text-sky-300 font-bold",
    bottomBarClass: "bg-[#030610] border-t border-red-600/40",
    cardBorderClass:
      "border-2 border-red-700/80 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(185,28,28,0.3)]",
    cardHeaderClass:
      "bg-gradient-to-r from-red-950 via-slate-950 to-red-950 border-b-2 border-red-500",
    boundary4Class: "bg-red-600 text-white font-black border-red-400",
    boundary6Class:
      "bg-gradient-to-r from-red-600 to-amber-500 text-white font-black border-amber-300",
    wicketClass: "bg-black text-red-500 border-2 border-red-500 font-black",
    dotBallClass: "bg-slate-800 text-slate-400 border-slate-700",
  },
  apex: {
    name: "Apex 24K Gold",
    containerClass:
      "border-2 border-amber-400/90 shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_40px_rgba(245,158,11,0.5)]",
    containerStyle: {
      background: "#0d0c09",
      borderColor: "rgba(245, 158, 11, 0.9)",
    },
    scoreTopClass: "bg-gradient-to-r from-[#17150f] via-[#241f15] to-[#17150f]",
    centerBadgeClass:
      "shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_30px_rgba(245,158,11,0.6)]",
    centerBadgeStyle: {
      background: "linear-gradient(135deg, #d97706 0%, #78350f 100%)",
      borderColor: "#fde68a",
      borderWidth: "3px",
    },
    wingStyle: { background: "rgba(245, 158, 11, 0.7)" },
    accentRunsClass: "text-amber-300 font-mono font-black",
    accentSecondaryClass: "text-yellow-400 font-bold",
    bottomBarClass: "bg-[#070604] border-t-2 border-amber-500",
    cardBorderClass:
      "border-2 border-amber-400/80 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(245,158,11,0.45)]",
    cardHeaderClass:
      "bg-gradient-to-r from-amber-950 via-neutral-950 to-amber-950 border-b-2 border-amber-400",
    boundary4Class: "bg-amber-600 text-black font-black border-amber-300",
    boundary6Class:
      "bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 text-black font-black border-yellow-100",
    wicketClass: "bg-red-600 text-white font-black border-red-400",
    dotBallClass: "bg-neutral-800 text-amber-200/50 border-neutral-700",
  },
  volt: {
    name: "Volt Sports-Tech",
    containerClass:
      "border-2 border-lime-400/90 shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_35px_rgba(163,230,53,0.4)]",
    containerStyle: {
      background: "#040d0a",
      borderColor: "rgba(163, 230, 53, 0.9)",
    },
    scoreTopClass: "bg-gradient-to-r from-[#071a13] via-[#0d2d21] to-[#071a13]",
    centerBadgeClass:
      "shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_25px_rgba(163,230,53,0.5)]",
    centerBadgeStyle: {
      background: "linear-gradient(135deg, #65a30d 0%, #064e3b 100%)",
      borderColor: "#bef264",
      borderWidth: "3px",
    },
    wingStyle: { background: "rgba(163, 230, 53, 0.7)" },
    accentRunsClass: "text-lime-300 font-mono font-black",
    accentSecondaryClass: "text-emerald-400 font-bold",
    bottomBarClass: "bg-[#020705] border-t-2 border-lime-400",
    cardBorderClass:
      "border-2 border-lime-400/80 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(163,230,53,0.35)]",
    cardHeaderClass:
      "bg-gradient-to-r from-emerald-950 via-zinc-950 to-emerald-950 border-b-2 border-lime-400",
    boundary4Class: "bg-cyan-500 text-black font-black border-cyan-300",
    boundary6Class: "bg-lime-400 text-black font-black border-lime-200",
    wicketClass: "bg-red-600 text-white font-black border-red-400",
    dotBallClass: "bg-neutral-900 text-lime-400/50 border-neutral-800",
  },
  agni: {
    name: "Agni Inferno",
    containerClass:
      "border-2 border-orange-600/90 shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_45px_rgba(234,88,12,0.5)]",
    containerStyle: {
      background: "#120501",
      borderColor: "rgba(234, 88, 12, 0.95)",
    },
    scoreTopClass: "bg-gradient-to-r from-[#200802] via-[#350f04] to-[#200802]",
    centerBadgeClass:
      "shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_30px_rgba(234,88,12,0.6)]",
    centerBadgeStyle: {
      background: "linear-gradient(135deg, #c2410c 0%, #431407 100%)",
      borderColor: "#ffedd5",
      borderWidth: "3px",
    },
    wingStyle: { background: "rgba(234, 88, 12, 0.7)" },
    accentRunsClass: "text-orange-400 font-mono font-black",
    accentSecondaryClass: "text-amber-400 font-bold",
    bottomBarClass: "bg-[#0a0200] border-t-2 border-orange-600",
    cardBorderClass:
      "border-2 border-orange-600/80 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_45px_rgba(234,88,12,0.45)]",
    cardHeaderClass:
      "bg-gradient-to-r from-orange-950 via-red-950 to-orange-950 border-b-2 border-orange-500",
    boundary4Class: "bg-orange-600 text-white font-black border-orange-400",
    boundary6Class:
      "bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 text-white font-black border-yellow-300",
    wicketClass: "bg-red-600 text-white font-black border-red-400",
    dotBallClass: "bg-stone-900 text-orange-400/50 border-stone-800",
  },
  thehundred: {
    name: "The Hundred",
    containerClass:
      "border-2 border-pink-500/90 shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_40px_rgba(236,72,153,0.45)]",
    containerStyle: {
      background: "#14031c",
      borderColor: "rgba(236, 72, 153, 0.9)",
    },
    scoreTopClass: "bg-gradient-to-r from-[#240532] via-[#380b4d] to-[#240532]",
    centerBadgeClass:
      "shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_25px_rgba(236,72,153,0.5)]",
    centerBadgeStyle: {
      background: "linear-gradient(135deg, #db2777 0%, #0891b2 100%)",
      borderColor: "#f472b6",
      borderWidth: "3px",
    },
    wingStyle: { background: "rgba(236, 72, 153, 0.7)" },
    accentRunsClass: "text-pink-400 font-mono font-black",
    accentSecondaryClass: "text-cyan-300 font-bold",
    bottomBarClass: "bg-[#0a010e] border-t-2 border-cyan-400",
    cardBorderClass:
      "border-2 border-pink-500/80 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(236,72,153,0.4)]",
    cardHeaderClass:
      "bg-gradient-to-r from-pink-950 via-purple-950 to-cyan-950 border-b-2 border-pink-400",
    boundary4Class: "bg-cyan-500 text-black font-black border-cyan-300",
    boundary6Class: "bg-pink-500 text-white font-black border-pink-300",
    wicketClass: "bg-red-600 text-white font-black border-red-400",
    dotBallClass: "bg-fuchsia-950 text-pink-300/50 border-fuchsia-900",
  },
  dharma: {
    name: "Dharma Gold",
    containerClass:
      "border-2 border-amber-600/90 shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_35px_rgba(217,119,6,0.45)]",
    containerStyle: {
      background: "#130a04",
      borderColor: "rgba(217, 119, 6, 0.9)",
    },
    scoreTopClass: "bg-gradient-to-r from-[#231206] via-[#351c09] to-[#231206]",
    centerBadgeClass:
      "shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_25px_rgba(217,119,6,0.5)]",
    centerBadgeStyle: {
      background: "linear-gradient(135deg, #b45309 0%, #451a03 100%)",
      borderColor: "#fde68a",
      borderWidth: "3px",
    },
    wingStyle: { background: "rgba(217, 119, 6, 0.7)" },
    accentRunsClass: "text-amber-300 font-mono font-black",
    accentSecondaryClass: "text-yellow-400 font-bold",
    bottomBarClass: "bg-[#0a0502] border-t-2 border-amber-600",
    cardBorderClass:
      "border-2 border-amber-600/80 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(217,119,6,0.4)]",
    cardHeaderClass:
      "bg-gradient-to-r from-amber-950 via-stone-950 to-amber-950 border-b-2 border-amber-500",
    boundary4Class: "bg-amber-600 text-black font-black border-amber-300",
    boundary6Class:
      "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 text-black font-black border-yellow-200",
    wicketClass: "bg-red-600 text-white font-black border-red-400",
    dotBallClass: "bg-stone-900 text-amber-300/50 border-stone-800",
  },
  thunder: {
    name: "Thunder Indigo",
    containerClass:
      "border-2 border-cyan-500/90 shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_35px_rgba(6,182,212,0.45)]",
    containerStyle: {
      background: "#03071e",
      borderColor: "rgba(6, 182, 212, 0.9)",
    },
    scoreTopClass: "bg-gradient-to-r from-[#091238] via-[#0f1e56] to-[#091238]",
    centerBadgeClass:
      "shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_25px_rgba(6,182,212,0.55)]",
    centerBadgeStyle: {
      background: "linear-gradient(135deg, #0891b2 0%, #1e1b4b 100%)",
      borderColor: "#67e8f9",
      borderWidth: "3px",
    },
    wingStyle: { background: "rgba(6, 182, 212, 0.7)" },
    accentRunsClass: "text-cyan-300 font-mono font-black",
    accentSecondaryClass: "text-sky-400 font-bold",
    bottomBarClass: "bg-[#020412] border-t-2 border-cyan-500",
    cardBorderClass:
      "border-2 border-cyan-500/80 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(6,182,212,0.4)]",
    cardHeaderClass:
      "bg-gradient-to-r from-cyan-950 via-indigo-950 to-cyan-950 border-b-2 border-cyan-400",
    boundary4Class: "bg-cyan-600 text-white font-black border-cyan-300",
    boundary6Class:
      "bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-black border-cyan-100",
    wicketClass: "bg-red-600 text-white font-black border-red-400",
    dotBallClass: "bg-indigo-950 text-cyan-300/50 border-indigo-900",
  },
  nakshatra: {
    name: "Nakshatra Cosmic",
    containerClass:
      "border-2 border-purple-500/90 shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_40px_rgba(168,85,247,0.45)]",
    containerStyle: {
      background: "#0e051a",
      borderColor: "rgba(168, 85, 247, 0.9)",
    },
    scoreTopClass: "bg-gradient-to-r from-[#1b0c30] via-[#2a134d] to-[#1b0c30]",
    centerBadgeClass:
      "shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_25px_rgba(168,85,247,0.55)]",
    centerBadgeStyle: {
      background: "linear-gradient(135deg, #7e22ce 0%, #3b0764 100%)",
      borderColor: "#fde047",
      borderWidth: "3px",
    },
    wingStyle: { background: "rgba(168, 85, 247, 0.7)" },
    accentRunsClass: "text-amber-300 font-mono font-black",
    accentSecondaryClass: "text-purple-300 font-bold",
    bottomBarClass: "bg-[#06020c] border-t-2 border-purple-500",
    cardBorderClass:
      "border-2 border-purple-500/80 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(168,85,247,0.4)]",
    cardHeaderClass:
      "bg-gradient-to-r from-purple-950 via-fuchsia-950 to-purple-950 border-b-2 border-amber-400",
    boundary4Class: "bg-purple-600 text-white font-black border-purple-300",
    boundary6Class:
      "bg-gradient-to-r from-amber-400 via-fuchsia-500 to-purple-600 text-white font-black border-yellow-200",
    wicketClass: "bg-red-600 text-white font-black border-red-400",
    dotBallClass: "bg-purple-950 text-purple-300/50 border-purple-900",
  },
  emerald: {
    name: "Emerald Cricket",
    containerClass:
      "border-2 border-emerald-500/90 shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_35px_rgba(16,185,129,0.45)]",
    containerStyle: {
      background: "#04120b",
      borderColor: "rgba(16, 185, 129, 0.9)",
    },
    scoreTopClass: "bg-gradient-to-r from-[#092416] via-[#0e3722] to-[#092416]",
    centerBadgeClass:
      "shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_25px_rgba(16,185,129,0.55)]",
    centerBadgeStyle: {
      background: "linear-gradient(135deg, #059669 0%, #064e3b 100%)",
      borderColor: "#fde047",
      borderWidth: "3px",
    },
    wingStyle: { background: "rgba(16, 185, 129, 0.7)" },
    accentRunsClass: "text-amber-300 font-mono font-black",
    accentSecondaryClass: "text-emerald-300 font-bold",
    bottomBarClass: "bg-[#020905] border-t-2 border-emerald-500",
    cardBorderClass:
      "border-2 border-emerald-500/80 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(16,185,129,0.4)]",
    cardHeaderClass:
      "bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-950 border-b-2 border-emerald-400",
    boundary4Class: "bg-emerald-600 text-white font-black border-emerald-300",
    boundary6Class:
      "bg-gradient-to-r from-yellow-400 to-emerald-500 text-black font-black border-yellow-200",
    wicketClass: "bg-red-600 text-white font-black border-red-400",
    dotBallClass: "bg-emerald-950 text-emerald-300/50 border-emerald-900",
  },
  dark: {
    name: "Dark Titanium",
    containerClass:
      "border-2 border-white/25 shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_30px_rgba(255,255,255,0.15)]",
    containerStyle: {
      background: "#0a0a0a",
      borderColor: "rgba(255, 255, 255, 0.25)",
    },
    scoreTopClass: "bg-gradient-to-r from-[#171717] via-[#262626] to-[#171717]",
    centerBadgeClass:
      "shadow-[0_10px_30px_rgba(0,0,0,0.95),0_0_25px_rgba(255,255,255,0.2)]",
    centerBadgeStyle: {
      background: "linear-gradient(135deg, #404040 0%, #171717 100%)",
      borderColor: "#ffffff",
      borderWidth: "3px",
    },
    wingStyle: { background: "rgba(255, 255, 255, 0.4)" },
    accentRunsClass: "text-sky-400 font-mono font-black",
    accentSecondaryClass: "text-slate-300 font-bold",
    bottomBarClass: "bg-[#050505] border-t-2 border-white/20",
    cardBorderClass:
      "border-2 border-white/25 shadow-[0_25px_60px_rgba(0,0,0,0.95)]",
    cardHeaderClass:
      "bg-gradient-to-r from-neutral-900 via-zinc-900 to-neutral-900 border-b-2 border-white/30",
    boundary4Class: "bg-sky-600 text-white font-black border-sky-400",
    boundary6Class: "bg-white text-black font-black border-slate-300",
    wicketClass: "bg-red-600 text-white font-black border-red-400",
    dotBallClass: "bg-neutral-800 text-neutral-400 border-neutral-700",
  },
  broadcast: DEFAULT_BROADCAST_THEME,
  minimal: DEFAULT_BROADCAST_THEME,
  custom: DEFAULT_BROADCAST_THEME,
};

export function BroadcastSuiteOverlay({
  state,
  match = null,
  activeView = "1",
  onSelectView,
  showControls = false,
  onCloseCard,
  theme = "starsports",
}: BroadcastSuiteOverlayProps) {
  const t: BroadcastThemeConfig =
    theme && BROADCAST_THEME_MAP[theme]
      ? BROADCAST_THEME_MAP[theme]
      : DEFAULT_BROADCAST_THEME;
  // Format overs string e.g. "16.1"
  const oversFormatted = (balls: number | null) => {
    if (!balls) return "0.0";
    return `${Math.floor(balls / 6)}.${balls % 6}`;
  };

  const team1Name = state.team1_name ?? match?.team1?.name ?? "Team 1";
  const team1Code =
    state.team1_short_name ??
    match?.team1?.short_name ??
    team1Name.slice(0, 3).toUpperCase();
  const team2Name = state.team2_name ?? match?.team2?.name ?? "Team 2";
  const team2Code =
    state.team2_short_name ??
    match?.team2?.short_name ??
    team2Name.slice(0, 3).toUpperCase();

  const isSecondInnings = (state.innings_number ?? 1) >= 2;
  const battingTeamName = state.batting_team_name ?? team1Name;
  const isMatchEnded = Boolean(
    state.result_description || state.status === "completed",
  );

  // Recent balls list
  const recentBalls = useMemo(() => {
    if (!state.this_over_balls) return [];
    return state.this_over_balls.split(" ").filter(Boolean);
  }, [state.this_over_balls]);

  // Innings data
  const inn1 = match?.innings?.[0];
  const inn2 = match?.innings?.[1];

  const inn1Overs = inn1 ? oversFormatted(inn1.total_balls) : "0.0";
  const inn2Overs = inn2
    ? oversFormatted(inn2.total_balls)
    : oversFormatted(state.total_balls);

  const inn1Total = inn1
    ? inn1.total_runs
    : isSecondInnings
      ? state.target_runs
        ? state.target_runs - 1
        : 0
      : (state.total_runs ?? 0);
  const inn1Wickets = inn1 ? inn1.total_wickets : 10;

  const inn2Total = inn2
    ? inn2.total_runs
    : isSecondInnings
      ? (state.total_runs ?? 0)
      : 0;
  const inn2Wickets = inn2
    ? inn2.total_wickets
    : isSecondInnings
      ? (state.total_wickets ?? 0)
      : 0;

  // Fallback striker strike rate
  const strikerSr =
    state.striker_runs !== null &&
    state.striker_balls &&
    state.striker_balls > 0
      ? ((state.striker_runs * 100) / state.striker_balls).toFixed(1)
      : "0.0";

  const runnerSr =
    state.non_striker_runs !== null &&
    state.non_striker_balls &&
    state.non_striker_balls > 0
      ? ((state.non_striker_runs * 100) / state.non_striker_balls).toFixed(1)
      : "0.0";

  const bowlerEcon =
    state.bowler_runs !== null && state.bowler_balls && state.bowler_balls > 0
      ? ((state.bowler_runs * 6) / state.bowler_balls).toFixed(2)
      : "0.00";

  // Toss text
  const tossText = state.toss_winner_team_id
    ? `${state.toss_winner_team_id === match?.team1_id ? team1Name : team2Name} WON THE TOSS AND ELECTED TO ${state.toss_decision === "bowl" ? "BOWL" : "BAT"}`
    : `${team1Name} WON THE TOSS AND ELECTED TO BAT`;

  // Equation text
  const equationText =
    state.runs_needed !== null && state.balls_remaining !== null
      ? `${state.batting_team_short_name ?? battingTeamName} NEED ${state.runs_needed} FROM ${oversFormatted(state.balls_remaining)} OVERS ${state.required_run_rate ?? "—"} RRR`
      : `${team1Name} VS ${team2Name}`;

  return (
    <div
      className={`mainWrap win select-none font-score theme-${theme}`}
      data-theme={theme}
    >
      {/* ===================================================================== */}
      {/* 0. Live Broadcast View Switcher Bar (premiumBtns)                 */}
      {/* ===================================================================== */}
      {showControls && (
        <div className="pointer-events-auto fixed left-1/2 top-4 z-50 max-w-[96vw] -translate-x-1/2">
          <div className="premiumBtns" id="premiumBtns">
            {BROADCAST_VIEW_OPTIONS.map((opt, idx) => (
              <button
                key={opt.id}
                data-view={opt.id}
                onClick={() => onSelectView?.(opt.id)}
                className={`btn btn-premium switcher ${idx === 0 ? "first" : ""} ${
                  activeView === opt.id ? "active" : ""
                }`}
              >
                {opt.label}
              </button>
            ))}
            <div className="placeholder" />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. SCOREBAR (data-view="1")                                           */}
      {/* ===================================================================== */}
      {(activeView === "1" ||
        activeView === "16" ||
        activeView === "17" ||
        activeView === "18" ||
        activeView === "19" ||
        activeView === "24" ||
        activeView === "25" ||
        activeView === "26" ||
        activeView === "27" ||
        activeView === "29" ||
        activeView === "36" ||
        activeView === "37" ||
        activeView === "38" ||
        activeView === "39") && (
        <div className="overlayWrap ScoreBar duration-300 animate-in slide-in-from-bottom-5">
          <div
            className={`scoreContainer ${t.containerClass}`}
            style={t.containerStyle}
          >
            {/* Match Ended Banner */}
            {isMatchEnded && (
              <div className={`matchEnded ${t.cardHeaderClass}`}>
                <div className="mEnded team1">
                  <span className="t2Code text-amber-300">{team2Code}</span>
                  <span className="t2Total">{inn2Total}</span>/
                  <span className="t2Wickets">{inn2Wickets}</span>
                  <span className="oversended">OVERS</span>
                  <span className="t2Overs">{inn2Overs}</span>
                </div>
                <div className="result">
                  <span>{state.result_description ?? equationText}</span>
                </div>
                <div className="mEnded team2">
                  <span className="t1Code text-sky-300">{team1Code}</span>
                  <span className="t1Total">{inn1Total}</span>/
                  <span className="t1Wickets">{inn1Wickets}</span>
                  <span className="oversended">OVERS</span>
                  <span className="t1Overs">{inn1Overs}</span>
                </div>
              </div>
            )}

            {/* ScoreTop: Left Wing (Batsmen) & Right Wing (Bowler) */}
            <div
              className={`scoreTop ${t.scoreTopClass}`}
              style={t.scoreTopStyle}
            >
              {/* Left Wing */}
              <div className="mainLeft">
                <div
                  className="team1logo teamlogoscorebar"
                  style={{
                    backgroundImage: state.team1_logo_url
                      ? `url(${state.team1_logo_url})`
                      : undefined,
                  }}
                />
                <div className="flex flex-col gap-0.5">
                  <div className="batsman1">
                    <div className="batsman1Name" id="batsman1Name">
                      {state.striker_name ?? "Striker"} *
                    </div>
                    <div
                      className={`batsman1Runs ${t.accentRunsClass}`}
                      id="batsman1Runs"
                    >
                      {state.striker_runs ?? 0}
                    </div>
                    <div className="batsman1Balls" id="batsman1Balls">
                      {state.striker_balls ?? 0}
                    </div>
                  </div>
                  <div className="batsman2">
                    <div className="batsman2Name" id="batsman2Name">
                      {state.non_striker_name ?? "Non-Striker"}
                    </div>
                    <div
                      className={`batsman2Runs ${t.accentRunsClass}`}
                      id="batsman2Runs"
                    >
                      {state.non_striker_runs ?? 0}
                    </div>
                    <div className="batsman2Balls" id="batsman2Balls">
                      {state.non_striker_balls ?? 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Wing */}
              <div className="mainRight">
                <div className="innerRightScorebar">
                  <div className="bowlerStatScore">
                    <span
                      className="bowlerName bowlerleftscore"
                      id="bowlerName"
                    >
                      {state.current_bowler_name ?? "Bowler"}
                    </span>
                    <span
                      className={`bowlerRuns ${t.accentRunsClass}`}
                      id="bowlerRuns"
                    >
                      {state.bowler_runs ?? 0}
                    </span>
                    <span className="bowlerWickets" id="bowlerWickets">
                      {state.bowler_wickets ?? 0}
                    </span>
                    <span className="overlabelbowler">OVERS</span>
                    <span
                      className={`bowlerOvers ${t.accentSecondaryClass}`}
                      id="bowlerOvers"
                    >
                      {oversFormatted(state.bowler_balls)}
                    </span>
                  </div>
                </div>
                <div
                  className="team2logo teamlogoscorebar"
                  style={{
                    backgroundImage: state.team2_logo_url
                      ? `url(${state.team2_logo_url})`
                      : undefined,
                  }}
                />
              </div>
            </div>

            {/* Center Prominent Broadcast 3D Badge */}
            <div className="mainCenter">
              <div
                className={`mainCAbsWrap ${t.centerBadgeClass}`}
                style={t.centerBadgeStyle}
              >
                <div className="mainCenterBL mainCenterB" style={t.wingStyle} />
                <div className="mainCenterBR mainCenterB" style={t.wingStyle} />
                <div className="mainCenterTop">
                  <div className="mainCenterTopLeft t1Code text-sky-400">
                    {team1Code}
                  </div>
                  <div className="text-xs font-black text-white/40">VS</div>
                  <div className="mainCenterTopLeft t2Code text-amber-400">
                    {team2Code}
                  </div>
                  <div className="mainCenterTopRight ml-2">
                    <span className="tTotal">{state.total_runs ?? 0}</span>
                    <span className={`tWickets ${t.accentRunsClass}`}>
                      {state.total_wickets ?? 0}
                    </span>
                  </div>
                </div>
                <div className="mainCenterBottom">
                  <div className="mainCenterBottomLeft">
                    <span>RR</span>
                    <span className={`runrate ${t.accentSecondaryClass}`}>
                      {state.current_run_rate ?? "0.00"}
                    </span>
                  </div>
                  <div className="mainCenterBottomRight">
                    <span>OVERS</span>
                    <span className="overs colorwhite">
                      {oversFormatted(state.total_balls)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ScoreBottom: Equation & Delivery Matrix */}
            <div
              className={`scoreBottom ${t.bottomBarClass}`}
              style={t.bottomBarStyle}
            >
              <div className="scBottomLeft">
                {!isSecondInnings ? (
                  <div className="firstIn" id="firstInningButtomTab">
                    <span className="t1Name text-sky-300">{team1Name}</span>
                    <span className="colorc1 firstinningvs"> VS </span>
                    <span className="t2Name text-amber-300">{team2Name}</span>
                  </div>
                ) : (
                  <div className="secondIn">
                    <div className="bottomLeft">
                      <span
                        className="showScoreMsgForOpositTeam text-slate-300"
                        id="showScoreMsgForOpositTeam"
                      >
                        <span className="numberColorClass font-bold">
                          {team1Code}
                        </span>{" "}
                        {inn1Total}/{inn1Wickets}
                        <span className="numberColorClass"> OVERS </span>
                        {inn1Overs}
                      </span>
                    </div>
                    <div className="bottomMed showRunsRequired border-l border-white/10 pl-3">
                      <div className="need-hide scoreEquation flex items-center gap-1.5">
                        <span className="colorc1 smallf text-amber-400">
                          NEED
                        </span>
                        <span className="requiredRuns">
                          {state.runs_needed ?? 0}
                        </span>
                        <span className="colorc1 smallf text-white/70">of</span>
                        <span className="remainingBalls">
                          {state.balls_remaining ?? 0}
                        </span>
                        <span className="colorc1 smallf text-white/70">
                          balls
                        </span>
                        <span className="RRR ml-1">
                          {state.required_run_rate ?? "—"}
                        </span>
                        <span className="colorc1 smallf text-amber-400">
                          RRR
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Matrix */}
              <div className="scBottomRight">
                <div className="ballsMainWrap">
                  {recentBalls.length > 0 ? (
                    recentBalls.map((b, idx) => (
                      <span key={idx} className="currentball dotBall">
                        <span className="normal_ball">
                          {b === "0" ? "•" : b}
                        </span>
                      </span>
                    ))
                  ) : (
                    <span className="currentball dotBall">
                      <span className="normal_ball">•</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="mainCenterShadow" />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. BATTING TEAM 1 (I1) (data-view="2") & BATTING TEAM 2 (I1) (data-view="4") */}
      {/* ===================================================================== */}
      {(activeView === "2" || activeView === "4") && (
        <div
          className={`overlayWrap card ${activeView === "2" ? "Batting1" : "Batting2"} active duration-200 animate-in zoom-in-95`}
        >
          <div className={`insideWrap relative ${t.cardBorderClass}`}>
            {onCloseCard && (
              <button
                onClick={onCloseCard}
                aria-label="Close Card"
                className="absolute right-4 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className={`teaminfo ${t.cardHeaderClass}`}>
              <div className="teamtitle t1Name">
                {activeView === "2" ? team1Name : team2Name} · BATTING CARD
              </div>
            </div>
            <div className="insideWrapInside battingcard">
              {((activeView === "2" ? inn1 : inn2)?.batting_performances || [])
                .length > 0 ? (
                (
                  (activeView === "2" ? inn1 : inn2)?.batting_performances || []
                ).map((bp: BattingPerformance, idx: number) => (
                  <div key={idx} className="scoreRow">
                    <div className="name font-bold text-white">
                      {bp.user?.full_name ?? "Batter"} {!bp.is_out && "*"}
                    </div>
                    <div className="status">
                      {!bp.is_out ? (
                        <span className="font-bold text-emerald-400">
                          not out
                        </span>
                      ) : (
                        <span>{bp.dismissal_type ?? "out"}</span>
                      )}
                    </div>
                    <div className="runs">{bp.runs_scored}</div>
                    <div className="balls">({bp.balls_faced})</div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center italic text-slate-400">
                  Live scorecard is updating with every delivery.
                </div>
              )}
            </div>
            <div className="scoreRow total bowling but_batting">
              <span className="cardlabel colorc1">Overs</span>
              <span className="t1Overs ml-1 font-mono">
                {activeView === "2" ? inn1Overs : inn2Overs}
              </span>
              <span className="cardlabel colorc1 ml-4">RR</span>
              <span className="t1RR ml-1 font-mono">
                {state.current_run_rate ?? "0.0"}
              </span>
              <span className="cardlabel colorc1 ml-4">Extras</span>
              <span className="t1Extras ml-1 font-mono">
                {(activeView === "2" ? inn1 : inn2)?.extras_total ?? 0}
              </span>
              <span className="cardlabel colorc1 ml-4">Total</span>
              <span className="t1Total ml-1 font-mono text-amber-300">
                {(activeView === "2" ? inn1 : inn2)?.total_runs ??
                  state.total_runs ??
                  0}
                /
                {(activeView === "2" ? inn1 : inn2)?.total_wickets ??
                  state.total_wickets ??
                  0}
              </span>
            </div>
            <div className="scoreRowtotal">
              <div className="tossWon">{tossText}</div>
              {isSecondInnings && (
                <div className="showMsgForScoreNeeded mt-1 font-bold text-amber-300">
                  {equationText}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. BOWLING TEAM 1 (I1) (data-view="3") & BOWLING TEAM 2 (I1) (data-view="5") */}
      {/* ===================================================================== */}
      {(activeView === "3" || activeView === "5") && (
        <div
          className={`overlayWrap card ${activeView === "3" ? "Bowling1" : "Bowling2"} active duration-200 animate-in zoom-in-95`}
        >
          <div className={`insideWrap relative ${t.cardBorderClass}`}>
            {onCloseCard && (
              <button
                onClick={onCloseCard}
                aria-label="Close Card"
                className="absolute right-4 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className={`teaminfo ${t.cardHeaderClass}`}>
              <div className="teamtitle t2Name">
                {activeView === "3" ? team2Name : team1Name} · BOWLING CARD
              </div>
            </div>
            <div className="insideWrapInside bowlingcard">
              {((activeView === "3" ? inn1 : inn2)?.bowling_performances || [])
                .length > 0 ? (
                (
                  (activeView === "3" ? inn1 : inn2)?.bowling_performances || []
                ).map((bw: BowlingPerformance, idx: number) => {
                  const ov = `${Math.floor(bw.balls_bowled / 6)}.${bw.balls_bowled % 6}`;
                  const econ =
                    bw.balls_bowled > 0
                      ? ((bw.runs_conceded * 6) / bw.balls_bowled).toFixed(2)
                      : "0.00";
                  return (
                    <div key={idx} className="scoreRow">
                      <div className="name font-bold text-white">
                        {bw.user?.full_name ?? "Bowler"}
                      </div>
                      <div className="status">
                        O: <span className="font-mono text-white">{ov}</span> ·
                        M:{" "}
                        <span className="font-mono text-white">
                          {bw.maidens}
                        </span>
                      </div>
                      <div className="runs text-amber-300">
                        {bw.wickets_taken}/{bw.runs_conceded}
                      </div>
                      <div className="balls text-slate-300">Econ: {econ}</div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center italic text-slate-400">
                  Bowling figures active.
                </div>
              )}
            </div>
            <div className="scoreRow total bowling powered-wrap">
              <span className="cardlabel colorc1">Overs</span>
              <span className="t1Overs ml-1 font-mono">
                {activeView === "3" ? inn1Overs : inn2Overs}
              </span>
              <span className="cardlabel colorc1 ml-4">Extras</span>
              <span className="t1Extras ml-1 font-mono">
                {(activeView === "3" ? inn1 : inn2)?.extras_total ?? 0}
              </span>
              <span className="cardlabel colorc1 ml-4">Total</span>
              <span className="t1Total ml-1 font-mono text-amber-300">
                {(activeView === "3" ? inn1 : inn2)?.total_runs ?? 0}/
                {(activeView === "3" ? inn1 : inn2)?.total_wickets ?? 0}
              </span>
            </div>
            <div className="scoreRowtotal">
              <div className="tossWon">{tossText}</div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. SQUAD TEAM 1 (data-view="6") & SQUAD TEAM 2 (data-view="7")        */}
      {/* ===================================================================== */}
      {(activeView === "6" || activeView === "7") && (
        <div
          className={`overlayWrap card ${activeView === "6" ? "Squad1" : "Squad2"} duration-200 animate-in zoom-in-95`}
        >
          <div
            className={`insideWrap relative ${t.cardBorderClass}`}
            style={{ width: "800px" }}
          >
            {onCloseCard && (
              <button
                onClick={onCloseCard}
                aria-label="Close Card"
                className="absolute right-4 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className={`teaminfo ${t.cardHeaderClass}`}>
              <div className="teamtitle">
                {activeView === "6" ? team1Name : team2Name} · PLAYING XI
              </div>
            </div>
            <div className="insideWrapInside grid grid-cols-2 gap-2 p-4">
              {(
                (activeView === "6" ? match?.team1 : match?.team2)
                  ?.team_players || []
              ).map((tp: TeamPlayer, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2"
                >
                  <span className="text-xs font-bold text-white">
                    {idx + 1}. {tp.user?.full_name ?? "Player"}
                  </span>
                  {tp.role_in_team && (
                    <span className="rounded border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                      {tp.role_in_team}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="scoreRow total squad powered-wrap">
              <div className="tossWon">{tossText}</div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. MATCH SUMMARY (data-view="8")                                      */}
      {/* ===================================================================== */}
      {activeView === "8" && (
        <div className="overlayWrap card summary duration-200 animate-in zoom-in-95">
          <div
            className={`insideWrap relative ${t.cardBorderClass}`}
            style={{ maxWidth: "860px" }}
          >
            {onCloseCard && (
              <button
                onClick={onCloseCard}
                aria-label="Close Card"
                className="absolute right-4 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className={`teaminfo ${t.cardHeaderClass}`}>
              <div className="teamtitle">MATCH SUMMARY</div>
            </div>

            {/* Team 1 Summary Header & Leaders */}
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between pb-2 text-sm font-black text-sky-300">
                <span>{team1Name}</span>
                <span className="font-mono text-white">
                  {inn1Total}/{inn1Wickets} ({inn1Overs} ov)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-white/5 bg-white/5 p-2">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-amber-400">
                    Top Batters
                  </span>
                  {(inn1?.batting_performances || [])
                    .slice(0, 3)
                    .map((bp: BattingPerformance, i: number) => (
                      <div
                        key={i}
                        className="flex justify-between py-0.5 text-slate-200"
                      >
                        <span>{bp.user?.full_name}</span>
                        <span className="font-mono font-bold text-amber-300">
                          {bp.runs_scored} ({bp.balls_faced})
                        </span>
                      </div>
                    ))}
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-2">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-sky-400">
                    Top Bowlers
                  </span>
                  {(inn2?.bowling_performances || [])
                    .slice(0, 3)
                    .map((bw: BowlingPerformance, i: number) => (
                      <div
                        key={i}
                        className="flex justify-between py-0.5 text-slate-200"
                      >
                        <span>{bw.user?.full_name}</span>
                        <span className="font-mono font-bold text-sky-300">
                          {bw.wickets_taken}/{bw.runs_conceded}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Team 2 Summary Header & Leaders */}
            <div className="p-4">
              <div className="flex items-center justify-between pb-2 text-sm font-black text-amber-300">
                <span>{team2Name}</span>
                <span className="font-mono text-white">
                  {inn2Total}/{inn2Wickets} ({inn2Overs} ov)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-white/5 bg-white/5 p-2">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-amber-400">
                    Top Batters
                  </span>
                  {(inn2?.batting_performances || [])
                    .slice(0, 3)
                    .map((bp: BattingPerformance, i: number) => (
                      <div
                        key={i}
                        className="flex justify-between py-0.5 text-slate-200"
                      >
                        <span>{bp.user?.full_name}</span>
                        <span className="font-mono font-bold text-amber-300">
                          {bp.runs_scored} ({bp.balls_faced})
                        </span>
                      </div>
                    ))}
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-2">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-sky-400">
                    Top Bowlers
                  </span>
                  {(inn1?.bowling_performances || [])
                    .slice(0, 3)
                    .map((bw: BowlingPerformance, i: number) => (
                      <div
                        key={i}
                        className="flex justify-between py-0.5 text-slate-200"
                      >
                        <span>{bw.user?.full_name}</span>
                        <span className="font-mono font-bold text-sky-300">
                          {bw.wickets_taken}/{bw.runs_conceded}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="scoreRowtotal summaryend">
              <div className="tossWon">{tossText}</div>
              <div className="result mt-1 font-black text-amber-300">
                {equationText}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. PARTNERSHIP CARD (data-view="23")                                  */}
      {/* ===================================================================== */}
      {activeView === "23" && (
        <div className="overlayWrap card partnership duration-200 animate-in zoom-in-95">
          <div
            className={`insideWrap relative ${t.cardBorderClass}`}
            style={{ width: "800px" }}
          >
            {onCloseCard && (
              <button
                onClick={onCloseCard}
                aria-label="Close Card"
                className="absolute right-4 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className="insideWrapInside">
              <div className={`teaminfo ${t.cardHeaderClass}`}>
                <div className="teamtitle">CURRENT PARTNERSHIP</div>
              </div>
              <div className="part_wrap">
                <div className="partnership_profiles">
                  {/* Left Batter */}
                  <div className="left-sec">
                    <div className="partnershipScore1 psgroup psgrouptop">
                      <span className="p1tRuns text-xl font-black text-white">
                        {state.striker_runs ?? 0}
                      </span>
                      <span className="p1tBalls ml-1 text-xs text-slate-400">
                        ({state.striker_balls ?? 0}b)
                      </span>
                      <div className="p1pName text_bottom_ps mt-0.5 font-bold uppercase text-sky-300">
                        {state.striker_name ?? "Striker"} *
                      </div>
                    </div>
                    <div className="partnership-bg partnershipImg1" />
                    <div className="partnershipScore1 psgroup psgroupbottom">
                      <span className="p1pRuns font-mono font-bold text-amber-300">
                        SR {strikerSr}
                      </span>
                      <div className="text_bottom_ps text-[10px] uppercase text-slate-400">
                        Strike Rate
                      </div>
                    </div>
                  </div>

                  {/* Mid Section: Partnership Runs */}
                  <div className="mid-sec">
                    <div className="ptRuns font-mono text-5xl font-black text-amber-400">
                      {state.partnership_runs ?? 0}
                    </div>
                    <div className="ptballswrap">
                      FROM{" "}
                      <span className="ptBalls font-bold text-white">
                        {state.partnership_balls ?? 0}
                      </span>{" "}
                      BALLS
                    </div>
                  </div>

                  {/* Right Batter */}
                  <div className="right-sec">
                    <div className="partnershipScore2 psgroup psgrouptop">
                      <span className="p2tRuns text-xl font-black text-white">
                        {state.non_striker_runs ?? 0}
                      </span>
                      <span className="p2tBalls ml-1 text-xs text-slate-400">
                        ({state.non_striker_balls ?? 0}b)
                      </span>
                      <div className="p2pName text_bottom_ps mt-0.5 font-bold uppercase text-sky-300">
                        {state.non_striker_name ?? "Non-Striker"}
                      </div>
                    </div>
                    <div className="partnership-bg partnershipImg2" />
                    <div className="partnershipScore2 psgroup psgroupbottom">
                      <span className="p2pRuns font-mono font-bold text-amber-300">
                        SR {runnerSr}
                      </span>
                      <div className="text_bottom_ps text-[10px] uppercase text-slate-400">
                        Strike Rate
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="scoreRow total squad powered-wrap">
              <div className="tossWon">{tossText}</div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. SPLASH: INTRO (data-view="13")                                     */}
      {/* ===================================================================== */}
      {activeView === "13" && (
        <div className="overlayWrap card splash matchintro duration-200 animate-in zoom-in-95">
          <div className="insideWrap intrasplash relative max-w-2xl">
            {onCloseCard && (
              <button
                onClick={onCloseCard}
                aria-label="Close Card"
                className="absolute right-4 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className={`teaminfo ${t.cardHeaderClass}`}>
              <div className="teamtitle">
                <div className="scoreRow tournamentName seriesName justify-center">
                  {state.tournament_name ?? "LIVE CRICKET BROADCAST"}
                </div>
              </div>
            </div>
            <div className="insideWrapInside">
              <div className="scoreRow player splash_contain justify-center py-6">
                <div className="splash_center">
                  <div className="team_detail">
                    <div
                      className="intro_team intro_team_1"
                      style={{
                        backgroundImage: state.team1_logo_url
                          ? `url(${state.team1_logo_url})`
                          : undefined,
                      }}
                    />
                    <div className="versus_intro">VS</div>
                    <div
                      className="intro_team intro_team_2"
                      style={{
                        backgroundImage: state.team2_logo_url
                          ? `url(${state.team2_logo_url})`
                          : undefined,
                      }}
                    />
                  </div>
                  <div className="splash_type">WE WILL BE STARTING SOON</div>
                </div>
              </div>
            </div>
            <div className="scoreRow total squad powered-wrap">
              <div className="tossWon">{tossText}</div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 8. SPLASH: INNINGS BREAK (data-view="14")                             */}
      {/* ===================================================================== */}
      {activeView === "14" && (
        <div className="overlayWrap splash card inningsbreak duration-200 animate-in zoom-in-95">
          <div className="insideWrap intrasplash relative max-w-2xl">
            {onCloseCard && (
              <button
                onClick={onCloseCard}
                aria-label="Close Card"
                className="absolute right-4 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className={`teaminfo ${t.cardHeaderClass}`}>
              <div className="teamtitle">
                <div className="scoreRow tournamentName seriesName justify-center">
                  {state.tournament_name ?? "MATCH UPDATE"}
                </div>
              </div>
            </div>
            <div className="insideWrapInside">
              <div className="scoreRow player splash_contain justify-center py-6">
                <div className="splash_center">
                  <div className="team_detail">
                    <div>
                      <div
                        className="intro_team intro_team_1"
                        style={{
                          backgroundImage: state.team1_logo_url
                            ? `url(${state.team1_logo_url})`
                            : undefined,
                        }}
                      />
                      <div className="mt-2 text-sm font-black text-sky-300">
                        {team1Code} {inn1Total}/{inn1Wickets}
                      </div>
                      <div className="text-xs text-slate-400">
                        Overs {inn1Overs}
                      </div>
                    </div>
                    <div className="versus_intro">VS</div>
                    <div>
                      <div
                        className="intro_team intro_team_2"
                        style={{
                          backgroundImage: state.team2_logo_url
                            ? `url(${state.team2_logo_url})`
                            : undefined,
                        }}
                      />
                      <div className="mt-2 text-sm font-black text-amber-300">
                        {team2Code}
                      </div>
                      <div className="text-xs text-slate-400">
                        Target: {(inn1Total ?? 0) + 1}
                      </div>
                    </div>
                  </div>
                  <div className="splash_type text-amber-300">
                    INNINGS BREAK
                  </div>
                </div>
              </div>
            </div>
            <div className="scoreRow total squad powered-wrap">
              <div className="tossWon">{tossText}</div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 9. SPLASH: DRINKS BREAK (data-view="15") & RAIN DELAY (data-view="28")*/}
      {/* ===================================================================== */}
      {(activeView === "15" || activeView === "28") && (
        <div
          className={`overlayWrap splash card ${activeView === "15" ? "drinksbreak" : "raindelay"} duration-200 animate-in zoom-in-95`}
        >
          <div className="insideWrap intrasplash relative max-w-xl">
            {onCloseCard && (
              <button
                onClick={onCloseCard}
                aria-label="Close Card"
                className="absolute right-4 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className={`teaminfo ${t.cardHeaderClass}`}>
              <div className="teamtitle">
                {activeView === "15" ? "DRINKS BREAK" : "RAIN DELAY"}
              </div>
            </div>
            <div className="insideWrapInside py-8 text-center">
              <p className="text-2xl font-black uppercase text-white">
                {activeView === "15"
                  ? "Official Drinks Interval"
                  : "Play Suspended Due To Rain"}
              </p>
              <p className="mt-2 text-sm font-bold text-amber-300">
                {battingTeamName}: {state.total_runs}/{state.total_wickets} in{" "}
                {oversFormatted(state.total_balls)} overs
              </p>
            </div>
            <div className="scoreRow total squad powered-wrap">
              <div className="tossWon">{tossText}</div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 10. LOWER-THIRD: BATSMAN STATS (data-view="16")                       */}
      {/* ===================================================================== */}
      {activeView === "16" && (
        <div className="overlayWrap batsmancurrentcard bottom_card duration-300 animate-in slide-in-from-left-5">
          <div className="insideWrap current_bottom_stat_row">
            <div className="insideWrapInside p-0">
              <div className="flex-row-box">
                <div className="side-player-img" />
                <div className="bottomCard_content">
                  <div className="scoreRow player_stat_box border-0 p-0">
                    <p className="player_stat_name batsman1Name">
                      {state.striker_name ?? "Striker"}
                    </p>
                    <p className="player_stat_runs">
                      <span className="batsman1Runs">
                        {state.striker_runs ?? 0}
                      </span>{" "}
                      <span>({state.striker_balls ?? 0})*</span>
                    </p>
                  </div>
                  <div className="scoreRow player player_current mt-1 border-0 p-0">
                    <div className="stat_type">SR</div>
                    <div className="stat_data">{strikerSr}</div>
                    <div className="stat_type ml-3">Fours</div>
                    <div className="stat_data">0</div>
                    <div className="stat_type ml-3">Sixes</div>
                    <div className="stat_data">0</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 11. LOWER-THIRD: RUNNER STATS (data-view="17")                        */}
      {/* ===================================================================== */}
      {activeView === "17" && (
        <div className="overlayWrap runnercurrentcard bottom_card duration-300 animate-in slide-in-from-left-5">
          <div className="insideWrap current_bottom_stat_row">
            <div className="flex-row-box">
              <div className="side-player-img" />
              <div className="bottomCard_content">
                <div className="scoreRow player_stat_box border-0 p-0">
                  <p className="player_stat_name batsman2Name">
                    {state.non_striker_name ?? "Non-Striker"}
                  </p>
                  <p className="player_stat_runs">
                    <span className="batsman2Runs">
                      {state.non_striker_runs ?? 0}
                    </span>{" "}
                    <span>({state.non_striker_balls ?? 0})*</span>
                  </p>
                </div>
                <div className="scoreRow player player_current mt-1 border-0 p-0">
                  <div className="stat_type">SR</div>
                  <div className="stat_data">{runnerSr}</div>
                  <div className="stat_type ml-3">Fours</div>
                  <div className="stat_data">0</div>
                  <div className="stat_type ml-3">Sixes</div>
                  <div className="stat_data">0</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 12. LOWER-THIRD: BOWLER STATS (data-view="18")                        */}
      {/* ===================================================================== */}
      {activeView === "18" && (
        <div className="overlayWrap bowlercurrentcard bottom_card duration-300 animate-in slide-in-from-left-5">
          <div className="insideWrap current_bottom_stat_row">
            <div className="flex-row-box">
              <div className="side-player-img" />
              <div className="bottomCard_content">
                <div className="scoreRow player_stat_box border-0 p-0">
                  <p className="player_stat_name bowlerName">
                    {state.current_bowler_name ?? "Bowler"}
                  </p>
                </div>
                <div className="scoreRow player player_current mt-1 border-0 p-0">
                  <div className="stat_type">Overs</div>
                  <div className="stat_data">
                    {oversFormatted(state.bowler_balls)}
                  </div>
                  <div className="stat_type ml-3">Runs</div>
                  <div className="stat_data">{state.bowler_runs ?? 0}</div>
                  <div className="stat_type ml-3">Wickets</div>
                  <div className="stat_data font-bold text-red-400">
                    {state.bowler_wickets ?? 0}
                  </div>
                  <div className="stat_type ml-3">Econ</div>
                  <div className="stat_data">{bowlerEcon}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 13. LOWER-THIRD: OUT BATSMAN (data-view="19")                         */}
      {/* ===================================================================== */}
      {activeView === "19" && (
        <div className="overlayWrap lastoutcard bottom_card duration-300 animate-in slide-in-from-left-5">
          <div className="insideWrap current_bottom_stat_row">
            <div className="flex-row-box">
              <div className="side-player-img" />
              <div className="bottomCard_content">
                <div className="scoreRow player_stat_box border-0 p-0">
                  <p className="player_stat_name lastOutName">
                    {state.last_ball_dismissed_player ?? "Last Out Batter"}
                  </p>
                  <p className="player_stat_name lastOutString mt-0.5 text-xs italic text-slate-400">
                    {state.last_ball_dismissal_type ?? "Dismissed"}
                  </p>
                </div>
                <div className="scoreRow player player_current mt-1 border-0 p-0">
                  <span className="text-xs font-black uppercase text-red-400">
                    WICKET CONFIRMED
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 14. LOWER-THIRD: PLAYER OF THE MATCH (data-view="29")                 */}
      {/* ===================================================================== */}
      {activeView === "29" && (
        <div className="overlayWrap bottom_card mom duration-300 animate-in slide-in-from-left-5">
          <div className="insideWrap current_bottom_stat_row">
            <div className="flex-row-box">
              <div className="side-player-img" />
              <div className="bottomCard_content">
                <div className="scoreRow player_stat_box border-0 p-0">
                  <p className="player_stat_name manOfTheMatch text-amber-300">
                    {match?.player_of_the_match?.full_name ??
                      state.striker_name ??
                      "Outstanding Performer"}
                  </p>
                </div>
                <div className="scoreRow player player_current mt-1 border-0 p-0">
                  <div className="stat_type font-bold text-amber-400">
                    PLAYER OF THE MATCH
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 15. LOWER-THIRD: CAREER CARDS (data-view="24", 25, 26, 27)            */}
      {/* ===================================================================== */}
      {(activeView === "24" ||
        activeView === "25" ||
        activeView === "26" ||
        activeView === "27") && (
        <div className="overlayWrap careercardofplayerbatsmen bottom_card duration-300 animate-in slide-in-from-left-5">
          <div className="insideWrap current_bottom_stat_row">
            <div className="flex-row-box">
              <div className="side-player-img" />
              <div className="bottomCard_content">
                <div className="scoreRow player_stat_box border-0 p-0">
                  <p className="player_stat_name careerPlayerName">
                    {activeView === "24"
                      ? state.striker_name
                      : activeView === "25"
                        ? state.non_striker_name
                        : state.current_bowler_name}
                  </p>
                </div>
                <div className="scoreRow player player_current mt-1 border-0 p-0">
                  <div className="stat_type">Career Matches</div>
                  <div className="stat_data">32</div>
                  <div className="stat_type ml-3">
                    {activeView === "26" ? "Wickets" : "Runs"}
                  </div>
                  <div className="stat_data text-amber-300">
                    {activeView === "26" ? "48" : "1240"}
                  </div>
                  <div className="stat_type ml-3">
                    {activeView === "26" ? "Economy" : "Strike Rate"}
                  </div>
                  <div className="stat_data">
                    {activeView === "26" ? "7.24" : "138.2"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 16. CHARTS: OVER BY OVER (data-view="21") & WORM (data-view="22")     */}
      {/* ===================================================================== */}
      {(activeView === "21" || activeView === "22") && (
        <div className="overlayWrap card charts duration-200 animate-in zoom-in-95">
          <div className="insideWrap relative max-w-2xl">
            {onCloseCard && (
              <button
                onClick={onCloseCard}
                aria-label="Close Card"
                className="absolute right-4 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className={`teaminfo ${t.cardHeaderClass}`}>
              <div className="teamtitle">
                {activeView === "21"
                  ? "OVER BY OVER PROGRESSION"
                  : "WORM RUN-RATE COMPARISON"}
              </div>
            </div>
            <div className="p-8 text-center">
              <div className="mb-4 flex items-center justify-center gap-6">
                <span className="font-bold text-sky-300">
                  ● {team1Code}: {inn1Total}/{inn1Wickets}
                </span>
                <span className="font-bold text-amber-300">
                  ● {team2Code}: {inn2Total}/{inn2Wickets}
                </span>
              </div>
              <div className="flex h-40 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs text-slate-400">
                {activeView === "21"
                  ? "Over By Over Bar Graph: High impact overs rendered in real-time"
                  : "Cumulative Worm Chart: Projected target trajectory comparison"}
              </div>
            </div>
            <div className="scoreRow total squad powered-wrap">
              <div className="tossWon">{tossText}</div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 17. POINTS TABLE (data-view="20")                                     */}
      {/* ===================================================================== */}
      {activeView === "20" && (
        <div className="overlayWrap card pointsTable duration-200 animate-in zoom-in-95">
          <div className="insideWrap relative max-w-2xl">
            {onCloseCard && (
              <button
                onClick={onCloseCard}
                aria-label="Close Card"
                className="absolute right-4 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className={`teaminfo ${t.cardHeaderClass}`}>
              <div className="teamtitle">TOURNAMENT STANDINGS</div>
            </div>
            <div className="p-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase text-slate-400">
                    <th className="p-2">Team</th>
                    <th className="p-2 text-center">P</th>
                    <th className="p-2 text-center">W</th>
                    <th className="p-2 text-center">L</th>
                    <th className="p-2 text-center">NRR</th>
                    <th className="p-2 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  <tr className="text-white">
                    <td className="p-2 font-sans font-bold text-sky-300">
                      {team1Name}
                    </td>
                    <td className="p-2 text-center">5</td>
                    <td className="p-2 text-center">4</td>
                    <td className="p-2 text-center">1</td>
                    <td className="p-2 text-center text-emerald-400">+1.240</td>
                    <td className="p-2 text-right font-bold text-amber-300">
                      8
                    </td>
                  </tr>
                  <tr className="text-white">
                    <td className="p-2 font-sans font-bold text-amber-300">
                      {team2Name}
                    </td>
                    <td className="p-2 text-center">5</td>
                    <td className="p-2 text-center">3</td>
                    <td className="p-2 text-center">2</td>
                    <td className="p-2 text-center text-emerald-400">+0.450</td>
                    <td className="p-2 text-right font-bold text-amber-300">
                      6
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="scoreRow total squad powered-wrap">
              <div className="tossWon">{tossText}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
