"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "~/lib/supabase";
import {
  Settings,
  X,
  Copy,
  Check,
  LayoutTemplate,
  Palette,
  Tag,
} from "lucide-react";

export interface LiveMatchState {
  match_id: string;
  title: string | null;
  status: string | null;
  match_format: string | null;
  overs_per_innings: number | null;
  venue: string | null;
  current_innings: number | null;
  current_over: number | null;
  current_ball: number | null;
  result_type: string | null;
  result_description: string | null;
  team1_name: string | null;
  team1_short_name: string | null;
  team2_name: string | null;
  team2_short_name: string | null;
  winning_team_name: string | null;
  innings_number: number | null;
  total_runs: number | null;
  total_wickets: number | null;
  total_overs: number | null;
  total_balls: number | null;
  extras_total: number | null;
  innings_completed: boolean | null;
  target_runs: number | null;
  batting_team_name: string | null;
  batting_team_short_name: string | null;
  bowling_team_name: string | null;
  bowling_team_short_name: string | null;
  striker_name: string | null;
  striker_runs: number | null;
  striker_balls: number | null;
  non_striker_name: string | null;
  non_striker_runs: number | null;
  non_striker_balls: number | null;
  current_bowler_name: string | null;
  bowler_balls: number | null;
  bowler_runs: number | null;
  bowler_wickets: number | null;
  partnership_runs: number | null;
  partnership_balls: number | null;
  this_over_balls: string | null;
  current_run_rate: number | null;
  runs_needed: number | null;
  balls_remaining: number | null;
  required_run_rate: number | null;
}

export type LayoutMode = "bottom" | "top" | "compact";
export type OverlayTheme = "dark" | "broadcast" | "emerald" | "minimal";

interface OverlayClientProps {
  matchId: string;
  initial: LiveMatchState | null;
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
  let cls = "bg-white/10 text-white/90";
  if (label === "W") cls = "bg-red-600 text-white";
  else if (label === "4") cls = "bg-sky-500 text-white";
  else if (label === "6") cls = "bg-violet-500 text-white";
  else if (label.includes("wd") || label.includes("nb") || label.endsWith("b"))
    cls = "bg-amber-400 text-black";

  return (
    <span
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ${cls}`}
    >
      {label}
    </span>
  );
}

const THEME_STYLES: Record<
  OverlayTheme,
  {
    box: string;
    header: string;
    headerText: string;
    accentText: string;
    strikeStar: string;
    subText: string;
    targetText: string;
  }
> = {
  dark: {
    box: "border-white/10 bg-black/85 text-white shadow-2xl backdrop-blur-md",
    header: "border-b border-white/10 bg-white/5",
    headerText: "text-white/90",
    accentText: "text-white",
    strikeStar: "text-emerald-400",
    subText: "text-white/60",
    targetText: "text-amber-400",
  },
  broadcast: {
    box: "border-amber-500/30 bg-slate-950/90 text-white shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-md ring-1 ring-amber-500/20",
    header: "border-b border-amber-500/20 bg-amber-500/10",
    headerText: "text-amber-200 font-bold tracking-wide",
    accentText: "text-amber-400 font-extrabold",
    strikeStar: "text-amber-300",
    subText: "text-slate-300",
    targetText: "text-amber-300",
  },
  emerald: {
    box: "border-emerald-500/30 bg-emerald-950/90 text-white shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-md ring-1 ring-emerald-500/20",
    header: "border-b border-emerald-500/20 bg-emerald-500/10",
    headerText: "text-emerald-200 font-bold",
    accentText: "text-emerald-300 font-extrabold",
    strikeStar: "text-emerald-400",
    subText: "text-emerald-100/70",
    targetText: "text-emerald-300",
  },
  minimal: {
    box: "border-zinc-700/80 bg-zinc-900/90 text-zinc-100 shadow-xl backdrop-blur-md",
    header: "border-b border-zinc-800 bg-zinc-800/40",
    headerText: "text-zinc-300",
    accentText: "text-zinc-100 font-bold",
    strikeStar: "text-zinc-300",
    subText: "text-zinc-400",
    targetText: "text-zinc-200",
  },
};

export function OverlayClient({
  matchId,
  initial,
  initialLayout = "bottom",
  initialTheme = "dark",
  initialControls = true,
  initialSponsor = "",
}: OverlayClientProps) {
  const [state, setState] = useState<LiveMatchState | null>(initial);
  const [isConnected, setIsConnected] = useState(false);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Customization states
  const [layout, setLayout] = useState<LayoutMode>(
    initialLayout === "top" || initialLayout === "compact"
      ? initialLayout
      : "bottom",
  );
  const [theme, setTheme] = useState<OverlayTheme>(
    initialTheme === "broadcast" ||
      initialTheme === "emerald" ||
      initialTheme === "minimal"
      ? initialTheme
      : "dark",
  );
  const [showBalls, setShowBalls] = useState(true);
  const [sponsor, setSponsor] = useState(initialSponsor);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("live_match_state")
      .select("*")
      .eq("match_id", matchId)
      .single();
    if (data) setState(data as LiveMatchState);
  }, [matchId]);

  // Keyboard shortcut to toggle drawer: 'S'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "s" || e.key === "S") {
        setDrawerOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const scheduleRefetch = () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(() => void refetch(), 250);
    };

    const channel = supabase
      .channel(`overlay_${matchId}`)
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
      void supabase.removeChannel(channel);
      clearInterval(poll);
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  }, [matchId, refetch]);

  const copyObsUrl = () => {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    const params = new URLSearchParams();
    if (layout !== "bottom") params.set("layout", layout);
    if (theme !== "dark") params.set("theme", theme);
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
        <div className="rounded-lg bg-black/70 px-6 py-4 text-lg font-medium text-white shadow-xl backdrop-blur-md">
          Waiting for match data…
        </div>
      </div>
    );
  }

  const isLive = state.status === "live";
  const isComplete = state.status === "completed";
  const thisOverBalls = (state.this_over_balls ?? "")
    .split(" ")
    .filter(Boolean);
  const themeStyle = THEME_STYLES[theme];

  return (
    <div className="pointer-events-none fixed inset-0 select-none bg-transparent p-6 font-sans">
      {/* Connection indicator */}
      <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
        <span
          className={`h-2 w-2 rounded-full ${
            isConnected ? "animate-pulse bg-emerald-400" : "bg-red-500"
          }`}
        />
        <span className="text-xs font-medium tracking-wide text-white/80">
          {isConnected ? "LIVE FEED" : "OFFLINE"}
        </span>
      </div>

      {/* Match status */}
      <div className="absolute left-5 top-5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-white shadow-md ${
            isLive
              ? "bg-red-600"
              : isComplete
                ? "bg-emerald-600"
                : "bg-zinc-700"
          }`}
        >
          {isLive && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          )}
          {state.status}
        </span>
      </div>

      {/* Streamer Settings Toggle Button */}
      {initialControls && (
        <button
          onClick={() => setDrawerOpen((prev) => !prev)}
          className="pointer-events-auto fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/80 text-white/90 shadow-xl backdrop-blur-md transition hover:scale-105 hover:bg-black hover:text-white"
          title="Overlay Settings (Press S)"
          aria-label="Toggle Overlay Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      )}

      {/* Settings Drawer */}
      {drawerOpen && (
        <div className="w-84 pointer-events-auto fixed bottom-16 right-4 z-50 rounded-xl border border-white/20 bg-zinc-950/95 p-5 text-white shadow-2xl backdrop-blur-xl transition-all">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <SlidersIcon className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold">Overlay Customizer</h3>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-4 text-xs">
            {/* Layout Picker */}
            <div>
              <label className="flex items-center gap-1.5 font-medium text-white/70">
                <LayoutTemplate className="h-3.5 w-3.5" /> Layout
              </label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "bottom", label: "Lower 3rd" },
                    { id: "top", label: "Top Bar" },
                    { id: "compact", label: "Corner Bug" },
                  ] as const
                ).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLayout(l.id)}
                    className={`rounded-md px-2 py-1.5 text-center font-medium transition ${
                      layout === l.id
                        ? "bg-primary text-primary-foreground shadow"
                        : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Picker */}
            <div>
              <label className="flex items-center gap-1.5 font-medium text-white/70">
                <Palette className="h-3.5 w-3.5" /> Theme
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: "dark", label: "Dark Glass" },
                    { id: "broadcast", label: "Broadcast Pro" },
                    { id: "emerald", label: "Club Emerald" },
                    { id: "minimal", label: "Minimal" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`rounded-md px-2 py-1.5 text-center font-medium transition ${
                      theme === t.id
                        ? "bg-primary text-primary-foreground shadow"
                        : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sponsor Banner Input */}
            <div>
              <label className="flex items-center gap-1.5 font-medium text-white/70">
                <Tag className="h-3.5 w-3.5" /> Sponsor / League Text
              </label>
              <input
                type="text"
                value={sponsor}
                onChange={(e) => setSponsor(e.target.value)}
                placeholder="e.g. Powered by Acme Corp"
                className="mt-1.5 w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-primary focus:outline-none"
              />
            </div>

            {/* Toggle Ball Chips */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-white/70">Show Ball-by-Ball Chips</span>
              <button
                onClick={() => setShowBalls((v) => !v)}
                className={`h-5 w-9 rounded-full transition-colors ${
                  showBalls ? "bg-emerald-500" : "bg-white/20"
                } relative`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    showBalls ? "left-4.5" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Copy OBS URL */}
            <div className="border-t border-white/10 pt-3">
              <button
                onClick={copyObsUrl}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 font-semibold text-white shadow-md transition hover:bg-emerald-500"
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
              <p className="mt-1.5 text-center text-[10px] text-white/40">
                1920×1080 · Shutdown when not visible
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* OVERLAY LAYOUTS                                           */}
      {/* ========================================================= */}

      {/* 1. COMPACT CORNER BUG LAYOUT */}
      {layout === "compact" && (
        <div
          className={`absolute bottom-6 left-6 w-[360px] overflow-hidden rounded-xl border ${themeStyle.box}`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-4 py-2 ${themeStyle.header}`}
          >
            <span className="truncate text-xs font-semibold">
              {state.title}
            </span>
            {sponsor && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                {sponsor}
              </span>
            )}
          </div>

          {isComplete ? (
            <div className="p-4 text-center">
              <p className="text-lg font-bold">{state.result_description}</p>
              {state.winning_team_name && (
                <p className="mt-1 text-sm text-emerald-400">
                  {state.winning_team_name}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider opacity-70">
                    {state.batting_team_short_name ?? state.batting_team_name}
                  </span>
                  <p className="mt-0.5 text-3xl font-black tabular-nums leading-none">
                    {state.total_runs ?? 0}/{state.total_wickets ?? 0}
                  </p>
                </div>
                <div className="text-right text-xs tabular-nums">
                  <p className="font-semibold opacity-90">
                    {oversText(state.total_balls)} / {state.overs_per_innings}{" "}
                    ov
                  </p>
                  <p className="opacity-60">
                    CRR {state.current_run_rate ?? "—"}
                  </p>
                </div>
              </div>

              {/* Target or RRR */}
              {state.target_runs !== null && (
                <div className="flex justify-between rounded bg-white/5 px-2.5 py-1 text-xs font-semibold text-amber-300">
                  <span>Target {state.target_runs}</span>
                  <span>
                    Need {state.runs_needed} off {state.balls_remaining}
                  </span>
                </div>
              )}

              {/* Striker & Bowler */}
              <div className="space-y-1 border-t border-white/10 pt-2 text-xs">
                {state.striker_name && (
                  <div className="flex justify-between">
                    <span className="max-w-[180px] truncate font-medium">
                      {state.striker_name} *
                    </span>
                    <span className="font-semibold tabular-nums">
                      {state.striker_runs ?? 0} ({state.striker_balls ?? 0})
                    </span>
                  </div>
                )}
                {state.current_bowler_name && (
                  <div className="flex justify-between text-white/70">
                    <span className="max-w-[180px] truncate">
                      {state.current_bowler_name}
                    </span>
                    <span className="tabular-nums">
                      {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0} (
                      {oversText(state.bowler_balls)})
                    </span>
                  </div>
                )}
              </div>

              {/* This over balls */}
              {showBalls && thisOverBalls.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto pt-1">
                  {thisOverBalls.map((b, idx) => (
                    <BallChip key={idx} label={b} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. TOP TICKER LAYOUT */}
      {layout === "top" && (
        <div
          className={`absolute left-1/2 top-5 w-full max-w-4xl -translate-x-1/2 overflow-hidden rounded-xl border ${themeStyle.box}`}
        >
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider opacity-60">
                  {state.batting_team_short_name ?? state.batting_team_name}
                </span>
                <p className="text-2xl font-black tabular-nums leading-none">
                  {state.total_runs ?? 0}/{state.total_wickets ?? 0}
                </p>
              </div>
              <div className="border-l border-white/15 pl-3 text-xs tabular-nums opacity-75">
                <p>{oversText(state.total_balls)} ov</p>
                <p className="text-[10px]">
                  CRR {state.current_run_rate ?? "—"}
                </p>
              </div>
            </div>

            {/* Striker & Bowler */}
            <div className="flex items-center gap-5 text-xs">
              {state.striker_name && (
                <div>
                  <span className="text-xs font-semibold">
                    {state.striker_name} *
                  </span>
                  <p className="text-[11px] tabular-nums opacity-75">
                    {state.striker_runs ?? 0} ({state.striker_balls ?? 0})
                  </p>
                </div>
              )}
              {state.current_bowler_name && (
                <div className="border-l border-white/15 pl-4">
                  <span className="text-xs font-semibold">
                    {state.current_bowler_name}
                  </span>
                  <p className="text-[11px] tabular-nums opacity-75">
                    {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0} (
                    {oversText(state.bowler_balls)})
                  </p>
                </div>
              )}
            </div>

            {/* This over */}
            {showBalls && (
              <div className="hidden items-center gap-1 sm:flex">
                {thisOverBalls.slice(-6).map((b, idx) => (
                  <BallChip key={idx} label={b} />
                ))}
              </div>
            )}

            {/* Target or sponsor */}
            <div className="text-right">
              {state.target_runs !== null ? (
                <div className="text-right">
                  <p className="text-xs font-bold tabular-nums text-amber-400">
                    Need {state.runs_needed} off {state.balls_remaining}
                  </p>
                  <p className="text-[10px] opacity-60">
                    RRR {state.required_run_rate ?? "—"}
                  </p>
                </div>
              ) : sponsor ? (
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {sponsor}
                </span>
              ) : (
                <span className="text-xs opacity-50">{state.match_format}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. LOWER-THIRD BANNER LAYOUT (DEFAULT) */}
      {layout === "bottom" && (
        <div
          className={`absolute bottom-6 left-1/2 w-full max-w-3xl -translate-x-1/2 overflow-hidden rounded-xl border ${themeStyle.box}`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-5 py-2.5 ${themeStyle.header}`}
          >
            <span
              className={`truncate text-sm font-semibold ${themeStyle.headerText}`}
            >
              {state.title}
            </span>
            <div className="flex items-center gap-3">
              {sponsor && (
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {sponsor}
                </span>
              )}
              <span className="ml-2 shrink-0 text-xs uppercase tracking-wider opacity-60">
                {state.match_format} · {state.venue}
              </span>
            </div>
          </div>

          {isComplete ? (
            <div className="px-5 py-8 text-center">
              <p className="text-3xl font-bold">{state.result_description}</p>
              {state.winning_team_name && (
                <p className="mt-2 text-lg text-emerald-400">
                  {state.winning_team_name}
                </p>
              )}
              <p className="mt-3 text-sm tabular-nums opacity-60">
                {state.team1_short_name} vs {state.team2_short_name}
              </p>
            </div>
          ) : (
            <>
              {/* Score row */}
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-wider opacity-60">
                    {state.batting_team_short_name ?? state.batting_team_name} ·{" "}
                    {state.innings_number === 2 ? "2nd" : "1st"} inn
                  </p>
                  <p className="mt-0.5 text-4xl font-bold tabular-nums leading-none">
                    {state.total_runs ?? 0}/{state.total_wickets ?? 0}
                  </p>
                  <p className="mt-1 text-sm tabular-nums opacity-70">
                    ({oversText(state.total_balls)} / {state.overs_per_innings}{" "}
                    ov) · CRR{" "}
                    <span className="font-semibold tabular-nums">
                      {state.current_run_rate ?? "—"}
                    </span>
                  </p>
                </div>

                <div className="justify-self-center text-center">
                  {showBalls && (
                    <>
                      <p className="text-[11px] uppercase tracking-widest opacity-50">
                        This over
                      </p>
                      <div className="mt-1.5 flex gap-1.5">
                        {thisOverBalls.length > 0 ? (
                          thisOverBalls.map((b, idx) => (
                            <BallChip key={idx} label={b} />
                          ))
                        ) : (
                          <span className="text-xs opacity-40">—</span>
                        )}
                      </div>
                    </>
                  )}
                  {state.partnership_runs !== null &&
                    state.partnership_runs > 0 && (
                      <p className="mt-2 text-xs tabular-nums opacity-60">
                        P&apos;ship {state.partnership_runs} (
                        {oversText(state.partnership_balls)})
                      </p>
                    )}
                </div>

                <div className="justify-self-end text-right">
                  {state.target_runs !== null ? (
                    <>
                      <p className="text-[11px] uppercase tracking-widest opacity-50">
                        Target {state.target_runs}
                      </p>
                      <p className="mt-0.5 text-xl font-bold tabular-nums text-amber-400">
                        Need {state.runs_needed} off {state.balls_remaining}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums opacity-70">
                        RRR {state.required_run_rate ?? "—"}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm opacity-60">
                      {state.bowling_team_short_name ?? state.bowling_team_name}
                    </p>
                  )}
                </div>
              </div>

              {/* Players row */}
              <div className="flex items-stretch justify-between border-t border-white/10 text-sm">
                <div className="flex divide-x divide-white/10">
                  {[
                    {
                      name: state.striker_name,
                      runs: state.striker_runs,
                      balls: state.striker_balls,
                      onStrike: true,
                    },
                    {
                      name: state.non_striker_name,
                      runs: state.non_striker_runs,
                      balls: state.non_striker_balls,
                      onStrike: false,
                    },
                  ].map(
                    (b, idx) =>
                      b.name && (
                        <div key={idx} className="px-5 py-2.5">
                          <p className="font-medium opacity-90">
                            {b.name}
                            {b.onStrike && (
                              <span className={`ml-1 ${themeStyle.strikeStar}`}>
                                *
                              </span>
                            )}
                          </p>
                          <p className="text-xs tabular-nums opacity-60">
                            {b.runs ?? 0} ({b.balls ?? 0})
                          </p>
                        </div>
                      ),
                  )}
                </div>

                {state.current_bowler_name && (
                  <div className="px-5 py-2.5 text-right">
                    <p className="font-medium opacity-90">
                      {state.current_bowler_name}
                    </p>
                    <p className="text-xs tabular-nums opacity-60">
                      {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0} (
                      {oversText(state.bowler_balls)})
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SlidersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="1" x2="7" y1="14" y2="14" />
      <line x1="9" x2="15" y1="8" y2="8" />
      <line x1="17" x2="23" y1="16" y2="16" />
    </svg>
  );
}
