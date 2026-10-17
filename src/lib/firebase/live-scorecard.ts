/**
 * Compact live scorecard: `live_scorecard/{matchId}` (public read).
 *
 * Everything the match page's Summary / Scorecard / Top performers / Stats
 * tabs render from the innings of a live match (batting, bowling, fall of
 * wickets, partnerships, extras and totals of every innings, with display
 * names), in one small document that viewers on those tabs listen to
 * instead of refetching the match after every ball. `live_state` stays the
 * small scoreboard doc that overlays and the other tabs follow.
 *
 * Compact encoding (a full T20 is ~4 KB; see `live-scorecard.test.ts`):
 * - players are listed once (`players` ids, `names` in parallel) and rows
 *   refer to them by index;
 * - each row is a comma-separated string in a fixed column order (below):
 *   numbers as text, booleans `1` / `0`, strings URI-encoded, null empty.
 *   Firestore arrays cannot hold arrays, and strings are the smallest
 *   encoding on the wire.
 *
 * This module is pure (browser and server). The scoring engine writes the
 * doc inside its transactions (`live-scorecard-sync.ts`).
 */

import { canonicalJson } from "./derive.mjs";
import type {
  BattingEntry,
  BowlingEntry,
  FallOfWicketEntry,
  PartnershipEntry,
} from "./scorecard";
import type { InningsRow } from "./types";

export const LIVE_SCORECARD_COLLECTION = "live_scorecard";

export interface LiveScorecardInnings {
  id: string;
  /** innings_number */
  n: number;
  /** team_id (batting side) */
  team: string;
  /** Totals row, see {@link TOTAL_COLUMNS}. */
  t: string;
  bat: string[];
  bowl: string[];
  fow: string[];
  par: string[];
}

export interface LiveScorecardDoc {
  match_id: string;
  /** Increases by one on every write. */
  version: number;
  updated_at: string;
  /** Player ids referenced by the rows (by index). */
  players: string[];
  /** Display name of each player in `players` (snapshot). */
  names: (string | null)[];
  /** In innings_number order. */
  innings: LiveScorecardInnings[];
}

/** An innings document with its stage 2 scorecard arrays. */
export type ScorecardSource = Pick<
  InningsRow,
  | "id"
  | "team_id"
  | "innings_number"
  | "total_runs"
  | "total_wickets"
  | "total_balls"
  | "total_overs"
  | "extras_total"
  | "extras_byes"
  | "extras_leg_byes"
  | "extras_wides"
  | "extras_no_balls"
  | "extras_penalties"
  | "extras_bonuses"
  | "target_runs"
  | "is_completed"
> & {
  match_id?: string | null;
  batting?: BattingEntry[] | null;
  bowling?: BowlingEntry[] | null;
  fall_of_wickets?: FallOfWicketEntry[] | null;
  partnerships?: PartnershipEntry[] | null;
};

/** `p` player index, `n` number, `b` boolean, `s` string. */
type Kind = "p" | "n" | "b" | "s";
type Columns = ReadonlyArray<readonly [string, Kind]>;

const TOTAL_COLUMNS = [
  ["total_runs", "n"],
  ["total_wickets", "n"],
  ["total_balls", "n"],
  ["total_overs", "n"],
  ["extras_total", "n"],
  ["extras_byes", "n"],
  ["extras_leg_byes", "n"],
  ["extras_wides", "n"],
  ["extras_no_balls", "n"],
  ["extras_penalties", "n"],
  ["extras_bonuses", "n"],
  ["target_runs", "n"],
  ["is_completed", "b"],
] as const satisfies Columns;

const BATTING_COLUMNS = [
  ["user_id", "p"],
  ["batting_position", "n"],
  ["runs_scored", "n"],
  ["balls_faced", "n"],
  ["minutes_batted", "n"],
  ["fours", "n"],
  ["sixes", "n"],
  ["is_out", "b"],
  ["dismissal_type", "s"],
  ["bowler_id", "p"],
  ["fielder_id", "p"],
  ["is_current_batsman", "b"],
  ["is_striker", "b"],
] as const satisfies Columns;

const BOWLING_COLUMNS = [
  ["user_id", "p"],
  ["overs_bowled", "n"],
  ["balls_bowled", "n"],
  ["runs_conceded", "n"],
  ["wickets_taken", "n"],
  ["maidens", "n"],
  ["wides", "n"],
  ["no_balls", "n"],
  ["is_current_bowler", "b"],
] as const satisfies Columns;

const FOW_COLUMNS = [
  ["wicket_number", "n"],
  ["runs_at_fall", "n"],
  ["overs_at_fall", "n"],
  ["batsman_out_id", "p"],
  ["dismissal_type", "s"],
  ["bowler_id", "p"],
  ["fielder_id", "p"],
] as const satisfies Columns;

const PARTNERSHIP_COLUMNS = [
  ["batsman1_id", "p"],
  ["batsman2_id", "p"],
  ["wicket_number", "n"],
  ["runs", "n"],
  ["balls", "n"],
  ["start_over", "n"],
  ["end_over", "n"],
  ["is_current", "b"],
] as const satisfies Columns;

type Players = { index: (id: string) => number };

function encodeRow(row: object, columns: Columns, players: Players): string {
  const r = row as Record<string, unknown>;
  return columns
    .map(([field, kind]) => {
      const v = r[field];
      if (v === null || v === undefined) return "";
      switch (kind) {
        case "p":
          return typeof v === "string" && v ? String(players.index(v)) : "";
        case "b":
          return v ? "1" : "0";
        case "n":
          return typeof v === "number" && Number.isFinite(v) ? String(v) : "";
        case "s":
          return encodeURIComponent(String(v));
      }
    })
    .join(",");
}

function decodeRow(
  text: string,
  columns: Columns,
  players: readonly string[],
): Record<string, unknown> {
  const parts = text.split(",");
  const out: Record<string, unknown> = {};
  columns.forEach(([field, kind], i) => {
    const raw = parts[i] ?? "";
    if (raw === "") {
      out[field] = null;
      return;
    }
    switch (kind) {
      case "p":
        out[field] = players[Number(raw)] ?? null;
        break;
      case "b":
        out[field] = raw === "1";
        break;
      case "n":
        out[field] = Number(raw);
        break;
      case "s":
        out[field] = decodeURIComponent(raw);
        break;
    }
  });
  return out;
}

function byInningsNumber(a: ScorecardSource, b: ScorecardSource): number {
  return (
    (a.innings_number ?? 0) - (b.innings_number ?? 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Every player id the scorecard of these innings refers to. */
export function liveScorecardUserIds(innings: ScorecardSource[]): string[] {
  const ids = new Set<string>();
  const add = (row: object, columns: Columns) => {
    for (const [field, kind] of columns) {
      const v = (row as Record<string, unknown>)[field];
      if (kind === "p" && typeof v === "string" && v) ids.add(v);
    }
  };
  for (const inn of [...innings].sort(byInningsNumber)) {
    for (const r of inn.batting ?? []) add(r, BATTING_COLUMNS);
    for (const r of inn.bowling ?? []) add(r, BOWLING_COLUMNS);
    for (const r of inn.fall_of_wickets ?? []) add(r, FOW_COLUMNS);
    for (const r of inn.partnerships ?? []) add(r, PARTNERSHIP_COLUMNS);
  }
  return [...ids];
}

/** The doc for these innings (version / timestamp supplied by the writer). */
export function buildLiveScorecard(input: {
  matchId: string;
  innings: ScorecardSource[];
  nameOf: (id: string) => string | null;
  version: number;
  now: string;
}): LiveScorecardDoc {
  const players: string[] = [];
  const at = new Map<string, number>();
  const index = (id: string) => {
    let i = at.get(id);
    if (i === undefined) {
      i = players.length;
      players.push(id);
      at.set(id, i);
    }
    return i;
  };
  const p: Players = { index };
  const innings = [...input.innings].sort(byInningsNumber).map((inn) => ({
    id: inn.id,
    n: inn.innings_number,
    team: inn.team_id,
    t: encodeRow(inn, TOTAL_COLUMNS, p),
    bat: (inn.batting ?? []).map((r) => encodeRow(r, BATTING_COLUMNS, p)),
    bowl: (inn.bowling ?? []).map((r) => encodeRow(r, BOWLING_COLUMNS, p)),
    fow: (inn.fall_of_wickets ?? []).map((r) => encodeRow(r, FOW_COLUMNS, p)),
    par: (inn.partnerships ?? []).map((r) =>
      encodeRow(r, PARTNERSHIP_COLUMNS, p),
    ),
  }));
  return {
    match_id: input.matchId,
    version: input.version,
    updated_at: input.now,
    players,
    names: players.map((id) => input.nameOf(id) ?? null),
    innings,
  };
}

/** Whether two docs show the same scorecard (ignores version / time). */
export function sameLiveScorecard(
  a: Pick<LiveScorecardDoc, "players" | "names" | "innings">,
  b: Pick<LiveScorecardDoc, "players" | "names" | "innings">,
): boolean {
  const content = (d: typeof a) =>
    canonicalJson({
      players: d.players ?? [],
      names: d.names ?? [],
      innings: d.innings ?? [],
    });
  return content(a) === content(b);
}

/** The innings (stage 2 shape) and names a doc was built from. */
export function decodeLiveScorecard(doc: LiveScorecardDoc): {
  innings: ScorecardSource[];
  names: Record<string, string | null>;
} {
  const players = doc.players ?? [];
  const names: Record<string, string | null> = {};
  players.forEach((id, i) => {
    names[id] = doc.names?.[i] ?? null;
  });
  const innings = (doc.innings ?? []).map(
    (e) =>
      ({
        id: e.id,
        match_id: doc.match_id,
        team_id: e.team,
        innings_number: e.n,
        ...decodeRow(e.t, TOTAL_COLUMNS, players),
        batting: (e.bat ?? []).map((r) =>
          decodeRow(r, BATTING_COLUMNS, players),
        ),
        bowling: (e.bowl ?? []).map((r) =>
          decodeRow(r, BOWLING_COLUMNS, players),
        ),
        fall_of_wickets: (e.fow ?? []).map((r) =>
          decodeRow(r, FOW_COLUMNS, players),
        ),
        partnerships: (e.par ?? []).map((r) =>
          decodeRow(r, PARTNERSHIP_COLUMNS, players),
        ),
      }) as unknown as ScorecardSource,
  );
  return { innings, names };
}

// ---------------------------------------------------------------------------
// Rows as the match page receives them from `getMatch` / `getPartnerships`
// ---------------------------------------------------------------------------

export interface LiveScorecardView {
  /** Innings with `batting_performances` / `bowling_performances` / `fall_of_wickets`. */
  innings: Array<Record<string, unknown>>;
  /** `getPartnerships` rows. */
  partnerships: Array<Record<string, unknown>>;
}

/**
 * The doc as the rows `getMatch` embeds in `innings(...)` (same ids, same
 * user embeds) and the rows `getPartnerships` returns.
 */
export function liveScorecardView(doc: LiveScorecardDoc): LiveScorecardView {
  const { innings, names } = decodeLiveScorecard(doc);
  const matchId = doc.match_id;
  const name = (id: unknown) =>
    typeof id === "string" && names[id] != null ? names[id] : null;
  const ref = (id: unknown) => {
    const n = name(id);
    return n === null ? null : { id: id as string, full_name: n };
  };
  const nameOnly = (id: unknown) => {
    const n = name(id);
    return n === null ? null : { full_name: n };
  };
  const partnerships: Array<Record<string, unknown>> = [];
  const out = innings.map((inn) => {
    const base = { match_id: matchId, innings_id: inn.id };
    (inn.partnerships ?? []).forEach((p, i) =>
      partnerships.push({
        ...p,
        id: `${inn.id}_p${i + 1}`,
        ...base,
        batsman1: nameOnly(p.batsman1_id),
        batsman2: nameOnly(p.batsman2_id),
      }),
    );
    const totals: Record<string, unknown> = { ...inn };
    delete totals.batting;
    delete totals.bowling;
    delete totals.fall_of_wickets;
    delete totals.partnerships;
    return {
      ...totals,
      match_id: matchId,
      batting_performances: (inn.batting ?? []).map((b) => ({
        ...b,
        id: `${inn.id}_${b.user_id}`,
        ...base,
        user: ref(b.user_id),
      })),
      bowling_performances: (inn.bowling ?? []).map((b) => ({
        ...b,
        id: `${inn.id}_${b.user_id}`,
        ...base,
        user: ref(b.user_id),
      })),
      fall_of_wickets: (inn.fall_of_wickets ?? []).map((f) => ({
        ...f,
        id: `${inn.id}_w${f.wicket_number}`,
        ...base,
        batsman: ref(f.batsman_out_id),
        bowler: nameOnly(f.bowler_id),
        fielder: nameOnly(f.fielder_id),
      })),
    };
  });
  return { innings: out, partnerships };
}
