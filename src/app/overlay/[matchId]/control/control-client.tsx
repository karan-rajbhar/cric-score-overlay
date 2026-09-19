"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "~/lib/supabase";
import type {
  LiveMatchState,
  OverlayTheme,
  ProducerCommand,
  ActiveEventSting,
  ActiveLowerThirdStrap,
  BroadcastViewId,
} from "~/components/overlay/types";
import {
  BroadcastSuiteOverlay,
  BROADCAST_VIEW_OPTIONS,
} from "~/components/overlay/broadcast-suite-overlay";
import { EventStings } from "~/components/overlay/event-stings";
import { LowerThirdStraps } from "~/components/overlay/lower-third-straps";
import { DEMO_MATCH_STATE, DEMO_MATCH_DETAILS } from "../demo-data";
import type { Match } from "~/lib/match-types";
import { useBroadcastStore } from "~/lib/stores/useBroadcastStore";
import {
  playFourFanfare,
  playSixExplosion,
  playWicketTone,
  playMilestoneFanfare,
  playFreeHitAlert,
} from "~/components/overlay/sound-effects";
import {
  Zap,
  Flame,
  AlertOctagon,
  Trophy,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  Palette,
  XCircle,
  Volume2,
  VolumeX,
  Activity,
  Send,
  Sliders,
} from "lucide-react";

interface ControlClientProps {
  matchId: string;
  initialState: LiveMatchState | null;
  initialMatch: Match | null;
}

function oversText(balls: number | null): string {
  if (!balls) return "0.0";
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

const VIEW_CATEGORIES = [
  { id: "all", label: "All Views (29)" },
  {
    id: "scorebars",
    label: "Scorebars & Straps",
    views: ["1", "16", "17", "18", "19"],
  },
  {
    id: "scorecards",
    label: "Scorecards & Squads",
    views: ["2", "3", "4", "5", "6", "7"],
  },
  {
    id: "intervals",
    label: "Breaks & Splashes",
    views: ["13", "14", "15", "28"],
  },
  {
    id: "analysis",
    label: "Match Insights",
    views: ["23", "8", "20", "21", "22", "29"],
  },
  {
    id: "career",
    label: "Career & Series",
    views: ["24", "25", "26", "27", "36", "37", "38", "39"],
  },
];

export function ControlClient({
  matchId,
  initialState,
  initialMatch,
}: ControlClientProps) {
  const [state, setState] = useState<LiveMatchState | null>(initialState);
  const [match] = useState<Match | null>(initialMatch);
  const [copiedObsUrl, setCopiedObsUrl] = useState(false);

  // Fallback to rich demo data when no match state is in database
  const activeState = state ?? DEMO_MATCH_STATE;
  const activeMatch = match ?? DEMO_MATCH_DETAILS;

  // Monitor preview scaling
  const monitorRef = useRef<HTMLDivElement>(null);
  // Active broadcast state managed via Zustand store
  const {
    selectedBroadcastView,
    selectedCategory,
    selectedTheme,
    audioEnabled,
    marginOffsetPx,
    strapDurationSecs,
    customStrapText,
    activeSting,
    activeStrap,
    activeTab,
    monitorScale,
    monitorBg,
    lastAction,
    setBroadcastView: setSelectedBroadcastView,
    setSelectedCategory,
    setSelectedTheme,
    setAudioEnabled,
    setMarginOffsetPx,
    setStrapDurationSecs,
    setCustomStrapText,
    setActiveTab,
    setMonitorScale,
    setMonitorBg,
    setLastAction,
    clearSting,
    clearStrap,
  } = useBroadcastStore();

  const setActiveSting = useCallback(
    (
      updater:
        | ActiveEventSting
        | null
        | ((curr: ActiveEventSting | null) => ActiveEventSting | null),
    ) => {
      if (typeof updater === "function") {
        const next = updater(useBroadcastStore.getState().activeSting);
        if (!next) clearSting();
        else useBroadcastStore.getState().triggerSting(next);
      } else if (!updater) {
        clearSting();
      } else {
        useBroadcastStore.getState().triggerSting(updater);
      }
    },
    [clearSting],
  );

  const setActiveStrap = useCallback(
    (
      updater:
        | ActiveLowerThirdStrap
        | null
        | ((curr: ActiveLowerThirdStrap | null) => ActiveLowerThirdStrap | null),
    ) => {
      if (typeof updater === "function") {
        const next = updater(useBroadcastStore.getState().activeStrap);
        if (!next) clearStrap();
        else
          useBroadcastStore.getState().triggerStrap({
            ...next,
            strapType: next.type,
          });
      } else if (!updater) {
        clearStrap();
      } else {
        useBroadcastStore.getState().triggerStrap({
          ...updater,
          strapType: updater.type,
        });
      }
    },
    [clearStrap],
  );

  const isRealUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      matchId,
    );

  const controlChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );

  // Measure monitor scale to fit 1920x1080 perfectly into 16:9 monitor
  useEffect(() => {
    if (!monitorRef.current) return;
    const updateScale = () => {
      if (monitorRef.current) {
        const w = monitorRef.current.clientWidth;
        setMonitorScale(w / 1920);
      }
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(monitorRef.current);
    return () => ro.disconnect();
  }, [setMonitorScale]);

  // Initialize Supabase Realtime Broadcast Channel
  useEffect(() => {
    const channel = supabase.channel(`overlay_control_${matchId}`);
    controlChannelRef.current = channel;
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId]);

  // Live match state polling / subscription
  const refetch = useCallback(async () => {
    if (!isRealUuid) return;
    const { data } = await supabase
      .from("live_match_state")
      .select("*")
      .eq("match_id", matchId)
      .single();
    if (data) setState(data as LiveMatchState);
  }, [isRealUuid, matchId]);

  useEffect(() => {
    if (!isRealUuid) return;
    const interval = setInterval(refetch, 3000);
    return () => clearInterval(interval);
  }, [isRealUuid, refetch]);

  // Command dispatcher
  const sendCommand = useCallback((cmd: Omit<ProducerCommand, "timestamp">) => {
    const fullCmd: ProducerCommand = {
      ...cmd,
      timestamp: Date.now(),
    };
    if (controlChannelRef.current) {
      void controlChannelRef.current.send({
        type: "broadcast",
        event: "command",
        payload: fullCmd,
      });
    }
  }, []);

  // Switch broadcast view
  const handleSelectBroadcastView = (view: BroadcastViewId) => {
    setSelectedBroadcastView(view);
    setActiveSting(null);
    sendCommand({
      type: "SET_BROADCAST_VIEW",
      broadcastView: view,
    });
    const opt = BROADCAST_VIEW_OPTIONS.find((o) => o.id === view);
    setLastAction(`Switched to: ${opt?.label ?? view} (View ${view})`);
  };

  // Trigger celebration stings
  const handleTriggerSting = useCallback(
    (stingType: "four" | "six" | "wicket" | "milestone" | "free_hit") => {
      if (audioEnabled) {
        if (stingType === "four") playFourFanfare();
        else if (stingType === "six") playSixExplosion();
        else if (stingType === "wicket") playWicketTone();
        else if (stingType === "milestone") playMilestoneFanfare();
        else if (stingType === "free_hit") playFreeHitAlert();
      }

      const titles: Record<string, string> = {
        four: "BOUNDARY FOUR!",
        six: "MAXIMUM SIX!",
        wicket: "WICKET DOWN!",
        milestone: "50 / 100 MILESTONE!",
        free_hit: "FREE HIT CALL!",
      };

      const stingId = `sting-${Date.now()}`;
      const sting: ActiveEventSting = {
        id: stingId,
        type: stingType,
        title: titles[stingType] ?? "BOUNDARY!",
        subtitle:
          activeState.batting_team_short_name ??
          activeState.batting_team_name ??
          "LIVE EVENT",
        detail: activeState.striker_name
          ? `${activeState.striker_name} · ${activeState.striker_runs ?? 0} (${activeState.striker_balls ?? 0}b)`
          : undefined,
        durationMs: 4000,
      };

      setActiveSting(sting);
      setTimeout(() => {
        setActiveSting((curr) => (curr?.id === sting.id ? null : curr));
      }, 4000);

      sendCommand({ type: "TRIGGER_STING", stingType });
      setLastAction(`Triggered: ${titles[stingType]}`);
    },
    [activeState, audioEnabled, sendCommand, setActiveSting, setLastAction],
  );

  // Trigger in-play lower-third straps
  const handleTriggerStrap = useCallback(
    (type: ActiveLowerThirdStrap["type"]) => {
      let title = "";
      let subtitle = "";
      let detail = "";
      let badge = "";

      if (type === "batsman") {
        badge = "BATSMAN STATS";
        title = activeState.striker_name ?? "Striker";
        subtitle = `${activeState.striker_runs ?? 0} runs off ${activeState.striker_balls ?? 0} balls`;
        const sr =
          activeState.striker_balls && activeState.striker_balls > 0
            ? (
                ((activeState.striker_runs ?? 0) / activeState.striker_balls) *
                100
              ).toFixed(1)
            : "0.0";
        detail = `Strike Rate: ${sr}`;
      } else if (type === "bowler") {
        badge = "BOWLER STATS";
        title = activeState.current_bowler_name ?? "Bowler";
        subtitle = `${activeState.bowler_wickets ?? 0}/${activeState.bowler_runs ?? 0} (${activeState.bowler_balls ? Math.floor(activeState.bowler_balls / 6) + "." + (activeState.bowler_balls % 6) : "0.0"} ov)`;
        const econ =
          activeState.bowler_balls && activeState.bowler_balls > 0
            ? (
                ((activeState.bowler_runs ?? 0) / activeState.bowler_balls) *
                6
              ).toFixed(2)
            : "0.00";
        detail = `Economy: ${econ}`;
      } else if (type === "partnership") {
        badge = "CURRENT PARTNERSHIP";
        title = `${activeState.partnership_runs ?? 0} RUNS`;
        subtitle = `${activeState.striker_name ?? "Batsman 1"} & ${activeState.non_striker_name ?? "Batsman 2"}`;
        detail = `${activeState.partnership_balls ?? 0} balls faced`;
      } else if (type === "target") {
        badge = "TARGET REQUIREMENT";
        title = `TARGET: ${activeState.target_runs ?? 0}`;
        subtitle = `Need ${activeState.runs_needed ?? 0} runs off ${activeState.balls_remaining ?? 0} balls`;
        detail = `Req RR: ${activeState.required_run_rate ?? "0.00"}`;
      }

      const strapId = `strap-${type}-${Date.now()}`;
      const strap: ActiveLowerThirdStrap = {
        id: strapId,
        type,
        title,
        subtitle,
        detail,
        badge,
        durationMs: strapDurationSecs * 1000,
      };

      setActiveStrap(strap);
      setTimeout(() => {
        setActiveStrap((curr) => (curr?.id === strap.id ? null : curr));
      }, strapDurationSecs * 1000);

      sendCommand({ type: "SHOW_STRAP", strap });
      setLastAction(`Strap: ${badge}`);
    },
    [
      activeState,
      sendCommand,
      setActiveStrap,
      setLastAction,
      strapDurationSecs,
    ],
  );

  // Custom alert strap
  const handleSendCustomAlert = useCallback(() => {
    if (!customStrapText.trim()) return;
    const strapId = `custom-${Date.now()}`;
    const strap: ActiveLowerThirdStrap = {
      id: strapId,
      type: "custom",
      title: "OFFICIAL MATCH NOTICE",
      subtitle: customStrapText.trim(),
      badge: "LIVE NOTICE",
      durationMs: strapDurationSecs * 1000,
    };
    setActiveStrap(strap);
    setTimeout(() => {
      setActiveStrap((curr) => (curr?.id === strap.id ? null : curr));
    }, strapDurationSecs * 1000);

    sendCommand({ type: "SHOW_STRAP", strap });
    setLastAction(`Alert: "${customStrapText.trim()}"`);
    setCustomStrapText("");
  }, [
    customStrapText,
    sendCommand,
    setActiveStrap,
    setCustomStrapText,
    setLastAction,
    strapDurationSecs,
  ]);

  // Panic clear
  const handlePanicClear = () => {
    setActiveSting(null);
    setActiveStrap(null);
    setSelectedBroadcastView("1");
    sendCommand({ type: "PANIC_CLEAR" });
    setLastAction("Cleared all active graphics (Safe)");
  };

  // Audio toggle
  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    sendCommand({ type: "TOGGLE_AUDIO", audioEnabled: next });
    setLastAction(next ? "SFX Audio Enabled" : "SFX Audio Muted");
  };

  // Theme selector
  const handleSelectTheme = (thm: OverlayTheme) => {
    setSelectedTheme(thm);
    sendCommand({ type: "SET_THEME", theme: thm });
    setLastAction(`Theme set to: ${thm.toUpperCase()}`);
  };

  // Margin offset
  const handleSetMarginOffset = (px: number) => {
    setMarginOffsetPx(px);
    sendCommand({ type: "SET_MARGIN_OFFSET", marginOffsetPx: px });
    setLastAction(`Safe margin offset: +${px}px`);
  };

  // Copy OBS URL
  const obsUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/overlay/${matchId}`
      : `/overlay/${matchId}`;

  const copyObsUrl = async () => {
    try {
      await navigator.clipboard.writeText(obsUrl);
      setCopiedObsUrl(true);
      setTimeout(() => setCopiedObsUrl(false), 2500);
      setLastAction("Copied OBS Browser Source URL!");
    } catch {
      // fallback
    }
  };

  // Filtered views based on category tab
  const filteredViews = useMemo(() => {
    if (selectedCategory === "all") return BROADCAST_VIEW_OPTIONS;
    const cat = VIEW_CATEGORIES.find((c) => c.id === selectedCategory);
    if (!cat?.views) return BROADCAST_VIEW_OPTIONS;
    return BROADCAST_VIEW_OPTIONS.filter((o) => cat.views.includes(o.id));
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-black">
      {/* ============================================================= */}
      {/* 1. STUDIO HEADER (CLEAN & PROFESSIONAL)                       */}
      {/* ============================================================= */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 px-3 py-2.5 shadow-lg backdrop-blur-xl sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 sm:gap-3">
          {/* Status & Match Summary */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-600/20 px-2.5 py-0.5 text-[11px] font-black text-red-400 sm:gap-2 sm:px-3 sm:py-1 sm:text-xs">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span>LIVE STUDIO</span>
            </div>

            <div className="hidden sm:block">
              <span className="text-sm font-black text-white">
                {activeState.team1_short_name ?? "T1"} vs{" "}
                {activeState.team2_short_name ?? "T2"}
              </span>
              <span className="ml-2 font-mono text-xs font-bold text-amber-400">
                {activeState.total_runs ?? 0}/{activeState.total_wickets ?? 0} (
                {oversText(activeState.total_balls)} ov)
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={copyObsUrl}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold shadow-sm transition sm:px-3.5 ${
                copiedObsUrl
                  ? "bg-emerald-600 text-white"
                  : "border border-white/10 bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {copiedObsUrl ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {copiedObsUrl ? "Copied OBS URL!" : "Copy OBS URL"}
              </span>
              <span className="sm:hidden">
                {copiedObsUrl ? "Copied!" : "URL"}
              </span>
            </button>

            <a
              href={obsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white sm:px-3"
              title="Open full transparent overlay in new window"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Popout</span>
            </a>

            <button
              onClick={handlePanicClear}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-2.5 py-1.5 text-xs font-black uppercase text-white shadow transition hover:bg-red-500 active:scale-95 sm:px-3.5"
              title="Emergency Clear (Space/ESC)"
            >
              <XCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Clear Overlay</span>
              <span className="sm:hidden">Clear</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================= */}
      {/* 2. MAIN PRODUCTION WORKSPACE                                  */}
      {/* ============================================================= */}
      <main className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6">
        {/* Broadcast TV Themes Quick Switcher */}
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold text-slate-200">
              TV Broadcast Theme:
            </span>
          </div>

          {/* Mobile Theme Dropdown (Eliminates horizontal scroll on mobile) */}
          <div className="w-full sm:hidden">
            <select
              value={selectedTheme}
              onChange={(e) =>
                handleSelectTheme(e.target.value as OverlayTheme)
              }
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-bold text-white focus:border-amber-400 focus:outline-none"
            >
              {[
                { id: "starsports", label: "⭐ Star Sports (IPL Gold & Blue)" },
                { id: "sonysports", label: "🔴 Sony Sports (LIV Crimson Red)" },
                {
                  id: "foxcricket",
                  label: "🦊 Fox Cricket (Aussie BBL Orange)",
                },
                { id: "skysports", label: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Sky Sports (Ashes Red & Navy)" },
                { id: "apex", label: "👑 Apex 24K (Mirror Gold)" },
                { id: "volt", label: "⚡ Volt Tech (Cyber Lime)" },
                { id: "agni", label: "🔥 Agni Inferno (Volcanic Magma)" },
                { id: "thehundred", label: "🦄 The Hundred (Hot Pink & Cyan)" },
                { id: "dharma", label: "🕉️ Dharma (Royal Vedic Gold)" },
                { id: "thunder", label: "⚡ Thunder (Electric Cyan)" },
                { id: "nakshatra", label: "✨ Nakshatra (Cosmic Purple)" },
                { id: "emerald", label: "🏏 Emerald (Pitch Green)" },
                { id: "dark", label: "🖤 Dark Titanium (Carbon)" },
              ].map((thm) => (
                <option key={thm.id} value={thm.id}>
                  {thm.label}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop Theme Pills */}
          <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
            {[
              {
                id: "starsports",
                label: "Star Sports",
                icon: "⭐",
                desc: "IPL Gold & Blue",
              },
              {
                id: "sonysports",
                label: "Sony Sports",
                icon: "🔴",
                desc: "LIV Crimson Red",
              },
              {
                id: "foxcricket",
                label: "Fox Cricket",
                icon: "🦊",
                desc: "Aussie BBL Orange",
              },
              {
                id: "apex",
                label: "Apex 24K",
                icon: "👑",
                desc: "Mirror Gold",
              },
              {
                id: "volt",
                label: "Volt Tech",
                icon: "⚡",
                desc: "Cyber Lime",
              },
              {
                id: "agni",
                label: "Agni Inferno",
                icon: "🔥",
                desc: "Volcanic Magma",
              },
              {
                id: "skysports",
                label: "Sky Sports",
                icon: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
                desc: "Ashes Red & Navy",
              },
              {
                id: "thehundred",
                label: "The Hundred",
                icon: "🦄",
                desc: "Hot Pink & Cyan",
              },
              {
                id: "dharma",
                label: "Dharma",
                icon: "🕉️",
                desc: "Royal Vedic Gold",
              },
              {
                id: "thunder",
                label: "Thunder",
                icon: "⚡",
                desc: "Electric Cyan & Indigo",
              },
              {
                id: "nakshatra",
                label: "Nakshatra",
                icon: "✨",
                desc: "Cosmic Purple & Gold",
              },
              {
                id: "emerald",
                label: "Emerald",
                icon: "🏏",
                desc: "Pitch Green & Gold",
              },
              {
                id: "dark",
                label: "Dark Titanium",
                icon: "🖤",
                desc: "Carbon Titanium",
              },
            ].map((thm) => (
              <button
                key={thm.id}
                onClick={() => handleSelectTheme(thm.id as OverlayTheme)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  selectedTheme === thm.id
                    ? "scale-105 border-amber-400 bg-amber-500 font-black text-black shadow-lg ring-2 ring-amber-400/50"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                title={thm.desc}
              >
                <span>{thm.icon}</span>
                <span>{thm.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* =========================================================== */}
        {/* LIVE PROGRAM MONITOR (16:9 1080P HERO PREVIEW)              */}
        {/* =========================================================== */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 shadow-2xl backdrop-blur-md sm:rounded-3xl sm:p-4">
          {/* Monitor Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span className="font-mono text-xs font-semibold text-slate-200">
                Program Feed (1920×1080 60fps)
              </span>
              <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-black text-black shadow-sm">
                Active View:{" "}
                {BROADCAST_VIEW_OPTIONS.find(
                  (o) => o.id === selectedBroadcastView,
                )?.label ?? selectedBroadcastView}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setMonitorBg(monitorBg === "stadium" ? "grid" : "stadium")
                }
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:bg-white/10"
              >
                {monitorBg === "stadium" ? "🏟️ Stadium Cam" : "🏁 Studio Grid"}
              </button>

              <button
                onClick={handleToggleAudio}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                  audioEnabled
                    ? "border-amber-500/40 bg-amber-500/20 text-amber-300"
                    : "border-white/10 bg-white/5 text-slate-400"
                }`}
              >
                {audioEnabled ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
                <span>{audioEnabled ? "SFX On" : "SFX Muted"}</span>
              </button>
            </div>
          </div>

          {/* 16:9 Screen Frame */}
          <div
            ref={monitorRef}
            className={`relative mt-3 aspect-video w-full overflow-hidden rounded-2xl border-2 border-white/10 shadow-2xl ${
              monitorBg === "stadium"
                ? "bg-cover bg-center"
                : "bg-slate-950 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]"
            }`}
            style={{
              backgroundImage:
                monitorBg === "stadium"
                  ? "radial-gradient(circle at 50% 30%, rgba(30, 58, 138, 0.4) 0%, rgba(2, 6, 23, 0.95) 100%), linear-gradient(180deg, rgba(2, 6, 23, 0.5) 0%, rgba(2, 6, 23, 0.92) 100%)"
                  : undefined,
            }}
          >
            {/* Scaled 1920x1080 Canvas */}
            <div
              style={{
                width: "1920px",
                height: "1080px",
                transform: `scale(${monitorScale})`,
                transformOrigin: "top left",
              }}
              className="pointer-events-none absolute left-0 top-0 select-none overflow-hidden"
            >
              <BroadcastSuiteOverlay
                state={activeState}
                match={activeMatch}
                activeView={selectedBroadcastView}
                theme={selectedTheme}
              />
              <EventStings
                sting={activeSting}
                theme={selectedTheme}
                onDismiss={() => setActiveSting(null)}
              />
              <LowerThirdStraps
                strap={activeStrap}
                state={activeState}
                theme={selectedTheme}
                layout="bottom"
                onDismiss={() => setActiveStrap(null)}
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* THE 29-VIEW SWITCHER DOCK (FRONT & CENTER)                */}
          {/* ========================================================= */}
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-2 items-center gap-1.5 text-xs min-[440px]:grid-cols-3 sm:flex sm:flex-wrap">
                {VIEW_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`rounded-full px-3 py-1 text-center text-xs font-bold transition ${
                      selectedCategory === cat.id
                        ? "bg-amber-500 font-black text-black shadow-md"
                        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <span className="hidden font-mono text-[11px] text-slate-500 sm:inline">
                Click any view to switch live stream
              </span>
            </div>

            {/* Mobile View Selector (Zero horizontal scroll needed) */}
            <div className="mt-2 sm:hidden">
              <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                Select Broadcast Overlay View ({filteredViews.length} views):
              </label>
              <select
                value={selectedBroadcastView}
                onChange={(e) =>
                  handleSelectBroadcastView(e.target.value as BroadcastViewId)
                }
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
              >
                {filteredViews.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    View {opt.id}: {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Desktop Switcher Bar */}
            <div className="premiumBtns hidden sm:flex" id="premiumBtns">
              {filteredViews.map((opt, idx) => (
                <button
                  key={opt.id}
                  data-view={opt.id}
                  onClick={() => handleSelectBroadcastView(opt.id)}
                  className={`btn btn-premium switcher ${idx === 0 ? "first" : ""} ${
                    selectedBroadcastView === opt.id ? "active" : ""
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <div className="placeholder" />
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* 3. CLEAN PRODUCER ACTION DECKS                                */}
        {/* ============================================================= */}
        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 shadow-xl backdrop-blur-md sm:rounded-3xl sm:p-5">
          {/* Tabs Selector */}
          <div className="flex flex-col gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto">
              <button
                onClick={() => setActiveTab("inplay")}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-4 ${
                  activeTab === "inplay"
                    ? "bg-amber-500 font-bold text-black shadow-md"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Zap className="h-4 w-4" />
                <span>In-Play Actions</span>
              </button>

              <button
                onClick={() => setActiveTab("settings")}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-4 ${
                  activeTab === "settings"
                    ? "bg-amber-500 font-bold text-black shadow-md"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Sliders className="h-4 w-4" />
                <span>Theme & Settings</span>
              </button>
            </div>

            <span className="hidden font-mono text-xs font-bold text-emerald-400 sm:block">
              {lastAction}
            </span>
          </div>

          {/* TAB 1: IN-PLAY ACTIONS */}
          {activeTab === "inplay" && (
            <div className="space-y-5 pt-1">
              {/* Event Celebration Stings */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-300">
                  Instant Celebration Stings (Triggers Sound Fanfare +
                  Full-Screen Flare)
                </label>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                  <button
                    onClick={() => handleTriggerSting("four")}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-sky-500/50 bg-gradient-to-b from-sky-600/30 to-slate-900 p-3 font-black text-white shadow-lg transition hover:from-sky-600/50 active:scale-95"
                  >
                    <Zap className="h-5 w-5 text-sky-400" />
                    <span className="text-lg">FOUR!</span>
                    <span className="text-[10px] uppercase text-sky-200/60">
                      Boundary
                    </span>
                  </button>

                  <button
                    onClick={() => handleTriggerSting("six")}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-purple-500/50 bg-gradient-to-b from-purple-600/30 to-slate-900 p-3 font-black text-white shadow-lg transition hover:from-purple-600/50 active:scale-95"
                  >
                    <Flame className="h-5 w-5 text-amber-400" />
                    <span className="text-lg text-amber-300">MAXIMUM!</span>
                    <span className="text-[10px] uppercase text-amber-200/60">
                      Six
                    </span>
                  </button>

                  <button
                    onClick={() => handleTriggerSting("wicket")}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-red-500/50 bg-gradient-to-b from-red-600/30 to-slate-900 p-3 font-black text-white shadow-lg transition hover:from-red-600/50 active:scale-95"
                  >
                    <AlertOctagon className="h-5 w-5 text-red-400" />
                    <span className="text-lg text-red-300">WICKET!</span>
                    <span className="text-[10px] uppercase text-red-200/60">
                      Out
                    </span>
                  </button>

                  <button
                    onClick={() => handleTriggerSting("milestone")}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-amber-500/50 bg-gradient-to-b from-amber-600/30 to-slate-900 p-3 font-black text-white shadow-lg transition hover:from-amber-600/50 active:scale-95"
                  >
                    <Trophy className="h-5 w-5 text-yellow-300" />
                    <span className="text-lg text-yellow-300">50 / 100</span>
                    <span className="text-[10px] uppercase text-yellow-200/60">
                      Milestone
                    </span>
                  </button>

                  <button
                    onClick={() => handleTriggerSting("free_hit")}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-yellow-500/50 bg-gradient-to-b from-yellow-500/30 to-slate-900 p-3 font-black text-white shadow-lg transition hover:from-yellow-500/50 active:scale-95"
                  >
                    <ShieldAlert className="h-5 w-5 text-yellow-400" />
                    <span className="text-lg text-yellow-400">FREE HIT</span>
                    <span className="text-[10px] uppercase text-yellow-200/60">
                      No-Ball Call
                    </span>
                  </button>
                </div>
              </div>

              {/* Lower-Third Quick Straps */}
              <div className="border-t border-white/10 pt-2">
                <div className="mb-2 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                    <Activity className="h-3.5 w-3.5 text-sky-400" />
                    In-Play Lower-Third Popups (Discreet {strapDurationSecs}s
                    Straps)
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Duration:</span>
                    <select
                      value={strapDurationSecs}
                      onChange={(e) =>
                        setStrapDurationSecs(Number(e.target.value))
                      }
                      className="rounded-lg border border-white/10 bg-slate-800 px-2 py-0.5 text-xs text-white"
                    >
                      <option value={5}>5s</option>
                      <option value={8}>8s</option>
                      <option value={10}>10s</option>
                      <option value={15}>15s</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    {
                      id: "batsman",
                      label: "Active Batter Inning",
                      desc: "Runs, balls & strike rate",
                    },
                    {
                      id: "bowler",
                      label: "Current Bowler Spell",
                      desc: "Overs, maidens, runs, wickets",
                    },
                    {
                      id: "partnership",
                      label: "Partnership Stand",
                      desc: "Active batters contribution",
                    },
                    {
                      id: "target",
                      label: "Chase Equation",
                      desc: "Runs needed from balls",
                    },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() =>
                        handleTriggerStrap(
                          s.id as ActiveLowerThirdStrap["type"],
                        )
                      }
                      className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-amber-500/40 hover:bg-white/10"
                    >
                      <span className="text-sm font-bold text-white">
                        {s.label}
                      </span>
                      <span className="mt-0.5 text-[11px] text-slate-400">
                        {s.desc}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Impromptu Notice Box */}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={customStrapText}
                    onChange={(e) => setCustomStrapText(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSendCustomAlert()
                    }
                    placeholder="Broadcast custom alert (e.g. 'Physio on ground' / 'Play delayed 10 mins')"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    onClick={handleSendCustomAlert}
                    className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-black transition hover:bg-amber-400"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Alert</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BROADCAST THEMES & STREAM SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-4 pt-1">
              <div>
                <label className="mb-2 block flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <Palette className="h-4 w-4 text-amber-400" />
                  Broadcast TV Themes (Authentic Visual Styling & Score Motifs)
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    {
                      id: "starsports",
                      label: "Star Sports",
                      sub: "Official IPL Gold & Blue",
                    },
                    {
                      id: "sonysports",
                      label: "Sony Sports",
                      sub: "LIV Championship Red",
                    },
                    {
                      id: "foxcricket",
                      label: "Fox Cricket",
                      sub: "Australian Prime Orange",
                    },
                    {
                      id: "skysports",
                      label: "Sky Sports",
                      sub: "UK Ashes Crimson & White",
                    },
                    { id: "apex", label: "Apex 24K", sub: "Luxury Gold Bevel" },
                    {
                      id: "volt",
                      label: "Volt Tech",
                      sub: "High-Velocity Cyber Lime",
                    },
                    {
                      id: "agni",
                      label: "Agni Inferno",
                      sub: "Volcanic Magma Flames",
                    },
                    {
                      id: "thehundred",
                      label: "The Hundred",
                      sub: "Pop Neon & Vertical Ranks",
                    },
                  ].map((thm) => (
                    <button
                      key={thm.id}
                      onClick={() => handleSelectTheme(thm.id as OverlayTheme)}
                      className={`flex flex-col rounded-xl border p-3 text-left transition ${
                        selectedTheme === thm.id
                          ? "border-amber-400 bg-amber-500/20 shadow-md ring-1 ring-amber-400"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-sm font-bold text-white">
                        {thm.label}
                      </span>
                      <span className="mt-0.5 text-[11px] text-slate-400">
                        {thm.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Safe-Zone Bottom Margin */}
              <div className="flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center">
                <div>
                  <span className="block text-xs font-bold text-slate-300">
                    OBS Safe-Zone Margin Offset
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Raises the scorebar above mobile comments or YouTube chat
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 16, 32, 48].map((px) => (
                    <button
                      key={px}
                      onClick={() => handleSetMarginOffset(px)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                        marginOffsetPx === px
                          ? "border-amber-400 bg-amber-500 font-black text-black"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      +{px}px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
