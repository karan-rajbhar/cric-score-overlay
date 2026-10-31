/**
 * Scorecard storage (schema stage 2).
 *
 * - `innings/{id}` carries its own scorecard: `batting`, `bowling`,
 *   `fall_of_wickets` and `partnerships` arrays (the former row documents
 *   without their redundant ids), plus two caches the scoring engine keeps
 *   in step with the ball log: `last_ball` (the delivery with the highest
 *   `seq`) and `last_over_bowler_id` (who bowled the last completed over).
 * - `overs/{inningsId}_{overNumber}` holds the ball log, one document per
 *   over: `{ match_id, innings_id, over_number, balls: [...] }` with balls
 *   in `seq` order.
 * - `player_matches/{matchId}_{userId}` is the per-player record of a match
 *   for career / player pages, built from the match's completed innings.
 *
 * The ball log stays the source of truth; everything else is derived by the
 * scoring engine. This module holds the pure conversions between storage and
 * the legacy row shapes (`BattingPerformancesRow`, `BallByBallRow`, ...) the
 * engine and the UI work with.
 */

import type {
  BallByBallRow,
  BattingPerformancesRow,
  BowlingPerformancesRow,
  FallOfWicketsRow,
  InningsRow,
  MatchesRow,
  PartnershipsRow,
} from "./types";
import { fieldingCreditOf } from "../cricket";
import { clubTeamIdsOf } from "./derive.mjs";

export const OVERS_COLLECTION = "overs";
export const PLAYER_MATCHES_COLLECTION = "player_matches";

export type BattingEntry = Omit<
  BattingPerformancesRow,
  "id" | "match_id" | "innings_id" | "created_at" | "updated_at"
>;
export type BowlingEntry = Omit<
  BowlingPerformancesRow,
  "id" | "match_id" | "innings_id" | "created_at" | "updated_at"
>;
export type FallOfWicketEntry = Omit<
  FallOfWicketsRow,
  "id" | "match_id" | "innings_id" | "created_at"
>;
export type PartnershipEntry = Omit<
  PartnershipsRow,
  "id" | "match_id" | "innings_id" | "created_at" | "updated_at"
>;
export type BallEntry = Omit<
  BallByBallRow,
  "match_id" | "innings_id" | "over_number"
>;
export type LastBall = BallEntry & { over_number: number };

/** Innings fields added by stage 2. */
export interface InningsScorecard {
  batting: BattingEntry[];
  bowling: BowlingEntry[];
  fall_of_wickets: FallOfWicketEntry[];
  partnerships: PartnershipEntry[];
  last_ball: LastBall | null;
  last_over_bowler_id: string | null;
}

/**
 * Innings fields only the scoring engine uses (hidden from `select("*")`,
 * see `HIDDEN_COLUMNS`, and dropped by {@link withoutScorecardStorage}).
 */
export const INNINGS_INTERNAL_FIELDS = [
  "recent_client_actions",
  "carried_penalties",
] as const;

export const SCORECARD_FIELDS = [
  "batting",
  "bowling",
  "fall_of_wickets",
  "partnerships",
  "last_ball",
  "last_over_bowler_id",
] as const;

/**
 * `value` with every string equal to `oldId` replaced by `newId`, however
 * deep (a player's id inside scorecard arrays and ball entries).
 */
export function replaceDeep(
  value: unknown,
  oldId: string,
  newId: string,
): unknown {
  if (value === oldId) return newId;
  if (Array.isArray(value))
    return value.map((v) => replaceDeep(v, oldId, newId));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value))
      out[k] = replaceDeep(v, oldId, newId);
    return out;
  }
  return value;
}

export interface OversRow {
  id: string;
  match_id: string;
  innings_id: string;
  over_number: number;
  balls: BallEntry[];
  updated_at: string | null;
}

export type PlayerMatchBatting = BattingEntry & {
  innings_id: string;
  innings_number: number;
};
export type PlayerMatchBowling = BowlingEntry & {
  innings_id: string;
  innings_number: number;
};

export interface PlayerMatchesRow {
  id: string;
  user_id: string;
  match_id: string;
  tournament_id: string | null;
  club_id: string | null;
  season_id: string | null;
  /** `matches.scheduled_at` (else `created_at`) when written. */
  match_date: string | null;
  /** One entry per completed innings the player batted / bowled in. */
  batting: PlayerMatchBatting[];
  bowling: PlayerMatchBowling[];
  /** Dismissals the player completed as fielder in completed innings. */
  fielding: { catches: number; stumpings: number; run_outs: number };
  updated_at: string | null;
}

export function overDocId(inningsId: string, overNumber: number): string {
  return `${inningsId}_${overNumber}`;
}

/**
 * Id for a new delivery: its over document id, `~`, then a random part, so
 * `update_ball` reads that one over document instead of the match's whole
 * ball log (deliveries never move between overs). Older ids are plain
 * UUIDs; {@link overDocIdOfBall} returns null for them.
 */
export function newBallId(
  inningsId: string,
  overNumber: number,
  random: string,
): string {
  return `${overDocId(inningsId, overNumber)}~${random}`;
}

export function overDocIdOfBall(ballId: string): string | null {
  const cut = ballId.lastIndexOf("~");
  return cut > 0 ? ballId.slice(0, cut) : null;
}

export function playerMatchId(matchId: string, userId: string): string {
  return `${matchId}_${userId}`;
}

function omit<T extends object>(row: T, keys: readonly string[]): never {
  const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const k of keys) delete copy[k];
  // Firestore has no `undefined`; keep missing optional fields as null.
  for (const [k, v] of Object.entries(copy))
    if (v === undefined) copy[k] = null;
  return copy as never;
}

const ROW_KEYS = ["id", "match_id", "innings_id", "created_at", "updated_at"];
const BALL_KEYS = ["match_id", "innings_id", "over_number"];

export const toBattingEntry = (r: BattingPerformancesRow): BattingEntry =>
  omit(r, ROW_KEYS);
export const toBowlingEntry = (r: BowlingPerformancesRow): BowlingEntry =>
  omit(r, ROW_KEYS);
export const toFallOfWicketEntry = (r: FallOfWicketsRow): FallOfWicketEntry =>
  omit(r, ROW_KEYS);
export const toPartnershipEntry = (r: PartnershipsRow): PartnershipEntry =>
  omit(r, ROW_KEYS);
export const toBallEntry = (b: BallByBallRow): BallEntry => omit(b, BALL_KEYS);

type InningsRef = Pick<InningsRow, "id" | "match_id"> &
  Partial<Pick<InningsRow, "created_at" | "updated_at">> &
  Partial<InningsScorecard>;

function rowBase(inn: InningsRef) {
  return {
    match_id: inn.match_id ?? null,
    innings_id: inn.id,
  };
}

export function battingRowsOf(inn: InningsRef): BattingPerformancesRow[] {
  return (inn.batting ?? []).map((e) => ({
    ...e,
    id: `${inn.id}_${e.user_id}`,
    ...rowBase(inn),
    created_at: inn.created_at ?? null,
    updated_at: inn.updated_at ?? null,
  }));
}

export function bowlingRowsOf(inn: InningsRef): BowlingPerformancesRow[] {
  return (inn.bowling ?? []).map((e) => ({
    ...e,
    id: `${inn.id}_${e.user_id}`,
    ...rowBase(inn),
    created_at: inn.created_at ?? null,
    updated_at: inn.updated_at ?? null,
  }));
}

export function fallOfWicketRowsOf(inn: InningsRef): FallOfWicketsRow[] {
  return (inn.fall_of_wickets ?? []).map((e) => ({
    ...e,
    id: `${inn.id}_w${e.wicket_number}`,
    ...rowBase(inn),
    created_at: inn.created_at ?? null,
  }));
}

export function partnershipRowsOf(inn: InningsRef): PartnershipsRow[] {
  return (inn.partnerships ?? []).map((e, i) => ({
    ...e,
    id: `${inn.id}_p${i + 1}`,
    ...rowBase(inn),
    created_at: inn.created_at ?? null,
    updated_at: inn.updated_at ?? null,
  }));
}

export function ballRowsOf(
  over: Pick<OversRow, "match_id" | "innings_id" | "over_number" | "balls">,
): BallByBallRow[] {
  return (over.balls ?? []).map((b) => ({
    ...b,
    match_id: over.match_id,
    innings_id: over.innings_id,
    over_number: over.over_number,
  }));
}

export function lastBallRowOf(
  inn: Pick<InningsRow, "id" | "match_id"> & { last_ball?: LastBall | null },
): BallByBallRow | null {
  const b = inn.last_ball;
  return b
    ? { ...b, match_id: inn.match_id ?? null, innings_id: inn.id }
    : null;
}

export function bySeq(a: { seq?: number | null }, b: { seq?: number | null }) {
  return (a.seq ?? 0) - (b.seq ?? 0);
}

/** Every ball of an innings, from its over documents, in `seq` order. */
export function ballLogOf(overs: OversRow[]): BallByBallRow[] {
  return overs.flatMap(ballRowsOf).sort(bySeq);
}

/** Groups balls into over documents (balls in `seq` order). */
export function oversOfBalls(
  matchId: string,
  inningsId: string,
  balls: BallByBallRow[],
  now: string,
): OversRow[] {
  const byOver = new Map<number, BallByBallRow[]>();
  for (const b of balls) {
    const list = byOver.get(b.over_number) ?? [];
    list.push(b);
    byOver.set(b.over_number, list);
  }
  return Array.from(byOver.entries())
    .sort(([a], [b]) => a - b)
    .map(([overNumber, list]) => ({
      id: overDocId(inningsId, overNumber),
      match_id: matchId,
      innings_id: inningsId,
      over_number: overNumber,
      balls: [...list].sort(bySeq).map(toBallEntry),
      updated_at: now,
    }));
}

/**
 * Bowler of the over before the current one (`floor(totalBalls / bpo) - 1`):
 * the last ball by `seq` among that over's balls numbered `bpo`, else among
 * all of its balls. Mid-over this is the ScoringState `last_over_bowler_id`.
 */
export function lastOverBowlerOf(
  balls: Pick<
    BallByBallRow,
    "over_number" | "ball_number" | "seq" | "bowler_id"
  >[],
  totalBalls: number,
  ballsPerOver: number,
): string | null {
  const bpo = ballsPerOver > 0 ? ballsPerOver : 6;
  const current = Math.floor(totalBalls / bpo);
  if (current <= 0) return null;
  const previous = balls.filter((b) => b.over_number === current - 1);
  const ending = previous.filter((b) => b.ball_number === bpo);
  const pool = ending.length ? ending : previous;
  if (!pool.length) return null;
  const last = [...pool].sort(bySeq)[pool.length - 1]!;
  return last.bowler_id ?? null;
}

export function lastBallOf(balls: BallByBallRow[]): LastBall | null {
  if (!balls.length) return null;
  const last = [...balls].sort(bySeq)[balls.length - 1]!;
  return { ...toBallEntry(last), over_number: last.over_number };
}

/** The stage 2 innings fields for a scorecard computed from `balls`. */
export function scorecardFields(input: {
  batting: BattingPerformancesRow[];
  bowling: BowlingPerformancesRow[];
  fallOfWickets: FallOfWicketsRow[];
  partnerships: PartnershipsRow[];
  balls: BallByBallRow[];
  totalBalls: number;
  ballsPerOver: number;
}): InningsScorecard {
  return {
    batting: input.batting.map(toBattingEntry),
    bowling: input.bowling.map(toBowlingEntry),
    fall_of_wickets: input.fallOfWickets.map(toFallOfWicketEntry),
    partnerships: input.partnerships.map(toPartnershipEntry),
    last_ball: lastBallOf(input.balls),
    last_over_bowler_id: lastOverBowlerOf(
      input.balls,
      input.totalBalls,
      input.ballsPerOver,
    ),
  };
}

/**
 * The match's ball `seq` counter (the highest seq assigned so far): the
 * larger of the legacy `matches.last_ball_seq` and the innings' counters
 * (the current innings holds it; see `InningsRow.last_ball_seq`). Null when
 * none of them has one (data that predates the counter).
 */
export function seqCounterOf(
  match: Pick<MatchesRow, "last_ball_seq">,
  ...innings: ReadonlyArray<
    Pick<InningsRow, "last_ball_seq"> | null | undefined
  >
): number | null {
  let best: number | null =
    typeof match.last_ball_seq === "number" ? match.last_ball_seq : null;
  for (const inn of innings) {
    const v = inn?.last_ball_seq;
    if (typeof v === "number" && (best === null || v > best)) best = v;
  }
  return best;
}

/**
 * `InningsRow.carried_penalties` for an innings with this ball log: the
 * fielding-side penalty events logged in it for the other side, in `seq`
 * order (what `openNextInnings` carries into that side's next innings).
 */
export function carriedPenaltiesOf(
  innings: Pick<InningsRow, "team_id">,
  balls: readonly BallByBallRow[],
): LastBall[] {
  return [...balls]
    .sort(bySeq)
    .filter((b) => !!b.penalty_team_id && b.penalty_team_id !== innings.team_id)
    .map((b) => ({ ...toBallEntry(b), over_number: b.over_number }));
}

export function ballsPerOverOf(
  match: Pick<MatchesRow, "balls_per_over">,
): number {
  return match.balls_per_over && match.balls_per_over > 0
    ? match.balls_per_over
    : 6;
}

// ---------------------------------------------------------------------------
// player_matches
// ---------------------------------------------------------------------------

type MatchRef = Pick<MatchesRow, "id"> &
  Partial<
    Pick<
      MatchesRow,
      | "tournament_id"
      | "club_id"
      | "club_side"
      | "team1_id"
      | "team2_id"
      | "season_id"
      | "scheduled_at"
      | "created_at"
    >
  >;

/**
 * The `player_matches` documents a match should have: one per player who
 * batted, bowled or took a catch / stumping / run-out in a completed innings.
 * Only players of the club's side (`club_side`, {@link clubTeamIdsOf}) carry
 * the match's `club_id`: an outside opponent's records stay out of the club
 * statistics but still count for their careers.
 */
export function playerMatchDocs(
  match: MatchRef,
  innings: (InningsRef &
    Pick<InningsRow, "innings_number" | "is_completed"> &
    Partial<Pick<InningsRow, "team_id">>)[],
  now: string,
): PlayerMatchesRow[] {
  const docs = new Map<string, PlayerMatchesRow>();
  const docOf = (userId: string) => {
    let doc = docs.get(userId);
    if (!doc) {
      doc = emptyPlayerMatch(match, userId, now);
      docs.set(userId, doc);
    }
    return doc;
  };
  const completed = innings
    .filter((i) => i.is_completed)
    .sort((a, b) => a.innings_number - b.innings_number);
  for (const inn of completed) {
    const tag = { innings_id: inn.id, innings_number: inn.innings_number };
    for (const e of inn.batting ?? [])
      docOf(e.user_id).batting.push({ ...e, ...tag });
    for (const e of inn.bowling ?? [])
      docOf(e.user_id).bowling.push({ ...e, ...tag });
    for (const f of inn.fall_of_wickets ?? []) {
      const key = fieldingCreditOf(f.dismissal_type);
      if (f.fielder_id && key) docOf(f.fielder_id).fielding[key] += 1;
    }
  }
  const club = clubPlayerIds(match, completed);
  return Array.from(docs.values(), (doc) =>
    club && !club.has(doc.user_id) ? { ...doc, club_id: null } : doc,
  );
}

/**
 * The players who played for the club's side (`clubTeamIdsOf`): its
 * batters, and the bowlers and fielders of the innings it fielded in. Null
 * when both sides are the club's.
 */
function clubPlayerIds(
  match: MatchRef,
  innings: (InningsRef & Partial<Pick<InningsRow, "team_id">>)[],
): Set<string> | null {
  const clubTeams = clubTeamIdsOf(match);
  if (!clubTeams) return null;
  const isClub = (teamId: string | null) =>
    !!teamId && clubTeams.includes(teamId);
  const ids = new Set<string>();
  for (const inn of innings) {
    const batting = inn.team_id ?? null;
    const batters = (inn.batting ?? []).map((e) => e.user_id);
    const fielders = [
      ...(inn.bowling ?? []).map((e) => e.user_id),
      ...(inn.fall_of_wickets ?? []).flatMap((f) =>
        f.fielder_id ? [f.fielder_id] : [],
      ),
    ];
    if (isClub(batting)) batters.forEach((id) => ids.add(id));
    if (isClub(opponentOf(match, batting))) {
      fielders.forEach((id) => ids.add(id));
    }
  }
  return ids;
}

function emptyPlayerMatch(
  match: MatchRef,
  userId: string,
  now: string,
): PlayerMatchesRow {
  return {
    id: playerMatchId(match.id, userId),
    user_id: userId,
    match_id: match.id,
    tournament_id: match.tournament_id ?? null,
    club_id: match.club_id ?? null,
    season_id: match.season_id ?? null,
    match_date: match.scheduled_at ?? match.created_at ?? null,
    batting: [],
    bowling: [],
    fielding: { catches: 0, stumpings: 0, run_outs: 0 },
    updated_at: now,
  };
}

/** The other team of the match (the fielding side of `teamId`'s innings). */
function opponentOf(
  match: Pick<MatchRef, "team1_id" | "team2_id">,
  teamId: string | null,
): string | null {
  if (teamId && teamId === match.team1_id) return match.team2_id ?? null;
  if (teamId && teamId === match.team2_id) return match.team1_id ?? null;
  return null;
}

export function battingRowsOfPlayerMatch(
  doc: PlayerMatchesRow,
): BattingPerformancesRow[] {
  return (doc.batting ?? []).map((e) => {
    const { innings_number: _n, ...entry } = e;
    void _n;
    return {
      ...entry,
      id: `${e.innings_id}_${doc.user_id}`,
      match_id: doc.match_id,
      innings_id: e.innings_id,
      created_at: doc.match_date,
      updated_at: doc.updated_at,
    };
  });
}

export function bowlingRowsOfPlayerMatch(
  doc: PlayerMatchesRow,
): BowlingPerformancesRow[] {
  return (doc.bowling ?? []).map((e) => {
    const { innings_number: _n, ...entry } = e;
    void _n;
    return {
      ...entry,
      id: `${e.innings_id}_${doc.user_id}`,
      match_id: doc.match_id,
      innings_id: e.innings_id,
      created_at: doc.match_date,
      updated_at: doc.updated_at,
    };
  });
}

/**
 * An innings document without its storage-only scorecard fields, for
 * responses that expose the scorecard as legacy rows instead (relations such
 * as `batting_performances(...)`). Fields named in `keep` stay (e.g. a
 * `fall_of_wickets(...)` relation that replaced the raw array).
 */
export function withoutScorecardStorage<T extends object>(
  innings: T,
  keep: readonly string[] = [],
): T {
  const copy: Record<string, unknown> = {
    ...(innings as Record<string, unknown>),
  };
  for (const k of SCORECARD_FIELDS) if (!keep.includes(k)) delete copy[k];
  for (const k of INNINGS_INTERNAL_FIELDS) delete copy[k];
  return copy as T;
}
