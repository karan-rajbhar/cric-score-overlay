/**
 * A no-ball now counts as a ball the striker faced (the Laws' scoring
 * convention; `matches.noball_counts_as_ball_faced` false leaves it out).
 * This plans bringing the figures stored before that in line, with the
 * engine's own code (scripts/migrate-noball-balls-faced.mjs runs it):
 *
 * - each innings holding a no-ball: its batters' `balls_faced` and its
 *   stands' balls and each batter's share (filled whole for a stand
 *   recorded before shares were kept) from `recomputeInnings` over its
 *   ball log; nothing else of the innings changes;
 * - then, in one scoring transaction per match on a copy of the store,
 *   what the engine derives from those innings: `live_scorecard`
 *   (`stageLiveScorecards`), `player_matches`, `player_career_stats` and
 *   the leaderboard shards of the players whose records change
 *   (`syncMatchRecords`). `innings_summary` holds no balls faced.
 *
 * The plan keeps only documents whose values change (timestamps aside), so
 * planning again after applying it gives nothing; the ball log (`overs`)
 * is only read.
 */

import {
  applyQueryOptions,
  memoryMatches,
  type DataSource,
  type Doc,
  type NativeFilter,
  type QueryOptions,
} from "./datasource";
import { LIVE_SCORECARD_COLLECTION } from "./live-scorecard";
import {
  ballLogOf,
  battingRowsOf,
  bowlingRowsOf,
  OVERS_COLLECTION,
  PLAYER_MATCHES_COLLECTION,
  type OversRow,
} from "./scorecard";
import { recomputeInnings } from "./scoring/recompute";
import { sameRow } from "./scoring/rows";
import { runScoringTransaction } from "./scoring/tx";
import { CAREER_COLLECTION, LEADERBOARDS_COLLECTION } from "./stats.mjs";
import { syncMatchRecords } from "./stats-sync";
import type { InningsRow, MatchesRow } from "./types";

/** Collections the plan may write (never the ball log). */
export const NOBALL_FACED_TABLES = [
  "innings",
  LIVE_SCORECARD_COLLECTION,
  PLAYER_MATCHES_COLLECTION,
  CAREER_COLLECTION,
  LEADERBOARDS_COLLECTION,
] as const;

export interface PlannedWrite {
  table: string;
  id: string;
  /** The document as read (null: absent). */
  before: Doc | null;
  /** The document to store (null: delete). */
  after: Doc | null;
}

export interface NoBallFacedPlan {
  /** Innings holding a no-ball (checked), and those whose figures change. */
  inningsChecked: number;
  inningsChanged: number;
  matches: number;
  writes: PlannedWrite[];
  /** Planned writes per collection. */
  byTable: Record<string, number>;
}

/** Whether an innings holds a no-ball (from its extras: no ball log read). */
export function hasNoBall(innings: Partial<InningsRow>): boolean {
  return (
    (innings.extras_no_balls ?? 0) > 0 ||
    (innings.bowling ?? []).some((b) => (b.no_balls ?? 0) > 0)
  );
}

type Stand = NonNullable<InningsRow["partnerships"]>[number];

/**
 * The innings' balls-faced figures by the engine's rules (batters'
 * `balls_faced`, stands' balls and shares), or null when none changes.
 */
export function facedFiguresOf(
  match: MatchesRow & { id: string },
  innings: InningsRow & { id: string },
  overs: OversRow[],
  now: string,
): Pick<InningsRow, "batting" | "partnerships"> | null {
  const out = recomputeInnings({
    match,
    innings,
    balls: ballLogOf(overs),
    existingBatting: battingRowsOf(innings),
    existingBowling: bowlingRowsOf(innings),
    now,
  });
  const faced = new Map(out.batting.map((b) => [b.user_id, b.balls_faced ?? 0]));
  const batting = (innings.batting ?? []).map((e) => {
    const n = faced.get(e.user_id);
    return n !== undefined && n !== (e.balls_faced ?? 0)
      ? { ...e, balls_faced: n }
      : e;
  });

  // Stands: only when the log gives back the same stands, in order.
  const stored = innings.partnerships ?? [];
  const rebuilt = out.partnerships;
  const pair = (s: { batsman1_id: string; batsman2_id: string }) =>
    [s.batsman1_id, s.batsman2_id].sort().join("|");
  const same =
    rebuilt.length === stored.length &&
    rebuilt.every((r, i) => pair(r) === pair(stored[i]!));
  // An innings whose stands' balls move is one migrate-partnership-splits
  // could no longer match: its stands without shares get them whole here.
  const standsMove =
    same && stored.some((s, i) => (s.balls ?? 0) !== rebuilt[i]!.balls);
  const partnerships = same
    ? stored.map((s, i): Stand => {
        const r = rebuilt[i]!;
        const hasShares = s.batsman1_runs != null && s.batsman2_runs != null;
        if (!hasShares && !standsMove) return s;
        const flipped = s.batsman1_id !== r.batsman1_id;
        const next: Stand = {
          ...s,
          balls: r.balls,
          batsman1_balls: flipped ? r.batsman2_balls : r.batsman1_balls,
          batsman2_balls: flipped ? r.batsman1_balls : r.batsman2_balls,
        };
        if (!hasShares) {
          next.batsman1_runs = flipped ? r.batsman2_runs : r.batsman1_runs;
          next.batsman2_runs = flipped ? r.batsman1_runs : r.batsman2_runs;
        }
        return next;
      })
    : stored;

  const changed =
    JSON.stringify(batting) !== JSON.stringify(innings.batting ?? []) ||
    JSON.stringify(partnerships) !== JSON.stringify(stored);
  return changed ? { batting, partnerships } : null;
}

/**
 * Reads through to `source`; writes stay here (the plan), and later reads
 * see them.
 */
export class CaptureDataSource implements DataSource {
  readonly kind = "memory" as const;
  readonly writes = new Map<string, Doc | null>();

  constructor(private readonly source: DataSource) {}

  private key(table: string, id: string) {
    return `${table}/${id}`;
  }

  private captured(table: string, id: string): Doc | null | undefined {
    return this.writes.get(this.key(table, id));
  }

  async getById(table: string, id: string): Promise<Doc | null> {
    const own = this.captured(table, id);
    if (own !== undefined) return own ? structuredClone(own) : null;
    return this.source.getById(table, id);
  }

  async getByIds(table: string, ids: string[]): Promise<Doc[]> {
    const rest = ids.filter((id) => this.captured(table, id) === undefined);
    const read = rest.length ? await this.source.getByIds(table, rest) : [];
    const byId = new Map(read.map((d) => [d.id, d]));
    const out: Doc[] = [];
    for (const id of ids) {
      const own = this.captured(table, id);
      const doc = own !== undefined ? own : byId.get(id);
      if (doc) out.push(structuredClone(doc));
    }
    return out;
  }

  async query(
    table: string,
    filters: NativeFilter[],
    options?: QueryOptions,
  ): Promise<Doc[]> {
    const read = await this.source.query(table, filters);
    const out = new Map(read.map((d) => [d.id, d]));
    for (const [key, doc] of this.writes) {
      const [t, ...rest] = key.split("/");
      if (t !== table) continue;
      const id = rest.join("/");
      if (doc && filters.every((f) => memoryMatches(doc, f))) out.set(id, doc);
      else out.delete(id);
    }
    return applyQueryOptions(
      [...out.values()].map((d) => structuredClone(d)),
      filters,
      options,
    );
  }

  async count(table: string, filters: NativeFilter[]): Promise<number> {
    return (await this.query(table, filters)).length;
  }

  async insert(table: string, docs: Doc[]): Promise<void> {
    for (const doc of docs) {
      this.writes.set(this.key(table, doc.id), structuredClone(doc));
    }
  }

  async update(
    table: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const base = await this.getById(table, id);
    if (!base) return;
    this.writes.set(this.key(table, id), { ...base, ...structuredClone(patch), id });
  }

  async delete(table: string, id: string): Promise<void> {
    this.writes.set(this.key(table, id), null);
  }
}

/**
 * The plan for every innings holding a no-ball (or those of `matchIds`).
 * Reads: all innings (one query), then per affected match its document,
 * the affected innings' over documents and what the engine reads to
 * derive its records.
 */
export async function planNoBallFaced(
  source: DataSource,
  options: { now: string; matchIds?: string[] },
): Promise<NoBallFacedPlan> {
  const allInnings = (await source.query("innings", [])) as unknown as Array<
    InningsRow & { id: string }
  >;
  const wanted = options.matchIds ? new Set(options.matchIds) : null;
  const checked = allInnings.filter(
    (i) =>
      i.match_id &&
      (!wanted || wanted.has(i.match_id)) &&
      Array.isArray(i.batting) &&
      hasNoBall(i),
  );
  const byMatch = new Map<string, Array<InningsRow & { id: string }>>();
  for (const inn of checked) {
    const list = byMatch.get(inn.match_id!) ?? [];
    list.push(inn);
    byMatch.set(inn.match_id!, list);
  }

  const capture = new CaptureDataSource(source);
  let inningsChanged = 0;
  let matches = 0;
  for (const [matchId, list] of byMatch) {
    const match = (await source.getById("matches", matchId)) as unknown as
      | (MatchesRow & { id: string })
      | null;
    if (!match) continue;
    const patches: Array<{ id: string; data: Partial<InningsRow> }> = [];
    for (const inn of list) {
      const overs = (await source.query(OVERS_COLLECTION, [
        { field: "innings_id", op: "==", value: inn.id },
      ])) as unknown as OversRow[];
      if (!overs.length) continue;
      const data = facedFiguresOf(match, inn, overs, options.now);
      if (data) patches.push({ id: inn.id, data });
    }
    if (!patches.length) continue;
    matches += 1;
    inningsChanged += patches.length;
    // The engine derives the rest from the innings, as after any change.
    await runScoringTransaction({ ds: capture }, async (t) => {
      for (const p of patches) t.patch("innings", p.id, p.data);
      const innings = allInnings
        .filter((i) => i.match_id === matchId)
        .map((i) => {
          const p = patches.find((x) => x.id === i.id);
          return p ? { ...i, ...p.data } : i;
        });
      await syncMatchRecords(t, matchId, match, innings, options.now);
    });
  }

  const writes: PlannedWrite[] = [];
  for (const [key, after] of capture.writes) {
    const [table, ...rest] = key.split("/");
    const id = rest.join("/");
    if (!(NOBALL_FACED_TABLES as readonly string[]).includes(table!)) continue;
    const before = await source.getById(table!, id);
    // A live scorecard is updated, never created for an older match.
    if (table === LIVE_SCORECARD_COLLECTION && !before) continue;
    if (before && after && sameRow(after, before)) continue;
    if (!before && !after) continue;
    writes.push({ table: table!, id, before, after });
  }
  const byTable: Record<string, number> = {};
  for (const w of writes) byTable[w.table] = (byTable[w.table] ?? 0) + 1;
  return {
    inningsChecked: checked.length,
    inningsChanged,
    matches,
    writes,
    byTable,
  };
}
