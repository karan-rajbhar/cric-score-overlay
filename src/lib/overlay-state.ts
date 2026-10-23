/**
 * What the control room has put on a match's broadcast overlay, kept in one
 * document, `overlay_state/{matchId}`:
 *
 * - `scene`: what stays on air until changed: theme, score-bug layout,
 *   graphics-suite view or presentation card, ticker, sponsors, colours,
 *   sound;
 * - `auto`: which graphics the overlay shows by itself (rule id ->
 *   `{ on, seconds }`);
 * - `strap`: the lower third on air, with when it went up (server ms);
 * - `cue`: the latest one-off event card (`{ id, kind, at }`);
 * - `version`, `last_command_id`, `at`: every command bumps the version and
 *   names the control room's id for it (its confirmation that the command
 *   went on air), `at` being the server time of that write.
 *
 * `POST /api/overlay/command` merges each command into it (1 write); the
 * overlay and the control room listen to it (1 read on load, 1 per
 * command). An overlay that loads or reloads (OBS refreshes its browser
 * sources) therefore starts from what is on air, and replays an event card
 * only if it is a few seconds old.
 *
 * Pure: shared by the server route, the overlay and the control room.
 */

import type {
  ActiveLowerThirdStrap,
  BroadcastViewId,
  CustomThemeColors,
  LowerThirdStrapType,
  OverlaySnapshots,
  PresentationCardType,
  ProducerCommand,
  SeriesFigures,
  SponsorItem,
} from "~/components/overlay/types";
import {
  AUTO_RULE_IDS,
  DEFAULT_AUTO_RULES as GRAPHICS_AUTO_RULES,
  resolveAutoRules,
} from "~/components/overlay/auto-graphics";
import { resolveOverlayTheme } from "~/components/overlay/overlay-themes";

export const OVERLAY_STATE_COLLECTION = "overlay_state";

export type SceneLayout = "bottom" | "top" | "compact";

export interface OverlayScene {
  /** Graphics-suite view on air; null: the score bug. */
  view: BroadcastViewId | null;
  /** Where the score bug sits. */
  layout: SceneLayout;
  /** Theme id (`~/components/overlay/overlay-themes`). */
  theme: string;
  /** Score bug (and the suite views that replace it) shown at all. */
  showBug: boolean;
  /** Event-card sounds from the overlay (off: most streams have commentary). */
  sound: boolean;
  /** 0..1 */
  volume: number;
  /** Lifts the bottom score bug (px of the 1920x1080 frame). */
  marginOffsetPx: number;
  tickerVisible: boolean;
  tickerText: string;
  /** Short sponsor line on the score bug. */
  sponsor: string;
  /** Sponsors rotating under the corner watermark. */
  sponsors: SponsorItem[];
  /** Moves on with each "next sponsor" (Stream Deck): who is shown first. */
  sponsorIndex: number;
  customColors: CustomThemeColors;
  /** Presentation card on air until taken off. */
  card: PresentationCardType;
  /** The OBS scene replays play in ("": save the clip only). */
  replayScene: string;
  /** Holding while the score is corrected (`HoldScreen`); null: on air. */
  hold: HoldMode | null;
}

export type HoldMode = "black" | "clean" | "card";

export const DEFAULT_SCENE: OverlayScene = {
  view: null,
  layout: "bottom",
  theme: "standard",
  showBug: true,
  sound: false,
  volume: 0.8,
  marginOffsetPx: 0,
  tickerVisible: false,
  tickerText: "",
  sponsor: "",
  sponsors: [],
  sponsorIndex: 0,
  customColors: { primary: "#242267", accent: "#a8abfa" },
  card: "none",
  replayScene: "Replay",
  hold: null,
};

/** One automatic-graphics rule: on or off, and seconds on air. */
export interface AutoRule {
  on: boolean;
  seconds: number;
}

/**
 * Rule id -> rule, as stored. The ids, labels and defaults are the
 * graphics' (`~/components/overlay/auto-graphics`); ids stored before them
 * (four, six, wicket, milestone, free_hit) still apply
 * (`resolveAutoRules`).
 */
export type AutoRules = Record<string, AutoRule>;

export const DEFAULT_AUTO_RULES: AutoRules = GRAPHICS_AUTO_RULES;

/** Replays need OBS set up first: "Automatic" leaves them as they are. */
export const isReplayRule = (id: string) => id.startsWith("replay_");

/** Every rule off: the producer runs the graphics. */
export function manualAutoRules(
  rules: AutoRules = DEFAULT_AUTO_RULES,
): AutoRules {
  return Object.fromEntries(
    Object.entries(rules).map(([id, rule]) => [id, { ...rule, on: false }]),
  );
}

export type StingKind = NonNullable<ProducerCommand["stingType"]>;

/**
 * A command as it arrives (the route only checked `type`): every field is
 * validated before use.
 */
export type OverlayCommandInput = { type: string } & Partial<
  Omit<ProducerCommand, "type">
>;

/** The latest one-off event card. */
export interface OverlayCue {
  id: string;
  kind: StingKind;
  /** Server time (ms) it was sent. */
  at: number;
}

/** The lower third on air and when it went up (server ms). */
export type StoredStrap = ActiveLowerThirdStrap & { at: number };

export interface OverlayStateDoc {
  match_id: string;
  version: number;
  last_command_id: string | null;
  /** Server time (ms) of the latest command. */
  at: number;
  scene: Partial<OverlayScene>;
  auto?: AutoRules;
  strap: StoredStrap | null;
  cue: OverlayCue | null;
  /** Data for the standings / leaders / next-match / tournament cards. */
  snapshots?: OverlaySnapshots | null;
}

/** A command's change to the overlay state; absent fields stay as they are. */
export interface OverlayStatePatch {
  scene?: Partial<OverlayScene>;
  strap?: StoredStrap | null;
  cue?: OverlayCue | null;
  auto?: AutoRules;
  snapshots?: OverlaySnapshots | null;
  /** Show the next sponsor now (the server adds one to `sponsorIndex`). */
  nextSponsor?: true;
}

const LAYOUTS: readonly SceneLayout[] = ["bottom", "top", "compact"];

const VIEW_IDS: readonly BroadcastViewId[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
];

const CARDS: readonly PresentationCardType[] = [
  "none",
  "toss",
  "playing_xi",
  "scorecard",
  "partnership",
  "result",
  "over_summary",
];

const STRAP_TYPES: readonly LowerThirdStrapType[] = [
  "batsman",
  "bowler",
  "partnership",
  "target",
  "powerplay",
  "drinks",
  "timeout",
  "rain_delay",
  "innings_break",
  "custom",
  "last_wicket",
  "win_predictor",
  "commentary",
  "message",
  "new_batter",
  "new_bowler",
  "over_end",
];

const MESSAGE_FORMS = ["single", "double", "baseline"] as const;
const HOLDS: readonly HoldMode[] = ["black", "clean", "card"];

const STING_KINDS: readonly StingKind[] = [
  "four",
  "six",
  "wicket",
  "milestone",
  "free_hit",
];

const MAX_TEXT = 200;
const MAX_SPONSORS = 12;
const MAX_RULES = 32;
const HEX = /^#[0-9a-f]{6}$/i;
const RULE_ID = /^[a-z][a-z0-9_]{0,39}$/;

function isOneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}

function text(v: unknown, max = MAX_TEXT): string | undefined {
  return typeof v === "string" ? v.slice(0, max) : undefined;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function sponsorsOf(v: unknown): SponsorItem[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter(
      (s): s is SponsorItem =>
        !!s &&
        typeof s === "object" &&
        typeof (s as SponsorItem).id === "string" &&
        typeof (s as SponsorItem).name === "string" &&
        (s as SponsorItem).name.trim() !== "",
    )
    .slice(0, MAX_SPONSORS)
    .map((s) => ({
      id: s.id.slice(0, 64),
      name: s.name.slice(0, 80),
      ...(typeof s.tagline === "string" && s.tagline
        ? { tagline: s.tagline.slice(0, 120) }
        : {}),
      ...(typeof s.logoUrl === "string" && /^https?:\/\//.test(s.logoUrl)
        ? { logoUrl: s.logoUrl.slice(0, 500) }
        : {}),
    }));
}

function colorsOf(v: unknown): CustomThemeColors | undefined {
  const c = v as CustomThemeColors | undefined;
  return c && HEX.test(c.primary) && HEX.test(c.accent)
    ? { primary: c.primary, accent: c.accent }
    : undefined;
}

function autoRulesOf(v: unknown): AutoRules | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: AutoRules = {};
  for (const [id, rule] of Object.entries(v).slice(0, MAX_RULES)) {
    const r = rule as AutoRule | undefined;
    if (!RULE_ID.test(id) || !r || typeof r.on !== "boolean") continue;
    const seconds = Number.isFinite(r.seconds) ? clamp(r.seconds, 1, 120) : 5;
    out[id] = { on: r.on, seconds };
  }
  return out;
}

function strapOf(v: unknown, at: number): StoredStrap | undefined {
  const s = v as ActiveLowerThirdStrap | undefined;
  if (!s || typeof s !== "object" || !isOneOf(STRAP_TYPES, s.type)) {
    return undefined;
  }
  const out: StoredStrap = {
    id: text(s.id, 64) || `strap-${at}`,
    type: s.type,
    title: text(s.title) ?? "",
    at,
  };
  for (const key of ["subtitle", "detail", "badge", "customText"] as const) {
    const value = text(s[key]);
    if (value) out[key] = value;
  }
  if (typeof s.durationMs === "number" && Number.isFinite(s.durationMs)) {
    out.durationMs = clamp(Math.round(s.durationMs), -1, 30 * 60 * 1000);
  }
  if (isOneOf(MESSAGE_FORMS, s.form)) out.form = s.form;
  return out;
}

const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/** Snapshot rows a card shows at most (the command stays well under 16 KB). */
const MAX_TABLE_ROWS = 16;
const MAX_LEADERS = 10;
const MAX_SERIES_PLAYERS = 30;

function seriesOf(v: unknown): Record<string, SeriesFigures> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, SeriesFigures> = {};
  for (const [id, raw] of Object.entries(v).slice(0, MAX_SERIES_PLAYERS)) {
    const f = raw as Record<string, unknown> | null;
    const matches = num(f?.matches);
    if (!/^[\w-]{1,128}$/.test(id) || !f || matches === undefined) continue;
    const fig: SeriesFigures = { matches };
    for (const k of ["runs", "average", "strikeRate", "wickets", "economy"] as const) {
      const value = num(f[k]);
      if (value !== undefined) fig[k] = value;
    }
    for (const k of ["highest", "best"] as const) {
      const value = text(f[k], 16);
      if (value) fig[k] = value;
    }
    out[id] = fig;
  }
  return out;
}

/** Snapshots from the control room, validated and capped; null clears. */
export function snapshotsOf(v: unknown): OverlaySnapshots | null | undefined {
  if (v === null) return null;
  if (!v || typeof v !== "object") return undefined;
  const r = v as Record<string, unknown>;
  const out: OverlaySnapshots = {};
  const pt = r.pointsTable as Record<string, unknown> | null | undefined;
  if (pt && Array.isArray(pt.rows)) {
    out.pointsTable = {
      title: text(pt.title, 80) || "Points table",
      rows: pt.rows.slice(0, MAX_TABLE_ROWS).flatMap((raw) => {
        const row = raw as Record<string, unknown>;
        const team = text(row?.team, 80);
        if (!team) return [];
        return [
          {
            team,
            short: text(row.short, 12) ?? null,
            played: num(row.played) ?? 0,
            won: num(row.won) ?? 0,
            lost: num(row.lost) ?? 0,
            tied: num(row.tied) ?? null,
            noResult: num(row.noResult) ?? null,
            points: num(row.points) ?? 0,
            nrr: num(row.nrr) ?? null,
            highlight: row.highlight === true,
          },
        ];
      }),
    };
  }
  const lb = r.leaderboard as Record<string, unknown> | null | undefined;
  if (lb && Array.isArray(lb.rows)) {
    out.leaderboard = {
      title: text(lb.title, 80) || "Leaders",
      metric: text(lb.metric, 20) || "",
      rows: lb.rows.slice(0, MAX_LEADERS).flatMap((raw) => {
        const row = raw as Record<string, unknown>;
        const name = text(row?.name, 80);
        const value =
          num(row?.value) ?? text(row?.value, 16);
        if (!name || value === undefined) return [];
        return [
          {
            name,
            team: text(row.team, 80) ?? null,
            value,
            detail: text(row.detail, 80) ?? null,
            playerId: text(row.playerId, 128) ?? null,
          },
        ];
      }),
    };
  }
  const fx = r.nextFixture as Record<string, unknown> | null | undefined;
  const team1 = text(fx?.team1, 80);
  const team2 = text(fx?.team2, 80);
  if (fx && team1 && team2) {
    const url = (u: unknown) =>
      typeof u === "string" && /^https?:\/\//.test(u) ? u.slice(0, 500) : null;
    out.nextFixture = {
      title: text(fx.title, 80) ?? null,
      team1,
      team1Short: text(fx.team1Short, 12) ?? null,
      team1Logo: url(fx.team1Logo),
      team2,
      team2Short: text(fx.team2Short, 12) ?? null,
      team2Logo: url(fx.team2Logo),
      startsAt: text(fx.startsAt, 40) ?? null,
      venue: text(fx.venue, 120) ?? null,
      round: text(fx.round, 60) ?? null,
    };
  }
  const series = seriesOf(r.series);
  if (series) out.series = series;
  return out;
}

/** The scene fields a command sets, validated; null when it sets none. */
export function scenePatchOf(
  cmd: OverlayCommandInput,
): Partial<OverlayScene> | null {
  switch (cmd.type) {
    case "SET_THEME":
      return typeof cmd.theme === "string"
        ? { theme: resolveOverlayTheme(cmd.theme) }
        : null;
    case "SET_LAYOUT":
      return isOneOf(LAYOUTS, cmd.layout) ? { layout: cmd.layout } : null;
    case "TOGGLE_BUG":
      return typeof cmd.visible === "boolean" ? { showBug: cmd.visible } : null;
    case "SET_SPONSOR": {
      const sponsor = text(cmd.sponsorText, 80);
      return sponsor === undefined ? null : { sponsor: sponsor.trim() };
    }
    case "SET_SPONSORS": {
      const sponsors = sponsorsOf(cmd.sponsors);
      return sponsors ? { sponsors } : null;
    }
    case "TOGGLE_TICKER": {
      const patch: Partial<OverlayScene> = {};
      if (typeof cmd.visible === "boolean") patch.tickerVisible = cmd.visible;
      const t = text(cmd.tickerText);
      if (t !== undefined) patch.tickerText = t.trim();
      return Object.keys(patch).length ? patch : null;
    }
    case "SET_TICKER_TEXT": {
      const t = text(cmd.tickerText);
      return t === undefined ? null : { tickerText: t.trim() };
    }
    case "SET_CUSTOM_COLORS": {
      const customColors = colorsOf(cmd.customColors);
      return customColors ? { customColors } : null;
    }
    case "SET_MARGIN_OFFSET":
      return typeof cmd.marginOffsetPx === "number" &&
        Number.isFinite(cmd.marginOffsetPx)
        ? { marginOffsetPx: clamp(Math.round(cmd.marginOffsetPx), 0, 200) }
        : null;
    case "TOGGLE_AUDIO": {
      const patch: Partial<OverlayScene> = {};
      if (typeof cmd.audioEnabled === "boolean") patch.sound = cmd.audioEnabled;
      if (
        typeof cmd.audioVolume === "number" &&
        Number.isFinite(cmd.audioVolume)
      ) {
        patch.volume = clamp(cmd.audioVolume, 0, 1);
      }
      return Object.keys(patch).length ? patch : null;
    }
    case "SET_BROADCAST_VIEW":
      if (cmd.broadcastView === null) return { view: null };
      return isOneOf(VIEW_IDS, cmd.broadcastView)
        ? { view: cmd.broadcastView, card: "none" }
        : null;
    case "SHOW_CARD":
      return isOneOf(CARDS, cmd.card) ? { card: cmd.card } : null;
    case "HIDE_CARD":
      return { card: "none" };
    case "SET_REPLAY_SCENE": {
      const scene = text(cmd.replayScene, 80);
      return scene === undefined ? null : { replayScene: scene.trim() };
    }
    case "SET_HOLD":
      if (cmd.hold === null) return { hold: null };
      return isOneOf(HOLDS, cmd.hold) ? { hold: cmd.hold } : null;
    case "PANIC_CLEAR":
      return { view: null, card: "none", hold: null };
    default:
      return null;
  }
}

/**
 * Everything a command changes in the overlay state, validated (`now`:
 * server time in ms); null when it changes nothing.
 */
export function overlayPatchOf(
  cmd: OverlayCommandInput,
  now: number,
): OverlayStatePatch | null {
  const patch: OverlayStatePatch = {};
  const scene = scenePatchOf(cmd);
  if (scene) patch.scene = scene;
  switch (cmd.type) {
    case "TRIGGER_STING":
      if (!isOneOf(STING_KINDS, cmd.stingType)) return null;
      patch.cue = {
        id: text(cmd.id, 64) || `cue-${now}`,
        kind: cmd.stingType,
        at: now,
      };
      break;
    case "SHOW_STRAP": {
      const strap = strapOf(cmd.strap, now);
      if (!strap) return null;
      patch.strap = strap;
      break;
    }
    case "HIDE_STRAP":
      patch.strap = null;
      break;
    case "SET_AUTO": {
      const auto = autoRulesOf(cmd.auto);
      if (!auto) return null;
      patch.auto = auto;
      break;
    }
    case "NEXT_SPONSOR":
      patch.nextSponsor = true;
      break;
    case "SET_SNAPSHOTS": {
      const snapshots = snapshotsOf(cmd.snapshots);
      if (snapshots === undefined) return null;
      patch.snapshots = snapshots;
      break;
    }
    case "PANIC_CLEAR":
      patch.strap = null;
      patch.cue = null;
      break;
  }
  return Object.keys(patch).length ? patch : null;
}

/**
 * The state after a command, as the server stores it (the demo match's
 * control room applies its commands with this instead).
 */
export function applyOverlayPatch(
  doc: OverlayStateDoc | null,
  patch: OverlayStatePatch,
  commandId: string | null,
  now: number,
): OverlayStateDoc {
  const base: OverlayStateDoc = doc ?? {
    match_id: "",
    version: 0,
    last_command_id: null,
    at: now,
    scene: {},
    strap: null,
    cue: null,
  };
  return {
    ...base,
    version: base.version + 1,
    last_command_id: commandId,
    at: now,
    scene: {
      ...base.scene,
      ...(patch.scene ?? {}),
      ...(patch.nextSponsor
        ? { sponsorIndex: (base.scene.sponsorIndex ?? 0) + 1 }
        : {}),
    },
    ...(patch.strap !== undefined ? { strap: patch.strap } : {}),
    ...(patch.cue !== undefined ? { cue: patch.cue } : {}),
    ...(patch.auto !== undefined ? { auto: patch.auto } : {}),
    ...(patch.snapshots !== undefined ? { snapshots: patch.snapshots } : {}),
  };
}

/** A stored overlay state (anything may be missing or stale), validated. */
export function parseOverlayState(raw: unknown): OverlayStateDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const at = typeof r.at === "number" ? r.at : 0;
  const strapAt =
    r.strap && typeof (r.strap as StoredStrap).at === "number"
      ? (r.strap as StoredStrap).at
      : at;
  const cue = r.cue as OverlayCue | null | undefined;
  return {
    match_id: typeof r.match_id === "string" ? r.match_id : "",
    version: typeof r.version === "number" ? r.version : 0,
    last_command_id:
      typeof r.last_command_id === "string" ? r.last_command_id : null,
    at,
    scene: parseScene(r.scene),
    auto: autoRulesOf(r.auto),
    strap: strapOf(r.strap, strapAt) ?? null,
    cue:
      cue &&
      typeof cue.id === "string" &&
      isOneOf(STING_KINDS, cue.kind) &&
      typeof cue.at === "number"
        ? { id: cue.id, kind: cue.kind, at: cue.at }
        : null,
    ...(r.snapshots !== undefined
      ? { snapshots: snapshotsOf(r.snapshots) ?? null }
      : {}),
  };
}

function parseScene(raw: unknown): Partial<OverlayScene> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<OverlayScene> = {};
  if (r.view === null || isOneOf(VIEW_IDS, r.view)) out.view = r.view;
  if (isOneOf(LAYOUTS, r.layout)) out.layout = r.layout;
  if (typeof r.theme === "string") out.theme = resolveOverlayTheme(r.theme);
  if (typeof r.showBug === "boolean") out.showBug = r.showBug;
  if (typeof r.sound === "boolean") out.sound = r.sound;
  if (typeof r.volume === "number") out.volume = clamp(r.volume, 0, 1);
  if (typeof r.marginOffsetPx === "number") {
    out.marginOffsetPx = clamp(r.marginOffsetPx, 0, 200);
  }
  if (typeof r.tickerVisible === "boolean") out.tickerVisible = r.tickerVisible;
  const ticker = text(r.tickerText);
  if (ticker !== undefined) out.tickerText = ticker;
  const sponsor = text(r.sponsor, 80);
  if (sponsor !== undefined) out.sponsor = sponsor;
  const sponsors = sponsorsOf(r.sponsors);
  if (sponsors) out.sponsors = sponsors;
  if (typeof r.sponsorIndex === "number" && Number.isFinite(r.sponsorIndex)) {
    out.sponsorIndex = Math.max(0, Math.floor(r.sponsorIndex));
  }
  const colors = colorsOf(r.customColors);
  if (colors) out.customColors = colors;
  if (isOneOf(CARDS, r.card)) out.card = r.card;
  const replayScene = text(r.replayScene, 80);
  if (replayScene !== undefined) out.replayScene = replayScene;
  if (r.hold === null || isOneOf(HOLDS, r.hold)) out.hold = r.hold;
  return out;
}

/** Starting values an overlay link may carry (`?theme=&layout=&sponsor=`). */
export interface SceneUrlParams {
  layout?: string;
  theme?: string;
  sponsor?: string;
}

/**
 * The scene on air: the defaults, the link's settings, then what the
 * control room set (which wins: it is what the producer sees).
 */
export function sceneOf(
  params: SceneUrlParams,
  stored: Partial<OverlayScene> | null | undefined,
): OverlayScene {
  const scene: OverlayScene = { ...DEFAULT_SCENE };
  if (isOneOf(LAYOUTS, params.layout)) scene.layout = params.layout;
  // The old graphics-suite link: its scorebar instead of the score bug.
  if (params.layout === "broadcast") scene.view = "1";
  if (params.theme) scene.theme = resolveOverlayTheme(params.theme);
  const sponsor = text(params.sponsor, 80)?.trim();
  if (sponsor) scene.sponsor = sponsor;
  return { ...scene, ...(stored ?? {}) };
}

/** The automatic-graphics rules in force (old rule ids included). */
export function autoRulesIn(doc: OverlayStateDoc | null): AutoRules {
  return resolveAutoRules(doc?.auto);
}

/**
 * Whether every automatic graphic is on (the setup flow's "Automatic").
 * Replays are not counted: they wait for OBS to be set up.
 */
export function isAutomatic(doc: OverlayStateDoc | null): boolean {
  const rules = autoRulesIn(doc);
  return AUTO_RULE_IDS.filter((id) => !isReplayRule(id)).every(
    (id) => rules[id]?.on,
  );
}

/** "Automatic": every graphic on, replays as they were. */
export function automaticRules(current: AutoRules = DEFAULT_AUTO_RULES): AutoRules {
  return Object.fromEntries(
    AUTO_RULE_IDS.map((id) => [
      id,
      isReplayRule(id)
        ? (current[id] ?? DEFAULT_AUTO_RULES[id]!)
        : { ...(current[id] ?? DEFAULT_AUTO_RULES[id]!), on: true },
    ]),
  );
}

/** How long an event card may be replayed after it was sent. */
export const CUE_REPLAY_MS = 10_000;

/** The stored lower third, if it is still on air at server time `now`. */
export function strapOnAir(
  doc: OverlayStateDoc | null,
  now: number,
): StoredStrap | null {
  const strap = doc?.strap;
  if (!strap) return null;
  const duration = strap.durationMs ?? 8000;
  if (duration <= 0) return strap; // until taken off
  return now - strap.at < duration ? strap : null;
}
