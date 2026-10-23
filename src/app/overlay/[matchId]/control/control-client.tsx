"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";
import {
  AUTO_RULE_IDS,
  AUTO_RULE_LABELS,
} from "~/components/overlay/auto-graphics";
import {
  BROADCAST_VIEW_OPTIONS,
  broadcastViewAvailable,
} from "~/components/overlay/broadcast-suite-overlay";
import { strapAvailable } from "~/components/overlay/lower-third-straps";
import { useStageMatch } from "~/components/overlay/overlay-data";
import { OverlayPreview } from "~/components/overlay/overlay-preview";
import {
  OVERLAY_THEMES,
  resolveOverlayTheme,
} from "~/components/overlay/overlay-themes";
import { presentationCardUnavailable } from "~/components/overlay/presentation-cards";
import type {
  ActiveLowerThirdStrap,
  BroadcastViewId,
  LiveMatchState,
  OverlaySnapshots,
  PresentationCardType,
} from "~/components/overlay/types";
import {
  useOverlayProducer,
  type CommandRecord,
  type OverlayCommand,
} from "~/components/overlay/use-overlay-producer";
import { useOverlayLayers } from "~/components/overlay/use-overlay-state";
import { useLiveState } from "~/lib/hooks/useLiveState";
import type { Match } from "~/lib/match-types";
import {
  automaticRules,
  autoRulesIn,
  isReplayRule,
  manualAutoRules,
  type HoldMode,
  type SceneLayout,
} from "~/lib/overlay-state";
import { getOverlaySnapshots } from "~/app/overlay/snapshot-actions";
import { cn } from "~/lib/utils";
import { ChannelPicker } from "~/components/streaming/channel-picker";
import { RemoteControlPanel } from "~/components/streaming/remote-control-panel";
import { DEMO_MATCH_DETAILS, DEMO_MATCH_STATE } from "../demo-data";

interface ControlClientProps {
  matchId: string;
  initialState: LiveMatchState | null;
  initialMatch: Match | null;
  /** Server clock when the page was rendered (ms). */
  serverNow?: number;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StingType = NonNullable<OverlayCommand["stingType"]>;

const EVENT_CARDS: Array<{ type: StingType; label: string; key: string }> = [
  { type: "four", label: "Four", key: "4" },
  { type: "six", label: "Six", key: "6" },
  { type: "wicket", label: "Wicket", key: "W" },
  { type: "milestone", label: "Fifty / hundred", key: "M" },
  { type: "free_hit", label: "Free hit", key: "F" },
];

const STRAPS: Array<{
  type: ActiveLowerThirdStrap["type"];
  label: string;
  hint: string;
  key: string;
}> = [
  {
    type: "batsman",
    label: "Striker",
    hint: "Runs, balls, strike rate",
    key: "B",
  },
  { type: "bowler", label: "Bowler", hint: "Wickets, runs, economy", key: "O" },
  {
    type: "partnership",
    label: "Partnership",
    hint: "The stand so far",
    key: "P",
  },
  { type: "target", label: "Chase", hint: "Runs needed from balls", key: "T" },
  {
    type: "last_wicket",
    label: "Last wicket",
    hint: "Who went, how, for what",
    key: "L",
  },
  {
    type: "win_predictor",
    label: "Win predictor",
    hint: "An estimate, labelled as one",
    key: "E",
  },
  {
    type: "commentary",
    label: "Commentary",
    hint: "The scorer's note on the last ball",
    key: "C",
  },
  { type: "powerplay", label: "Powerplay", hint: "While it is on", key: "Y" },
];

const NOTICES: Array<{
  type: ActiveLowerThirdStrap["type"];
  label: string;
  text: string;
}> = [
  { type: "drinks", label: "Drinks break", text: "Drinks break" },
  { type: "rain_delay", label: "Rain delay", text: "Rain has stopped play" },
  { type: "innings_break", label: "Innings break", text: "Innings break" },
  { type: "timeout", label: "Time out", text: "Time out" },
];

const CARDS: Array<{ id: PresentationCardType; label: string }> = [
  { id: "toss", label: "Toss" },
  { id: "playing_xi", label: "Playing XI" },
  { id: "scorecard", label: "Scorecard" },
  { id: "partnership", label: "Partnership" },
  { id: "over_summary", label: "This over" },
  { id: "result", label: "Result" },
];

const LAYOUTS: Array<{ id: SceneLayout; label: string }> = [
  { id: "bottom", label: "Bottom bar" },
  { id: "top", label: "Top bar" },
  { id: "compact", label: "Corner" },
];

/** The graphics-suite views by what they show. */
const VIEW_GROUPS: Array<{ title: string; views: BroadcastViewId[] }> = [
  { title: "Scorecards", views: ["2", "3", "4", "5", "8", "14"] },
  { title: "This innings", views: ["16", "17", "18", "19", "23", "40"] },
  { title: "Careers", views: ["24", "25", "26", "27"] },
  {
    title: "Tournament",
    views: ["20", "43", "44", "36", "37", "38", "39"],
  },
  { title: "Charts", views: ["21", "22", "41", "42"] },
  { title: "Breaks", views: ["13", "15", "28", "29"] },
];

const viewLabel = (id: BroadcastViewId) =>
  BROADCAST_VIEW_OPTIONS.find((o) => o.id === id)?.label ?? id;

const MESSAGE_STYLES: Array<{
  id: "strap" | "single" | "double" | "baseline";
  label: string;
}> = [
  { id: "strap", label: "Lower third" },
  { id: "single", label: "In place of the score bar" },
  { id: "double", label: "Title and text card" },
  { id: "baseline", label: "Thin line under the score" },
];

const HOLDS: Array<{ id: HoldMode; label: string; hint: string }> = [
  { id: "card", label: "Holding line", hint: "Says the score is being updated" },
  { id: "clean", label: "Clean", hint: "No graphics at all" },
  { id: "black", label: "Black", hint: "Covers the picture" },
];

const RULE_SECONDS = [3, 4, 5, 6, 8, 10, 15, 20, 30, 45];

const STRAP_SECONDS = [5, 8, 10, 15];

function oversText(balls: number | null | undefined): string {
  if (!balls) return "0.0";
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function Panel({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "rounded-xl border border-white/10 bg-[#0e131d] p-4",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={id} className="text-base font-semibold text-white">
          {title}
        </h2>
        {hint && <p className="text-sm text-slate-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40";
const QUIET = `${BUTTON} border-white/10 bg-white/5 text-slate-100 hover:bg-white/10`;
const ON_AIR = `${BUTTON} border-red-500/60 bg-red-500/15 text-white`;
const SELECTED = `${BUTTON} border-white/70 bg-white/15 text-white`;
const PRIMARY = `${BUTTON} border-white bg-white text-black hover:bg-white/90`;

/** The latest command's fate, read out to screen readers too. */
function CommandStatusLine({
  last,
  listening,
  onRetry,
}: {
  last: CommandRecord | null;
  listening: boolean;
  onRetry: () => void;
}) {
  let body: React.ReactNode = (
    <span className="text-slate-400">
      Nothing sent yet. What you send shows in the preview once the overlay has
      it.
    </span>
  );
  if (last?.status === "sending") {
    body = (
      <span className="flex items-center gap-2 text-slate-200">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        Sending: {last.label}
      </span>
    );
  } else if (last?.status === "sent") {
    body = (
      <span className="flex items-center gap-2 text-slate-200">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Sent: {last.label}.{" "}
        {listening
          ? "Waiting for the overlay to confirm."
          : "This page has lost its connection, so it cannot confirm."}
      </span>
    );
  } else if (last?.status === "on_air") {
    body = (
      <span className="flex items-center gap-2 text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        On air: {last.label}
      </span>
    );
  } else if (last?.status === "failed") {
    body = (
      <span className="flex flex-wrap items-center gap-2 text-red-300">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        Not sent: {last.label}. {last.message}
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-red-400/40 px-2 py-1 text-sm text-white hover:bg-red-500/20"
        >
          Try again
        </button>
      </span>
    );
  }
  return (
    <div
      role="status"
      aria-label="Last command"
      aria-live="polite"
      className="rounded-lg bg-black/40 px-3 py-2 text-sm"
    >
      {body}
    </div>
  );
}

function AutoRuleRow({
  id,
  label,
  rule,
  onChange,
}: {
  id: string;
  label: string;
  rule: { on: boolean; seconds: number };
  onChange: (change: { on?: boolean; seconds?: number }) => void;
}) {
  const secondsId = useId();
  return (
    <li className="flex min-h-10 items-center justify-between gap-2 text-sm text-slate-200">
      <label className="flex min-w-0 items-center gap-2">
        <input
          type="checkbox"
          checked={rule.on}
          onChange={(e) => onChange({ on: e.target.checked })}
          className="h-4 w-4 accent-white"
          data-rule={id}
        />
        <span className="truncate">{label}</span>
      </label>
      <label htmlFor={secondsId} className="sr-only">
        {label}: seconds on air
      </label>
      <select
        id={secondsId}
        value={rule.seconds}
        onChange={(e) => onChange({ seconds: Number(e.target.value) })}
        className="min-h-9 rounded-lg border border-white/10 bg-slate-900 px-1.5 text-sm text-white"
      >
        {[...new Set([...RULE_SECONDS, rule.seconds])]
          .sort((a, b) => a - b)
          .map((sec) => (
            <option key={sec} value={sec}>
              {sec} s
            </option>
          ))}
      </select>
    </li>
  );
}

export function ControlClient({
  matchId,
  initialState,
  initialMatch,
  serverNow,
}: ControlClientProps) {
  const isDemo = matchId === "test";
  const isRealMatch = UUID_REGEX.test(matchId);
  const [demoState, setDemoState] = useState<LiveMatchState | null>(
    isDemo ? (initialState ?? DEMO_MATCH_STATE) : null,
  );
  const pageMatch = initialMatch ?? (isDemo ? DEMO_MATCH_DETAILS : null);

  // Live score: one listener on live_state/{matchId} (1 read per change).
  // Once the match is over it stops; the producer can resume it (e.g.
  // after a scorer undoes the final ball).
  const [resumeLive, setResumeLive] = useState(false);
  const [lastState, setLastState] = useState<LiveMatchState | null>(
    initialState,
  );
  const isFinished =
    lastState?.status === "completed" || lastState?.status === "abandoned";
  const live = useLiveState(matchId, {
    enabled: isRealMatch && (!isFinished || resumeLive),
    pauseWhenHidden: false,
  });
  if (live.state && live.state !== lastState) setLastState(live.state);
  const state: LiveMatchState =
    (isDemo ? demoState : (live.state ?? lastState)) ?? DEMO_MATCH_STATE;

  // What is on air: the overlay state (one listener), as the overlay sees it.
  const producer = useOverlayProducer(matchId, isDemo);
  const { doc, send, last } = producer;
  const layers = useOverlayLayers({
    doc,
    loaded: producer.loaded,
    state,
    serverNow,
    muted: true,
  });
  const { scene } = layers;
  const listening = producer.status === "connected";
  // Scorecards in the preview follow the live scorecard, as on air.
  const match = useStageMatch(matchId, pageMatch, {
    view: layers.view,
    card: layers.card,
  });
  const snapshots: OverlaySnapshots | null = layers.snapshots ?? null;
  const viewOk = (id: BroadcastViewId) =>
    broadcastViewAvailable(id, { state, match, snapshots });

  const [strapSeconds, setStrapSeconds] = useState(8);
  const [noticeText, setNoticeText] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [noticeStyle, setNoticeStyle] =
    useState<(typeof MESSAGE_STYLES)[number]["id"]>("strap");
  const [replayScene, setReplayScene] = useState(scene.replayScene);
  const [snapshotNote, setSnapshotNote] = useState<string | null>(null);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [sponsorText, setSponsorText] = useState(scene.sponsor);
  const [tickerText, setTickerText] = useState(scene.tickerText);
  const [sponsorsText, setSponsorsText] = useState(
    scene.sponsors.map((s) => s.name).join("\n"),
  );
  const [volume, setVolume] = useState(Math.round(scene.volume * 100));
  // The forms start from what is stored, once it has been read.
  const [formsLoaded, setFormsLoaded] = useState(false);
  if (producer.loaded && !formsLoaded) {
    setFormsLoaded(true);
    setSponsorText(scene.sponsor);
    setTickerText(scene.tickerText);
    setSponsorsText(scene.sponsors.map((s) => s.name).join("\n"));
    setVolume(Math.round(scene.volume * 100));
    setReplayScene(scene.replayScene);
  }

  // ---- commands ----
  const showSting = useCallback(
    (type: StingType) => {
      const label = EVENT_CARDS.find((c) => c.type === type)?.label ?? type;
      void send(
        { type: "TRIGGER_STING", stingType: type },
        `Event card: ${label}`,
      );
    },
    [send],
  );

  const showStrap = useCallback(
    (
      type: ActiveLowerThirdStrap["type"],
      label: string,
      text?: string,
      extra: Partial<ActiveLowerThirdStrap> = {},
    ) => {
      const strap: ActiveLowerThirdStrap = {
        id: `strap-${type}-${Date.now()}`,
        type,
        title: "",
        durationMs: strapSeconds * 1000,
        ...extra,
      };
      if (type === "custom") {
        strap.badge = "Notice";
        strap.title = text ?? "";
      }
      if (type === "message") strap.title = text ?? "";
      void send({ type: "SHOW_STRAP", strap }, `Lower third: ${label}`);
    },
    [send, strapSeconds],
  );

  const showView = (id: BroadcastViewId) => {
    if (layers.view === id) {
      void send(
        { type: "SET_BROADCAST_VIEW", broadcastView: null },
        "Back to the score bug",
      );
    } else {
      void send(
        { type: "SET_BROADCAST_VIEW", broadcastView: id },
        `Graphic: ${viewLabel(id)}`,
      );
    }
  };

  const loadSnapshots = async () => {
    setLoadingSnapshots(true);
    setSnapshotNote(null);
    const res = await getOverlaySnapshots(matchId);
    setLoadingSnapshots(false);
    if (res.error !== null) {
      setSnapshotNote(res.error);
      return;
    }
    const parts = [
      res.data.pointsTable && "points table",
      res.data.leaderboard && "leaders",
      res.data.nextFixture && "next match",
      res.data.series && "players' figures",
    ].filter(Boolean);
    setSnapshotNote(
      parts.length ? `Loaded: ${parts.join(", ")}` : "No tournament data yet",
    );
    void send(
      { type: "SET_SNAPSHOTS", snapshots: res.data },
      "Tournament data for the graphics",
    );
  };

  const clearAll = useCallback(() => {
    void send({ type: "PANIC_CLEAR" }, "Cleared graphics, score bug only");
  }, [send]);

  const toggleCard = (id: PresentationCardType, label: string) => {
    if (scene.card === id) {
      void send({ type: "HIDE_CARD" }, `Took off: ${label}`);
    } else {
      void send({ type: "SHOW_CARD", card: id }, `Card: ${label}`);
    }
  };

  // Keyboard shortcuts for whoever runs the graphics from a laptop.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable ||
        target?.closest("[role=dialog]")
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "escape") {
        e.preventDefault();
        clearAll();
        return;
      }
      const sting = EVENT_CARDS.find((c) => c.key.toLowerCase() === key);
      if (sting) {
        e.preventDefault();
        showSting(sting.type);
        return;
      }
      const strap = STRAPS.find((s) => s.key.toLowerCase() === key);
      if (strap && strapAvailable(strap.type, stateRef.current)) {
        e.preventDefault();
        showStrap(strap.type, strap.label);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearAll, showSting, showStrap]);

  // ---- what is on air, in words ----
  const cardOnAir = CARDS.find((c) => c.id === layers.card);
  const strapOnAir = layers.strap;
  const strapLabel = strapOnAir
    ? strapOnAir.type === "custom"
      ? strapOnAir.title || "Notice"
      : (STRAPS.find((s) => s.type === strapOnAir.type)?.label ??
        NOTICES.find((n) => n.type === strapOnAir.type)?.label ??
        "Lower third")
    : null;
  const mainOnAir = !scene.showBug
    ? "Score bug hidden"
    : layers.view
      ? viewLabel(layers.view)
      : `Score bug (${LAYOUTS.find((l) => l.id === scene.layout)?.label.toLowerCase()})`;

  const rules = autoRulesIn(doc);
  const graphicRules = AUTO_RULE_IDS.filter((id) => !isReplayRule(id));
  const replayRules = AUTO_RULE_IDS.filter(isReplayRule);
  const allAuto = graphicRules.every((id) => rules[id]?.on);
  const noneAuto = graphicRules.every((id) => !rules[id]?.on);
  const setRule = (id: string, change: { on?: boolean; seconds?: number }) =>
    void send(
      {
        type: "SET_AUTO",
        auto: { ...rules, [id]: { ...rules[id]!, ...change } },
      },
      `${AUTO_RULE_LABELS[id as keyof typeof AUTO_RULE_LABELS] ?? id}: ${
        change.on === undefined
          ? `${change.seconds} seconds`
          : change.on
            ? "automatic"
            : "manual"
      }`,
    );
  const theme = resolveOverlayTheme(scene.theme);

  const team1 = state.team1_name ?? state.team1_short_name ?? "Team 1";
  const team2 = state.team2_name ?? state.team2_short_name ?? "Team 2";
  const ids = {
    notice: useId(),
    noticeBody: useId(),
    noticeStyle: useId(),
    replayScene: useId(),
    sponsor: useId(),
    sponsors: useId(),
    ticker: useId(),
    strapSeconds: useId(),
    lift: useId(),
    volume: useId(),
    primary: useId(),
    accent: useId(),
  };

  const simulate = (runs: number, wicket = false) =>
    setDemoState((prev) => {
      const s = prev ?? DEMO_MATCH_STATE;
      const balls = (s.total_balls ?? 0) + 1;
      return {
        ...s,
        total_runs: (s.total_runs ?? 0) + runs,
        total_wickets: (s.total_wickets ?? 0) + (wicket ? 1 : 0),
        total_balls: balls,
        striker_runs: wicket ? s.striker_runs : (s.striker_runs ?? 0) + runs,
        striker_balls: (s.striker_balls ?? 0) + 1,
        last_ball_runs: runs,
        last_ball_is_wicket: wicket,
        last_ball_dismissed_player: wicket ? s.striker_name : null,
        last_ball_seq: (s.last_ball_seq ?? 0) + 1,
        runs_needed:
          s.runs_needed !== null ? Math.max(0, s.runs_needed - runs) : null,
        balls_remaining:
          s.balls_remaining !== null
            ? Math.max(0, s.balls_remaining - 1)
            : null,
      };
    });

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#080c14] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0f18]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={isRealMatch ? `/matches/${matchId}` : "/"}
              aria-label="Back to the match"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-white [text-wrap:balance]">
                Control room
              </h1>
              <p className="truncate text-sm text-slate-400">
                {team1} v {team2}
                <span className="ml-2 font-score tabular-nums text-slate-200">
                  {state.total_runs ?? 0}/{state.total_wickets ?? 0} (
                  {oversText(state.total_balls)} ov)
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm",
                listening
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-amber-500/15 text-amber-200",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 rounded-full",
                  listening ? "bg-emerald-400" : "bg-amber-400",
                )}
              />
              {listening
                ? "Connected"
                : producer.status === "error"
                  ? "Connection lost, retrying"
                  : "Connecting…"}
            </span>
            {isRealMatch && isFinished && !resumeLive && (
              <button
                type="button"
                onClick={() => setResumeLive(true)}
                className={QUIET}
                title="Live updates stop when the match ends"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Resume live updates
              </button>
            )}
            {isRealMatch && (
              <Link href={`/matches/${matchId}/stream`} className={QUIET}>
                Stream setup
              </Link>
            )}
            <a
              href={`/overlay/${matchId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={QUIET}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open overlay
            </a>
            <button
              type="button"
              onClick={clearAll}
              className={`${BUTTON} border-red-500 bg-red-600 text-white hover:bg-red-500`}
              title="Takes off every card and lower third (Esc)"
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Clear graphics
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-7">
          <Panel
            title="On air"
            hint="The overlay as your viewers see it, over the camera."
          >
            <OverlayPreview
              state={state}
              match={match}
              layers={layers}
              label="Preview of the overlay on air"
            />
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-black/30 px-3">
                <span className="min-w-0 truncate">
                  <span className="text-slate-400">Main: </span>
                  {mainOnAir}
                </span>
                {layers.view && (
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-slate-200 underline-offset-2 hover:underline"
                    onClick={() =>
                      void send(
                        { type: "SET_BROADCAST_VIEW", broadcastView: null },
                        "Back to the score bug",
                      )
                    }
                  >
                    Back to score bug
                  </button>
                )}
              </li>
              {cardOnAir && (
                <li className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-red-500/10 px-3">
                  <span className="min-w-0 truncate">
                    <span className="text-slate-400">Card: </span>
                    {cardOnAir.label}
                  </span>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-white underline-offset-2 hover:underline"
                    onClick={() =>
                      void send(
                        { type: "HIDE_CARD" },
                        `Took off: ${cardOnAir.label}`,
                      )
                    }
                  >
                    Take off
                  </button>
                </li>
              )}
              {strapLabel && (
                <li className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-red-500/10 px-3">
                  <span className="min-w-0 truncate">
                    <span className="text-slate-400">Lower third: </span>
                    {strapLabel}
                  </span>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-white underline-offset-2 hover:underline"
                    onClick={() =>
                      void send(
                        { type: "HIDE_STRAP" },
                        "Took off the lower third",
                      )
                    }
                  >
                    Take off
                  </button>
                </li>
              )}
            </ul>
            <div className="mt-3">
              <CommandStatusLine
                last={last}
                listening={listening}
                onRetry={producer.retry}
              />
            </div>
          </Panel>

          <Panel
            title="Event cards"
            hint={
              allAuto
                ? "These also show by themselves after each ball."
                : "Shown for a few seconds in the middle of the frame."
            }
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {EVENT_CARDS.map((c) => (
                <button
                  key={c.type}
                  type="button"
                  onClick={() => showSting(c.type)}
                  className={cn(
                    QUIET,
                    "relative",
                    c.type === "free_hit" && "col-span-2 sm:col-span-1",
                  )}
                  aria-keyshortcuts={c.key}
                >
                  {c.label}
                  <kbd className="absolute right-1.5 top-1 hidden font-mono text-xs text-slate-500 sm:inline">
                    {c.key}
                  </kbd>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Lower thirds" hint="A strip above the score bug.">
            <div className="mb-3 flex items-center gap-2 text-sm">
              <label htmlFor={ids.strapSeconds} className="text-slate-300">
                Show for
              </label>
              <select
                id={ids.strapSeconds}
                value={strapSeconds}
                onChange={(e) => setStrapSeconds(Number(e.target.value))}
                className="min-h-10 rounded-lg border border-white/10 bg-slate-900 px-2 text-sm text-white"
              >
                {STRAP_SECONDS.map((s) => (
                  <option key={s} value={s}>
                    {s} seconds
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STRAPS.map((s) => (
                <button
                  key={s.type}
                  type="button"
                  disabled={!strapAvailable(s.type, state)}
                  onClick={() => showStrap(s.type, s.label)}
                  className={cn(QUIET, "flex-col items-start text-left")}
                  aria-keyshortcuts={s.key}
                >
                  <span className="flex w-full items-center justify-between">
                    {s.label}
                    <kbd className="hidden font-mono text-xs text-slate-500 sm:inline">
                      {s.key}
                    </kbd>
                  </span>
                  <span className="text-xs font-normal text-slate-400">
                    {s.hint}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {NOTICES.map((n) => (
                <button
                  key={n.type}
                  type="button"
                  onClick={() => showStrap(n.type, n.label)}
                  className={QUIET}
                >
                  {n.label}
                </button>
              ))}
            </div>
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = noticeText.trim();
                if (!text) return;
                if (noticeStyle === "strap") {
                  showStrap("custom", `Notice "${text}"`, text);
                } else {
                  showStrap("message", `Message "${text}"`, text, {
                    form: noticeStyle,
                    ...(noticeStyle === "double" && noticeBody.trim()
                      ? { subtitle: noticeBody.trim() }
                      : {}),
                  });
                }
                setNoticeText("");
                setNoticeBody("");
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <label htmlFor={ids.notice} className="sr-only">
                  Your own notice
                </label>
                <input
                  id={ids.notice}
                  value={noticeText}
                  onChange={(e) => setNoticeText(e.target.value)}
                  maxLength={120}
                  placeholder="Your own notice, e.g. Play resumes at 3:30"
                  className="min-h-11 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-base text-white placeholder:text-slate-500 focus:border-white/40 focus:outline-none sm:text-sm"
                />
                <button
                  type="submit"
                  className={`${PRIMARY} shrink-0 whitespace-nowrap`}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Show notice
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label htmlFor={ids.noticeStyle} className="text-slate-300">
                  Shown as
                </label>
                <select
                  id={ids.noticeStyle}
                  value={noticeStyle}
                  onChange={(e) =>
                    setNoticeStyle(
                      e.target.value as (typeof MESSAGE_STYLES)[number]["id"],
                    )
                  }
                  className="min-h-10 rounded-lg border border-white/10 bg-slate-900 px-2 text-sm text-white"
                >
                  {MESSAGE_STYLES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              {noticeStyle === "double" && (
                <>
                  <label htmlFor={ids.noticeBody} className="sr-only">
                    Card text
                  </label>
                  <textarea
                    id={ids.noticeBody}
                    rows={2}
                    value={noticeBody}
                    maxLength={200}
                    onChange={(e) => setNoticeBody(e.target.value)}
                    placeholder="The card's text, under the title"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-base text-white placeholder:text-slate-500 sm:text-sm"
                  />
                </>
              )}
            </form>
          </Panel>

          {isDemo && (
            <Panel
              title="Practice match"
              hint="Changes the score on this page only."
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={QUIET}
                  onClick={() => simulate(1)}
                >
                  Add a single
                </button>
                <button
                  type="button"
                  className={QUIET}
                  onClick={() => simulate(4)}
                >
                  Add a four
                </button>
                <button
                  type="button"
                  className={QUIET}
                  onClick={() => simulate(6)}
                >
                  Add a six
                </button>
                <button
                  type="button"
                  className={QUIET}
                  onClick={() => simulate(0, true)}
                >
                  Add a wicket
                </button>
                <button
                  type="button"
                  className={QUIET}
                  onClick={() => setDemoState(DEMO_MATCH_STATE)}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Reset
                </button>
              </div>
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5">
          <Panel
            title="Full-screen cards"
            hint="Stay up until you take them off."
          >
            <div className="grid grid-cols-2 gap-2">
              {CARDS.map((c) => {
                const why = presentationCardUnavailable(c.id, state, match);
                const onAir = scene.card === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!onAir && why !== null}
                    aria-pressed={onAir}
                    onClick={() => toggleCard(c.id, c.label)}
                    className={cn(
                      onAir ? ON_AIR : QUIET,
                      "flex-col items-start text-left",
                    )}
                  >
                    <span>{c.label}</span>
                    <span className="text-xs font-normal text-slate-400">
                      {onAir ? "On air: tap to take off" : (why ?? "Ready")}
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="Graphics"
            hint="Full-screen and lower-third graphics; one at a time. Greyed out until there is data for them."
          >
            <div className="space-y-3">
              {VIEW_GROUPS.map((g) => (
                <fieldset key={g.title}>
                  <legend className="mb-1.5 text-sm text-slate-400">
                    {g.title}
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {g.views.map((id) => {
                      const onAir = layers.view === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={!onAir && !viewOk(id)}
                          aria-pressed={onAir}
                          onClick={() => showView(id)}
                          className={cn(onAir ? ON_AIR : QUIET, "text-left")}
                        >
                          {viewLabel(id)}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
            {isRealMatch && (
              <div className="mt-3 space-y-1 text-sm">
                <button
                  type="button"
                  className={QUIET}
                  disabled={loadingSnapshots}
                  onClick={() => void loadSnapshots()}
                >
                  {loadingSnapshots && (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  Load tournament data
                </button>
                <p className="text-slate-400" role="status">
                  {snapshotNote ??
                    "Points table, leaders, next match and players' tournament figures."}
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Automatic graphics">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={allAuto}
                className={allAuto ? SELECTED : QUIET}
                onClick={() =>
                  void send(
                    { type: "SET_AUTO", auto: automaticRules(rules) },
                    "Automatic graphics on",
                  )
                }
              >
                Automatic
              </button>
              <button
                type="button"
                aria-pressed={noneAuto}
                className={noneAuto ? SELECTED : QUIET}
                onClick={() =>
                  void send(
                    { type: "SET_AUTO", auto: manualAutoRules(rules) },
                    "Automatic graphics off",
                  )
                }
              >
                I&apos;ll run them
              </button>
            </div>
            <fieldset className="mt-3">
              <legend className="mb-2 text-sm text-slate-400">
                Show by themselves, for
              </legend>
              <ul className="space-y-1">
                {graphicRules.map((id) => (
                  <AutoRuleRow
                    key={id}
                    id={id}
                    label={AUTO_RULE_LABELS[id]}
                    rule={rules[id]!}
                    onChange={(change) => setRule(id, change)}
                  />
                ))}
              </ul>
            </fieldset>
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm text-slate-400">
                Replays through OBS (see Stream setup, Replays)
              </legend>
              <ul className="space-y-1">
                {replayRules.map((id) => (
                  <AutoRuleRow
                    key={id}
                    id={id}
                    label={AUTO_RULE_LABELS[id]}
                    rule={rules[id]!}
                    onChange={(change) => setRule(id, change)}
                  />
                ))}
              </ul>
              <form
                className="mt-2 flex flex-wrap items-center gap-2 text-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(
                    { type: "SET_REPLAY_SCENE", replayScene },
                    replayScene.trim()
                      ? `Replay scene: ${replayScene.trim()}`
                      : "Replays: save clips only",
                  );
                }}
              >
                <label htmlFor={ids.replayScene} className="text-slate-300">
                  OBS replay scene
                </label>
                <input
                  id={ids.replayScene}
                  value={replayScene}
                  maxLength={80}
                  onChange={(e) => setReplayScene(e.target.value)}
                  placeholder="Replay"
                  autoCorrect="off"
                  className="min-h-10 w-40 rounded-lg border border-white/10 bg-black/40 px-3 text-base text-white sm:text-sm"
                />
                <button type="submit" className={QUIET}>
                  Save
                </button>
              </form>
            </fieldset>
          </Panel>

          <Panel
            title="Hold"
            hint="While a score is corrected: the graphics keep the score they had."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {HOLDS.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  aria-pressed={scene.hold === h.id}
                  className={cn(
                    scene.hold === h.id ? ON_AIR : QUIET,
                    "flex-col items-start text-left",
                  )}
                  onClick={() =>
                    void send(
                      { type: "SET_HOLD", hold: h.id },
                      `Hold: ${h.label}`,
                    )
                  }
                >
                  {h.label}
                  <span className="text-xs font-normal text-slate-400">
                    {h.hint}
                  </span>
                </button>
              ))}
              <button
                type="button"
                disabled={!scene.hold}
                className={QUIET}
                onClick={() =>
                  void send({ type: "SET_HOLD", hold: null }, "Hold ended")
                }
              >
                End hold
              </button>
            </div>
          </Panel>

          <Panel title="Score bug">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={scene.showBug}
                className={QUIET}
                onClick={() =>
                  void send(
                    { type: "TOGGLE_BUG", visible: !scene.showBug },
                    scene.showBug
                      ? "Hid the score bug"
                      : "Showed the score bug",
                  )
                }
              >
                {scene.showBug ? "Hide score bug" : "Show score bug"}
              </button>
            </div>
            <fieldset className="mt-3">
              <legend className="mb-2 text-sm text-slate-400">Position</legend>
              <div className="flex flex-wrap gap-2">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={scene.layout === l.id}
                    className={scene.layout === l.id ? SELECTED : QUIET}
                    onClick={() =>
                      void send(
                        { type: "SET_LAYOUT", layout: l.id },
                        `Position: ${l.label}`,
                      )
                    }
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor={ids.lift} className="text-slate-300">
                Lift from the bottom edge
              </label>
              <select
                id={ids.lift}
                value={scene.marginOffsetPx}
                onChange={(e) =>
                  void send(
                    {
                      type: "SET_MARGIN_OFFSET",
                      marginOffsetPx: Number(e.target.value),
                    },
                    `Lift: ${e.target.value}px`,
                  )
                }
                className="min-h-10 rounded-lg border border-white/10 bg-slate-900 px-2 text-sm text-white"
              >
                {[0, 16, 32, 48, 64, 96].map((px) => (
                  <option key={px} value={px}>
                    {px === 0 ? "None" : `${px} px`}
                  </option>
                ))}
              </select>
            </div>
          </Panel>

          <Panel title="Look">
            <fieldset>
              <legend className="mb-2 text-sm text-slate-400">Theme</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {OVERLAY_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={theme === t.id}
                    className={cn(
                      theme === t.id ? SELECTED : QUIET,
                      "flex-col items-start text-left",
                    )}
                    onClick={() =>
                      void send(
                        { type: "SET_THEME", theme: t.id },
                        `Theme: ${t.label}`,
                      )
                    }
                  >
                    {t.label}
                    <span className="text-xs font-normal text-slate-400">
                      {t.description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
            {theme === "custom" && (
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                <label
                  htmlFor={ids.primary}
                  className="flex items-center gap-2"
                >
                  Main colour
                  <input
                    id={ids.primary}
                    type="color"
                    value={scene.customColors.primary}
                    onChange={(e) =>
                      void send(
                        {
                          type: "SET_CUSTOM_COLORS",
                          customColors: {
                            ...scene.customColors,
                            primary: e.target.value,
                          },
                        },
                        "Custom colours",
                      )
                    }
                    className="h-10 w-14 rounded border border-white/10 bg-transparent"
                  />
                </label>
                <label htmlFor={ids.accent} className="flex items-center gap-2">
                  Highlight colour
                  <input
                    id={ids.accent}
                    type="color"
                    value={scene.customColors.accent}
                    onChange={(e) =>
                      void send(
                        {
                          type: "SET_CUSTOM_COLORS",
                          customColors: {
                            ...scene.customColors,
                            accent: e.target.value,
                          },
                        },
                        "Custom colours",
                      )
                    }
                    className="h-10 w-14 rounded border border-white/10 bg-transparent"
                  />
                </label>
              </div>
            )}

            <form
              className="mt-4 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send(
                  { type: "SET_SPONSOR", sponsorText },
                  sponsorText.trim()
                    ? "Sponsor line"
                    : "Removed the sponsor line",
                );
              }}
            >
              <label
                htmlFor={ids.sponsor}
                className="block text-sm text-slate-300"
              >
                Sponsor line on the score bug
              </label>
              <div className="flex gap-2">
                <input
                  id={ids.sponsor}
                  value={sponsorText}
                  maxLength={80}
                  onChange={(e) => setSponsorText(e.target.value)}
                  placeholder="e.g. Presented by Smith Builders"
                  className="min-h-11 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-base text-white placeholder:text-slate-500 sm:text-sm"
                />
                <button type="submit" className={QUIET}>
                  Save
                </button>
              </div>
            </form>

            <form
              className="mt-4 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const sponsors = sponsorsText
                  .split("\n")
                  .map((name) => name.trim())
                  .filter(Boolean)
                  .map((name, i) => ({ id: `s${i + 1}`, name }));
                void send(
                  { type: "SET_SPONSORS", sponsors },
                  sponsors.length
                    ? "Sponsors in the corner"
                    : "Removed the sponsors",
                );
              }}
            >
              <label
                htmlFor={ids.sponsors}
                className="block text-sm text-slate-300"
              >
                Sponsors taking turns in the top corner, one per line
              </label>
              <textarea
                id={ids.sponsors}
                rows={3}
                value={sponsorsText}
                onChange={(e) => setSponsorsText(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-base text-white sm:text-sm"
              />
              <button type="submit" className={QUIET}>
                Save sponsors
              </button>
            </form>

            <form
              className="mt-4 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send(
                  { type: "TOGGLE_TICKER", visible: true, tickerText },
                  "Ticker on",
                );
              }}
            >
              <label
                htmlFor={ids.ticker}
                className="block text-sm text-slate-300"
              >
                Ticker along the bottom edge
              </label>
              <input
                id={ids.ticker}
                value={tickerText}
                maxLength={200}
                onChange={(e) => setTickerText(e.target.value)}
                placeholder="e.g. Next match: Saturday 10 am at Riverside"
                className="min-h-11 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-base text-white placeholder:text-slate-500 sm:text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className={scene.tickerVisible ? ON_AIR : QUIET}
                  disabled={!tickerText.trim()}
                >
                  {scene.tickerVisible ? "Update ticker" : "Show ticker"}
                </button>
                {scene.tickerVisible && (
                  <button
                    type="button"
                    className={QUIET}
                    onClick={() =>
                      void send(
                        { type: "TOGGLE_TICKER", visible: false },
                        "Ticker off",
                      )
                    }
                  >
                    Hide ticker
                  </button>
                )}
              </div>
            </form>
          </Panel>

          <Panel
            title="Sound"
            hint="Plays from the overlay. In OBS, tick Control audio via OBS."
          >
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                aria-pressed={scene.sound}
                className={scene.sound ? SELECTED : QUIET}
                onClick={() =>
                  void send(
                    { type: "TOGGLE_AUDIO", audioEnabled: !scene.sound },
                    scene.sound ? "Sound off" : "Sound on",
                  )
                }
              >
                {scene.sound ? "Sound on" : "Sound off"}
              </button>
              <label htmlFor={ids.volume} className="text-sm text-slate-300">
                Volume
              </label>
              <input
                id={ids.volume}
                type="range"
                min={0}
                max={100}
                step={10}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                onPointerUp={(e) =>
                  void send(
                    {
                      type: "TOGGLE_AUDIO",
                      audioVolume: Number(e.currentTarget.value) / 100,
                    },
                    `Volume ${e.currentTarget.value}%`,
                  )
                }
                onKeyUp={(e) =>
                  void send(
                    {
                      type: "TOGGLE_AUDIO",
                      audioVolume: Number(e.currentTarget.value) / 100,
                    },
                    `Volume ${e.currentTarget.value}%`,
                  )
                }
                className="w-40 accent-white"
              />
            </div>
          </Panel>

          {isRealMatch && (
            <Panel
              title="Fixed links and Stream Deck"
              hint="Optional: a ground's own overlay link, and buttons."
            >
              {/* The app's own components, in its dark colours. */}
              <div className="dark space-y-4 text-foreground">
                <ChannelPicker matchId={matchId} />
                <RemoteControlPanel matchId={matchId} />
              </div>
            </Panel>
          )}

          <details className="rounded-xl border border-white/10 bg-[#0e131d] p-4 text-sm">
            <summary className="cursor-pointer font-semibold text-white">
              Keyboard shortcuts
            </summary>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-slate-300">
              {[...EVENT_CARDS, ...STRAPS].map((s) => (
                <div key={s.key} className="contents">
                  <dt>
                    <kbd className="font-mono">{s.key}</kbd>
                  </dt>
                  <dd>{s.label}</dd>
                </div>
              ))}
              <dt>
                <kbd className="font-mono">Esc</kbd>
              </dt>
              <dd>Clear graphics</dd>
            </dl>
          </details>
        </div>
      </main>
    </div>
  );
}
