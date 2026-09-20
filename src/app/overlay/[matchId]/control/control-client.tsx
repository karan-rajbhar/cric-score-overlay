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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
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
  SlidersHorizontal,
  Landmark,
  Tv,
  Undo2,
  RotateCcw,
  Keyboard,
  Radio,
  Sparkles,
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
    desc: "IPL Gold & Blue",
    swatch: "from-amber-400 to-blue-600",
  },
  {
    id: "sonysports",
    label: "Sony Sports",
    desc: "LIV Crimson Red",
    swatch: "from-red-600 to-rose-950",
  },
  {
    id: "foxcricket",
    label: "Fox Cricket",
    desc: "Aussie BBL Orange",
    swatch: "from-amber-500 to-orange-600",
  },
  {
    id: "apex",
    label: "Apex 24K",
    desc: "Mirror Gold",
    swatch: "from-yellow-300 via-amber-400 to-yellow-600",
  },
  {
    id: "volt",
    label: "Volt Tech",
    desc: "Cyber Lime",
    swatch: "from-lime-400 to-emerald-500",
  },
  {
    id: "agni",
    label: "Agni Inferno",
    desc: "Volcanic Magma",
    swatch: "from-orange-500 to-red-600",
  },
  {
    id: "skysports",
    label: "Sky Sports",
    desc: "Ashes Red & Navy",
    swatch: "from-red-600 to-blue-900",
  },
  {
    id: "thehundred",
    label: "The Hundred",
    desc: "Hot Pink & Cyan",
    swatch: "from-pink-500 to-cyan-400",
  },
  {
    id: "dharma",
    label: "Dharma",
    desc: "Royal Vedic Gold",
    swatch: "from-amber-500 to-orange-700",
  },
  {
    id: "thunder",
    label: "Thunder",
    desc: "Electric Cyan & Indigo",
    swatch: "from-cyan-400 to-indigo-600",
  },
  {
    id: "nakshatra",
    label: "Nakshatra",
    desc: "Cosmic Purple & Gold",
    swatch: "from-purple-500 to-amber-400",
  },
  {
    id: "emerald",
    label: "Emerald",
    desc: "Pitch Green & Gold",
    swatch: "from-emerald-500 to-green-800",
  },
  {
    id: "dark",
    label: "Dark Titanium",
    desc: "Carbon Titanium",
    swatch: "from-zinc-700 to-neutral-900",
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
    name: "Live Scorebars",
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
    name: "Scorecards & Squads",
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
    name: "Breaks & Stoppages",
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
    name: "Analytics & Charts",
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
    label: "DRINKS BREAK",
    text: "Drinks break in progress · Play resumes shortly",
  },
  {
    id: "rain",
    label: "RAIN DELAY",
    text: "Rain stopped play · Ground staff covering the pitch",
  },
  {
    id: "timeout",
    label: "STRATEGIC TIMEOUT",
    text: "2.5-minute strategic tactical timeout underway",
  },
  {
    id: "innings",
    label: "INNINGS BREAK",
    text: "Change of innings in progress · Pitch preparation underway",
  },
  {
    id: "drs",
    label: "DRS REVIEW",
    text: "Decision review in progress · Third umpire reviewing ball trajectory",
  },
  {
    id: "inspection",
    label: "PITCH INSPECTION",
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
  const controlChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
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

  // Realtime Supabase broadcast channel
  useEffect(() => {
    const channel = supabase.channel(`overlay_control_${matchId}`);
    controlChannelRef.current = channel;
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId]);

  // Live database polling for real matches
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
    setLastAction("Live Scorebar On-Air (Scoreboard safe)");
  }, [sendCommand, setActiveSting, setActiveStrap, setLastAction, setSelectedBroadcastView]);

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
        four: "FOUR!",
        six: "MAXIMUM!",
        wicket: "WICKET!",
        milestone: "50 / 100",
        free_hit: "FREE HIT",
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
        setActiveSting(null);
      }, 4000);

      sendCommand({ type: "TRIGGER_STING", stingType });
      setLastAction(`Fired Sting: ${titles[stingType]}`);
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
        setActiveStrap(null);
      }, strapDurationSecs * 1000);

      sendCommand({ type: "SHOW_STRAP", strap });
      setLastAction(`Lower Third: ${badge}`);
    },
    [activeState, sendCommand, setActiveStrap, setLastAction, strapDurationSecs],
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
        title: "OFFICIAL MATCH NOTICE",
        subtitle: text,
        badge: "LIVE NOTICE",
        durationMs: strapDurationSecs * 1000,
      };
      setActiveStrap(strap);
      setTimeout(() => {
        setActiveStrap(null);
      }, strapDurationSecs * 1000);

      sendCommand({ type: "SHOW_STRAP", strap });
      setLastAction(`Broadcast Alert: "${text}"`);
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
    setLastAction("Cleared all active graphics (Safety Cut)");
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
  }, [
    handleTriggerSting,
    handleReturnToScorebar,
    handleTriggerStrap,
  ]);

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
    setLastAction(`Broadcast Theme: ${thm.toUpperCase()}`);
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
      `Simulator: ${isWicket ? "WICKET!" : `+${runsDelta} Runs`} (Score: ${(activeState.total_runs ?? 0) + runsDelta}/${(activeState.total_wickets ?? 0) + (isWicket ? 1 : 0)})`,
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
    setLastAction("Simulator: Rotated Strike");
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
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-black">
      {/* ============================================================= */}
      {/* 1. STUDIO HEADER & ON-AIR TALLY BAR                           */}
      {/* ============================================================= */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 px-3 py-2.5 shadow-xl backdrop-blur-xl sm:px-5 sm:py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2.5 sm:gap-4">
          {/* Match & Live Studio Status */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <div className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-600/20 px-2.5 py-1 text-xs font-black tracking-wider text-red-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
              <span>LIVE STUDIO</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-sm font-black tracking-wide text-white">
                {activeState.team1_name ?? activeState.team1_short_name ?? "T1"}{" "}
                vs{" "}
                {activeState.team2_name ?? activeState.team2_short_name ?? "T2"}
              </span>
              <span className="font-mono text-xs font-bold tabular-nums text-amber-400">
                {activeState.total_runs ?? 0}/{activeState.total_wickets ?? 0}{" "}
                ({oversText(activeState.total_balls)} ov)
              </span>
            </div>
          </div>

          {/* Live On-Air Tally Indicator & Return Button */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition",
                selectedBroadcastView === "1"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/50 bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/30",
              )}
            >
              <Radio
                className={cn(
                  "h-3.5 w-3.5 animate-pulse",
                  selectedBroadcastView === "1"
                    ? "text-emerald-400"
                    : "text-amber-400",
                )}
              />
              <span>
                ON AIR:{" "}
                <span className="font-black text-white">
                  {currentViewMeta.label}
                </span>
              </span>
            </div>

            {selectedBroadcastView !== "1" && (
              <button
                onClick={handleReturnToScorebar}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/50 bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow-lg transition hover:bg-emerald-500 active:scale-95"
                title="Return to Scorebar (Space / Esc)"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cut to Scorebar</span>
                <span className="sm:hidden">Cut</span>
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
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {copiedObsUrl ? "Copied!" : "Copy OBS URL"}
              </span>
            </button>

            <a
              href={obsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              title="Open full transparent overlay in new window"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Popout</span>
            </a>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              title="Configure Themes, Margins & Audio"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            <button
              onClick={handlePanicClear}
              className="flex min-h-[36px] items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-black uppercase text-white shadow-md transition hover:bg-red-500 active:scale-95"
              title="Emergency Clear (Space / Esc)"
            >
              <XCircle className="h-3.5 w-3.5" />
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
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-3 shadow-2xl backdrop-blur-md sm:rounded-3xl sm:p-4">
              {/* Monitor Titlebar */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
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
                        <Landmark className="h-3 w-3 text-emerald-400" />
                        <span>Stadium</span>
                      </>
                    ) : (
                      <>
                        <Tv className="h-3 w-3 text-amber-400" />
                        <span>Grid</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleToggleAudio}
                    className={cn(
                      "flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition",
                      audioEnabled
                        ? "border-amber-500/40 bg-amber-500/20 text-amber-300"
                        : "border-white/10 bg-white/5 text-slate-400",
                    )}
                    title="Toggle celebration sting audio fanfares"
                  >
                    {audioEnabled ? (
                      <Volume2 className="h-3.5 w-3.5" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5" />
                    )}
                    <span>{audioEnabled ? "SFX On" : "Muted"}</span>
                  </button>
                </div>
              </div>

              {/* 16:9 Scaled Monitor Viewport */}
              <div
                ref={monitorRef}
                className={cn(
                  "relative mt-3 aspect-video w-full overflow-hidden rounded-xl border-2 border-white/10 shadow-2xl sm:rounded-2xl",
                  monitorBg === "stadium"
                    ? "bg-cover bg-center"
                    : "bg-slate-950 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]",
                )}
                style={{
                  backgroundImage:
                    monitorBg === "stadium"
                      ? "radial-gradient(circle at 50% 30%, rgba(30, 58, 138, 0.4) 0%, rgba(2, 6, 23, 0.95) 100%), linear-gradient(180deg, rgba(2, 6, 23, 0.5) 0%, rgba(2, 6, 23, 0.92) 100%)"
                      : undefined,
                }}
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
                  <span className="text-slate-400">Layer Stack:</span>
                  <span className="font-semibold text-emerald-400">
                    Base: {currentViewMeta.label}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span
                    className={cn(
                      "font-semibold",
                      activeStrap ? "text-sky-300" : "text-slate-500",
                    )}
                  >
                    Strap: {activeStrap ? activeStrap.badge ?? "Active" : "None"}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span
                    className={cn(
                      "font-semibold",
                      activeSting ? "text-amber-300" : "text-slate-500",
                    )}
                  >
                    Sting: {activeSting ? activeSting.title : "Idle"}
                  </span>
                </div>

                <span className="font-mono text-xs font-bold text-slate-400">
                  {lastAction}
                </span>
              </div>
            </div>

            {/* Stream-Deck Instant Event Celebration Hotdeck */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-3.5 shadow-xl backdrop-blur-md sm:rounded-3xl sm:p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Instant Event Celebration Stings
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Click or use hotkeys
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <button
                  onClick={() => handleTriggerSting("four")}
                  className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl border border-sky-500/40 bg-gradient-to-b from-sky-600/30 to-slate-900 p-3 font-black text-white shadow-lg transition hover:scale-[1.02] hover:from-sky-600/50 active:scale-95"
                >
                  <span className="absolute right-2 top-2 rounded bg-sky-500/30 px-1 py-0.5 text-[9px] font-mono text-sky-300">
                    [4]
                  </span>
                  <Zap className="h-5 w-5 text-sky-400 transition group-hover:scale-110" />
                  <span className="text-lg">FOUR!</span>
                  <span className="text-[10px] uppercase text-sky-200/70">
                    Boundary
                  </span>
                </button>

                <button
                  onClick={() => handleTriggerSting("six")}
                  className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl border border-purple-500/40 bg-gradient-to-b from-purple-600/30 to-slate-900 p-3 font-black text-white shadow-lg transition hover:scale-[1.02] hover:from-purple-600/50 active:scale-95"
                >
                  <span className="absolute right-2 top-2 rounded bg-purple-500/30 px-1 py-0.5 text-[9px] font-mono text-purple-300">
                    [6]
                  </span>
                  <Flame className="h-5 w-5 text-amber-400 transition group-hover:scale-110" />
                  <span className="text-lg text-amber-300">MAXIMUM!</span>
                  <span className="text-[10px] uppercase text-amber-200/70">
                    Six
                  </span>
                </button>

                <button
                  onClick={() => handleTriggerSting("wicket")}
                  className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl border border-red-500/40 bg-gradient-to-b from-red-600/30 to-slate-900 p-3 font-black text-white shadow-lg transition hover:scale-[1.02] hover:from-red-600/50 active:scale-95"
                >
                  <span className="absolute right-2 top-2 rounded bg-red-500/30 px-1 py-0.5 text-[9px] font-mono text-red-300">
                    [W]
                  </span>
                  <AlertOctagon className="h-5 w-5 text-red-400 transition group-hover:scale-110" />
                  <span className="text-lg text-red-300">WICKET!</span>
                  <span className="text-[10px] uppercase text-red-200/70">
                    Out
                  </span>
                </button>

                <button
                  onClick={() => handleTriggerSting("milestone")}
                  className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-600/30 to-slate-900 p-3 font-black text-white shadow-lg transition hover:scale-[1.02] hover:from-amber-600/50 active:scale-95"
                >
                  <span className="absolute right-2 top-2 rounded bg-amber-500/30 px-1 py-0.5 text-[9px] font-mono text-amber-300">
                    [M]
                  </span>
                  <Trophy className="h-5 w-5 text-yellow-300 transition group-hover:scale-110" />
                  <span className="text-lg text-yellow-300">50 / 100</span>
                  <span className="text-[10px] uppercase text-yellow-200/70">
                    Milestone
                  </span>
                </button>

                <button
                  onClick={() => handleTriggerSting("free_hit")}
                  className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl border border-yellow-500/40 bg-gradient-to-b from-yellow-500/30 to-slate-900 p-3 font-black text-white shadow-lg transition hover:scale-[1.02] hover:from-yellow-500/50 active:scale-95 col-span-2 sm:col-span-1"
                >
                  <span className="absolute right-2 top-2 rounded bg-yellow-500/30 px-1 py-0.5 text-[9px] font-mono text-yellow-300">
                    [F]
                  </span>
                  <ShieldAlert className="h-5 w-5 text-yellow-400 transition group-hover:scale-110" />
                  <span className="text-lg text-yellow-400">FREE HIT</span>
                  <span className="text-[10px] uppercase text-yellow-200/70">
                    No-Ball
                  </span>
                </button>
              </div>
            </div>

            {/* In-Play Lower-Third Popups Deck */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-3.5 shadow-xl backdrop-blur-md sm:rounded-3xl sm:p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-sky-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    In-Play Lower-Third Popups
                  </span>
                </div>
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
                    label: "Striker Stats",
                    hotkey: "B",
                    desc: "Runs, balls & strike rate",
                  },
                  {
                    id: "bowler",
                    label: "Bowler Spell",
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
                    label: "Chase Equation",
                    hotkey: "T",
                    desc: "Runs needed from balls",
                  },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() =>
                      handleTriggerStrap(s.id as ActiveLowerThirdStrap["type"])
                    }
                    className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-2.5 text-left transition hover:border-amber-500/40 hover:bg-white/10 active:scale-95"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        {s.label}
                      </span>
                      <span className="rounded bg-white/10 px-1 text-[9px] font-mono text-slate-300">
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
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-slate-900/80 p-3.5 shadow-xl backdrop-blur-md sm:rounded-3xl sm:p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400 text-xs">
                    <Radio className="h-4 w-4" />
                    <span>Match Simulator (Test Cockpit)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Instant match state QA
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => simulateScoreChange(4)}
                    className="rounded-lg border border-sky-500/40 bg-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-300 hover:bg-sky-500/30 active:scale-95"
                  >
                    +4 Runs
                  </button>
                  <button
                    onClick={() => simulateScoreChange(6)}
                    className="rounded-lg border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/30 active:scale-95"
                  >
                    +6 Runs
                  </button>
                  <button
                    onClick={() => simulateScoreChange(0, true)}
                    className="rounded-lg border border-red-500/40 bg-red-500/20 px-2.5 py-1 text-xs font-bold text-red-300 hover:bg-red-500/30 active:scale-95"
                  >
                    +Wkt
                  </button>
                  <button
                    onClick={simulateStrikeRotation}
                    className="rounded-lg border border-purple-500/40 bg-purple-500/20 px-2.5 py-1 text-xs font-bold text-purple-300 hover:bg-purple-500/30 active:scale-95"
                  >
                    Rotate Strike
                  </button>
                  <button
                    onClick={() => {
                      setState(DEMO_MATCH_STATE);
                      setLastAction("Simulator: Reset to Demo State");
                    }}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10 active:scale-95"
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
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-3.5 shadow-2xl backdrop-blur-md sm:rounded-3xl sm:p-5">
              <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Broadcast Graphic Decks
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Select graphic to push live
                </span>
              </div>

              {/* 4 Clean Phase Navigation Tabs */}
              <div
                role="tablist"
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-xl bg-black/40 p-1"
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
                        "flex shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition min-h-[38px] flex-1",
                        isActive
                          ? "bg-amber-500 text-black shadow-md"
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
                          "flex flex-col justify-between rounded-xl border p-3 text-left transition",
                          isLive
                            ? "border-amber-400 bg-amber-500/20 shadow-md ring-2 ring-amber-400/40"
                            : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "text-xs font-bold",
                              isLive ? "text-amber-300" : "text-white",
                            )}
                          >
                            {v.label}
                          </span>
                          {isLive ? (
                            <span className="flex items-center gap-1 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-black">
                              <Radio className="h-2.5 w-2.5" />
                              <span>LIVE</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-500">
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
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-3.5 shadow-xl backdrop-blur-md sm:rounded-3xl sm:p-5">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Radio className="h-4 w-4 text-sky-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Live Broadcast Notices & Alerts
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  1-Click Presets
                </span>
              </div>

              {/* 1-Click Notice Badges */}
              <div className="flex flex-wrap gap-1.5">
                {NOTICE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSendCustomAlert(p.text)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-300 transition hover:border-amber-400/50 hover:bg-amber-500/10 hover:text-amber-300 active:scale-95"
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
                  placeholder="Custom broadcast alert (e.g. 'Match inspection at 3:30 PM')"
                  className="w-full min-h-[44px] sm:min-h-0 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-base sm:text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                />
                <button
                  onClick={() => handleSendCustomAlert()}
                  className="flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-black transition hover:bg-amber-400 active:scale-95"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send Alert</span>
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/10 bg-slate-900 text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-white">
              <SlidersHorizontal className="h-5 w-5 text-amber-400" />
              <span>Broadcast Production Settings</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Customize visual broadcast theme, OBS safe-zone margins, sound
              fanfares, and review operator hotkeys.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* TV Broadcast Themes */}
            <div>
              <label className="mb-2 block flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Palette className="h-4 w-4 text-amber-400" />
                <span>TV Broadcast Visual Theme</span>
              </label>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {THEME_OPTIONS.map((thm) => {
                  const isSelected = selectedTheme === thm.id;
                  return (
                    <button
                      key={thm.id}
                      onClick={() => handleSelectTheme(thm.id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition",
                        isSelected
                          ? "border-amber-400 bg-amber-500/20 ring-1 ring-amber-400"
                          : "border-white/10 bg-white/5 hover:bg-white/10",
                      )}
                    >
                      <span
                        className={cn(
                          "h-3 w-3 shrink-0 rounded-full bg-gradient-to-tr ring-1 ring-white/30",
                          thm.swatch,
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-white">
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
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-300">
                OBS Safe-Zone Margin Offset
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
                      "rounded-xl border px-3.5 py-1.5 text-xs font-bold transition",
                      marginOffsetPx === px
                        ? "border-amber-400 bg-amber-500 font-black text-black shadow-md"
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
              <label className="mb-2 block flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Keyboard className="h-4 w-4 text-sky-400" />
                <span>Operator Keyboard Shortcuts</span>
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1.5 rounded-xl bg-black/40 p-3">
                  <div className="font-bold text-amber-300 text-[11px] uppercase">
                    Celebration Stings
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Boundary Four:</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px] font-bold">
                      [4]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Maximum Six:</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px] font-bold">
                      [6]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Wicket Down:</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px] font-bold">
                      [W]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Milestone 50/100:</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px] font-bold">
                      [M]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Free Hit Call:</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px] font-bold">
                      [F]
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-xl bg-black/40 p-3">
                  <div className="font-bold text-sky-300 text-[11px] uppercase">
                    Production Navigation
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Return to Scorebar:</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px] font-bold">
                      [Space / Esc]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Striker Stats:</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px] font-bold">
                      [B]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Bowler Figures:</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px] font-bold">
                      [O]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Partnership Stand:</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px] font-bold">
                      [P]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Target Chase:</span>
                    <span className="rounded bg-white/10 px-1.5 font-mono text-[11px] font-bold">
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
