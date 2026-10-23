/**
 * Automatic mode: which graphics a new `live_state` version calls for.
 *
 * Pure: `(previous row, next row, rules) → graphics`, in the order to show
 * them, each with its offset (`at`, ms) and duration. The overlay calls it
 * once per new version and schedules the result; `overlay_state.auto`
 * holds the producer's rules in the shared shape
 * `Record<AutoRuleId, { on: boolean; seconds: number }>`.
 *
 * Driven by `live_state.events` (what the delivery or crease change did)
 * plus two structural changes the rows show: the toss being set and the
 * match ending. Undo and edits publish no events, so they fire nothing.
 *
 * Wiring (overlay-client): keep the previous row in a ref; on each new
 * `live.state`, `autoGraphics(prev, next, overlayState.auto)` and for each
 * item `setTimeout(at)` then: "sting" → setActiveSting, "strap" →
 * setActiveStrap, "card" → setActiveCard (clear after `durationMs`),
 * "view" → setBroadcastView (back to "1" after `durationMs`), "replay" →
 * `obsBridge.replay(item)` (`obs-bridge.ts`).
 */

import { formatDismissalType } from "~/lib/cricket";
import type { LiveEvent } from "~/lib/firebase/types";
import type {
  ActiveEventSting,
  ActiveLowerThirdStrap,
  BroadcastViewId,
  LiveMatchState,
  PresentationCardType,
} from "./types";

export const AUTO_RULE_IDS = [
  "sting_four",
  "sting_six",
  "sting_wicket",
  "batter_milestone",
  "bowler_milestone",
  "hat_trick",
  "partnership_milestone",
  "new_batter",
  "new_bowler",
  "over_end",
  "innings_break",
  "match_result",
  "toss",
  "replay_four",
  "replay_six",
  "replay_wicket",
] as const;

export type AutoRuleId = (typeof AUTO_RULE_IDS)[number];

export interface AutoRule {
  on: boolean;
  /** How long the graphic stays up (replays: how long the replay scene holds). */
  seconds: number;
}

export type AutoRules = Record<AutoRuleId, AutoRule>;

/**
 * Defaults: event graphics on; replays off (they need OBS set up, see
 * `obs-bridge.ts`). Replay scenes hold 20 s: a replay buffer of the same
 * length covers a scorer who records the ball within ~10 s.
 */
export const DEFAULT_AUTO_RULES: AutoRules = {
  sting_four: { on: true, seconds: 4 },
  sting_six: { on: true, seconds: 5 },
  sting_wicket: { on: true, seconds: 6 },
  batter_milestone: { on: true, seconds: 8 },
  bowler_milestone: { on: true, seconds: 8 },
  hat_trick: { on: true, seconds: 8 },
  partnership_milestone: { on: true, seconds: 8 },
  new_batter: { on: true, seconds: 8 },
  new_bowler: { on: true, seconds: 6 },
  over_end: { on: true, seconds: 8 },
  innings_break: { on: true, seconds: 30 },
  match_result: { on: true, seconds: 45 },
  toss: { on: true, seconds: 15 },
  replay_four: { on: false, seconds: 20 },
  replay_six: { on: false, seconds: 20 },
  replay_wicket: { on: false, seconds: 20 },
};

/** Labels for the control room's rule list. */
export const AUTO_RULE_LABELS: Record<AutoRuleId, string> = {
  sting_four: "Four",
  sting_six: "Six",
  sting_wicket: "Wicket",
  batter_milestone: "Batter fifty and hundred",
  bowler_milestone: "Three and five wickets",
  hat_trick: "Hat-trick",
  partnership_milestone: "Partnership of 50, 100…",
  new_batter: "New batter",
  new_bowler: "New bowler",
  over_end: "End of over",
  innings_break: "Innings break card",
  match_result: "Result card",
  toss: "Toss card",
  replay_four: "Replay fours (OBS)",
  replay_six: "Replay sixes (OBS)",
  replay_wicket: "Replay wickets (OBS)",
};

/** Stored rules (possibly partial or old) completed with the defaults. */
export function resolveAutoRules(
  rules?: Partial<Record<string, Partial<AutoRule>>> | null,
): AutoRules {
  const out = { ...DEFAULT_AUTO_RULES };
  for (const id of AUTO_RULE_IDS) {
    const r = rules?.[id];
    if (!r) continue;
    out[id] = {
      on: typeof r.on === "boolean" ? r.on : out[id].on,
      seconds:
        typeof r.seconds === "number" && r.seconds > 0 && r.seconds <= 600
          ? r.seconds
          : out[id].seconds,
    };
  }
  return out;
}

interface Timed {
  rule: AutoRuleId;
  /** Offset from now, ms. */
  at: number;
  durationMs: number;
}

export type AutoGraphic =
  | (Timed & { kind: "sting"; sting: ActiveEventSting })
  | (Timed & { kind: "strap"; strap: ActiveLowerThirdStrap })
  | (Timed & { kind: "card"; card: PresentationCardType })
  | (Timed & { kind: "view"; view: BroadcastViewId })
  | (Timed & { kind: "replay"; reason: "four" | "six" | "wicket" });

/** Same delivery, crease and score: a snapshot seen again fires nothing. */
function sameMoment(a: LiveMatchState, b: LiveMatchState): boolean {
  const keys: (keyof LiveMatchState)[] = [
    "status",
    "innings_number",
    "total_runs",
    "total_wickets",
    "total_balls",
    "last_ball_seq",
    "striker_id",
    "non_striker_id",
    "bowler_id",
    "toss_winner_team_id",
  ];
  return (
    keys.every((k) => (a[k] ?? null) === (b[k] ?? null)) &&
    JSON.stringify(a.events ?? []) === JSON.stringify(b.events ?? [])
  );
}

/** "74 (42)" for a batter at the crease, by id. */
function batterFigures(state: LiveMatchState, id: string | null): string | null {
  if (!id) return null;
  if (state.striker_id === id) {
    return `${state.striker_runs ?? 0} (${state.striker_balls ?? 0})`;
  }
  if (state.non_striker_id === id) {
    return `${state.non_striker_runs ?? 0} (${state.non_striker_balls ?? 0})`;
  }
  return null;
}

const MILESTONE_TITLE: Record<number, string> = {
  50: "Fifty",
  100: "Hundred",
  150: "150",
  200: "Double hundred",
};

function wicketDetail(state: LiveMatchState, e: LiveEvent): string {
  const w = state.last_wicket?.player_id === e.player_id ? state.last_wicket : null;
  const how = w?.dismissal_type ? formatDismissalType(w.dismissal_type) : null;
  const bowler = w?.bowler_name ? `b ${w.bowler_name}` : null;
  const figures = e.runs !== null ? `${e.runs} (${e.balls ?? 0})` : null;
  return [figures, [how, bowler].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" · ");
}

function stingFor(
  e: LiveEvent,
  state: LiveMatchState,
  id: string,
): { rule: AutoRuleId; sting: Omit<ActiveEventSting, "durationMs"> } | null {
  const name = e.name ?? undefined;
  switch (e.type) {
    case "four":
    case "six":
      return {
        rule: e.type === "four" ? "sting_four" : "sting_six",
        sting: {
          id,
          type: e.type,
          title: e.type === "four" ? "Four" : "Six",
          subtitle: name,
          detail: batterFigures(state, e.player_id) ?? undefined,
        },
      };
    case "wicket":
      return {
        rule: "sting_wicket",
        sting: {
          id,
          type: "wicket",
          title: "Wicket",
          subtitle: name,
          detail: wicketDetail(state, e) || undefined,
        },
      };
    case "batter_milestone":
      return {
        rule: "batter_milestone",
        sting: {
          id,
          type: "milestone",
          title: MILESTONE_TITLE[e.value ?? 0] ?? `${e.value}`,
          subtitle: name,
          detail: `${e.runs ?? e.value} (${e.balls ?? 0})`,
        },
      };
    case "bowler_milestone":
      return {
        rule: "bowler_milestone",
        sting: {
          id,
          type: "milestone",
          title: e.value === 5 ? "Five wickets" : "Three wickets",
          subtitle: name,
          detail: `${e.wickets ?? e.value}-${e.runs ?? 0}`,
        },
      };
    case "hat_trick":
      return {
        rule: "hat_trick",
        sting: {
          id,
          type: "milestone",
          title: "Hat-trick",
          subtitle: name,
          detail: `${e.wickets ?? 3}-${e.runs ?? 0}`,
        },
      };
    default:
      return null;
  }
}

function strapFor(
  e: LiveEvent,
  state: LiveMatchState,
  id: string,
): { rule: AutoRuleId; strap: Omit<ActiveLowerThirdStrap, "durationMs"> } | null {
  switch (e.type) {
    case "new_batter":
      return {
        rule: "new_batter",
        strap: {
          id,
          type: "new_batter",
          badge: "New batter",
          title: e.name ?? "New batter",
          subtitle: `In at ${state.total_runs ?? 0}/${state.total_wickets ?? 0}`,
        },
      };
    case "new_bowler": {
      const balls = e.balls ?? 0;
      return {
        rule: "new_bowler",
        strap: {
          id,
          type: "new_bowler",
          badge: "Bowling",
          title: e.name ?? "Bowler",
          subtitle:
            balls > 0
              ? `${e.wickets ?? 0}-${e.runs ?? 0} off ${Math.floor(balls / 6)}.${balls % 6} overs`
              : "Into the attack",
        },
      };
    }
    case "over_end": {
      const runs = e.runs ?? 0;
      const wkts = e.wickets ?? 0;
      return {
        rule: "over_end",
        strap: {
          id,
          type: "over_end",
          badge: `End of over ${e.number ?? ""}`.trim(),
          title: `${runs} ${runs === 1 ? "run" : "runs"}${wkts ? `, ${wkts} ${wkts === 1 ? "wicket" : "wickets"}` : ""}`,
          subtitle: e.name ? `Bowler ${e.name}` : undefined,
        },
      };
    }
    case "partnership_milestone":
      return {
        rule: "partnership_milestone",
        strap: {
          id,
          type: "partnership",
          badge: "Partnership",
          title: `${e.value} partnership`,
          subtitle: `${e.runs ?? e.value} runs off ${e.balls ?? 0} balls`,
        },
      };
    default:
      return null;
  }
}

const REPLAY_RULE: Partial<Record<LiveEvent["type"], AutoRuleId>> = {
  four: "replay_four",
  six: "replay_six",
  wicket: "replay_wicket",
};

/**
 * The graphics a new live row calls for under `rules`, in show order:
 * stings one after another, then straps, then a full card (innings break,
 * result, toss). Replays start at once (the replay buffer is saved while
 * the moment is still in it).
 */
export function autoGraphics(
  prev: LiveMatchState | null,
  next: LiveMatchState,
  rules?: Partial<Record<string, Partial<AutoRule>>> | null,
): AutoGraphic[] {
  // The first row after (re)loading is history, not news.
  if (!prev || prev === next || sameMoment(prev, next)) return [];
  const r = resolveAutoRules(rules);
  const events = next.events ?? [];
  const types = new Set(events.map((e) => e.type));
  const tag = `${next.innings_number ?? 0}-${next.last_ball_seq ?? 0}-${next.total_balls ?? 0}`;
  const out: AutoGraphic[] = [];
  let at = 0;

  // A hat-trick says more than the three-wicket haul it may complete.
  const skip = (e: LiveEvent) =>
    (e.type === "bowler_milestone" && types.has("hat_trick")) ||
    (e.type === "over_end" && (types.has("innings_end") || types.has("match_end")));

  for (const [i, e] of events.entries()) {
    if (skip(e)) continue;
    const s = stingFor(e, next, `auto-${e.type}-${tag}-${i}`);
    if (!s || !r[s.rule].on) continue;
    const durationMs = r[s.rule].seconds * 1000;
    out.push({
      kind: "sting",
      rule: s.rule,
      at,
      durationMs,
      sting: { ...s.sting, durationMs },
    });
    at += durationMs;
  }

  for (const e of events) {
    const rule = REPLAY_RULE[e.type];
    if (!rule || !r[rule].on) continue;
    out.push({
      kind: "replay",
      rule,
      at: 0,
      durationMs: r[rule].seconds * 1000,
      reason: e.type as "four" | "six" | "wicket",
    });
  }

  for (const [i, e] of events.entries()) {
    if (skip(e)) continue;
    const s = strapFor(e, next, `auto-${e.type}-${tag}-${i}`);
    if (!s || !r[s.rule].on) continue;
    const durationMs = r[s.rule].seconds * 1000;
    out.push({
      kind: "strap",
      rule: s.rule,
      at,
      durationMs,
      strap: { ...s.strap, durationMs },
    });
    at += durationMs;
  }

  const ended =
    types.has("match_end") ||
    (prev.status !== "completed" && next.status === "completed");
  if (ended && r.match_result.on) {
    out.push({
      kind: "card",
      rule: "match_result",
      at,
      durationMs: r.match_result.seconds * 1000,
      card: "result",
    });
  } else if (types.has("innings_end") && r.innings_break.on) {
    out.push({
      kind: "view",
      rule: "innings_break",
      at,
      durationMs: r.innings_break.seconds * 1000,
      view: "14",
    });
  }

  const tossSet = !prev.toss_winner_team_id && !!next.toss_winner_team_id;
  if (tossSet && r.toss.on) {
    out.push({
      kind: "card",
      rule: "toss",
      at,
      durationMs: r.toss.seconds * 1000,
      card: "toss",
    });
  }
  return out;
}
