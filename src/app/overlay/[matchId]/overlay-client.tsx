"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "~/lib/supabase";
import {
  Settings,
  X,
  Copy,
  Check,
  Palette,
  Eye,
  EyeOff,
  Radio,
  ExternalLink,
  Sparkles,
  Zap,
  Volume2,
  VolumeX,
  Trophy,
  Activity,
  Flame,
  Crown,
} from "lucide-react";
import { formatStatus } from "~/lib/cricket";
import type {
  LiveMatchState,
  LayoutMode,
  OverlayTheme,
  PresentationCardType,
  ActiveEventSting,
  ProducerCommand,
  ActiveLowerThirdStrap,
  SponsorItem,
  CustomThemeColors,
  BroadcastViewId,
} from "~/components/overlay/types";
import type { Match } from "~/lib/match-types";
import { EventStings } from "~/components/overlay/event-stings";
import { PresentationCards } from "~/components/overlay/presentation-cards";
import { LowerThirdStraps } from "~/components/overlay/lower-third-straps";
import { CornerWatermark } from "~/components/overlay/corner-watermark";
import { NewsTicker } from "~/components/overlay/news-ticker";
import { BroadcastSuiteOverlay } from "~/components/overlay/broadcast-suite-overlay";
import {
  playFourFanfare,
  playSixExplosion,
  playWicketTone,
  playMilestoneFanfare,
  playFreeHitAlert,
} from "~/components/overlay/sound-effects";
import { usePreferencesStore } from "~/lib/stores/usePreferencesStore";

export type { LiveMatchState, LayoutMode, OverlayTheme };

interface OverlayClientProps {
  matchId: string;
  initial: LiveMatchState | null;
  match?: Match | null;
  initialLayout?: string;
  initialTheme?: string;
  initialControls?: boolean;
  initialSponsor?: string;
}

function oversText(balls: number | null): string {
  if (!balls) return "0.0";
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function BallChip({ label }: { label: string }) {
  let bg = "bg-slate-900 text-slate-100 border-slate-700/80";
  if (label === "W") {
    bg =
      "bg-red-600 text-white border-red-400 font-black motion-reduce:animate-none animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.9)]";
  } else if (label === "4") {
    bg =
      "bg-sky-500 text-white border-sky-300 font-black shadow-[0_0_10px_rgba(14,165,233,0.85)]";
  } else if (label === "6") {
    bg =
      "bg-amber-400 text-black border-amber-200 font-black shadow-[0_0_14px_rgba(245,158,11,0.9)]";
  } else if (
    label.includes("wd") ||
    label.includes("nb") ||
    label.endsWith("b")
  ) {
    bg = "bg-orange-500 text-black border-orange-300 font-bold";
  } else if (label === "0" || label === "•") {
    bg = "bg-slate-950 text-slate-400 border-slate-800 font-medium";
  }

  const ariaLabel =
    label === "W"
      ? "Wicket"
      : label === "4"
        ? "Four"
        : label === "6"
          ? "Six"
          : label === "0" || label === "•"
            ? "Dot ball"
            : `${label} runs`;

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={`skew-tile inline-flex h-6 min-w-[26px] items-center justify-center border px-1.5 font-score text-xs font-black tabular-nums shadow transition-transform ${bg}`}
    >
      <span className="skew-tile-content inline-block">
        {label === "0" ? "•" : label}
      </span>
    </span>
  );
}

function CircularBallDot({ label }: { label: string }) {
  let bg = "bg-slate-800 text-slate-200 border-slate-700";
  if (label === "W") {
    bg =
      "bg-red-600 text-white border-red-400 font-black shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse";
  } else if (label === "4") {
    bg =
      "bg-sky-500 text-white border-sky-300 font-black shadow-[0_0_8px_rgba(14,165,233,0.8)]";
  } else if (label === "6") {
    bg =
      "bg-amber-400 text-black border-amber-200 font-black shadow-[0_0_10px_rgba(245,158,11,0.9)]";
  } else if (
    label.includes("wd") ||
    label.includes("nb") ||
    label.endsWith("b")
  ) {
    bg = "bg-orange-500 text-black border-orange-300 font-bold";
  } else if (label === "0" || label === "•") {
    bg = "bg-slate-900 text-slate-500 border-slate-800 font-medium";
  }

  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full border font-score text-[11px] font-black tabular-nums shadow transition-transform ${bg}`}
    >
      {label === "0" ? "•" : label}
    </span>
  );
}

function CyberBallCell({ label }: { label: string }) {
  let bg = "bg-neutral-900 text-lime-400 border-lime-500/40";
  if (label === "W") {
    bg =
      "bg-red-600 text-white border-red-400 font-black shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse";
  } else if (label === "4") {
    bg =
      "bg-cyan-500 text-black border-cyan-300 font-black shadow-[0_0_8px_rgba(6,182,212,0.9)]";
  } else if (label === "6") {
    bg =
      "bg-lime-400 text-black border-lime-200 font-black shadow-[0_0_10px_rgba(163,230,53,0.9)]";
  } else if (
    label.includes("wd") ||
    label.includes("nb") ||
    label.endsWith("b")
  ) {
    bg = "bg-amber-500 text-black border-amber-300 font-bold";
  } else if (label === "0" || label === "•") {
    bg = "bg-black text-slate-600 border-neutral-800 font-medium";
  }

  return (
    <span
      className={`inline-flex h-6 min-w-[24px] items-center justify-center border px-1 font-mono text-[11px] font-black tabular-nums shadow transition-transform ${bg}`}
    >
      {label === "0" ? "•" : label}
    </span>
  );
}

function HexBallDot({ label }: { label: string }) {
  let bg = "bg-amber-950/60 text-amber-300 border-amber-500/40";
  if (label === "W") {
    bg =
      "bg-red-600 text-white border-red-400 font-black shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse";
  } else if (label === "4" || label === "6") {
    bg =
      "bg-gradient-to-r from-amber-400 to-yellow-400 text-black border-yellow-200 font-black shadow-[0_0_10px_rgba(245,158,11,0.9)]";
  } else if (
    label.includes("wd") ||
    label.includes("nb") ||
    label.endsWith("b")
  ) {
    bg = "bg-yellow-500 text-black border-yellow-300 font-bold";
  } else if (label === "0" || label === "•") {
    bg = "bg-black/60 text-amber-400/40 border-amber-900/40 font-medium";
  }

  return (
    <span
      className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded border px-1 font-score text-[11px] font-black tabular-nums shadow transition-transform ${bg}`}
    >
      {label === "0" ? "•" : label}
    </span>
  );
}

function EmberBallDot({ label }: { label: string }) {
  let bg = "bg-orange-950/70 text-orange-200 border-orange-600/50";
  if (label === "W") {
    bg =
      "bg-red-600 text-white border-red-400 font-black shadow-[0_0_12px_rgba(239,68,68,1)] animate-pulse";
  } else if (label === "4" || label === "6") {
    bg =
      "bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-400 text-black border-yellow-200 font-black shadow-[0_0_12px_rgba(255,100,0,0.95)]";
  } else if (
    label.includes("wd") ||
    label.includes("nb") ||
    label.endsWith("b")
  ) {
    bg = "bg-amber-500 text-black border-amber-300 font-bold";
  } else if (label === "0" || label === "•") {
    bg = "bg-[#160603] text-orange-600/50 border-orange-950/80 font-medium";
  }

  return (
    <span
      className={`clip-flame-badge inline-flex h-6 min-w-[26px] items-center justify-center border px-1.5 font-score text-[11px] font-black tabular-nums shadow transition-transform ${bg}`}
    >
      {label === "0" ? "•" : label}
    </span>
  );
}

const THEME_STYLES: Record<
  OverlayTheme,
  {
    outerBorder: string;
    teamBadge: string;
    mainBarBg: string;
    subBarBg: string;
    accentColor: string;
    accentText: string;
    strikeChevron: string;
  }
> = {
  starsports: {
    outerBorder: "border-blue-500/40 shadow-[0_12px_40px_rgba(2,11,30,0.95)]",
    teamBadge:
      "bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white",
    mainBarBg:
      "bg-gradient-to-r from-[#03091e] via-[#081738] to-[#03091e] text-white",
    subBarBg: "bg-[#020614] border-t border-amber-500/40 text-amber-300",
    accentColor: "#f59e0b",
    accentText: "text-amber-400 font-black",
    strikeChevron: "text-amber-400",
  },
  sonysports: {
    outerBorder: "border-red-600/50 shadow-[0_12px_45px_rgba(220,38,38,0.4)]",
    teamBadge:
      "bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-black",
    mainBarBg:
      "bg-gradient-to-r from-zinc-950 via-neutral-900 to-zinc-950 text-white",
    subBarBg: "bg-black border-t-2 border-red-600 text-red-300",
    accentColor: "#ef4444",
    accentText: "text-red-400 font-black",
    strikeChevron: "text-red-500",
  },
  foxcricket: {
    outerBorder: "border-lime-400/80 shadow-[0_12px_45px_rgba(163,230,53,0.4)]",
    teamBadge:
      "bg-gradient-to-r from-neutral-950 via-slate-900 to-black text-lime-400 font-mono",
    mainBarBg:
      "bg-gradient-to-r from-[#070a0f] via-[#0d141e] to-[#070a0f] text-white",
    subBarBg: "bg-black border-t-2 border-lime-400 text-lime-300",
    accentColor: "#a3e635",
    accentText: "text-lime-400 font-black",
    strikeChevron: "text-lime-400",
  },
  thehundred: {
    outerBorder: "border-pink-500/80 shadow-[0_12px_45px_rgba(236,72,153,0.5)]",
    teamBadge:
      "bg-gradient-to-r from-pink-600 via-fuchsia-600 to-pink-700 text-white font-black",
    mainBarBg:
      "bg-gradient-to-r from-[#180324] via-[#2c0643] to-[#180324] text-white",
    subBarBg: "bg-black border-t-2 border-cyan-400 text-cyan-300",
    accentColor: "#ec4899",
    accentText: "text-pink-400 font-black",
    strikeChevron: "text-cyan-400",
  },
  skysports: {
    outerBorder: "border-red-600/40 shadow-[0_12px_40px_rgba(6,12,33,0.95)]",
    teamBadge: "bg-gradient-to-r from-red-600 to-red-700 text-white",
    mainBarBg:
      "bg-gradient-to-r from-[#050b1a] via-[#091533] to-[#050b1a] text-white",
    subBarBg: "bg-[#040814] border-t border-red-500/50 text-red-300",
    accentColor: "#ef4444",
    accentText: "text-red-400 font-black",
    strikeChevron: "text-red-400",
  },
  apex: {
    outerBorder:
      "border-amber-400/90 shadow-[0_12px_45px_rgba(245,158,11,0.4)]",
    teamBadge:
      "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-black font-black",
    mainBarBg:
      "bg-gradient-to-r from-[#0b0c10] via-[#16171d] to-[#0b0c10] text-white",
    subBarBg: "bg-[#07080a] border-t-2 border-amber-400 text-amber-200",
    accentColor: "#f59e0b",
    accentText: "text-amber-400 font-black",
    strikeChevron: "text-amber-400",
  },
  volt: {
    outerBorder: "border-lime-400 shadow-[0_12px_45px_rgba(0,255,102,0.45)]",
    teamBadge:
      "bg-gradient-to-r from-lime-400 to-emerald-500 text-black font-mono font-black",
    mainBarBg:
      "bg-gradient-to-r from-[#030805] via-[#08150c] to-[#030805] text-white",
    subBarBg: "bg-black border-t-2 border-cyan-400 text-cyan-300 font-mono",
    accentColor: "#00ff66",
    accentText: "text-lime-400 font-black",
    strikeChevron: "text-cyan-400",
  },
  agni: {
    outerBorder: "border-orange-500 shadow-[0_12px_45px_rgba(255,69,0,0.55)]",
    teamBadge:
      "bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-black font-black",
    mainBarBg:
      "bg-gradient-to-r from-[#140502] via-[#240a04] to-[#140502] text-white",
    subBarBg: "bg-[#0d0301] border-t-2 border-orange-500 text-orange-200",
    accentColor: "#ff4500",
    accentText: "text-orange-400 font-black",
    strikeChevron: "text-orange-400",
  },
  dharma: {
    outerBorder: "border-amber-500/80 shadow-[0_12px_45px_rgba(180,83,9,0.4)]",
    teamBadge:
      "bg-gradient-to-r from-red-800 via-rose-900 to-red-950 text-amber-200 font-serif font-black border border-amber-400/50",
    mainBarBg:
      "bg-gradient-to-r from-[#180408] via-[#2a0810] to-[#180408] text-white",
    subBarBg:
      "bg-[#0e0204] border-t-2 border-amber-500 text-amber-300 font-serif",
    accentColor: "#f59e0b",
    accentText: "text-amber-300 font-black",
    strikeChevron: "text-amber-400",
  },
  thunder: {
    outerBorder: "border-blue-400/90 shadow-[0_12px_45px_rgba(59,130,246,0.5)]",
    teamBadge:
      "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800 text-yellow-300 font-black",
    mainBarBg:
      "bg-gradient-to-r from-[#030a21] via-[#081845] to-[#030a21] text-white",
    subBarBg: "bg-[#020617] border-t-2 border-blue-400 text-blue-200",
    accentColor: "#60a5fa",
    accentText: "text-yellow-300 font-black",
    strikeChevron: "text-yellow-400",
  },
  nakshatra: {
    outerBorder:
      "border-purple-500/70 shadow-[0_12px_45px_rgba(168,85,247,0.4)]",
    teamBadge:
      "bg-gradient-to-r from-purple-700 via-fuchsia-700 to-indigo-800 text-white font-black",
    mainBarBg:
      "bg-gradient-to-r from-[#0a041f] via-[#16083d] to-[#0a041f] text-white",
    subBarBg: "bg-[#060214] border-t-2 border-purple-400 text-purple-200",
    accentColor: "#c084fc",
    accentText: "text-cyan-300 font-black",
    strikeChevron: "text-cyan-300",
  },
  broadcast: {
    outerBorder: "border-amber-500/40 shadow-[0_12px_40px_rgba(0,0,0,0.95)]",
    teamBadge:
      "bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 text-black font-black",
    mainBarBg:
      "bg-gradient-to-r from-neutral-950 via-slate-950 to-neutral-950 text-white",
    subBarBg: "bg-black border-t border-amber-500/40 text-amber-300",
    accentColor: "#eab308",
    accentText: "text-amber-400 font-black",
    strikeChevron: "text-amber-400",
  },
  emerald: {
    outerBorder:
      "border-emerald-500/40 shadow-[0_12px_40px_rgba(2,44,34,0.95)]",
    teamBadge: "bg-gradient-to-r from-emerald-600 to-emerald-800 text-white",
    mainBarBg:
      "bg-gradient-to-r from-[#011a13] via-[#03291e] to-[#011a13] text-white",
    subBarBg: "bg-[#01120d] border-t border-emerald-500/40 text-emerald-300",
    accentColor: "#10b981",
    accentText: "text-emerald-400 font-black",
    strikeChevron: "text-emerald-400",
  },
  dark: {
    outerBorder: "border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.95)]",
    teamBadge: "bg-white/15 text-white",
    mainBarBg: "bg-black/95 text-white",
    subBarBg: "bg-neutral-950 border-t border-white/20 text-white/90",
    accentColor: "#ffffff",
    accentText: "text-white font-black",
    strikeChevron: "text-emerald-400",
  },
  minimal: {
    outerBorder: "border-zinc-700/80 shadow-[0_12px_30px_rgba(0,0,0,0.9)]",
    teamBadge: "bg-zinc-800 text-white",
    mainBarBg: "bg-zinc-950 text-zinc-100",
    subBarBg: "bg-black border-t border-zinc-700 text-zinc-300",
    accentColor: "#e4e4e7",
    accentText: "text-white font-bold",
    strikeChevron: "text-zinc-300",
  },
  custom: {
    outerBorder: "border-amber-500/40 shadow-[0_12px_40px_rgba(0,0,0,0.95)]",
    teamBadge: "bg-amber-600 text-black font-black",
    mainBarBg: "bg-slate-950 text-white",
    subBarBg: "bg-black border-t border-amber-500/40 text-amber-300",
    accentColor: "#f59e0b",
    accentText: "text-amber-400 font-black",
    strikeChevron: "text-amber-400",
  },
};

export function OverlayClient({
  matchId,
  initial,
  match: initialMatch = null,
  initialLayout = "bottom",
  initialTheme = "starsports",
  initialControls = true,
  initialSponsor = "",
}: OverlayClientProps) {
  const [state, setState] = useState<LiveMatchState | null>(initial);
  const [matchData] = useState<Match | null>(initialMatch);
  const [isConnected, setIsConnected] = useState(matchId === "test");
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Customization & Producer states
  const [layout, setLayout] = useState<LayoutMode>(
    initialLayout === "top" || initialLayout === "compact"
      ? initialLayout
      : "bottom",
  );
  const [theme, setTheme] = useState<OverlayTheme>(
    initialTheme in THEME_STYLES
      ? (initialTheme as OverlayTheme)
      : "starsports",
  );
  const [customColors, setCustomColors] = useState<CustomThemeColors>({
    primary: "#1e3a8a",
    accent: "#f59e0b",
  });
  const [marginOffsetPx, setMarginOffsetPx] = useState<number>(0);
  const [showBalls] = useState(true);
  const [showBug, setShowBug] = useState(true);
  const [showWatermark] = useState(true);
  const [showTicker, setShowTicker] = useState(false);
  const [tickerText, setTickerText] = useState(
    "Live Match Broadcast · Streaming in Full HD · Real-time score & commentary powered by CricScore Overlay",
  );
  const [sponsor, setSponsor] = useState(initialSponsor);
  const [sponsorsList, setSponsorsList] = useState<SponsorItem[]>([]);
  const {
    soundEffectsEnabled: audioEnabled,
    soundVolume: audioVolume,
    setSoundEnabled: setAudioEnabled,
    setVolume: setAudioVolume,
    toggleSound,
  } = usePreferencesStore();
  const [showSafeZone, setShowSafeZone] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("safe") === "true",
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Broadcast graphics states
  const [activeCard, setActiveCard] = useState<PresentationCardType>("none");
  const [activeSting, setActiveSting] = useState<ActiveEventSting | null>(null);
  const [activeStrap, setActiveStrap] = useState<ActiveLowerThirdStrap | null>(
    null,
  );
  const [autoStingsEnabled] = useState(true);

  // Broadcast Suite overlay views state (29-view switcher dock)
  const [broadcastView, setBroadcastView] = useState<BroadcastViewId | null>(
    initialLayout === "broadcast" ? "1" : null,
  );
  const [showBroadcastDock, setShowBroadcastDock] = useState(false);

  // Micro-animations & Stat Carousel states
  const [scorePulsing, setScorePulsing] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);

  // References for tracking state changes
  const prevBallSeq = useRef<number | null>(initial?.last_ball_seq ?? null);
  const prevRuns = useRef<number | null>(initial?.total_runs ?? null);
  const prevWickets = useRef<number | null>(initial?.total_wickets ?? null);
  const celebratedMilestones = useRef<Set<string>>(new Set());

  const isRealUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      matchId,
    );

  // Stat Carousel rotator (every 8s)
  useEffect(() => {
    const interval = setInterval(() => {
      setCarouselIdx((prev) => (prev + 1) % 4);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Score change pulse animation trigger
  useEffect(() => {
    if (!state) return;
    if (
      (prevRuns.current !== null && state.total_runs !== prevRuns.current) ||
      (prevWickets.current !== null &&
        state.total_wickets !== prevWickets.current)
    ) {
      setScorePulsing(true);
      const t = setTimeout(() => setScorePulsing(false), 600);
      prevRuns.current = state.total_runs;
      prevWickets.current = state.total_wickets;
      return () => clearTimeout(t);
    }
    prevRuns.current = state.total_runs;
    prevWickets.current = state.total_wickets;
  }, [state]);

  const refetch = useCallback(async () => {
    if (!isRealUuid) return;
    const { data } = await supabase
      .from("live_match_state")
      .select("*")
      .eq("match_id", matchId)
      .single();
    if (data) setState(data as LiveMatchState);
  }, [isRealUuid, matchId]);

  // Delivery Event Detector: Triggers animated stings & SFX audio
  useEffect(() => {
    if (!state) return;
    const currentSeq = state.last_ball_seq;
    if (currentSeq === undefined || currentSeq === null) return;

    if (prevBallSeq.current === null) {
      prevBallSeq.current = currentSeq;
      return;
    }

    if (currentSeq > prevBallSeq.current && autoStingsEnabled) {
      prevBallSeq.current = currentSeq;

      const triggerAutoSting = (sting: ActiveEventSting) => {
        setTimeout(() => setActiveSting(sting), 0);
      };

      // 1. Wicket Event
      if (state.last_ball_is_wicket) {
        if (audioEnabled) playWicketTone(audioVolume);
        triggerAutoSting({
          id: `wkt-${currentSeq}`,
          type: "wicket",
          title: "WICKET!",
          subtitle: state.last_ball_dismissed_player
            ? `${state.last_ball_dismissed_player} OUT`
            : "BATSMAN OUT",
          detail: [
            state.last_ball_dismissal_type,
            state.last_ball_fielder ? `c ${state.last_ball_fielder}` : null,
            state.current_bowler_name ? `b ${state.current_bowler_name}` : null,
          ]
            .filter(Boolean)
            .join(" "),
          durationMs: 4500,
        });
      }
      // 2. Six / Maximum Event
      else if (state.last_ball_runs === 6) {
        if (audioEnabled) playSixExplosion(audioVolume);
        triggerAutoSting({
          id: `six-${currentSeq}`,
          type: "six",
          title: "MAXIMUM!",
          subtitle: `${state.striker_name ?? "Batter"} sends it into the stands!`,
          detail: `${state.striker_runs ?? 0}* off ${state.striker_balls ?? 0} balls`,
          durationMs: 4200,
        });
      }
      // 3. Four Event
      else if (state.last_ball_runs === 4) {
        if (audioEnabled) playFourFanfare(audioVolume);
        triggerAutoSting({
          id: `four-${currentSeq}`,
          type: "four",
          title: "FOUR!",
          subtitle: `Boundary struck by ${state.striker_name ?? "Batter"}`,
          detail: `${state.striker_runs ?? 0}* (${state.striker_balls ?? 0}b)`,
          durationMs: 3800,
        });
      }
      // 4. Free Hit Event (No Ball)
      else if (state.last_ball_extra_type === "no_ball") {
        if (audioEnabled) playFreeHitAlert(audioVolume);
        triggerAutoSting({
          id: `freehit-${currentSeq}`,
          type: "free_hit",
          title: "FREE HIT!",
          subtitle: "No-ball called by umpire",
          detail: "Next delivery is a Free Hit",
          durationMs: 4000,
        });
      }

      // 5. Milestone Check (50 / 100)
      if (state.striker_name && state.striker_runs) {
        if (
          state.striker_runs >= 50 &&
          state.striker_runs < 55 &&
          !celebratedMilestones.current.has(`${state.striker_name}-50`)
        ) {
          celebratedMilestones.current.add(`${state.striker_name}-50`);
          if (audioEnabled) playMilestoneFanfare(audioVolume);
          triggerAutoSting({
            id: `fifty-${currentSeq}`,
            type: "milestone",
            title: "HALF CENTURY!",
            subtitle: `${state.striker_name} · 50 Runs`,
            detail: `Superb fifty off ${state.striker_balls} deliveries!`,
            durationMs: 5000,
          });
        } else if (
          state.striker_runs >= 100 &&
          state.striker_runs < 105 &&
          !celebratedMilestones.current.has(`${state.striker_name}-100`)
        ) {
          celebratedMilestones.current.add(`${state.striker_name}-100`);
          if (audioEnabled) playMilestoneFanfare(audioVolume);
          triggerAutoSting({
            id: `century-${currentSeq}`,
            type: "milestone",
            title: "CENTURY!",
            subtitle: `${state.striker_name} · 100 Runs`,
            detail: `Magnificent century off ${state.striker_balls} balls!`,
            durationMs: 5500,
          });
        }
      }
    } else {
      prevBallSeq.current = currentSeq;
    }
  }, [state, autoStingsEnabled, audioEnabled, audioVolume]);

  const triggerManualSting = useCallback(
    (type: "four" | "six" | "wicket" | "milestone" | "free_hit") => {
      if (type === "four") {
        if (audioEnabled) playFourFanfare(audioVolume);
        setActiveSting({
          id: `manual-4-${Date.now()}`,
          type: "four",
          title: "FOUR!",
          subtitle: `${state?.striker_name ?? "Batter"} hits a four!`,
          detail: `${state?.striker_runs ?? 0}* (${state?.striker_balls ?? 0}b)`,
          durationMs: 4000,
        });
      } else if (type === "six") {
        if (audioEnabled) playSixExplosion(audioVolume);
        setActiveSting({
          id: `manual-6-${Date.now()}`,
          type: "six",
          title: "MAXIMUM!",
          subtitle: `${state?.striker_name ?? "Batter"} clears the ropes!`,
          detail: `${state?.striker_runs ?? 0}* (${state?.striker_balls ?? 0}b)`,
          durationMs: 4500,
        });
      } else if (type === "wicket") {
        if (audioEnabled) playWicketTone(audioVolume);
        setActiveSting({
          id: `manual-w-${Date.now()}`,
          type: "wicket",
          title: "WICKET!",
          subtitle: `${state?.striker_name ?? "Batter"} DISMISSED`,
          detail: state?.current_bowler_name
            ? `b ${state.current_bowler_name}`
            : "Wicket Falls",
          durationMs: 4500,
        });
      } else if (type === "milestone") {
        if (audioEnabled) playMilestoneFanfare(audioVolume);
        setActiveSting({
          id: `manual-m-${Date.now()}`,
          type: "milestone",
          title: "FIFTY!",
          subtitle: `${state?.striker_name ?? "Batter"} reaches 50!`,
          detail: "50 runs off 32 balls",
          durationMs: 4500,
        });
      } else if (type === "free_hit") {
        if (audioEnabled) playFreeHitAlert(audioVolume);
        setActiveSting({
          id: `manual-fh-${Date.now()}`,
          type: "free_hit",
          title: "FREE HIT!",
          subtitle: "No-ball called",
          detail: "Next ball is a Free Hit",
          durationMs: 4000,
        });
      }
    },
    [audioEnabled, audioVolume, state],
  );

  const triggerStrap = useCallback((type: ActiveLowerThirdStrap["type"]) => {
    setActiveStrap({
      id: `strap-${Date.now()}`,
      type,
      title: "",
      durationMs: 8000,
    });
  }, []);

  const handleDismissSting = useCallback(() => setActiveSting(null), []);
  const handleDismissStrap = useCallback(() => setActiveStrap(null), []);
  const handleDismissCard = useCallback(() => setActiveCard("none"), []);

  // Keyboard Shortcuts (Numpad 1-9, B, T, S, Space/Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === " " || e.key === "Escape") {
        e.preventDefault();
        setActiveCard("none");
        setActiveSting(null);
        setActiveStrap(null);
        return;
      }

      if (e.key === "s" || e.key === "S") {
        setDrawerOpen((prev) => !prev);
      } else if (e.key === "b" || e.key === "B") {
        setShowBug((prev) => !prev);
      } else if (e.key === "c" || e.key === "C") {
        setBroadcastView((prev) => (prev ? null : "1"));
      } else if (e.key === "d" || e.key === "D") {
        setShowBroadcastDock((prev) => !prev);
      } else if (e.key === "t" || e.key === "T") {
        setShowTicker((prev) => !prev);
      } else if (e.key === "g" || e.key === "G") {
        setShowSafeZone((prev) => !prev);
      } else if (e.code === "Numpad1" || e.key === "1") {
        triggerManualSting("four");
      } else if (e.code === "Numpad2" || e.key === "2") {
        triggerManualSting("six");
      } else if (e.code === "Numpad3" || e.key === "3") {
        triggerManualSting("wicket");
      } else if (e.code === "Numpad4" || e.key === "4") {
        triggerStrap("batsman");
      } else if (e.code === "Numpad5" || e.key === "5") {
        triggerStrap("bowler");
      } else if (e.code === "Numpad6" || e.key === "6") {
        triggerStrap("partnership");
      } else if (e.code === "Numpad7" || e.key === "7") {
        triggerStrap("target");
      } else if (e.code === "Numpad8" || e.key === "8") {
        triggerStrap("powerplay");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triggerManualSting, triggerStrap]);

  // Realtime Subscriptions & Remote Producer Channel
  useEffect(() => {
    const controlChannel = supabase
      .channel(`overlay_control_${matchId}`)
      .on(
        "broadcast",
        { event: "command" },
        ({ payload }: { payload: ProducerCommand }) => {
          if (!payload) return;
          if (payload.type === "SHOW_CARD" && payload.card) {
            setActiveCard(payload.card);
            if (payload.durationMs && payload.durationMs > 0) {
              setTimeout(() => {
                setActiveCard((curr) =>
                  curr === payload.card ? "none" : curr,
                );
              }, payload.durationMs);
            }
          } else if (payload.type === "HIDE_CARD") {
            setActiveCard("none");
          } else if (payload.type === "TOGGLE_BUG") {
            setShowBug((prev) =>
              payload.visible !== undefined ? payload.visible : !prev,
            );
          } else if (payload.type === "SET_THEME" && payload.theme) {
            setTheme(payload.theme);
          } else if (payload.type === "SET_LAYOUT" && payload.layout) {
            setLayout(payload.layout);
          } else if (
            payload.type === "SET_SPONSOR" &&
            payload.sponsorText !== undefined
          ) {
            setSponsor(payload.sponsorText);
          } else if (payload.type === "TRIGGER_STING" && payload.stingType) {
            triggerManualSting(payload.stingType);
          } else if (payload.type === "SHOW_STRAP" && payload.strap) {
            setActiveStrap(payload.strap);
          } else if (payload.type === "HIDE_STRAP") {
            setActiveStrap(null);
          } else if (payload.type === "TOGGLE_TICKER") {
            setShowTicker((prev) =>
              payload.visible !== undefined ? payload.visible : !prev,
            );
            if (payload.tickerText) setTickerText(payload.tickerText);
          } else if (payload.type === "SET_TICKER_TEXT" && payload.tickerText) {
            setTickerText(payload.tickerText);
          } else if (payload.type === "SET_SPONSORS" && payload.sponsors) {
            setSponsorsList(payload.sponsors);
          } else if (
            payload.type === "SET_CUSTOM_COLORS" &&
            payload.customColors
          ) {
            setCustomColors(payload.customColors);
          } else if (
            payload.type === "SET_MARGIN_OFFSET" &&
            payload.marginOffsetPx !== undefined
          ) {
            setMarginOffsetPx(payload.marginOffsetPx);
          } else if (payload.type === "TOGGLE_AUDIO") {
            if (payload.audioEnabled !== undefined)
              setAudioEnabled(payload.audioEnabled);
            if (payload.audioVolume !== undefined)
              setAudioVolume(payload.audioVolume);
          } else if (
            payload.type === "SET_BROADCAST_VIEW" &&
            payload.broadcastView
          ) {
            setBroadcastView(payload.broadcastView);
          } else if (payload.type === "PANIC_CLEAR") {
            setActiveCard("none");
            setActiveSting(null);
            setActiveStrap(null);
            setBroadcastView(null);
          }
        },
      )
      .subscribe();

    if (!isRealUuid) {
      return () => {
        void supabase.removeChannel(controlChannel);
      };
    }

    const scheduleRefetch = () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(() => void refetch(), 250);
    };

    const dataChannel = supabase
      .channel(`overlay_${matchId}`)
      .on(
        "broadcast",
        { event: "score_update" },
        ({ payload }: { payload?: { liveState?: LiveMatchState } }) => {
          if (payload?.liveState && payload.liveState.match_id === matchId) {
            setState(payload.liveState);
          } else {
            void refetch();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ball_by_ball",
          filter: `match_id=eq.${matchId}`,
        },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "innings",
          filter: `match_id=eq.${matchId}`,
        },
        scheduleRefetch,
      )
      .subscribe((status) => setIsConnected(status === "SUBSCRIBED"));

    const poll = setInterval(() => void refetch(), 15000);

    return () => {
      void supabase.removeChannel(controlChannel);
      void supabase.removeChannel(dataChannel);
      clearInterval(poll);
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  }, [
    isRealUuid,
    matchId,
    refetch,
    setAudioEnabled,
    setAudioVolume,
    triggerManualSting,
  ]);

  const copyObsUrl = () => {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    const params = new URLSearchParams();
    if (layout !== "bottom") params.set("layout", layout);
    if (theme !== "starsports") params.set("theme", theme);
    if (sponsor.trim()) params.set("sponsor", sponsor.trim());
    params.set("controls", "false");

    const url = `${origin}/overlay/${matchId}?${params.toString()}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!state) {
    return (
      <div className="fixed inset-0 flex items-center justify-center font-sans">
        <div className="rounded-2xl border border-white/20 bg-black/90 px-8 py-5 text-xl font-black text-white shadow-2xl backdrop-blur-xl">
          Loading Live Cricket Broadcast Feed…
        </div>
      </div>
    );
  }

  const isLive = state.status === "live";
  const isComplete = state.status === "completed";
  const thisOverBalls = (state.this_over_balls ?? "")
    .split(" ")
    .filter(Boolean);
  const themeStyle = THEME_STYLES[theme] || THEME_STYLES.starsports;
  const isFreeHit = state.last_ball_extra_type === "no_ball";

  // Dynamic strike rate calculation
  const strikerSr =
    state.striker_runs && state.striker_balls && state.striker_balls > 0
      ? ((state.striker_runs / state.striker_balls) * 100).toFixed(1)
      : null;

  const bowlerBalls = state.bowler_balls ?? 0;
  const bowlerEcon =
    bowlerBalls > 0 && state.bowler_runs !== null
      ? (state.bowler_runs / (bowlerBalls / 6)).toFixed(1)
      : "—";

  // Custom margin offset applied to the persistent bug container
  const bottomOffsetStyle = {
    bottom: `${20 + marginOffsetPx}px`,
  };

  const battingTeamShort =
    state.batting_team_short_name ??
    (state.batting_team_name
      ? state.batting_team_name.substring(0, 3).toUpperCase()
      : "BAT");

  const bowlingTeamShort =
    state.bowling_team_short_name ??
    (state.bowling_team_name
      ? state.bowling_team_name.substring(0, 3).toUpperCase()
      : "BWL");

  return (
    <div
      style={
        {
          "--overlay-custom-primary": customColors.primary,
          "--overlay-custom-accent": customColors.accent,
        } as React.CSSProperties
      }
      className="pointer-events-none fixed inset-0 select-none bg-transparent p-6 font-sans"
    >
      {/* 1. BROADCAST EVENT STINGS ANIMATION LAYER */}
      <EventStings
        sting={activeSting}
        theme={theme}
        onDismiss={handleDismissSting}
      />

      {/* 2. FULL-SCREEN PRESENTATION CARDS */}
      <PresentationCards
        card={activeCard}
        state={state}
        match={matchData}
        theme={theme}
        onClose={handleDismissCard}
      />

      {/* 3. IN-PLAY LOWER-THIRD STRAPS */}
      <LowerThirdStraps
        strap={activeStrap}
        state={state}
        layout={layout}
        theme={theme}
        onDismiss={handleDismissStrap}
      />

      {/* 4. CORNER WATERMARK & ROTATING SPONSORS */}
      <CornerWatermark
        title={state.tournament_name ?? state.title}
        logoUrl={state.team1_logo_url}
        sponsors={sponsorsList}
        visible={showWatermark}
      />

      {/* 5. BOTTOM BROADCAST NEWS CRAWLER / TICKER */}
      <NewsTicker text={tickerText} visible={showTicker} />

      {/* 6. SAFE-ZONE GUIDE OVERLAY (CALIBRATION) */}
      {showSafeZone && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          role="img"
          aria-label="Broadcast safe-zone guides: action safe 90 percent, title safe 80 percent, 1920 by 1080 canvas"
        >
          <div className="absolute inset-[5%] border border-dashed border-amber-400/50 p-2 font-mono text-[11px] text-amber-300">
            Action Safe (90%) · 1920×1080
          </div>
          <div className="absolute inset-[10%] border border-dashed border-sky-400/50 p-2 font-mono text-[11px] text-sky-300">
            Title Safe (80%) · keep score bug inside
          </div>
        </div>
      )}

      {/* Live / Offline feed indicator */}
      <div className="absolute right-5 top-5 flex items-center gap-2 rounded-md border border-white/10 bg-black/75 px-3 py-1.5 shadow-lg backdrop-blur-md">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isConnected
              ? "motion-reduce:animate-none animate-pulse bg-emerald-400"
              : "bg-red-500"
          }`}
        />
        <span className="font-score text-[11px] font-bold uppercase tracking-wider text-white">
          {isConnected ? "LIVE BROADCAST" : "OFFLINE"}
        </span>
      </div>

      {/* Match status badge */}
      <div className="absolute left-5 top-5 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-score text-xs font-black uppercase tracking-widest text-white shadow-xl ${
            isLive
              ? "motion-reduce:animate-none animate-pulse bg-red-600"
              : isComplete
                ? "bg-emerald-600"
                : "bg-zinc-800"
          }`}
        >
          {isLive && (
            <span className="h-2 w-2 motion-reduce:animate-none animate-ping rounded-full bg-white" />
          )}
          {formatStatus(state.status)}
        </span>

        {isFreeHit && (
          <span className="inline-flex motion-reduce:animate-none animate-bounce items-center gap-1 rounded-md bg-amber-400 px-2.5 py-1 font-score text-xs font-black uppercase tracking-wider text-black shadow-xl">
            <Zap className="h-3.5 w-3.5 fill-black" />
            FREE HIT
          </span>
        )}
      </div>

      {/* Streamer Settings Toggle Button */}
      {initialControls && (
        <button
          onClick={() => setDrawerOpen((prev) => !prev)}
          className="pointer-events-auto fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/85 text-white shadow-2xl backdrop-blur-xl transition hover:scale-110 hover:bg-amber-500 hover:text-black"
          title="Overlay Producer Deck (Press S)"
          aria-label="Toggle Overlay Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      )}

      {/* Settings Drawer */}
      {drawerOpen && (
        <div className="pointer-events-auto fixed bottom-16 right-4 z-50 max-h-[85vh] w-[420px] overflow-y-auto rounded-3xl border border-white/20 bg-zinc-950/95 p-6 text-white shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <h3 className="text-base font-black">Broadcast Control Deck</h3>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-4 text-xs">
            <div className="rounded-2xl border border-blue-500/30 bg-blue-950/40 p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-200">
                  External Touch Controller
                </span>
                <a
                  href={`/overlay/${matchId}/control`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-black text-white shadow transition hover:bg-blue-500"
                >
                  <span>Open Deck</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowBug((v) => !v)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 font-bold transition ${
                  showBug
                    ? "border-emerald-500/50 bg-emerald-600/30 text-emerald-300"
                    : "border-white/10 bg-white/5 text-white/60"
                }`}
              >
                {showBug ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
                <span>
                  {showBug ? "Score Bug Visible (B)" : "Score Bug Hidden (B)"}
                </span>
              </button>

              <button
                onClick={toggleSound}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 font-bold transition ${
                  audioEnabled
                    ? "border-amber-500/50 bg-amber-600/30 text-amber-300"
                    : "border-white/10 bg-white/5 text-white/60"
                }`}
              >
                {audioEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
                <span>{audioEnabled ? "SFX Audio Active" : "SFX Muted"}</span>
              </button>
            </div>

            <button
              onClick={() => setShowSafeZone((v) => !v)}
              aria-pressed={showSafeZone}
              className={`flex w-full items-center justify-center gap-1.5 rounded-xl border p-2.5 font-bold transition ${
                showSafeZone
                  ? "border-sky-500/50 bg-sky-600/30 text-sky-300"
                  : "border-white/10 bg-white/5 text-white/60"
              }`}
              title="Toggle 1920×1080 safe-zone guides (G)"
            >
              <span>
                {showSafeZone
                  ? "Safe Guides ON (G) · 1920×1080"
                  : "Safe Guides OFF (G)"}
              </span>
            </button>

            {/* Broadcast Theme Selector */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 font-bold text-white/80">
                <Palette className="h-3.5 w-3.5 text-amber-400" /> Broadcast
                Style
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "apex", label: "Apex (24K Gold)" },
                  { id: "volt", label: "Volt (Sports-Tech)" },
                  { id: "agni", label: "Agni (Inferno)" },
                  { id: "thunder", label: "Thunder (Velocity)" },
                  { id: "dharma", label: "Dharma (Heritage)" },
                  { id: "nakshatra", label: "Nakshatra (Astral)" },
                  { id: "starsports", label: "Star Sports (IPL)" },
                  { id: "sonysports", label: "Sony Sports (LIV)" },
                  { id: "foxcricket", label: "Fox Cricket (AUS)" },
                  { id: "skysports", label: "Sky Sports (Ashes)" },
                  { id: "thehundred", label: "The Hundred" },
                  { id: "broadcast", label: "ICC Gold Feed" },
                  { id: "emerald", label: "County Emerald" },
                  { id: "dark", label: "Carbon Glass" },
                  { id: "minimal", label: "Clean Minimal" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id as OverlayTheme)}
                    className={`rounded-lg border px-2 py-1.5 text-center font-bold transition ${
                      theme === t.id
                        ? "border-amber-400 bg-amber-500/20 text-white shadow"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Broadcast Suite Mode */}
            <div className="border-t border-white/10 pt-3">
              <label className="mb-1.5 flex items-center justify-between font-bold text-white/80">
                <span className="flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-sky-400" /> Broadcast
                  Graphics Suite
                </span>
                <span className="font-mono text-[10px] text-sky-300">
                  29 Views Live
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setBroadcastView((v) => (v ? null : "1"))}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 font-bold transition ${
                    broadcastView !== null
                      ? "border-sky-500/50 bg-sky-600/30 text-sky-300"
                      : "border-white/10 bg-white/5 text-white/60"
                  }`}
                >
                  <Trophy className="h-4 w-4" />
                  <span>
                    {broadcastView !== null
                      ? "Broadcast Suite ON (C)"
                      : "Standard Scorebug"}
                  </span>
                </button>
                <button
                  onClick={() => setShowBroadcastDock((v) => !v)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 font-bold transition ${
                    showBroadcastDock
                      ? "border-amber-500/50 bg-amber-600/30 text-amber-300"
                      : "border-white/10 bg-white/5 text-white/60"
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  <span>
                    {showBroadcastDock ? "Dock Docked (D)" : "Show Dock (D)"}
                  </span>
                </button>
              </div>
            </div>

            {/* Copy OBS URL */}
            <div className="border-t border-white/10 pt-3">
              <button
                onClick={copyObsUrl}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 font-bold text-white shadow-xl transition hover:bg-emerald-500"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-white" />
                    <span>Copied OBS Link!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy OBS Browser URL</span>
                  </>
                )}
              </button>
              <p className="mt-1 text-center font-mono text-[10px] text-white/40">
                1920×1080 · 60fps · Transparent Layer
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. AUTHENTIC TV BROADCAST SUITE & SCOREBUG                */}
      {/* ========================================================= */}
      {showBug && (
        <>
          {/* BROADCAST SUITE (29 LIVE VIEWS) */}
          {(broadcastView !== null || layout === "broadcast") && (
            <BroadcastSuiteOverlay
              state={state}
              match={matchData}
              activeView={broadcastView ?? "1"}
              onSelectView={setBroadcastView}
              showControls={showBroadcastDock}
              onCloseCard={() => setBroadcastView("1")}
              theme={theme}
            />
          )}

          {/* STANDARD CUSTOMIZABLE SCOREBUGS (BOTTOM / TOP / COMPACT) */}
          {broadcastView === null && layout !== "broadcast" && (
            <>
              {/* 1. LOWER-THIRD INTEGRATED BROADCAST BAR (DEFAULT) */}
              {layout === "bottom" && (
                <>
                  {/* ========================================================= */}
                  {/* A. SONY SPORTS NETWORK CURVED CAPSULE SCOREBUG            */}
                  {/* ========================================================= */}
                  {theme === "sonysports" && (
                    <div
                      style={bottomOffsetStyle}
                      className="absolute left-1/2 w-full max-w-5xl -translate-x-1/2 select-none font-score drop-shadow-2xl transition-all duration-300"
                    >
                      <div className="broadcast-bevel overflow-hidden rounded-2xl border-2 border-red-600/70 bg-gradient-to-r from-zinc-950 via-neutral-900 to-zinc-950 text-white shadow-[0_12px_45px_rgba(220,38,38,0.4)]">
                        {/* Top Sony Red Banner Strip */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-5 py-1 font-score text-[11px] font-black uppercase tracking-wider text-white">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
                            <span>
                              SONY SPORTS NETWORK ·{" "}
                              {state.tournament_name ??
                                `${battingTeamShort} v ${bowlingTeamShort}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {sponsor && (
                              <span className="py-0.2 rounded-full border border-white/20 bg-black/30 px-2.5 text-[10px] font-black text-white">
                                {sponsor}
                              </span>
                            )}
                            <span className="font-mono text-[11px] font-black text-white">
                              SONY LIV · CRR {state.current_run_rate ?? "—"}
                            </span>
                          </div>
                        </div>

                        {/* Main Sony Horizontal Bar */}
                        <div className="flex items-stretch border-t border-white/10">
                          {/* Left Team Block with Vertical Red Accent Pill */}
                          <div className="flex shrink-0 items-center gap-3 border-r border-red-600/40 bg-zinc-950 px-5 py-2.5 text-white">
                            <span className="h-8 w-1.5 rounded-full bg-red-600 shadow-[0_0_8px_#ef4444]" />
                            {state.team1_logo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={state.team1_logo_url}
                                alt="Logo"
                                className="h-8 w-8 object-contain drop-shadow"
                              />
                            )}
                            <div className="text-left leading-none">
                              <span className="block font-score text-3xl font-black tracking-tight drop-shadow">
                                {battingTeamShort}
                              </span>
                              <span className="mt-0.5 block font-score text-[10px] font-black uppercase tracking-wider text-red-400">
                                {state.innings_number === 2
                                  ? "2ND INN"
                                  : "1ST INN"}
                              </span>
                            </div>
                          </div>

                          {/* Score Block */}
                          <div className="flex items-center gap-3 border-r border-white/10 bg-black/60 px-5 py-2">
                            <div className="flex items-baseline gap-1">
                              <span
                                className={`font-score text-4xl font-black leading-none tracking-tight ${
                                  scorePulsing
                                    ? "animate-score-pulse scale-105 text-amber-300"
                                    : "text-white"
                                }`}
                              >
                                {state.total_runs ?? 0}
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-red-500">
                                /
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-white">
                                {state.total_wickets ?? 0}
                              </span>
                            </div>

                            <div className="border-l border-white/10 pl-3 text-right leading-tight">
                              <span className="block font-score text-base font-black tabular-nums text-white">
                                {oversText(state.total_balls)}
                              </span>
                              <span className="block font-score text-[10px] font-bold uppercase tracking-wider text-red-300">
                                OVERS
                              </span>
                            </div>
                          </div>

                          {/* Batsmen Sony Capsule Cards */}
                          <div className="flex items-center divide-x divide-white/10 border-r border-white/10">
                            {state.striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <div className="flex items-center gap-1.5">
                                  <span className="py-0.2 animate-pulse rounded-full bg-red-600 px-1.5 text-[8px] font-black tracking-wider text-white">
                                    STRIKE
                                  </span>
                                  <span className="font-score text-sm font-black uppercase tracking-tight text-white">
                                    {state.striker_name} *
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span className="font-score text-base font-black tabular-nums text-white">
                                    {state.striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.striker_balls ?? 0}b)
                                  </span>
                                  {strikerSr && (
                                    <span className="py-0.2 rounded border border-red-500/40 bg-red-500/20 px-1.5 font-score text-[9px] font-black tabular-nums text-red-300">
                                      SR {strikerSr}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {state.non_striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <span className="block font-score text-sm font-bold uppercase tracking-tight text-slate-300">
                                  {state.non_striker_name}
                                </span>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="font-score text-base font-bold tabular-nums text-slate-200">
                                    {state.non_striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.non_striker_balls ?? 0}b)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Bowler Sony Capsule */}
                          {state.current_bowler_name && (
                            <div className="border-r border-white/10 px-5 py-2 leading-tight">
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                                <span className="font-score text-sm font-black uppercase tracking-tight text-white">
                                  {state.current_bowler_name}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="font-score text-base font-black tabular-nums text-red-400">
                                  {state.bowler_wickets ?? 0}-
                                  {state.bowler_runs ?? 0}
                                </span>
                                <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                  ({oversText(state.bowler_balls)})
                                </span>
                                <span className="py-0.2 rounded bg-white/10 px-1.5 font-score text-[9px] font-black tabular-nums text-slate-300">
                                  ECON {bowlerEcon}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Over Delivery Matrix: Sony Circular Dots */}
                          {showBalls && (
                            <div className="flex flex-1 items-center justify-end gap-1.5 px-4 py-2">
                              {thisOverBalls.length > 0 ? (
                                thisOverBalls.map((b, idx) => (
                                  <CircularBallDot key={idx} label={b} />
                                ))
                              ) : (
                                <span className="font-score text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                  Over in progress
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Sub-Bar */}
                        <div className="overflow-hidden border-t border-red-600/50 bg-black/90 px-5 py-1.5 font-score text-xs font-black uppercase tracking-wide text-red-200">
                          <div
                            key={carouselIdx}
                            className="animate-sub-bar-flip flex items-center justify-between"
                          >
                            {carouselIdx === 0 && (
                              <>
                                {state.target_runs !== null ? (
                                  <div className="flex items-center gap-3">
                                    <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-black text-white">
                                      TARGET {state.target_runs}
                                    </span>
                                    <span className="text-white">
                                      NEED {state.runs_needed} RUNS FROM{" "}
                                      {state.balls_remaining} BALLS
                                    </span>
                                    <span className="text-white/30">|</span>
                                    <span className="text-red-300">
                                      REQ. RR: {state.required_run_rate ?? "—"}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <span className="text-red-400">
                                      VS{" "}
                                      {state.bowling_team_name ??
                                        state.bowling_team_short_name}
                                    </span>
                                    <span className="text-white/30">|</span>
                                    <span className="text-white">
                                      PROJECTED:{" "}
                                      {state.current_run_rate
                                        ? Math.round(
                                            state.current_run_rate *
                                              (state.overs_per_innings ?? 20),
                                          )
                                        : "—"}{" "}
                                      RUNS
                                    </span>
                                  </div>
                                )}
                                <span className="font-mono text-red-400">
                                  SONY LIV LIVE CENTRE
                                </span>
                              </>
                            )}
                            {carouselIdx !== 0 && (
                              <>
                                <div className="flex items-center gap-3">
                                  <span className="text-red-400">
                                    PARTNERSHIP:
                                  </span>
                                  <span className="text-white">
                                    {state.partnership_runs ?? 0} RUNS OFF{" "}
                                    {state.partnership_balls ?? 0} BALLS
                                  </span>
                                </div>
                                <span className="text-slate-300">
                                  CURRENT RR: {state.current_run_rate ?? "—"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* B. FOX CRICKET AUSTRALIA ASYMMETRIC NEON HUD SCOREBUG     */}
                  {/* ========================================================= */}
                  {theme === "foxcricket" && (
                    <div
                      style={bottomOffsetStyle}
                      className="absolute left-1/2 w-full max-w-5xl -translate-x-1/2 select-none font-score drop-shadow-2xl transition-all duration-300"
                    >
                      <div className="clip-slant-right overflow-hidden border-2 border-lime-400 bg-neutral-950 text-white shadow-[0_0_35px_rgba(0,255,102,0.35)]">
                        {/* Top Fox Sports Lab Radar Bar */}
                        <div className="flex items-center justify-between border-b border-lime-400/40 bg-black px-4 py-1 font-mono text-[11px] font-black uppercase text-lime-400">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rotate-45 bg-lime-400" />
                            <span>
                              FOX CRICKET · FOX SPORTS LAB · {battingTeamShort}{" "}
                              v {bowlingTeamShort}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span>RADAR: 144.2 KPH</span>
                            <span>•</span>
                            <span className="text-white">
                              CRR {state.current_run_rate ?? "—"}
                            </span>
                          </div>
                        </div>

                        {/* Main Fox Sports Bar */}
                        <div className="flex items-stretch">
                          {/* Left Team Asymmetric Polygon Block */}
                          <div className="flex shrink-0 items-center gap-3 border-r-2 border-lime-400 bg-black px-5 py-2">
                            {state.team1_logo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={state.team1_logo_url}
                                alt="Logo"
                                className="h-8 w-8 object-contain drop-shadow"
                              />
                            )}
                            <div className="text-left leading-none">
                              <span className="block font-score text-3xl font-black tracking-tight text-lime-400">
                                {battingTeamShort}
                              </span>
                              <span className="mt-0.5 block font-mono text-[10px] font-bold text-lime-400/80">
                                INNINGS {state.innings_number ?? 1}
                              </span>
                            </div>
                          </div>

                          {/* Score Block */}
                          <div className="flex items-center gap-3 border-r-2 border-lime-500/30 bg-neutral-950 px-4 py-1.5">
                            <div className="flex items-baseline gap-1">
                              <span
                                className={`font-score text-4xl font-black leading-none tracking-tight ${
                                  scorePulsing
                                    ? "animate-score-pulse scale-105 text-lime-300"
                                    : "text-white"
                                }`}
                              >
                                {state.total_runs ?? 0}
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-lime-400">
                                /
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-lime-300">
                                {state.total_wickets ?? 0}
                              </span>
                            </div>

                            <div className="border-l border-lime-500/20 pl-2.5 text-right leading-tight">
                              <span className="block font-mono text-base font-black tabular-nums text-white">
                                {oversText(state.total_balls)}
                              </span>
                              <span className="block font-mono text-[10px] font-bold uppercase text-lime-400/70">
                                OV / {state.overs_per_innings}
                              </span>
                            </div>
                          </div>

                          {/* Batters Fox Dual Telemetry Module */}
                          <div className="flex items-center divide-x divide-lime-500/20 border-r-2 border-lime-500/30 bg-black/50">
                            {state.striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <div className="flex items-center gap-1.5">
                                  <span className="py-0.2 rounded bg-lime-400 px-1.5 font-mono text-[9px] font-black tracking-wider text-black">
                                    FOX STRIKE ▶
                                  </span>
                                  <span className="font-score text-sm font-black uppercase tracking-tight text-white">
                                    {state.striker_name}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span className="font-score text-base font-black tabular-nums text-lime-300">
                                    {state.striker_runs ?? 0}*
                                  </span>
                                  <span className="font-mono text-[11px] tabular-nums text-slate-400">
                                    ({state.striker_balls ?? 0}b)
                                  </span>
                                  {strikerSr && (
                                    <span className="py-0.2 rounded border border-lime-500/40 bg-lime-500/20 px-1 font-mono text-[9px] font-bold tabular-nums text-lime-300">
                                      {strikerSr} SR
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {state.non_striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <span className="block font-score text-sm font-bold uppercase tracking-tight text-slate-300">
                                  {state.non_striker_name}
                                </span>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="font-score text-base font-bold tabular-nums text-slate-200">
                                    {state.non_striker_runs ?? 0}
                                  </span>
                                  <span className="font-mono text-[11px] tabular-nums text-slate-400">
                                    ({state.non_striker_balls ?? 0}b)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Bowler Fox Telemetry */}
                          {state.current_bowler_name && (
                            <div className="border-r-2 border-lime-500/30 bg-black/60 px-4 py-1.5 leading-tight">
                              <span className="block font-score text-sm font-black uppercase tracking-tight text-white">
                                {state.current_bowler_name}
                              </span>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="font-mono text-base font-black tabular-nums text-cyan-300">
                                  {state.bowler_wickets ?? 0}/
                                  {state.bowler_runs ?? 0}
                                </span>
                                <span className="font-mono text-[11px] tabular-nums text-slate-400">
                                  ({oversText(state.bowler_balls)})
                                </span>
                                <span className="py-0.2 rounded bg-cyan-500/20 px-1 font-mono text-[9px] font-bold tabular-nums text-cyan-300">
                                  {bowlerEcon} RPO
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Over Delivery Matrix: Square Cyber Cells */}
                          {showBalls && (
                            <div className="flex flex-1 items-center justify-end gap-1 bg-black/80 px-4 py-1.5">
                              {thisOverBalls.length > 0 ? (
                                thisOverBalls.map((b, idx) => (
                                  <CyberBallCell key={idx} label={b} />
                                ))
                              ) : (
                                <span className="font-mono text-[11px] font-bold uppercase text-lime-500/60">
                                  IN PLAY
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Sub-Ribbon */}
                        <div className="overflow-hidden border-t-2 border-lime-400 bg-black px-4 py-1.5 font-mono text-xs font-black uppercase tracking-wide text-lime-300">
                          <div
                            key={carouselIdx}
                            className="animate-sub-bar-flip flex items-center justify-between"
                          >
                            {state.target_runs !== null ? (
                              <div className="flex items-center gap-3">
                                <span className="rounded bg-lime-400 px-2 py-0.5 text-[11px] font-black text-black">
                                  CHASE EQUATION
                                </span>
                                <span className="text-white">
                                  NEED {state.runs_needed} RUNS OFF{" "}
                                  {state.balls_remaining} BALLS
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-lime-300">
                                  RRR {state.required_run_rate ?? "—"}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-lime-400">
                                  PARTNERSHIP {state.partnership_runs ?? 0} (
                                  {state.partnership_balls ?? 0}B)
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-white">
                                  PROJECTED{" "}
                                  {state.current_run_rate
                                    ? Math.round(
                                        state.current_run_rate *
                                          (state.overs_per_innings ?? 20),
                                      )
                                    : "—"}
                                </span>
                              </div>
                            )}
                            <span className="text-lime-400">
                              FOX SPORTS LAB TELEMETRY
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* C. SKY SPORTS CRICKET THE ASHES MODULAR GRID SCOREBUG     */}
                  {/* ========================================================= */}
                  {theme === "skysports" && (
                    <div
                      style={bottomOffsetStyle}
                      className="absolute left-1/2 w-full max-w-5xl -translate-x-1/2 select-none font-score drop-shadow-2xl transition-all duration-300"
                    >
                      <div className="overflow-hidden border border-white/20 bg-[#03081a] text-white shadow-[0_12px_45px_rgba(4,10,28,0.95)]">
                        {/* Top Sky Red & Midnight Bar */}
                        <div className="flex items-center justify-between border-b-2 border-red-600 bg-[#040a1c] px-4 py-1 font-score text-[11px] font-bold uppercase tracking-wider text-slate-300">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-red-500">
                              sky sports cricket
                            </span>
                            <span className="text-white/30">·</span>
                            <span className="font-bold text-white">
                              {state.tournament_name ?? "THE ASHES LIVE"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400">
                              {state.venue}
                            </span>
                            <span className="text-white/30">|</span>
                            <span className="font-bold text-red-400">
                              CRR: {state.current_run_rate ?? "—"}
                            </span>
                          </div>
                        </div>

                        {/* Main Sky Modular Grid */}
                        <div className="flex items-stretch divide-x divide-white/15">
                          {/* Left Team Card */}
                          <div className="flex shrink-0 items-center gap-3 bg-[#06102a] px-5 py-2.5 text-white">
                            {state.team1_logo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={state.team1_logo_url}
                                alt="Logo"
                                className="h-8 w-8 object-contain drop-shadow"
                              />
                            )}
                            <div className="text-left leading-none">
                              <span className="block font-score text-3xl font-black tracking-tight">
                                {battingTeamShort}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-red-400">
                                {state.innings_number === 2
                                  ? "2ND INNINGS"
                                  : "1ST INNINGS"}
                              </span>
                            </div>
                          </div>

                          {/* Score Card with Red Bottom Hairline */}
                          <div className="relative flex items-center gap-3 bg-[#040b20] px-5 py-2">
                            <div className="flex items-baseline gap-1.5">
                              <span
                                className={`font-score text-4xl font-black leading-none tracking-tight ${
                                  scorePulsing
                                    ? "animate-score-pulse scale-105 text-amber-300"
                                    : "text-white"
                                }`}
                              >
                                {state.total_runs ?? 0}
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-red-500">
                                -
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-white">
                                {state.total_wickets ?? 0}
                              </span>
                            </div>

                            <div className="border-l border-white/10 pl-3 text-right leading-tight">
                              <span className="block font-score text-base font-black tabular-nums text-white">
                                {oversText(state.total_balls)}
                              </span>
                              <span className="block font-score text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                OVERS
                              </span>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
                          </div>

                          {/* Batters Side-by-Side Dual Equal Cards */}
                          {state.striker_name && (
                            <div className="border-l-2 border-red-600 bg-[#071333] px-4 py-1.5 leading-tight">
                              <span className="block font-score text-sm font-black uppercase tracking-tight text-white">
                                {state.striker_name} *
                              </span>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="font-score text-base font-black tabular-nums text-white">
                                  {state.striker_runs ?? 0}
                                </span>
                                <span className="font-score text-[11px] tabular-nums text-slate-400">
                                  ({state.striker_balls ?? 0} balls)
                                </span>
                                {strikerSr && (
                                  <span className="font-score text-[10px] font-bold tabular-nums text-red-400">
                                    SR {strikerSr}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {state.non_striker_name && (
                            <div className="bg-[#050e26] px-4 py-1.5 leading-tight">
                              <span className="block font-score text-sm font-bold uppercase tracking-tight text-slate-300">
                                {state.non_striker_name}
                              </span>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span className="font-score text-base font-bold tabular-nums text-slate-200">
                                  {state.non_striker_runs ?? 0}
                                </span>
                                <span className="font-score text-[11px] tabular-nums text-slate-400">
                                  ({state.non_striker_balls ?? 0}b)
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Bowler Card with Full Test Spell: O - M - R - W */}
                          {state.current_bowler_name && (
                            <div className="bg-[#040b20] px-5 py-2 leading-tight">
                              <span className="block font-score text-sm font-black uppercase tracking-tight text-white">
                                {state.current_bowler_name}
                              </span>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="font-score text-base font-black tabular-nums text-red-400">
                                  {oversText(state.bowler_balls)}-0-
                                  {state.bowler_runs ?? 0}-
                                  {state.bowler_wickets ?? 0}
                                </span>
                                <span className="font-score text-[10px] font-medium text-slate-400">
                                  Econ: {bowlerEcon}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Over Delivery Matrix: Circular Sky Dots */}
                          {showBalls && (
                            <div className="flex flex-1 items-center justify-end gap-1.5 bg-[#06102a] px-4 py-2">
                              {thisOverBalls.length > 0 ? (
                                thisOverBalls.map((b, idx) => (
                                  <CircularBallDot key={idx} label={b} />
                                ))
                              ) : (
                                <span className="font-score text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                  In play
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Sub-Bar */}
                        <div className="flex items-center justify-between border-t border-red-600/50 bg-[#030714] px-4 py-1.5 font-score text-xs font-bold text-slate-300">
                          {state.target_runs !== null ? (
                            <div>
                              <span className="font-black text-red-400">
                                CHASE:{" "}
                              </span>
                              <span>
                                NEED {state.runs_needed} RUNS FROM{" "}
                                {state.balls_remaining} BALLS
                              </span>
                              <span className="mx-2 text-white/30">|</span>
                              <span>
                                REQUIRED RATE: {state.required_run_rate ?? "—"}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span>
                                PROJECTED SCORE:{" "}
                                {state.current_run_rate
                                  ? Math.round(
                                      state.current_run_rate *
                                        (state.overs_per_innings ?? 20),
                                    )
                                  : "—"}{" "}
                                RUNS
                              </span>
                              <span className="mx-2 text-white/30">|</span>
                              <span>EXTRAS: {state.extras_total ?? 0}</span>
                            </div>
                          )}
                          <span className="font-black text-red-500">
                            SKY SPORTS CRICKET
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* D. THE HUNDRED BALLS COUNTDOWN POP-ART SCOREBUG           */}
                  {/* ========================================================= */}
                  {theme === "thehundred" && (
                    <div
                      style={bottomOffsetStyle}
                      className="absolute left-1/2 w-full max-w-5xl -translate-x-1/2 select-none font-score drop-shadow-2xl transition-all duration-300"
                    >
                      <div className="overflow-hidden border-2 border-pink-500 bg-[#100118] text-white shadow-[0_12px_45px_rgba(236,72,153,0.5)]">
                        {/* Top Neon Bar */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-pink-600 via-fuchsia-600 to-pink-700 px-4 py-1 font-score text-[11px] font-black uppercase tracking-wider text-white">
                          <span>
                            THE HUNDRED · {battingTeamShort} v{" "}
                            {bowlingTeamShort}
                          </span>
                          <span>CRR {state.current_run_rate ?? "—"}</span>
                        </div>

                        {/* Main Pop-Art Bar */}
                        <div className="flex items-stretch bg-black">
                          <div className="bg-pink-600 px-6 py-2.5 text-3xl font-black text-white">
                            {battingTeamShort}
                          </div>

                          {/* Countdown Box */}
                          <div className="flex flex-col justify-center bg-cyan-400 px-6 py-2 leading-none text-black">
                            <span className="font-mono text-2xl font-black">
                              {state.balls_remaining ?? 18}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider">
                              BALLS LEFT
                            </span>
                          </div>

                          {/* Score */}
                          <div className="flex items-center gap-1.5 border-r border-pink-500/30 bg-neutral-950 px-5 py-2 text-3xl font-black text-yellow-300">
                            <span>{state.total_runs ?? 0}</span>
                            <span className="text-pink-500">/</span>
                            <span>{state.total_wickets ?? 0}</span>
                          </div>

                          {/* Batters */}
                          <div className="flex items-center gap-4 border-r border-pink-500/30 px-4 py-2 text-xs font-bold">
                            <div>
                              <span className="text-pink-400">
                                {state.striker_name}*
                              </span>
                              :{" "}
                              <span className="font-black text-white">
                                {state.striker_runs ?? 0}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">
                                {state.non_striker_name}
                              </span>
                              :{" "}
                              <span className="font-black text-white">
                                {state.non_striker_runs ?? 0}
                              </span>
                            </div>
                          </div>

                          {/* Bowler */}
                          <div className="border-r border-pink-500/30 px-4 py-2 text-xs font-bold">
                            <span className="block text-cyan-400">
                              {state.current_bowler_name}
                            </span>
                            <span className="text-white">
                              {state.bowler_wickets ?? 0}-
                              {state.bowler_runs ?? 0}
                            </span>
                          </div>

                          {/* Delivery Cells */}
                          {showBalls && (
                            <div className="flex flex-1 items-center justify-end gap-1 px-4">
                              {thisOverBalls.map((b, idx) => (
                                <CyberBallCell key={idx} label={b} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* E. APEX FRANCHISE 24K GOLD CHAMPIONSHIP SCOREBUG         */}
                  {/* ========================================================= */}
                  {theme === "apex" && (
                    <div
                      style={bottomOffsetStyle}
                      className="absolute left-1/2 w-full max-w-5xl -translate-x-1/2 select-none font-score drop-shadow-2xl transition-all duration-300"
                    >
                      <div className="clip-chamfer-both carbon-matrix relative overflow-hidden border-2 border-amber-400/90 text-white shadow-[0_12px_45px_rgba(245,158,11,0.4)]">
                        <div className="animate-light-sweep pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-amber-300/15 to-transparent" />

                        {/* Top Gold & Carbon Header Strip */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 px-5 py-1 font-score text-[11px] font-black uppercase tracking-wider text-black">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-3.5 w-3.5 text-black" />
                            <span>
                              APEX BROADCAST · 24K FRANCHISE GOLD ·{" "}
                              {state.tournament_name ??
                                `${battingTeamShort} v ${bowlingTeamShort}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono font-bold">
                            <span>EXIT RADAR: 149.2 KPH</span>
                            <span>•</span>
                            <span>CRR {state.current_run_rate ?? "—"}</span>
                          </div>
                        </div>

                        {/* Main Apex Bar */}
                        <div className="flex items-stretch border-t border-amber-400/30">
                          {/* Left Team Block (Chamfered 24K Gold) */}
                          <div className="flex shrink-0 items-center gap-3 border-r-2 border-amber-300 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 px-6 py-2.5 text-black">
                            {state.team1_logo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={state.team1_logo_url}
                                alt="Logo"
                                className="h-8 w-8 object-contain drop-shadow"
                              />
                            )}
                            <div className="text-left leading-none">
                              <span className="block font-score text-3xl font-black tracking-tight drop-shadow">
                                {battingTeamShort}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-black uppercase tracking-wider opacity-90">
                                {state.innings_number === 2
                                  ? "2ND INNINGS"
                                  : "1ST INNINGS"}
                              </span>
                            </div>
                          </div>

                          {/* Score Block */}
                          <div className="flex items-center gap-3 border-r border-amber-400/30 bg-black/70 px-5 py-2">
                            <div className="flex items-baseline gap-1">
                              <span
                                className={`font-score text-4xl font-black leading-none tracking-tight ${
                                  scorePulsing
                                    ? "animate-score-pulse scale-105 text-yellow-200"
                                    : "bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 bg-clip-text text-transparent"
                                }`}
                              >
                                {state.total_runs ?? 0}
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-amber-400">
                                /
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-white">
                                {state.total_wickets ?? 0}
                              </span>
                            </div>

                            <div className="border-l border-amber-400/20 pl-3 text-right leading-tight">
                              <span className="block font-score text-base font-black tabular-nums text-white">
                                {oversText(state.total_balls)}
                              </span>
                              <span className="block font-score text-[10px] font-bold uppercase tracking-wider text-amber-300">
                                OVERS
                              </span>
                            </div>
                          </div>

                          {/* Batsmen Apex Cards */}
                          <div className="flex items-center divide-x divide-white/10 border-r border-amber-400/30 bg-black/40">
                            {state.striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <div className="flex items-center gap-1.5">
                                  <Sparkles className="h-3 w-3 animate-pulse text-amber-400" />
                                  <span className="font-score text-sm font-black uppercase tracking-tight text-white">
                                    {state.striker_name} *
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span className="font-score text-base font-black tabular-nums text-amber-300">
                                    {state.striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.striker_balls ?? 0}b)
                                  </span>
                                  {strikerSr && (
                                    <span className="py-0.2 rounded border border-amber-400/40 bg-amber-400/20 px-1.5 font-score text-[9px] font-black tabular-nums text-amber-300">
                                      SR {strikerSr}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {state.non_striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <span className="block font-score text-sm font-bold uppercase tracking-tight text-slate-300">
                                  {state.non_striker_name}
                                </span>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="font-score text-base font-bold tabular-nums text-slate-200">
                                    {state.non_striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.non_striker_balls ?? 0}b)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Bowler Apex Card */}
                          {state.current_bowler_name && (
                            <div className="border-r border-amber-400/30 bg-black/50 px-4 py-1.5 leading-tight">
                              <span className="block font-score text-sm font-black uppercase tracking-tight text-white">
                                {state.current_bowler_name}
                              </span>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="font-score text-base font-black tabular-nums text-amber-400">
                                  {state.bowler_wickets ?? 0}-
                                  {state.bowler_runs ?? 0}
                                </span>
                                <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                  ({oversText(state.bowler_balls)})
                                </span>
                                <span className="py-0.2 rounded bg-amber-500/20 px-1.5 font-score text-[9px] font-black tabular-nums text-amber-300">
                                  ECON {bowlerEcon}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Delivery Cells: Hex Gold Dots */}
                          {showBalls && (
                            <div className="flex flex-1 items-center justify-end gap-1 bg-black/60 px-4 py-2">
                              {thisOverBalls.length > 0 ? (
                                thisOverBalls.map((b, idx) => (
                                  <HexBallDot key={idx} label={b} />
                                ))
                              ) : (
                                <span className="font-score text-[11px] font-bold uppercase tracking-wider text-amber-400/60">
                                  OVER IN PROGRESS
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Sub-Ribbon */}
                        <div className="overflow-hidden border-t border-amber-400/40 bg-black/95 px-5 py-1.5 font-score text-xs font-black uppercase tracking-wide text-amber-200">
                          <div
                            key={carouselIdx}
                            className="animate-sub-bar-flip flex items-center justify-between"
                          >
                            {state.target_runs !== null ? (
                              <div className="flex items-center gap-3">
                                <span className="rounded bg-amber-400 px-2.5 py-0.5 text-[11px] font-black text-black">
                                  CHASE TARGET {state.target_runs}
                                </span>
                                <span className="text-white">
                                  NEED {state.runs_needed} RUNS OFF{" "}
                                  {state.balls_remaining} BALLS
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-amber-300">
                                  REQUIRED RATE:{" "}
                                  {state.required_run_rate ?? "—"}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-amber-400">
                                  PARTNERSHIP {state.partnership_runs ?? 0} (
                                  {state.partnership_balls ?? 0}B)
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-white">
                                  PROJECTED SCORE:{" "}
                                  {state.current_run_rate
                                    ? Math.round(
                                        state.current_run_rate *
                                          (state.overs_per_innings ?? 20),
                                      )
                                    : "—"}
                                </span>
                              </div>
                            )}
                            <span className="text-amber-400">
                              APEX BROADCAST NETWORK
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* F. VOLT SPORTS-TECH HIGH-VOLTAGE CYBER SCOREBUG           */}
                  {/* ========================================================= */}
                  {theme === "volt" && (
                    <div
                      style={bottomOffsetStyle}
                      className="absolute left-1/2 w-full max-w-5xl -translate-x-1/2 select-none font-mono drop-shadow-2xl transition-all duration-300"
                    >
                      <div className="clip-slant-right overflow-hidden border-2 border-lime-400 bg-[#020904] text-white shadow-[0_0_35px_rgba(0,255,102,0.4)]">
                        {/* Top Volt Sports-Tech Telemetry Bar */}
                        <div className="flex items-center justify-between border-b border-lime-400/40 bg-black px-4 py-1 font-mono text-[11px] font-black uppercase text-lime-400">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rotate-45 animate-pulse bg-lime-400" />
                            <span>
                              VOLT SPORTS-TECH · HIGH-VOLTAGE LIVE ·{" "}
                              {battingTeamShort} v {bowlingTeamShort}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-bold text-cyan-300">
                            <span>[ VOLT RADAR: 151.2 KPH ]</span>
                            <span>•</span>
                            <span className="text-lime-300">
                              CRR {state.current_run_rate ?? "—"}
                            </span>
                          </div>
                        </div>

                        {/* Main Volt Cyber Bar */}
                        <div className="flex items-stretch">
                          {/* Left Team Angled Neon Block */}
                          <div className="flex shrink-0 items-center gap-3 border-r-2 border-lime-300 bg-gradient-to-r from-lime-400 to-emerald-500 px-5 py-2 font-black text-black">
                            {state.team1_logo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={state.team1_logo_url}
                                alt="Logo"
                                className="h-8 w-8 object-contain drop-shadow"
                              />
                            )}
                            <div className="text-left leading-none">
                              <span className="block font-mono text-3xl font-black tracking-tight">
                                {battingTeamShort}
                              </span>
                              <span className="mt-0.5 block font-mono text-[10px] font-bold">
                                INN {state.innings_number ?? 1}
                              </span>
                            </div>
                          </div>

                          {/* Score Block */}
                          <div className="flex items-center gap-3 border-r-2 border-lime-500/30 bg-neutral-950 px-5 py-1.5">
                            <div className="flex items-baseline gap-1">
                              <span
                                className={`font-mono text-4xl font-black leading-none tracking-tight ${
                                  scorePulsing
                                    ? "animate-score-pulse scale-105 text-cyan-300"
                                    : "text-lime-400"
                                }`}
                              >
                                {state.total_runs ?? 0}
                              </span>
                              <span className="font-mono text-2xl font-black leading-none text-cyan-400">
                                /
                              </span>
                              <span className="font-mono text-2xl font-black leading-none text-white">
                                {state.total_wickets ?? 0}
                              </span>
                            </div>

                            <div className="border-l border-lime-500/20 pl-2.5 text-right leading-tight">
                              <span className="block font-mono text-base font-black tabular-nums text-white">
                                {oversText(state.total_balls)}
                              </span>
                              <span className="block font-mono text-[10px] font-bold uppercase text-lime-400/80">
                                OVERS
                              </span>
                            </div>
                          </div>

                          {/* Batters Volt Telemetry */}
                          <div className="flex items-center divide-x divide-lime-500/20 border-r-2 border-lime-500/30 bg-black/60">
                            {state.striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <div className="flex items-center gap-1.5">
                                  <span className="py-0.2 rounded bg-lime-400 px-1.5 font-mono text-[8px] font-black tracking-wider text-black">
                                    STRIKE ▶
                                  </span>
                                  <span className="font-mono text-sm font-black uppercase tracking-tight text-white">
                                    {state.striker_name}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span className="font-mono text-base font-black tabular-nums text-lime-300">
                                    {state.striker_runs ?? 0}*
                                  </span>
                                  <span className="font-mono text-[11px] tabular-nums text-slate-400">
                                    ({state.striker_balls ?? 0}b)
                                  </span>
                                  {strikerSr && (
                                    <span className="py-0.2 rounded border border-cyan-500/40 bg-cyan-500/20 px-1 font-mono text-[9px] font-bold tabular-nums text-cyan-300">
                                      {strikerSr} SR
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {state.non_striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <span className="block font-mono text-sm font-bold uppercase tracking-tight text-slate-300">
                                  {state.non_striker_name}
                                </span>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="font-mono text-base font-bold tabular-nums text-slate-200">
                                    {state.non_striker_runs ?? 0}
                                  </span>
                                  <span className="font-mono text-[11px] tabular-nums text-slate-400">
                                    ({state.non_striker_balls ?? 0}b)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Bowler Volt Telemetry */}
                          {state.current_bowler_name && (
                            <div className="border-r-2 border-lime-500/30 bg-black/80 px-4 py-1.5 leading-tight">
                              <span className="block font-mono text-sm font-black uppercase tracking-tight text-white">
                                {state.current_bowler_name}
                              </span>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="font-mono text-base font-black tabular-nums text-cyan-300">
                                  {state.bowler_wickets ?? 0}/
                                  {state.bowler_runs ?? 0}
                                </span>
                                <span className="font-mono text-[11px] tabular-nums text-slate-400">
                                  ({oversText(state.bowler_balls)})
                                </span>
                                <span className="py-0.2 rounded bg-lime-500/20 px-1 font-mono text-[9px] font-bold tabular-nums text-lime-300">
                                  {bowlerEcon} RPO
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Over Delivery Matrix: Cyber Cells */}
                          {showBalls && (
                            <div className="flex flex-1 items-center justify-end gap-1 bg-black/90 px-4 py-1.5">
                              {thisOverBalls.length > 0 ? (
                                thisOverBalls.map((b, idx) => (
                                  <CyberBallCell key={idx} label={b} />
                                ))
                              ) : (
                                <span className="font-mono text-[11px] font-bold uppercase text-lime-500/60">
                                  IN PLAY
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Sub-Ribbon */}
                        <div className="overflow-hidden border-t-2 border-lime-400 bg-black px-4 py-1.5 font-mono text-xs font-black uppercase tracking-wide text-lime-300">
                          <div
                            key={carouselIdx}
                            className="animate-sub-bar-flip flex items-center justify-between"
                          >
                            {state.target_runs !== null ? (
                              <div className="flex items-center gap-3">
                                <span className="rounded bg-lime-400 px-2 py-0.5 text-[11px] font-black text-black">
                                  CHASE EQUATION
                                </span>
                                <span className="text-white">
                                  NEED {state.runs_needed} RUNS OFF{" "}
                                  {state.balls_remaining} BALLS
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-cyan-300">
                                  RRR {state.required_run_rate ?? "—"}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-lime-400">
                                  PARTNERSHIP {state.partnership_runs ?? 0} (
                                  {state.partnership_balls ?? 0}B)
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-white">
                                  PROJECTED{" "}
                                  {state.current_run_rate
                                    ? Math.round(
                                        state.current_run_rate *
                                          (state.overs_per_innings ?? 20),
                                      )
                                    : "—"}
                                </span>
                              </div>
                            )}
                            <span className="text-cyan-400">
                              VOLT HIGH-VOLTAGE TELEMETRY
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* G. THUNDER VELOCITY COBALT STORM SCOREBUG                 */}
                  {/* ========================================================= */}
                  {theme === "thunder" && (
                    <div
                      style={bottomOffsetStyle}
                      className="absolute left-1/2 w-full max-w-5xl -translate-x-1/2 select-none font-score drop-shadow-2xl transition-all duration-300"
                    >
                      <div className="overflow-hidden rounded-2xl border-2 border-blue-400 bg-gradient-to-r from-[#030a21] via-[#081845] to-[#030a21] text-white shadow-[0_12px_45px_rgba(59,130,246,0.5)]">
                        {/* Top Thunder Blue Bar */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-5 py-1 font-score text-[11px] font-black uppercase tracking-wider text-white">
                          <div className="flex items-center gap-2">
                            <Zap className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" />
                            <span>
                              THUNDER VELOCITY ·{" "}
                              {state.tournament_name ??
                                `${battingTeamShort} v ${bowlingTeamShort}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-bold text-yellow-300">
                            <span>
                              THUNDER CRR: {state.current_run_rate ?? "—"}
                            </span>
                          </div>
                        </div>

                        {/* Main Thunder Bar */}
                        <div className="flex items-stretch border-t border-blue-400/30">
                          {/* Left Team Block */}
                          <div className="flex shrink-0 items-center gap-3 border-r border-blue-400/50 bg-blue-600 px-5 py-2.5 text-white">
                            <Zap className="h-6 w-6 fill-yellow-300 text-yellow-300" />
                            {state.team1_logo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={state.team1_logo_url}
                                alt="Logo"
                                className="h-8 w-8 object-contain drop-shadow"
                              />
                            )}
                            <div className="text-left leading-none">
                              <span className="block font-score text-3xl font-black tracking-tight">
                                {battingTeamShort}
                              </span>
                              <span className="mt-0.5 block font-score text-[10px] font-black uppercase tracking-wider text-yellow-300">
                                {state.innings_number === 2
                                  ? "2ND INN"
                                  : "1ST INN"}
                              </span>
                            </div>
                          </div>

                          {/* Score Block */}
                          <div className="flex items-center gap-3 border-r border-white/10 bg-black/60 px-5 py-2">
                            <div className="flex items-baseline gap-1">
                              <span
                                className={`font-score text-4xl font-black leading-none tracking-tight ${
                                  scorePulsing
                                    ? "animate-score-pulse scale-105 text-yellow-200"
                                    : "text-yellow-300"
                                }`}
                              >
                                {state.total_runs ?? 0}
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-blue-400">
                                /
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-white">
                                {state.total_wickets ?? 0}
                              </span>
                            </div>

                            <div className="border-l border-white/10 pl-3 text-right leading-tight">
                              <span className="block font-score text-base font-black tabular-nums text-white">
                                {oversText(state.total_balls)}
                              </span>
                              <span className="block font-score text-[10px] font-bold uppercase tracking-wider text-blue-300">
                                OVERS
                              </span>
                            </div>
                          </div>

                          {/* Batsmen */}
                          <div className="flex items-center divide-x divide-white/10 border-r border-white/10 bg-black/40">
                            {state.striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <div className="flex items-center gap-1.5">
                                  <Zap className="h-3 w-3 animate-pulse fill-yellow-300 text-yellow-300" />
                                  <span className="font-score text-sm font-black uppercase tracking-tight text-white">
                                    {state.striker_name} *
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span className="font-score text-base font-black tabular-nums text-yellow-300">
                                    {state.striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.striker_balls ?? 0}b)
                                  </span>
                                  {strikerSr && (
                                    <span className="py-0.2 rounded border border-blue-400/40 bg-blue-500/20 px-1.5 font-score text-[9px] font-black tabular-nums text-blue-200">
                                      SR {strikerSr}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {state.non_striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <span className="block font-score text-sm font-bold uppercase tracking-tight text-slate-300">
                                  {state.non_striker_name}
                                </span>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="font-score text-base font-bold tabular-nums text-slate-200">
                                    {state.non_striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.non_striker_balls ?? 0}b)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Bowler */}
                          {state.current_bowler_name && (
                            <div className="border-r border-white/10 bg-black/50 px-4 py-1.5 leading-tight">
                              <span className="block font-score text-sm font-black uppercase tracking-tight text-white">
                                {state.current_bowler_name}
                              </span>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="font-score text-base font-black tabular-nums text-blue-300">
                                  {state.bowler_wickets ?? 0}-
                                  {state.bowler_runs ?? 0}
                                </span>
                                <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                  ({oversText(state.bowler_balls)})
                                </span>
                                <span className="py-0.2 rounded bg-white/10 px-1.5 font-score text-[9px] font-black tabular-nums text-slate-300">
                                  ECON {bowlerEcon}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Over Delivery Matrix */}
                          {showBalls && (
                            <div className="flex flex-1 items-center justify-end gap-1 bg-black/60 px-4 py-2">
                              {thisOverBalls.length > 0 ? (
                                thisOverBalls.map((b, idx) => (
                                  <CircularBallDot key={idx} label={b} />
                                ))
                              ) : (
                                <span className="font-score text-[11px] font-bold uppercase tracking-wider text-blue-300/60">
                                  IN PLAY
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Sub-Bar */}
                        <div className="border-t-2 border-blue-400 bg-[#020617] px-5 py-1.5 font-score text-xs font-black uppercase tracking-wide text-blue-200">
                          <div
                            key={carouselIdx}
                            className="animate-sub-bar-flip flex items-center justify-between"
                          >
                            {state.target_runs !== null ? (
                              <div className="flex items-center gap-3">
                                <span className="rounded bg-yellow-400 px-2.5 py-0.5 text-[11px] font-black text-black">
                                  TARGET {state.target_runs}
                                </span>
                                <span className="text-white">
                                  NEED {state.runs_needed} RUNS FROM{" "}
                                  {state.balls_remaining} BALLS
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-yellow-300">
                                  REQ. RR: {state.required_run_rate ?? "—"}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-yellow-300">
                                  PARTNERSHIP {state.partnership_runs ?? 0} (
                                  {state.partnership_balls ?? 0}B)
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-white">
                                  PROJECTED:{" "}
                                  {state.current_run_rate
                                    ? Math.round(
                                        state.current_run_rate *
                                          (state.overs_per_innings ?? 20),
                                      )
                                    : "—"}
                                </span>
                              </div>
                            )}
                            <span className="text-yellow-300">
                              THUNDER VELOCITY CRICKET
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* H. DHARMA HERITAGE ROYALE INDIAN SCOREBUG                 */}
                  {/* ========================================================= */}
                  {theme === "dharma" && (
                    <div
                      style={bottomOffsetStyle}
                      className="absolute left-1/2 w-full max-w-5xl -translate-x-1/2 select-none font-serif drop-shadow-2xl transition-all duration-300"
                    >
                      <div className="overflow-hidden rounded-3xl border-2 border-amber-400/80 bg-gradient-to-r from-[#180408] via-[#2a0810] to-[#180408] text-white shadow-[0_12px_45px_rgba(180,83,9,0.4)]">
                        {/* Top Dharma Saffron Gold Header */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 px-5 py-1 text-[11px] font-black uppercase tracking-widest text-black">
                          <div className="flex items-center gap-2">
                            <Crown className="h-3.5 w-3.5 text-black" />
                            <span>
                              DHARMA HERITAGE · RAJASTHAN ROYALE ·{" "}
                              {state.tournament_name ??
                                `${battingTeamShort} v ${bowlingTeamShort}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-sans font-bold">
                            <span>CRR {state.current_run_rate ?? "—"}</span>
                          </div>
                        </div>

                        {/* Main Dharma Bar */}
                        <div className="flex items-stretch border-t border-amber-400/30">
                          {/* Left Team Arched Block */}
                          <div className="flex shrink-0 items-center gap-3 border-r border-amber-400/50 bg-gradient-to-r from-red-800 via-rose-900 to-red-950 px-6 py-2.5 text-amber-200">
                            {state.team1_logo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={state.team1_logo_url}
                                alt="Logo"
                                className="h-8 w-8 object-contain drop-shadow"
                              />
                            )}
                            <div className="text-left leading-none">
                              <span className="block font-score text-3xl font-black tracking-tight">
                                {battingTeamShort}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-black uppercase tracking-wider text-amber-300">
                                {state.innings_number === 2
                                  ? "2ND INNINGS"
                                  : "1ST INNINGS"}
                              </span>
                            </div>
                          </div>

                          {/* Score Block */}
                          <div className="flex items-center gap-3 border-r border-white/10 bg-black/60 px-5 py-2 font-sans">
                            <div className="flex items-baseline gap-1">
                              <span
                                className={`font-score text-4xl font-black leading-none tracking-tight ${
                                  scorePulsing
                                    ? "animate-score-pulse scale-105 text-amber-200"
                                    : "text-amber-300"
                                }`}
                              >
                                {state.total_runs ?? 0}
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-red-500">
                                /
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-white">
                                {state.total_wickets ?? 0}
                              </span>
                            </div>

                            <div className="border-l border-white/10 pl-3 text-right font-serif leading-tight">
                              <span className="block font-score text-base font-black tabular-nums text-white">
                                {oversText(state.total_balls)}
                              </span>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-300">
                                OVERS
                              </span>
                            </div>
                          </div>

                          {/* Batsmen */}
                          <div className="flex items-center divide-x divide-white/10 border-r border-white/10 bg-black/40 font-sans">
                            {state.striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <div className="flex items-center gap-1.5">
                                  <Crown className="h-3 w-3 text-amber-400" />
                                  <span className="font-score text-sm font-black uppercase tracking-tight text-white">
                                    {state.striker_name} *
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span className="font-score text-base font-black tabular-nums text-amber-300">
                                    {state.striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.striker_balls ?? 0}b)
                                  </span>
                                  {strikerSr && (
                                    <span className="py-0.2 rounded border border-amber-400/40 bg-amber-500/20 px-1.5 font-score text-[9px] font-black tabular-nums text-amber-300">
                                      SR {strikerSr}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {state.non_striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <span className="block font-score text-sm font-bold uppercase tracking-tight text-slate-300">
                                  {state.non_striker_name}
                                </span>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="font-score text-base font-bold tabular-nums text-slate-200">
                                    {state.non_striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.non_striker_balls ?? 0}b)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Bowler */}
                          {state.current_bowler_name && (
                            <div className="border-r border-white/10 bg-black/50 px-4 py-1.5 font-sans leading-tight">
                              <span className="block font-score text-sm font-black uppercase tracking-tight text-white">
                                {state.current_bowler_name}
                              </span>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="font-score text-base font-black tabular-nums text-amber-300">
                                  {state.bowler_wickets ?? 0}-
                                  {state.bowler_runs ?? 0}
                                </span>
                                <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                  ({oversText(state.bowler_balls)})
                                </span>
                                <span className="py-0.2 rounded bg-white/10 px-1.5 font-score text-[9px] font-black tabular-nums text-slate-300">
                                  ECON {bowlerEcon}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Over Delivery Matrix */}
                          {showBalls && (
                            <div className="flex flex-1 items-center justify-end gap-1 bg-black/60 px-4 py-2">
                              {thisOverBalls.length > 0 ? (
                                thisOverBalls.map((b, idx) => (
                                  <CircularBallDot key={idx} label={b} />
                                ))
                              ) : (
                                <span className="font-serif text-[11px] font-bold uppercase tracking-wider text-amber-400/60">
                                  IN PLAY
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Sub-Bar */}
                        <div className="border-t-2 border-amber-500 bg-[#0e0204] px-5 py-1.5 font-sans text-xs font-black uppercase tracking-wide text-amber-300">
                          <div
                            key={carouselIdx}
                            className="animate-sub-bar-flip flex items-center justify-between"
                          >
                            {state.target_runs !== null ? (
                              <div className="flex items-center gap-3">
                                <span className="rounded bg-amber-400 px-2.5 py-0.5 text-[11px] font-black text-black">
                                  TARGET {state.target_runs}
                                </span>
                                <span className="text-white">
                                  NEED {state.runs_needed} RUNS FROM{" "}
                                  {state.balls_remaining} BALLS
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-amber-300">
                                  REQ. RR: {state.required_run_rate ?? "—"}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-amber-400">
                                  PARTNERSHIP {state.partnership_runs ?? 0} (
                                  {state.partnership_balls ?? 0}B)
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-white">
                                  PROJECTED:{" "}
                                  {state.current_run_rate
                                    ? Math.round(
                                        state.current_run_rate *
                                          (state.overs_per_innings ?? 20),
                                      )
                                    : "—"}
                                </span>
                              </div>
                            )}
                            <span className="text-amber-400">
                              DHARMA HERITAGE ROYALE
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* I. NAKSHATRA ASTRAL COSMIC NEBULA SCOREBUG                */}
                  {/* ========================================================= */}
                  {theme === "nakshatra" && (
                    <div
                      style={bottomOffsetStyle}
                      className="absolute left-1/2 w-full max-w-5xl -translate-x-1/2 select-none font-score drop-shadow-2xl transition-all duration-300"
                    >
                      <div className="from-[#0a041f]/98 via-[#16083d]/98 to-[#0a041f]/98 overflow-hidden rounded-3xl border-2 border-purple-500/70 bg-gradient-to-r text-white shadow-[0_12px_45px_rgba(168,85,247,0.4)] backdrop-blur-2xl">
                        {/* Top Cosmic Nebula Header */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 px-5 py-1 font-score text-[11px] font-black uppercase tracking-wider text-white">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                            <span>
                              NAKSHATRA ASTRAL · COSMIC CRICKET ·{" "}
                              {state.tournament_name ??
                                `${battingTeamShort} v ${bowlingTeamShort}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono font-bold text-cyan-300">
                            <span>
                              ASTRAL CRR: {state.current_run_rate ?? "—"}
                            </span>
                          </div>
                        </div>

                        {/* Main Nakshatra Bar */}
                        <div className="flex items-stretch border-t border-purple-400/30">
                          {/* Left Team Nebula Block */}
                          <div className="flex shrink-0 items-center gap-3 border-r border-purple-400/40 bg-gradient-to-r from-purple-700 via-fuchsia-700 to-indigo-800 px-6 py-2.5 font-black text-white">
                            {state.team1_logo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={state.team1_logo_url}
                                alt="Logo"
                                className="h-8 w-8 object-contain drop-shadow"
                              />
                            )}
                            <div className="text-left leading-none">
                              <span className="block font-score text-3xl font-black tracking-tight">
                                {battingTeamShort}
                              </span>
                              <span className="mt-0.5 block font-score text-[10px] font-black uppercase tracking-wider text-cyan-300">
                                {state.innings_number === 2
                                  ? "2ND INN"
                                  : "1ST INN"}
                              </span>
                            </div>
                          </div>

                          {/* Score Block */}
                          <div className="flex items-center gap-3 border-r border-white/10 bg-black/60 px-5 py-2">
                            <div className="flex items-baseline gap-1">
                              <span
                                className={`font-score text-4xl font-black leading-none tracking-tight ${
                                  scorePulsing
                                    ? "animate-score-pulse scale-105 text-cyan-200"
                                    : "text-cyan-300"
                                }`}
                              >
                                {state.total_runs ?? 0}
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-purple-400">
                                /
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-white">
                                {state.total_wickets ?? 0}
                              </span>
                            </div>

                            <div className="border-l border-white/10 pl-3 text-right leading-tight">
                              <span className="block font-score text-base font-black tabular-nums text-white">
                                {oversText(state.total_balls)}
                              </span>
                              <span className="block font-score text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                                OVERS
                              </span>
                            </div>
                          </div>

                          {/* Batsmen */}
                          <div className="flex items-center divide-x divide-white/10 border-r border-white/10 bg-black/40">
                            {state.striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <div className="flex items-center gap-1.5">
                                  <Sparkles className="h-3 w-3 animate-pulse text-cyan-300" />
                                  <span className="font-score text-sm font-black uppercase tracking-tight text-white">
                                    {state.striker_name} *
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span className="font-score text-base font-black tabular-nums text-cyan-200">
                                    {state.striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.striker_balls ?? 0}b)
                                  </span>
                                  {strikerSr && (
                                    <span className="py-0.2 rounded border border-purple-400/40 bg-purple-500/20 px-1.5 font-score text-[9px] font-black tabular-nums text-purple-300">
                                      SR {strikerSr}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {state.non_striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <span className="block font-score text-sm font-bold uppercase tracking-tight text-slate-300">
                                  {state.non_striker_name}
                                </span>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="font-score text-base font-bold tabular-nums text-slate-200">
                                    {state.non_striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.non_striker_balls ?? 0}b)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Bowler */}
                          {state.current_bowler_name && (
                            <div className="border-r border-white/10 bg-black/50 px-4 py-1.5 leading-tight">
                              <span className="block font-score text-sm font-black uppercase tracking-tight text-white">
                                {state.current_bowler_name}
                              </span>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="font-score text-base font-black tabular-nums text-cyan-300">
                                  {state.bowler_wickets ?? 0}-
                                  {state.bowler_runs ?? 0}
                                </span>
                                <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                  ({oversText(state.bowler_balls)})
                                </span>
                                <span className="py-0.2 rounded bg-white/10 px-1.5 font-score text-[9px] font-black tabular-nums text-slate-300">
                                  ECON {bowlerEcon}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Over Delivery Matrix */}
                          {showBalls && (
                            <div className="flex flex-1 items-center justify-end gap-1 bg-black/60 px-4 py-2">
                              {thisOverBalls.length > 0 ? (
                                thisOverBalls.map((b, idx) => (
                                  <CircularBallDot key={idx} label={b} />
                                ))
                              ) : (
                                <span className="font-score text-[11px] font-bold uppercase tracking-wider text-purple-300/60">
                                  IN PLAY
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Sub-Bar */}
                        <div className="border-t-2 border-purple-400 bg-[#060214] px-5 py-1.5 font-score text-xs font-black uppercase tracking-wide text-purple-200">
                          <div
                            key={carouselIdx}
                            className="animate-sub-bar-flip flex items-center justify-between"
                          >
                            {state.target_runs !== null ? (
                              <div className="flex items-center gap-3">
                                <span className="rounded bg-purple-600 px-2.5 py-0.5 text-[11px] font-black text-white">
                                  TARGET {state.target_runs}
                                </span>
                                <span className="text-white">
                                  NEED {state.runs_needed} RUNS FROM{" "}
                                  {state.balls_remaining} BALLS
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-cyan-300">
                                  REQ. RR: {state.required_run_rate ?? "—"}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-cyan-300">
                                  PARTNERSHIP {state.partnership_runs ?? 0} (
                                  {state.partnership_balls ?? 0}B)
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-white">
                                  PROJECTED:{" "}
                                  {state.current_run_rate
                                    ? Math.round(
                                        state.current_run_rate *
                                          (state.overs_per_innings ?? 20),
                                      )
                                    : "—"}
                                </span>
                              </div>
                            )}
                            <span className="text-cyan-300">
                              NAKSHATRA ASTRAL FEED
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* I2. AGNI INFERNO SCOREBUG (VOLCANIC MAGMA & EMBER MATRIX) */}
                  {/* ========================================================= */}
                  {theme === "agni" && (
                    <div
                      style={bottomOffsetStyle}
                      className="absolute left-1/2 w-full max-w-5xl -translate-x-1/2 select-none font-score drop-shadow-2xl transition-all duration-300"
                    >
                      <div className="clip-notch-card magma-matrix relative overflow-hidden border-2 border-orange-500 text-white shadow-[0_12px_45px_rgba(255,69,0,0.55)]">
                        <div className="animate-flame-flicker pointer-events-none absolute inset-0 bg-gradient-to-r from-red-600/10 via-orange-500/15 to-amber-500/10" />

                        {/* Top Header: Agni Inferno Match Heat */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 px-5 py-1 font-score text-[11px] font-black uppercase tracking-wider text-black">
                          <div className="flex items-center gap-2">
                            <Flame className="h-3.5 w-3.5 animate-flame-flicker fill-black text-black" />
                            <span>
                              AGNI INFERNO · BLAZING PASSION ·{" "}
                              {state.tournament_name ??
                                `${battingTeamShort} v ${bowlingTeamShort}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono font-black">
                            <span>[ CORE TEMP: 1850°C ]</span>
                            <span>•</span>
                            <span>CRR {state.current_run_rate ?? "—"}</span>
                          </div>
                        </div>

                        {/* Main Agni Bar */}
                        <div className="flex items-stretch border-t border-orange-500/30">
                          {/* Left Team Flame Notch */}
                          <div className="clip-notch-card flex shrink-0 items-center gap-3 border-r-2 border-orange-400 bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 px-6 py-2.5 text-black">
                            {state.team1_logo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={state.team1_logo_url}
                                alt="Logo"
                                className="h-8 w-8 object-contain drop-shadow"
                              />
                            )}
                            <div className="text-left leading-none">
                              <span className="block font-score text-3xl font-black tracking-tight drop-shadow">
                                {battingTeamShort}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-black uppercase tracking-wider opacity-90">
                                {state.innings_number === 2
                                  ? "2ND INNINGS"
                                  : "1ST INNINGS"}
                              </span>
                            </div>
                          </div>

                          {/* Score Block */}
                          <div className="flex items-center gap-3 border-r border-orange-500/30 bg-black/70 px-5 py-2">
                            <div className="flex items-baseline gap-1">
                              <span
                                className={`font-score text-4xl font-black leading-none tracking-tight ${
                                  scorePulsing
                                    ? "animate-score-pulse scale-105 text-yellow-200"
                                    : "bg-gradient-to-r from-yellow-200 via-orange-300 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(255,69,0,0.8)]"
                                }`}
                              >
                                {state.total_runs ?? 0}
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-orange-500">
                                /
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-white">
                                {state.total_wickets ?? 0}
                              </span>
                            </div>

                            <div className="border-l border-orange-500/30 pl-3 text-right leading-tight">
                              <span className="block font-score text-base font-black tabular-nums text-white">
                                {oversText(state.total_balls)}
                              </span>
                              <span className="block font-score text-[10px] font-bold uppercase tracking-wider text-orange-400">
                                OVERS
                              </span>
                            </div>
                          </div>

                          {/* Batsmen Agni Cards */}
                          <div className="flex items-center divide-x divide-white/10 border-r border-orange-500/30 bg-black/50">
                            {state.striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <div className="flex items-center gap-1.5">
                                  <Flame className="h-3.5 w-3.5 animate-flame-flicker fill-orange-400 text-orange-400" />
                                  <span className="font-score text-sm font-black uppercase tracking-tight text-white">
                                    {state.striker_name} *
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span className="font-score text-base font-black tabular-nums text-orange-300">
                                    {state.striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.striker_balls ?? 0}b)
                                  </span>
                                  {strikerSr && (
                                    <span className="py-0.2 rounded border border-orange-500/40 bg-orange-500/20 px-1.5 font-score text-[9px] font-black tabular-nums text-orange-300">
                                      SR {strikerSr}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {state.non_striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <span className="block font-score text-sm font-bold uppercase tracking-tight text-slate-300">
                                  {state.non_striker_name}
                                </span>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="font-score text-base font-bold tabular-nums text-slate-200">
                                    {state.non_striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.non_striker_balls ?? 0}b)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Bowler Agni Card */}
                          {state.current_bowler_name && (
                            <div className="border-r border-orange-500/30 bg-black/60 px-4 py-1.5 leading-tight">
                              <span className="block font-score text-sm font-black uppercase tracking-tight text-white">
                                {state.current_bowler_name}
                              </span>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="font-score text-base font-black tabular-nums text-orange-400">
                                  {state.bowler_wickets ?? 0}-
                                  {state.bowler_runs ?? 0}
                                </span>
                                <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                  ({oversText(state.bowler_balls)})
                                </span>
                                <span className="py-0.2 rounded bg-white/10 px-1.5 font-score text-[9px] font-black tabular-nums text-slate-300">
                                  ECON {bowlerEcon}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Over Delivery Ember Matrix */}
                          {showBalls && (
                            <div className="flex flex-1 items-center justify-end gap-1 bg-black/60 px-4 py-2">
                              {thisOverBalls.length > 0 ? (
                                thisOverBalls.map((b, idx) => (
                                  <EmberBallDot key={idx} label={b} />
                                ))
                              ) : (
                                <span className="font-score text-[11px] font-bold uppercase tracking-wider text-orange-400/60">
                                  IN PLAY
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Agni Sub-Bar */}
                        <div className="border-t-2 border-orange-500 bg-[#0d0301] px-5 py-1.5 font-score text-xs font-black uppercase tracking-wide text-orange-200">
                          <div
                            key={carouselIdx}
                            className="animate-sub-bar-flip flex items-center justify-between"
                          >
                            {state.target_runs !== null ? (
                              <div className="flex items-center gap-3">
                                <span className="rounded bg-orange-600 px-2.5 py-0.5 text-[11px] font-black text-black">
                                  TARGET {state.target_runs}
                                </span>
                                <span className="text-white">
                                  NEED {state.runs_needed} RUNS FROM{" "}
                                  {state.balls_remaining} BALLS
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-amber-300">
                                  REQ. RR: {state.required_run_rate ?? "—"}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-amber-300">
                                  PARTNERSHIP {state.partnership_runs ?? 0} (
                                  {state.partnership_balls ?? 0}B)
                                </span>
                                <span className="text-white/30">|</span>
                                <span className="text-white">
                                  PROJECTED:{" "}
                                  {state.current_run_rate
                                    ? Math.round(
                                        state.current_run_rate *
                                          (state.overs_per_innings ?? 20),
                                      )
                                    : "—"}
                                </span>
                              </div>
                            )}
                            <span className="text-orange-400">
                              AGNI INFERNO FEED
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* J. STAR SPORTS / IPL / ICC GOLD FEED (DEFAULT PARALLELOGRAM) */}
                  {/* ========================================================= */}
                  {theme !== "sonysports" &&
                    theme !== "foxcricket" &&
                    theme !== "skysports" &&
                    theme !== "thehundred" &&
                    theme !== "apex" &&
                    theme !== "volt" &&
                    theme !== "agni" &&
                    theme !== "thunder" &&
                    theme !== "dharma" &&
                    theme !== "nakshatra" && (
                      <div
                        style={bottomOffsetStyle}
                        className="absolute left-1/2 w-full max-w-5xl -translate-x-1/2 select-none font-score drop-shadow-2xl transition-all duration-300"
                      >
                        {/* TOP HEADER SUB-STRIP: TOURNAMENT & MATCH PACE */}
                        <div className="flex items-center justify-between border-x border-t border-white/20 bg-black/95 px-3.5 py-1 font-score text-[11px] font-black uppercase tracking-wider text-slate-300">
                          <div className="flex items-center gap-2.5">
                            <span className="font-black text-amber-400">
                              {state.tournament_name ?? state.title}
                            </span>
                            <span className="text-white/30">|</span>
                            <span className="text-white/80">
                              {state.match_format} · {state.venue}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {sponsor && (
                              <span className="rounded border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-black tracking-wider text-amber-300">
                                {sponsor}
                              </span>
                            )}
                            <span className="rounded border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black tracking-wider text-emerald-300">
                              CRR {state.current_run_rate ?? "—"}
                            </span>
                          </div>
                        </div>

                        {/* MAIN HORIZONTAL SEGMENTED SCORE BAR */}
                        <div
                          className={`relative flex items-stretch border border-white/20 ${themeStyle.mainBarBg} ${themeStyle.outerBorder} broadcast-bevel`}
                        >
                          {/* 1. TEAM BLOCK (ANGLED TRAPEZOID BADGE) */}
                          <div
                            className={`clip-slant-right flex shrink-0 items-center gap-3 px-5 py-2 ${themeStyle.teamBadge} broadcast-gloss shadow-inner`}
                          >
                            {state.team1_logo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={state.team1_logo_url}
                                alt="Logo"
                                className="h-8 w-8 object-contain drop-shadow"
                              />
                            )}
                            <div className="text-left leading-none">
                              <span className="block font-score text-3xl font-black tracking-tight drop-shadow">
                                {battingTeamShort}
                              </span>
                              <span className="mt-0.5 block font-score text-[10px] font-black uppercase tracking-widest opacity-90">
                                {state.innings_number === 2
                                  ? "2ND INN"
                                  : "1ST INN"}
                              </span>
                            </div>
                          </div>

                          {/* 2. CORE SCORE & OVERS BLOCK */}
                          <div className="flex items-center gap-3 border-r border-white/15 bg-black/40 px-4 py-1.5">
                            <div className="flex items-baseline gap-1">
                              <span
                                className={`font-score text-4xl font-black leading-none tracking-tight transition-all duration-300 ${
                                  scorePulsing
                                    ? "animate-score-pulse scale-105 text-amber-300"
                                    : "text-white"
                                }`}
                              >
                                {state.total_runs ?? 0}
                              </span>
                              <span className="font-score text-2xl font-black leading-none text-amber-400">
                                /{state.total_wickets ?? 0}
                              </span>
                            </div>

                            <div className="border-l border-white/10 pl-2.5 text-right leading-tight">
                              <span className="block font-score text-base font-black tabular-nums text-white">
                                {oversText(state.total_balls)}
                              </span>
                              <span className="block font-score text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                / {state.overs_per_innings} OV
                              </span>
                            </div>
                          </div>

                          {/* 3. BATSMEN PANEL (STRIKER & NON-STRIKER) */}
                          <div className="flex items-center divide-x divide-white/10 border-r border-white/15">
                            {/* Striker */}
                            {state.striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <div className="flex items-center gap-1.5">
                                  <span className="animate-pulse text-xs font-black text-emerald-400 drop-shadow-[0_0_6px_#34d399]">
                                    ▶
                                  </span>
                                  <span className="font-score text-sm font-black uppercase tracking-tight text-white">
                                    {state.striker_name} *
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span className="font-score text-base font-black tabular-nums text-amber-300">
                                    {state.striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.striker_balls ?? 0}b)
                                  </span>
                                  {strikerSr && (
                                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-score text-[9px] font-black tabular-nums text-emerald-300">
                                      SR {strikerSr}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Non-Striker */}
                            {state.non_striker_name && (
                              <div className="px-4 py-1.5 leading-tight">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-500">
                                    •
                                  </span>
                                  <span className="font-score text-sm font-bold uppercase tracking-tight text-slate-300">
                                    {state.non_striker_name}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="font-score text-base font-bold tabular-nums text-slate-200">
                                    {state.non_striker_runs ?? 0}
                                  </span>
                                  <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                    ({state.non_striker_balls ?? 0}b)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 4. CURRENT BOWLER PANEL */}
                          {state.current_bowler_name && (
                            <div className="border-r border-white/15 px-4 py-1.5 leading-tight">
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
                                <span className="font-score text-sm font-black uppercase tracking-tight text-white">
                                  {state.current_bowler_name}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="font-score text-base font-black tabular-nums text-sky-300">
                                  {state.bowler_wickets ?? 0}-
                                  {state.bowler_runs ?? 0}
                                </span>
                                <span className="font-score text-[11px] font-medium tabular-nums text-slate-400">
                                  ({oversText(state.bowler_balls)})
                                </span>
                                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-score text-[9px] font-black tabular-nums text-sky-300">
                                  ECON {bowlerEcon}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* 5. OVER BALL-BY-BALL CHIP TRAY */}
                          {showBalls && (
                            <div className="flex flex-1 items-center justify-end gap-1 px-4 py-1.5">
                              {thisOverBalls.length > 0 ? (
                                <>
                                  {thisOverBalls.map((b, idx) => (
                                    <BallChip key={idx} label={b} />
                                  ))}
                                  {Array.from({
                                    length: Math.max(
                                      0,
                                      6 - thisOverBalls.length,
                                    ),
                                  }).map((_, i) => (
                                    <span
                                      key={`empty-${i}`}
                                      className="skew-tile inline-flex h-6 w-[26px] items-center justify-center border border-dashed border-white/20 bg-white/5 opacity-50"
                                    />
                                  ))}
                                </>
                              ) : (
                                <span className="font-score text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                  Over in progress
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* LOWER SUB-BAR: DYNAMIC ROTATING BROADCAST RIBBON */}
                        <div
                          className={`overflow-hidden px-4 py-1.5 ${themeStyle.subBarBg} font-score text-xs font-black uppercase tracking-wide`}
                        >
                          <div
                            key={carouselIdx}
                            className="animate-sub-bar-flip flex items-center justify-between"
                          >
                            {/* Slide 0: Target / Chase Equation or Projected Score */}
                            {carouselIdx === 0 && (
                              <>
                                {state.target_runs !== null ? (
                                  <div className="flex items-center gap-3">
                                    <span className="rounded bg-amber-400 px-2 py-0.5 text-[11px] font-black text-black">
                                      TARGET {state.target_runs}
                                    </span>
                                    <span className="text-white">
                                      NEED {state.runs_needed} RUNS FROM{" "}
                                      {state.balls_remaining} BALLS
                                    </span>
                                    <span className="text-white/30">|</span>
                                    <span className="text-amber-300">
                                      REQ. RR: {state.required_run_rate ?? "—"}
                                    </span>
                                    <span className="text-white/30">|</span>
                                    <span className="text-emerald-300">
                                      CURR. RR: {state.current_run_rate ?? "—"}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <span className="text-amber-400">
                                      VS{" "}
                                      {state.bowling_team_name ??
                                        state.bowling_team_short_name}
                                    </span>
                                    <span className="text-white/30">|</span>
                                    <span className="text-white">
                                      PROJECTED SCORE:{" "}
                                      {state.current_run_rate
                                        ? Math.round(
                                            state.current_run_rate *
                                              (state.overs_per_innings ?? 20),
                                          )
                                        : "—"}{" "}
                                      RUNS
                                    </span>
                                    <span className="text-white/30">|</span>
                                    <span className="text-slate-300">
                                      EXTRAS: {state.extras_total ?? 0}
                                    </span>
                                  </div>
                                )}
                                {state.partnership_runs !== null &&
                                  state.partnership_runs > 0 && (
                                    <div className="font-bold text-slate-300">
                                      PARTNERSHIP {state.partnership_runs} (
                                      {state.partnership_balls}b)
                                    </div>
                                  )}
                              </>
                            )}

                            {/* Slide 1: Partnership Analysis with Visual Progress Bar */}
                            {carouselIdx === 1 && (
                              <>
                                <div className="flex items-center gap-3">
                                  <span className="rounded bg-purple-600 px-2 py-0.5 text-[11px] font-black text-white">
                                    PARTNERSHIP
                                  </span>
                                  <span className="text-white">
                                    {state.partnership_runs ?? 0} RUNS OFF{" "}
                                    {state.partnership_balls ?? 0} BALLS
                                  </span>
                                  {state.striker_name &&
                                    state.non_striker_name &&
                                    state.partnership_runs &&
                                    state.partnership_runs > 0 && (
                                      <div className="ml-2 flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-amber-300">
                                          {state.striker_name.split(" ").pop()}{" "}
                                          ({state.striker_runs ?? 0})
                                        </span>
                                        <div className="flex h-2 w-24 overflow-hidden rounded-full border border-white/20 bg-slate-800">
                                          <div
                                            style={{
                                              width: `${Math.min(
                                                100,
                                                Math.max(
                                                  10,
                                                  ((state.striker_runs ?? 0) /
                                                    Math.max(
                                                      1,
                                                      (state.striker_runs ??
                                                        0) +
                                                        (state.non_striker_runs ??
                                                          0),
                                                    )) *
                                                    100,
                                                ),
                                              )}%`,
                                            }}
                                            className="h-full bg-amber-400"
                                          />
                                          <div className="h-full flex-1 bg-sky-400" />
                                        </div>
                                        <span className="text-[10px] font-bold text-sky-300">
                                          ({state.non_striker_runs ?? 0}){" "}
                                          {state.non_striker_name
                                            .split(" ")
                                            .pop()}
                                        </span>
                                      </div>
                                    )}
                                </div>
                                <div className="font-bold text-emerald-300">
                                  RUN RATE:{" "}
                                  {state.partnership_balls &&
                                  state.partnership_balls > 0
                                    ? (
                                        ((state.partnership_runs ?? 0) /
                                          state.partnership_balls) *
                                        6
                                      ).toFixed(2)
                                    : "—"}
                                </div>
                              </>
                            )}

                            {/* Slide 2: Bowler Spell & Over Summary */}
                            {carouselIdx === 2 && (
                              <>
                                <div className="flex items-center gap-3">
                                  <span className="rounded bg-sky-600 px-2 py-0.5 text-[11px] font-black text-white">
                                    BOWLER ANALYSIS
                                  </span>
                                  <span className="text-white">
                                    {state.current_bowler_name}:{" "}
                                    {state.bowler_wickets ?? 0}-
                                    {state.bowler_runs ?? 0} (
                                    {oversText(state.bowler_balls)} OV)
                                  </span>
                                  <span className="text-white/30">|</span>
                                  <span className="text-sky-300">
                                    ECONOMY: {bowlerEcon}
                                  </span>
                                </div>
                                <div className="font-bold text-amber-300">
                                  {state.overs_per_innings
                                    ? `${state.overs_per_innings} OVERS MATCH`
                                    : "T20"}
                                </div>
                              </>
                            )}

                            {/* Slide 3: Tournament & Venue Match Info */}
                            {carouselIdx === 3 && (
                              <>
                                <div className="flex items-center gap-3">
                                  <span className="rounded bg-white/20 px-2 py-0.5 text-[11px] font-black text-white">
                                    MATCH CONTEXT
                                  </span>
                                  <span className="text-white">
                                    {state.tournament_name ?? state.title}
                                  </span>
                                  <span className="text-white/30">|</span>
                                  <span className="text-slate-300">
                                    {state.venue ?? "Live Broadcast"}
                                  </span>
                                </div>
                                <div className="font-black text-amber-400">
                                  {state.toss_decision
                                    ? `TOSS: ${state.toss_decision === "bowl" ? "ELECTED TO BOWL" : "ELECTED TO BAT"}`
                                    : "MATCH UNDERWAY"}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                </>
              )}

              {/* 2. TOP TICKER LAYOUT */}
              {layout === "top" && (
                <div className="absolute left-1/2 top-4 w-full max-w-5xl -translate-x-1/2 select-none font-score drop-shadow-2xl transition-all duration-300">
                  <div
                    className={`flex items-stretch border border-white/20 ${themeStyle.mainBarBg} ${themeStyle.outerBorder} broadcast-bevel`}
                  >
                    <div
                      className={`clip-slant-right flex items-center gap-2 px-5 py-2 ${themeStyle.teamBadge} broadcast-gloss font-black`}
                    >
                      <span className="font-score text-2xl font-black">
                        {battingTeamShort}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 border-r border-white/15 bg-black/40 px-4">
                      <span
                        className={`font-score text-3xl font-black tabular-nums ${
                          scorePulsing
                            ? "animate-score-pulse text-amber-300"
                            : "text-white"
                        }`}
                      >
                        {state.total_runs ?? 0}/{state.total_wickets ?? 0}
                      </span>
                      <span className="text-xs font-bold text-slate-300">
                        ({oversText(state.total_balls)} ov)
                      </span>
                    </div>

                    {state.striker_name && (
                      <div className="flex items-center gap-2 border-r border-white/15 px-4">
                        <span className="animate-pulse text-xs font-black text-emerald-400">
                          ▶
                        </span>
                        <span className="text-sm font-bold uppercase text-white">
                          {state.striker_name}
                        </span>
                        <span className="text-sm font-black text-amber-300">
                          {state.striker_runs ?? 0}*
                        </span>
                      </div>
                    )}

                    {state.current_bowler_name && (
                      <div className="flex items-center gap-2 border-r border-white/15 px-4">
                        <span className="text-xs font-bold uppercase text-slate-300">
                          {state.current_bowler_name}
                        </span>
                        <span className="text-xs font-black text-sky-300">
                          {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0}
                        </span>
                      </div>
                    )}

                    {/* Over Tray */}
                    {showBalls && (
                      <div className="flex flex-1 items-center justify-end gap-1 px-4">
                        {thisOverBalls.slice(-6).map((b, idx) => (
                          <BallChip key={idx} label={b} />
                        ))}
                      </div>
                    )}

                    {state.target_runs !== null && (
                      <div className="border-l border-amber-500/40 bg-amber-500/20 px-4 py-2 text-right">
                        <span className="block text-xs font-black text-amber-300">
                          NEED {state.runs_needed} OFF {state.balls_remaining}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. COMPACT CORNER BUG LAYOUT */}
              {layout === "compact" && (
                <div className="absolute bottom-6 left-6 w-[350px] select-none font-score drop-shadow-2xl transition-all duration-300">
                  <div
                    className={`border border-white/20 ${themeStyle.mainBarBg} ${themeStyle.outerBorder} broadcast-bevel overflow-hidden`}
                  >
                    <div className="flex items-center justify-between border-b border-white/15 bg-black/80 px-3 py-1.5">
                      <span className="truncate text-xs font-black uppercase text-amber-400">
                        {state.tournament_name ?? state.title}
                      </span>
                      <span className="py-0.2 rounded bg-emerald-500/20 px-1.5 text-[10px] font-black text-emerald-300">
                        CRR {state.current_run_rate ?? "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`clip-slant-right rounded px-3.5 py-1.5 text-2xl font-black ${themeStyle.teamBadge} broadcast-gloss shadow`}
                        >
                          {battingTeamShort}
                        </div>
                        <div>
                          <p
                            className={`font-score text-3xl font-black leading-none ${
                              scorePulsing
                                ? "animate-score-pulse text-amber-300"
                                : "text-white"
                            }`}
                          >
                            {state.total_runs ?? 0}/{state.total_wickets ?? 0}
                          </p>
                          <span className="mt-0.5 block text-[11px] font-bold text-slate-300">
                            {oversText(state.total_balls)} /{" "}
                            {state.overs_per_innings} OV
                          </span>
                        </div>
                      </div>

                      {state.target_runs !== null && (
                        <div className="text-right">
                          <span className="block text-[10px] font-bold uppercase text-slate-400">
                            Target {state.target_runs}
                          </span>
                          <span className="block text-xs font-black text-amber-300">
                            Need {state.runs_needed}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Striker & Bowler */}
                    <div className="flex items-center justify-between border-t border-white/10 bg-black/50 px-3 py-2 text-xs">
                      <span className="max-w-[150px] truncate font-bold text-white">
                        <span className="mr-1 font-black text-emerald-400">
                          ▶
                        </span>
                        {state.striker_name} * ({state.striker_runs ?? 0})
                      </span>
                      <span className="font-bold tabular-nums text-sky-300">
                        {state.current_bowler_name}: {state.bowler_wickets ?? 0}
                        -{state.bowler_runs ?? 0}
                      </span>
                    </div>

                    {/* Balls */}
                    {showBalls && thisOverBalls.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 border-t border-white/10 bg-black/70 px-3 py-1.5">
                        {thisOverBalls.map((b, idx) => (
                          <BallChip key={idx} label={b} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
