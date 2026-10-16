"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { firebase } from "~/lib/firebase";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import {
  Copy,
  Check,
  ExternalLink,
  Palette,
  XCircle,
  Volume2,
  VolumeX,
  Send,
  SlidersHorizontal,
  Undo2,
  RotateCcw,
  Keyboard,
  Users,
  Layers,
  BarChart3,
  Calendar,
} from "lucide-react";
import { cn } from "~/lib/utils";

interface ControlClientProps {
  matchId: string;
  initialState: LiveMatchState | null;
  initialMatch: Match | null;
}

function oversText(balls: number | null): string {
  if (!balls) return "0.0";
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

const THEME_OPTIONS: Array<{
  id: OverlayTheme;
  label: string;
  desc: string;
  swatch: string;
}> = [
  {
    id: "starsports",
    label: "Star Sports",
    desc: "Blue and gold",
    swatch: "bg-amber-400",
  },
  {
    id: "sonysports",
    label: "Sony Sports",
    desc: "Red",
    swatch: "bg-red-600",
  },
  {
    id: "foxcricket",
    label: "Fox Cricket",
    desc: "Orange",
    swatch: "bg-amber-500",
  },
  {
    id: "apex",
    label: "Apex",
    desc: "Gold",
    swatch: "bg-yellow-300",
  },
  {
    id: "volt",
    label: "Volt",
    desc: "Lime",
    swatch: "bg-lime-400",
  },
  {
    id: "agni",
    label: "Agni",
    desc: "Orange and red",
    swatch: "bg-orange-500",
  },
  {
    id: "skysports",
    label: "Sky Sports",
    desc: "Red and navy",
    swatch: "bg-red-600",
  },
  {
    id: "thehundred",
    label: "The Hundred",
    desc: "Pink and cyan",
    swatch: "bg-pink-500",
  },
  {
    id: "dharma",
    label: "Dharma",
    desc: "Maroon and gold",
    swatch: "bg-amber-500",
  },
  {
    id: "thunder",
    label: "Thunder",
    desc: "Cyan and indigo",
    swatch: "bg-cyan-400",
  },
  {
    id: "nakshatra",
    label: "Nakshatra",
    desc: "Purple and gold",
    swatch: "bg-purple-500",
  },
  {
    id: "emerald",
    label: "Emerald",
    desc: "Green and gold",
    swatch: "bg-emerald-500",
  },
  {
    id: "dark",
    label: "Dark",
    desc: "Neutral dark",
    swatch: "bg-zinc-700",
  },
];

// Curated phase decks replacing the unorganized 29-button scroll
const GRAPHIC_PHASE_DECKS: Array<{
  id: string;
  name: string;
  description: string;
  icon: typeof Layers;
  views: Array<{ id: BroadcastViewId; label: string; desc: string }>;
}> = [
  {
    id: "scorebars",
    name: "Live scorebars",
    description: "In-play broadcast bugs anchored at the bottom of the feed",
    icon: Layers,
    views: [
      {
        id: "1",
        label: "Standard Scorebar",
        desc: "Batters, bowler, runs & match status",
      },
      {
        id: "16",
        label: "Striker Focus",
        desc: "Expanded striker runs & ball-by-ball",
      },
      {
        id: "17",
        label: "Runner Focus",
        desc: "Non-striker profile & boundary tally",
      },
      {
        id: "18",
        label: "Bowler Focus",
        desc: "Current spell overs, maidens & wickets",
      },
      {
        id: "19",
        label: "Fall of Wicket Bug",
        desc: "Recently dismissed batter details",
      },
    ],
  },
  {
    id: "scorecards",
    name: "Scorecards & squads",
    description: "Full-screen cards during fall of wickets or extended pauses",
    icon: Users,
    views: [
      {
        id: "2",
        label: "Batting Team 1",
        desc: "First innings batsman dismissal card",
      },
      {
        id: "3",
        label: "Bowling Team 1",
        desc: "Bowling figures & economy rates",
      },
      {
        id: "4",
        label: "Batting Team 2",
        desc: "Second innings chase card",
      },
      {
        id: "5",
        label: "Bowling Team 2",
        desc: "Second innings bowling card",
      },
      {
        id: "6",
        label: "Team 1 Playing XI",
        desc: "Squad list & captain/keeper badges",
      },
      {
        id: "7",
        label: "Team 2 Playing XI",
        desc: "Opponent squad & playing roster",
      },
      {
        id: "8",
        label: "Match Summary",
        desc: "Combined scores & match outcome",
      },
    ],
  },
  {
    id: "breaks",
    name: "Breaks & stoppages",
    description: "Full presentation screens for toss, innings break & weather",
    icon: Calendar,
    views: [
      {
        id: "13",
        label: "Pre-Match Intro",
        desc: "Tournament splash & stadium header",
      },
      {
        id: "14",
        label: "Innings Break",
        desc: "Target requirement & 1st innings total",
      },
      {
        id: "15",
        label: "Drinks Break",
        desc: "Mid-session pause & match equation",
      },
      {
        id: "28",
        label: "Rain Delay Notice",
        desc: "Weather interruption announcement",
      },
    ],
  },
  {
    id: "analytics",
    name: "Analytics & charts",
    description: "In-depth graphs, match trends & tournament honours",
    icon: BarChart3,
    views: [
      {
        id: "22",
        label: "Run Rate Worm",
        desc: "Comparative innings trajectory chart",
      },
      {
        id: "21",
        label: "Over by Over Manhattan",
        desc: "Runs scored bar chart per over",
      },
      {
        id: "23",
        label: "Partnership Graphic",
        desc: "Current partnership contribution",
      },
      {
        id: "20",
        label: "Points Table",
        desc: "Tournament standings & net run rate",
      },
      {
        id: "29",
        label: "Player of the Match",
        desc: "Award winner spotlight & figures",
      },
      {
        id: "24",
        label: "Batter Career",
        desc: "Milestones, averages & historical stats",
      },
      {
        id: "26",
        label: "Bowler Career",
        desc: "Wicket milestones & economy profile",
      },
    ],
  },
];

// 1-Click Broadcast Notice Presets for instant broadcast straps
const NOTICE_PRESETS = [
  {
    id: "drinks",
    label: "Drinks break",
    text: "Drinks break in progress · Play resumes shortly",
  },
  {
    id: "rain",
    label: "Rain delay",
    text: "Rain stopped play · Ground staff covering the pitch",
  },
  {
    id: "timeout",
    label: "Strategic timeout",
    text: "2.5-minute strategic tactical timeout underway",
  },
  {
    id: "innings",
    label: "Innings break",
    text: "Change of innings in progress · Pitch preparation underway",
  },
  {
    id: "drs",
    label: "DRS review",
    text: "Decision review in progress · Third umpire reviewing ball trajectory",
  },
  {
    id: "inspection",
    label: "Pitch inspection",
    text: "Next official umpires inspection scheduled in 15 minutes",
  },
];

export function ControlClient({
  matchId,
  initialState,
  initialMatch,
}: ControlClientProps) {
  const isTestMode = matchId === "test";
  const isRealUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      matchId,
    );

  // Live match state with fallback to demo data
  const [state, setState] = useState<LiveMatchState | null>(initialState);
  const [match] = useState<Match | null>(initialMatch);
  const [copiedObsUrl, setCopiedObsUrl] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Active operational state from broadcast store
  const {
    selectedBroadcastView,
    selectedTheme,
    audioEnabled,
    marginOffsetPx,
    strapDurationSecs,
    customStrapText,
    activeSting,
    activeStrap,
    monitorScale,
    monitorBg,
    lastAction,
    setBroadcastView: setSelectedBroadcastView,
    setSelectedTheme,
    setAudioEnabled,
    setMarginOffsetPx,
    setStrapDurationSecs,
    setCustomStrapText,
    setMonitorScale,
    setMonitorBg,
    setLastAction,
    clearSting,
    clearStrap,
  } = useBroadcastStore();

  const [activeDeckTab, setActiveDeckTab] = useState<string>("scorebars");
  const monitorRef = useRef<HTMLDivElement>(null);
  const controlChannelRef = useRef<ReturnType<typeof firebase.channel> | null>(
    null,
  );

  const activeState = state ?? DEMO_MATCH_STATE;
  const activeMatch = match ?? DEMO_MATCH_DETAILS;

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

  // Realtime broadcast channel to the overlay
  useEffect(() => {
    const channel = firebase.channel(`overlay_control_${matchId}`);
    controlChannelRef.current = channel;
    channel.subscribe();

    return () => {
      void firebase.removeChannel(channel);
    };
  }, [matchId]);

  // Live database polling for real matches
  const refetch = useCallback(async () => {
    if (!isRealUuid) return;
    const { data } = await firebase
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

  const setActiveSting = useCallback(
    (sting: ActiveEventSting | null) => {
      if (!sting) clearSting();
      else useBroadcastStore.getState().triggerSting(sting);
    },
    [clearSting],
  );

  const setActiveStrap = useCallback(
    (strap: ActiveLowerThirdStrap | null) => {
      if (!strap) clearStrap();
      else
        useBroadcastStore.getState().triggerStrap({
          ...strap,
          strapType: strap.type,
        });
    },
    [clearStrap],
  );

  // Return to live scorebar (Take off full cards)
  const handleReturnToScorebar = useCallback(() => {
    setSelectedBroadcastView("1");
    setActiveSting(null);
    setActiveStrap(null);
    sendCommand({
      type: "SET_BROADCAST_VIEW",
      broadcastView: "1",
    });
    setLastAction("Scorebar on air");
  }, [
    sendCommand,
    setActiveSting,
    setActiveStrap,
    setLastAction,
    setSelectedBroadcastView,
  ]);

  // Switch broadcast view
  const handleSelectBroadcastView = useCallback(
    (view: BroadcastViewId) => {
      setSelectedBroadcastView(view);
      setActiveSting(null);
      sendCommand({
        type: "SET_BROADCAST_VIEW",
        broadcastView: view,
      });
      const opt = BROADCAST_VIEW_OPTIONS.find((o) => o.id === view);
      setLastAction(`Switched to: ${opt?.label ?? view} (View ${view})`);
    },
    [sendCommand, setActiveSting, setLastAction, setSelectedBroadcastView],
  );

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
        four: "Four",
        six: "Six",
        wicket: "Wicket",
        milestone: "Milestone",
        free_hit: "Free hit",
      };

      const stingId = `sting-${Date.now()}`;
      const sting: ActiveEventSting = {
        id: stingId,
        type: stingType,
        title: titles[stingType] ?? "Boundary",
        subtitle:
          activeState.batting_team_short_name ??
          activeState.batting_team_name ??
          "Live",
        detail: activeState.striker_name
          ? `${activeState.striker_name} · ${activeState.striker_runs ?? 0} (${activeState.striker_balls ?? 0}b)`
          : undefined,
        durationMs: 4000,
      };

      setActiveSting(sting);
      setTimeout(() => {
        setActiveSting(null);
      }, 4000);

      sendCommand({ type: "TRIGGER_STING", stingType });
      setLastAction(`Event card: ${titles[stingType]}`);
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
        badge = "Batter";
        title = activeState.striker_name ?? "Striker";
        subtitle = `${activeState.striker_runs ?? 0} runs off ${activeState.striker_balls ?? 0} balls`;
        const sr =
          activeState.striker_balls && activeState.striker_balls > 0
            ? (
                ((activeState.striker_runs ?? 0) / activeState.striker_balls) *
                100
              ).toFixed(1)
            : "0.0";
        detail = `Strike rate: ${sr}`;
      } else if (type === "bowler") {
        badge = "Bowler";
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
        badge = "Partnership";
        title = `${activeState.partnership_runs ?? 0} runs`;
        subtitle = `${activeState.striker_name ?? "Batsman 1"} & ${activeState.non_striker_name ?? "Batsman 2"}`;
        detail = `${activeState.partnership_balls ?? 0} balls faced`;
      } else if (type === "target") {
        badge = "Chase";
        title = `Target: ${activeState.target_runs ?? 0}`;
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
        setActiveStrap(null);
      }, strapDurationSecs * 1000);

      sendCommand({ type: "SHOW_STRAP", strap });
      setLastAction(`Lower third: ${badge}`);
    },
    [
      activeState,
      sendCommand,
      setActiveStrap,
      setLastAction,
      strapDurationSecs,
    ],
  );

  // Trigger custom alert strap
  const handleSendCustomAlert = useCallback(
    (customText?: string) => {
      const text = (customText ?? customStrapText).trim();
      if (!text) return;
      const strapId = `custom-${Date.now()}`;
      const strap: ActiveLowerThirdStrap = {
        id: strapId,
        type: "custom",
        title: "Match notice",
        subtitle: text,
        badge: "Notice",
        durationMs: strapDurationSecs * 1000,
      };
      setActiveStrap(strap);
      setTimeout(() => {
        setActiveStrap(null);
      }, strapDurationSecs * 1000);

      sendCommand({ type: "SHOW_STRAP", strap });
      setLastAction(`Notice: "${text}"`);
      if (!customText) setCustomStrapText("");
    },
    [
      customStrapText,
      sendCommand,
      setActiveStrap,
      setCustomStrapText,
      setLastAction,
      strapDurationSecs,
    ],
  );

  // Emergency Panic clear
  const handlePanicClear = useCallback(() => {
    handleReturnToScorebar();
    sendCommand({ type: "PANIC_CLEAR" });
    setLastAction("Cleared all graphics");
  }, [handleReturnToScorebar, sendCommand, setLastAction]);

  // Global keyboard shortcuts for live operators
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "4") {
        e.preventDefault();
        handleTriggerSting("four");
      } else if (e.key === "6") {
        e.preventDefault();
        handleTriggerSting("six");
      } else if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        handleTriggerSting("wicket");
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        handleTriggerSting("milestone");
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        handleTriggerSting("free_hit");
      } else if (e.key === " " || e.key === "Escape") {
        e.preventDefault();
        handleReturnToScorebar();
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        handleTriggerStrap("batsman");
      } else if (e.key === "o" || e.key === "O") {
        e.preventDefault();
        handleTriggerStrap("bowler");
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        handleTriggerStrap("partnership");
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        handleTriggerStrap("target");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTriggerSting, handleReturnToScorebar, handleTriggerStrap]);

  // Audio toggle
  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    sendCommand({ type: "TOGGLE_AUDIO", audioEnabled: next });
    setLastAction(next ? "Sound on" : "Sound off");
  };

  // Theme selector
  const handleSelectTheme = (thm: OverlayTheme) => {
    setSelectedTheme(thm);
    sendCommand({ type: "SET_THEME", theme: thm });
    setLastAction(`Theme: ${thm}`);
  };

  // Margin offset
  const handleSetMarginOffset = (px: number) => {
    setMarginOffsetPx(px);
    sendCommand({ type: "SET_MARGIN_OFFSET", marginOffsetPx: px });
    setLastAction(`Safe margin offset: +${px}px`);
  };

  // Copy OBS URL (relative on SSR/render to prevent hydration mismatch)
  const obsUrl = `/overlay/${matchId}`;

  const copyObsUrl = async () => {
    try {
      const fullUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/overlay/${matchId}`
          : `/overlay/${matchId}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedObsUrl(true);
      setTimeout(() => setCopiedObsUrl(false), 2500);
      setLastAction("Copied OBS browser source URL");
    } catch {
      // fallback
    }
  };

  // Simulator helper mutations (Test Mode Only)
  const simulateScoreChange = (runsDelta: number, isWicket = false) => {
    if (!isTestMode) return;
    setState((prev) => {
      const curr = prev ?? DEMO_MATCH_STATE;
      const totalBalls = (curr.total_balls ?? 0) + 1;
      const totalRuns = (curr.total_runs ?? 0) + runsDelta;
      const totalWickets = isWicket
        ? (curr.total_wickets ?? 0) + 1
        : (curr.total_wickets ?? 0);
      const strikerRuns = isWicket
        ? curr.striker_runs
        : (curr.striker_runs ?? 0) + runsDelta;
      const strikerBalls = (curr.striker_balls ?? 0) + 1;
      const runsNeeded =
        curr.target_runs && curr.target_runs > totalRuns
          ? curr.target_runs - totalRuns
          : 0;
      const ballsRemaining = Math.max(0, 120 - totalBalls);

      return {
        ...curr,
        total_runs: totalRuns,
        total_wickets: totalWickets,
        total_balls: totalBalls,
        current_over: Math.floor(totalBalls / 6),
        current_ball: totalBalls % 6,
        striker_runs: strikerRuns,
        striker_balls: strikerBalls,
        runs_needed: runsNeeded,
        balls_remaining: ballsRemaining,
        required_run_rate:
          ballsRemaining > 0
            ? Number(((runsNeeded / ballsRemaining) * 6).toFixed(2))
            : 0,
      };
    });
    setLastAction(
      `Simulator: ${isWicket ? "Wicket" : `+${runsDelta} runs`} (Score: ${(activeState.total_runs ?? 0) + runsDelta}/${(activeState.total_wickets ?? 0) + (isWicket ? 1 : 0)})`,
    );
  };

  const simulateStrikeRotation = () => {
    if (!isTestMode) return;
    setState((prev) => {
      const curr = prev ?? DEMO_MATCH_STATE;
      return {
        ...curr,
        striker_name: curr.non_striker_name,
        striker_runs: curr.non_striker_runs,
        striker_balls: curr.non_striker_balls,
        non_striker_name: curr.striker_name,
        non_striker_runs: curr.striker_runs,
        non_striker_balls: curr.striker_balls,
      };
    });
    setLastAction("Simulator: rotated strike");
  };

  const currentViewMeta = useMemo(() => {
    return (
      BROADCAST_VIEW_OPTIONS.find((o) => o.id === selectedBroadcastView) ?? {
        id: selectedBroadcastView,
        label: "Scorebar",
      }
    );
  }, [selectedBroadcastView]);

  const activeDeck = useMemo(() => {
    return (
      GRAPHIC_PHASE_DECKS.find((d) => d.id === activeDeckTab) ??
      GRAPHIC_PHASE_DECKS[0]!
    );
  }, [activeDeckTab]);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#080c14] text-slate-100 ">
      {/* ============================================================= */}
      {/* 1. STUDIO HEADER & ON-AIR TALLY BAR                           */}
      {/* ============================================================= */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0f18] px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2.5 sm:gap-4">
          {/* Match & Live Studio Status */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <span className="text-sm font-medium text-slate-400">
              Control room
            </span>

            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-white">
                {activeState.team1_name ?? activeState.team1_short_name ?? "T1"}{" "}
                vs{" "}
                {activeState.team2_name ?? activeState.team2_short_name ?? "T2"}
              </span>
              <span className="text-xs font-semibold tabular-nums text-slate-300">
                {activeState.total_runs ?? 0}/{activeState.total_wickets ?? 0} (
                {oversText(activeState.total_balls)} ov)
              </span>
            </div>
          </div>

          {/* Live On-Air Tally Indicator & Return Button */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition",
                selectedBroadcastView === "1"
                  ? "border-white/10 bg-white/5 text-slate-300"
                  : "border-red-500/40 bg-red-500/10 text-red-200",
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
              <span>
                On air:{" "}
                <span className="font-semibold text-white">
                  {currentViewMeta.label}
                </span>
              </span>
            </div>

            {selectedBroadcastView !== "1" && (
              <button
                onClick={handleReturnToScorebar}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-white/90"
                title="Return to Scorebar (Space / Esc)"
              >
                <Undo2 className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Back to scorebar</span>
                <span className="sm:hidden">Back</span>
              </button>
            )}
          </div>

          {/* Quick Production Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={copyObsUrl}
              className={`flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm transition ${
                copiedObsUrl
                  ? "bg-emerald-600 text-white"
                  : "border border-white/10 bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {copiedObsUrl ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Copy className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="hidden sm:inline">
                {copiedObsUrl ? "Copied" : "Copy OBS URL"}
              </span>
            </button>

            <a
              href={obsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              title="Open full transparent overlay in new window"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Popout</span>
            </a>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              title="Configure Themes, Margins & Audio"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            <button
              onClick={handlePanicClear}
              className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500"
              title="Clear all graphics"
            >
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================= */}
      {/* 2. MAIN 2-COLUMN BROADCAST CONTROL SUITE                      */}
      {/* ============================================================= */}
      <main className="mx-auto max-w-7xl p-3 sm:p-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* ========================================================= */}
          {/* LEFT COLUMN: PROGRAM MONITOR & INSTANT EVENT HOTDECK      */}
          {/* ========================================================= */}
          <div className="space-y-4 lg:col-span-6 xl:col-span-6">
            {/* 16:9 Live Preview Screen Card */}
            <div className="rounded-xl border border-slate-800 bg-[#0e131d] p-3.5 sm:p-4">
              {/* Monitor Titlebar */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold text-slate-200">
                    Program Feed
                  </span>
                  <span className="text-[11px] text-slate-400">
                    1920×1080 · 60fps
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      setMonitorBg(monitorBg === "stadium" ? "grid" : "stadium")
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:bg-white/10"
                    title="Toggle preview backdrop between stadium cam and transparency grid"
                  >
                    {monitorBg === "stadium" ? (
                      <>
                        <span>Stadium</span>
                      </>
                    ) : (
                      <>
                        <span>Grid</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleToggleAudio}
                    className={cn(
                      "flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition",
                      audioEnabled
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-white/10 bg-white/5 text-slate-400",
                    )}
                    title="Toggle celebration sting audio fanfares"
                  >
                    {audioEnabled ? (
                      <Volume2 className="h-3.5 w-3.5" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5" />
                    )}
                    <span>{audioEnabled ? "Sound on" : "Muted"}</span>
                  </button>
                </div>
              </div>

              {/* 16:9 Scaled Monitor Viewport */}
              <div
                ref={monitorRef}
                className={cn(
                  "relative mt-3 aspect-video w-full overflow-hidden rounded-lg border border-white/10",
                  monitorBg === "stadium"
                    ? "bg-[#0b1220]"
                    : "bg-slate-950 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]",
                )}
              >
                {/* 1920x1080 Scaled Canvas */}
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

              {/* Active Layers Status HUD */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/40 px-3 py-2 text-[11px]">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">Layers:</span>
                  <span className="font-medium text-slate-200">
                    Base: {currentViewMeta.label}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span
                    className={cn(
                      "font-semibold",
                      activeStrap ? "text-slate-200" : "text-slate-500",
                    )}
                  >
                    Strap:{" "}
                    {activeStrap ? (activeStrap.badge ?? "Active") : "None"}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span
                    className={cn(
                      "font-semibold",
                      activeSting ? "text-slate-200" : "text-slate-500",
                    )}
                  >
                    Sting: {activeSting ? activeSting.title : "Idle"}
                  </span>
                </div>

                <span className="text-xs text-slate-400">{lastAction}</span>
              </div>
            </div>

            {/* Stream-Deck Instant Event Celebration Hotdeck */}
            <div className="rounded-xl border border-slate-800 bg-[#0e131d] p-3.5 sm:p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">
                  Event cards
                </h2>
                <span className="text-[11px] text-slate-400">
                  <span className="hidden sm:inline">Click or use hotkeys</span>
                  <span className="sm:hidden">Tap to show</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(
                  [
                    { type: "four", label: "Four", sub: "Boundary", key: "4" },
                    {
                      type: "six",
                      label: "Six",
                      sub: "Over the rope",
                      key: "6",
                    },
                    { type: "wicket", label: "Wicket", sub: "Out", key: "W" },
                    {
                      type: "milestone",
                      label: "Milestone",
                      sub: "50 / 100",
                      key: "M",
                    },
                    {
                      type: "free_hit",
                      label: "Free hit",
                      sub: "After a no-ball",
                      key: "F",
                    },
                  ] as const
                ).map((ev) => (
                  <button
                    key={ev.type}
                    onClick={() => handleTriggerSting(ev.type)}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-white/5 p-3 text-white transition-colors hover:bg-white/10",
                      ev.type === "free_hit" && "col-span-2 sm:col-span-1",
                    )}
                  >
                    <kbd className="absolute right-2 top-2 hidden rounded border border-white/10 px-1 font-mono text-[10px] text-slate-400 sm:inline">
                      {ev.key}
                    </kbd>
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        ev.type === "wicket" && "text-red-400",
                      )}
                    >
                      {ev.label}
                    </span>
                    <span className="text-xs text-slate-400">{ev.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* In-Play Lower-Third Popups Deck */}
            <div className="rounded-xl border border-slate-800 bg-[#0e131d] p-3.5 sm:p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">
                  Lower thirds
                </h2>
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
                    label: "Striker",
                    hotkey: "B",
                    desc: "Runs, balls & strike rate",
                  },
                  {
                    id: "bowler",
                    label: "Bowler",
                    hotkey: "O",
                    desc: "Overs, maidens & wickets",
                  },
                  {
                    id: "partnership",
                    label: "Partnership",
                    hotkey: "P",
                    desc: "Active pair contribution",
                  },
                  {
                    id: "target",
                    label: "Chase",
                    hotkey: "T",
                    desc: "Runs needed from balls",
                  },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() =>
                      handleTriggerStrap(s.id as ActiveLowerThirdStrap["type"])
                    }
                    className="flex flex-col justify-between rounded-lg border border-white/10 bg-white/5 p-2.5 text-left transition-colors hover:bg-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">
                        {s.label}
                      </span>
                      <span className="rounded bg-white/10 px-1 font-mono text-[9px] text-slate-300">
                        [{s.hotkey}]
                      </span>
                    </div>
                    <span className="mt-1 text-[10px] text-slate-400">
                      {s.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Test Match Simulator (Only active on /overlay/test/control) */}
            {isTestMode && (
              <div className="rounded-xl border border-dashed border-white/15 bg-[#0e131d] p-3.5 sm:p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-100">
                    Match simulator (test only)
                  </h2>
                  <span className="text-[10px] text-slate-400">
                    Changes the preview state only
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => simulateScoreChange(4)}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-white/10"
                  >
                    +4 runs
                  </button>
                  <button
                    onClick={() => simulateScoreChange(6)}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-white/10"
                  >
                    +6 runs
                  </button>
                  <button
                    onClick={() => simulateScoreChange(0, true)}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-white/10"
                  >
                    +Wkt
                  </button>
                  <button
                    onClick={simulateStrikeRotation}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-white/10"
                  >
                    Rotate strike
                  </button>
                  <button
                    onClick={() => {
                      setState(DEMO_MATCH_STATE);
                      setLastAction("Simulator: reset to demo state");
                    }}
                    className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: PHASE-DRIVEN GRAPHICS DECKS & NOTICE PRESETS */}
          {/* ========================================================= */}
          <div className="space-y-4 lg:col-span-6 xl:col-span-6">
            {/* Phase Graphics Switcher Deck */}
            <div className="rounded-xl border border-slate-800 bg-[#0e131d] p-3.5 sm:p-4">
              <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
                <h2 className="text-sm font-semibold text-slate-100">
                  Graphics
                </h2>
                <span className="text-[11px] text-slate-400">
                  Select graphic to push live
                </span>
              </div>

              {/* 4 Clean Phase Navigation Tabs */}
              <div
                role="tablist"
                className="no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-xl bg-black/40 p-1"
              >
                {GRAPHIC_PHASE_DECKS.map((deck) => {
                  const Icon = deck.icon;
                  const isActive = activeDeckTab === deck.id;
                  return (
                    <button
                      key={deck.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveDeckTab(deck.id)}
                      className={cn(
                        "flex min-h-[38px] flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-medium transition-colors",
                        isActive
                          ? "bg-white text-black"
                          : "text-slate-400 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{deck.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Views Grid for Active Phase */}
              <div className="mt-3.5 space-y-2">
                <p className="text-[11px] text-slate-400">
                  {activeDeck.description}:
                </p>

                <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
                  {activeDeck.views.map((v) => {
                    const isLive = selectedBroadcastView === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => handleSelectBroadcastView(v.id)}
                        className={cn(
                          "flex flex-col justify-between rounded-lg border p-3 text-left transition-colors",
                          isLive
                            ? "border-red-500/50 bg-red-500/10"
                            : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              "text-white",
                            )}
                          >
                            {v.label}
                          </span>
                          {isLive ? (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-red-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              <span>On air</span>
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-slate-500">
                              v{v.id}
                            </span>
                          )}
                        </div>
                        <span className="mt-1 text-[11px] text-slate-400">
                          {v.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 1-Click Broadcast Notice Presets & Custom Ticker */}
            <div className="rounded-xl border border-slate-800 bg-[#0e131d] p-3.5 sm:p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">
                  Notices
                </h2>
                <span className="text-[11px] text-slate-400">Presets</span>
              </div>

              {/* 1-Click Notice Badges */}
              <div className="flex flex-wrap gap-1.5">
                {NOTICE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSendCustomAlert(p.text)}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Ticker Input Box */}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={customStrapText}
                  onChange={(e) => setCustomStrapText(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleSendCustomAlert()
                  }
                  placeholder="Custom broadcast alert (e.g. 'Inspection at 3:30 PM')"
                  className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-base text-white placeholder:text-slate-500 focus:border-white/40 focus:outline-none sm:min-h-0 sm:text-xs"
                />
                <button
                  onClick={() => handleSendCustomAlert()}
                  className="flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-white/90"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send alert</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ============================================================= */}
      {/* 3. UNIFIED THEME & BROADCAST SETTINGS DIALOG (NO REDUNDANCY)  */}
      {/* ============================================================= */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/10 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              <span>Overlay settings</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Theme, OBS safe-zone margin and hotkeys.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* TV Broadcast Themes */}
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-200">
                <Palette className="h-4 w-4" />
                <span>Theme</span>
              </label>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {THEME_OPTIONS.map((thm) => {
                  const isSelected = selectedTheme === thm.id;
                  return (
                    <button
                      key={thm.id}
                      onClick={() => handleSelectTheme(thm.id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                        isSelected
                          ? "border-white/40 bg-white/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10",
                      )}
                    >
                      <span
                        className={cn(
                          "h-3 w-3 shrink-0 rounded-full ring-1 ring-white/30",
                          thm.swatch,
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-white">
                          {thm.label}
                        </div>
                        <div className="truncate text-[10px] text-slate-400">
                          {thm.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* OBS Safe-Zone Margin Offset */}
            <div className="border-t border-white/10 pt-4">
              <label className="mb-1 block text-sm font-semibold text-slate-200">
                OBS safe-zone margin
              </label>
              <p className="mb-2 text-xs text-slate-400">
                Lifts the bottom scorebar above YouTube/Twitch live chat or
                mobile portrait safe areas.
              </p>

              <div className="flex gap-2">
                {[0, 16, 32, 48].map((px) => (
                  <button
                    key={px}
                    onClick={() => handleSetMarginOffset(px)}
                    className={cn(
                      "rounded-md border px-3.5 py-1.5 text-xs font-medium tabular-nums transition-colors",
                      marginOffsetPx === px
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                    )}
                  >
                    +{px}px
                  </button>
                ))}
              </div>
            </div>

            {/* Keyboard Hotkeys Guide */}
            <div className="border-t border-white/10 pt-4">
              <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-200">
                <Keyboard className="h-4 w-4" />
                <span>Keyboard shortcuts</span>
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1.5 rounded-xl bg-black/40 p-3">
                  <div className="text-xs font-medium text-slate-400">
                    Event cards
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Four</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px]">
                      [4]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Six</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px]">
                      [6]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Wicket</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px]">
                      [W]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Milestone (50/100)</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px]">
                      [M]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Free hit</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px]">
                      [F]
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-xl bg-black/40 p-3">
                  <div className="text-xs font-medium text-slate-400">
                    Navigation
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Back to scorebar</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px]">
                      [Space / Esc]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Striker</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px]">
                      [B]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Bowler</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px]">
                      [O]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Partnership</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px]">
                      [P]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Chase</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px]">
                      [T]
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
