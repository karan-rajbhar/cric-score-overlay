import { isWicketFall } from "~/lib/cricket";

/**
 * What a scorer's correction did, in a few ids and numbers: stored in
 * `live_state.last_change.correction` by the engine, so the other scorer's
 * screen can say what changed and who changed it (docs/scoring-corrections.md,
 * 1.5). Plain data, safe on the server and in the browser.
 */

export type CorrectionKind =
  | "edit_ball"
  | "over_bowler"
  | "swap_batters"
  | "rename_batter"
  | "replace_batter"
  | "replace_player"
  | "swap_players"
  | "undo";

export interface CorrectionNote {
  kind: CorrectionKind;
  innings_number?: number | null;
  /** Where the fix starts: the over (0-based) and the ball in it. */
  over?: number | null;
  ball?: number | null;
  /** Where a range ends; both null: the end of the innings. */
  to_over?: number | null;
  to_ball?: number | null;
  /**
   * The players: swap_batters the two batters, over_bowler the bowler
   * before and after, replace_* the player recorded and the one who played.
   */
  from_id?: string | null;
  to_id?: string | null;
}

const KINDS: readonly CorrectionKind[] = [
  "edit_ball",
  "over_bowler",
  "swap_batters",
  "rename_batter",
  "replace_batter",
  "replace_player",
  "swap_players",
  "undo",
];

const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v ? v : null;

/** A stored note, or null when it is not one (older docs have none). */
export function correctionNoteOf(value: unknown): CorrectionNote | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const kind = KINDS.find((k) => k === v.kind);
  if (!kind) return null;
  return {
    kind,
    innings_number: numOrNull(v.innings_number),
    over: numOrNull(v.over),
    ball: numOrNull(v.ball),
    to_over: numOrNull(v.to_over),
    to_ball: numOrNull(v.to_ball),
    from_id: strOrNull(v.from_id),
    to_id: strOrNull(v.to_id),
  };
}

/** The players on one entry of a ball log, as a correction reads them. */
export interface CorrectableBall {
  id: string;
  over_number?: number | null;
  ball_number?: number | null;
  batsman_id?: string | null;
  non_striker_id?: string | null;
  bowler_id?: string | null;
  is_wicket?: boolean | null;
  dismissed_player_id?: string | null;
}

/** Who took part in one entry, as corrected (a field left out stays). */
export interface BallPlayersFix {
  ball_id: string;
  batsman_id?: string;
  non_striker_id?: string | null;
  dismissed_player_id?: string | null;
  bowler_id?: string;
  fielder_id?: string | null;
}

/**
 * The batters were at the wrong ends from the entry `fromId` to `toId`
 * (null: the end of the innings) of `balls` (one innings, in `seq` order):
 * the two batters at the crease on the first entry, `a` (striker) and `b`,
 * change places wherever the range names them, as striker, non-striker or
 * batter out. Null when the range is not one (unknown entries, the end
 * before the start, nobody at an end). The engine's `swap_batters` and the
 * screen's preview both use this, so they cannot differ.
 */
export function swapBattersFixes<T extends CorrectableBall>(
  balls: readonly T[],
  fromId: string,
  toId: string | null,
): { fixes: BallPlayersFix[]; a: string; b: string; first: T; last: T | null } | null {
  const start = balls.findIndex((x) => x.id === fromId);
  const end = toId ? balls.findIndex((x) => x.id === toId) : balls.length - 1;
  if (start < 0 || end < 0 || end < start) return null;
  const first = balls[start]!;
  const a = first.batsman_id;
  const b = first.non_striker_id;
  if (!a || !b || a === b) return null;
  const swap = (id: string) => (id === a ? b : id === b ? a : id);
  const fixes: BallPlayersFix[] = [];
  for (const ball of balls.slice(start, end + 1)) {
    const fix: BallPlayersFix = { ball_id: ball.id };
    if (ball.batsman_id && swap(ball.batsman_id) !== ball.batsman_id)
      fix.batsman_id = swap(ball.batsman_id);
    if (ball.non_striker_id && swap(ball.non_striker_id) !== ball.non_striker_id)
      fix.non_striker_id = swap(ball.non_striker_id);
    if (
      ball.is_wicket &&
      ball.dismissed_player_id &&
      swap(ball.dismissed_player_id) !== ball.dismissed_player_id
    )
      fix.dismissed_player_id = swap(ball.dismissed_player_id);
    if (Object.keys(fix).length > 1) fixes.push(fix);
  }
  return { fixes, a, b, first, last: toId ? balls[end]! : null };
}

/**
 * Someone else bowled over `over` (0-based): its entries with a bowler go to
 * `bowlerId` (events without one stay). Null when the over has no balls.
 */
export function overBowlerFixes(
  balls: readonly CorrectableBall[],
  over: number,
  bowlerId: string,
): { fixes: BallPlayersFix[]; from: string | null } | null {
  const inOver = balls.filter((b) => b.over_number === over && b.bowler_id);
  if (inOver.length === 0) return null;
  return {
    fixes: inOver
      .filter((b) => b.bowler_id !== bowlerId)
      .map((b) => ({ ball_id: b.id, bowler_id: bowlerId })),
    from: inOver[0]!.bowler_id ?? null,
  };
}

/**
 * A wicket was added on the entry `atId`: the log has the batter now out
 * there (`outId`) still batting after it, which can only have been the
 * batter who came in (`laterId`). Every later entry naming `outId` (striker,
 * non-striker, batter out) names `laterId` instead. `balls` in `seq` order.
 * Edit ball's "Who came in?" (Play-Cricket Scorer Pro's reassignment of
 * subsequent balls); the engine and the screen's preview both use it.
 */
export function laterBallsTo<T extends CorrectableBall>(
  balls: readonly T[],
  atId: string,
  outId: string,
  laterId: string,
): T[] {
  const at = balls.findIndex((b) => b.id === atId);
  if (at < 0) return [...balls];
  const swap = (id: string | null | undefined) => (id === outId ? laterId : id);
  return balls.map((b, i) => {
    if (i <= at) return b;
    const named =
      b.batsman_id === outId ||
      b.non_striker_id === outId ||
      (b.is_wicket && b.dismissed_player_id === outId);
    if (!named) return b;
    return {
      ...b,
      batsman_id: swap(b.batsman_id) ?? b.batsman_id,
      non_striker_id: swap(b.non_striker_id) ?? null,
      ...(b.is_wicket
        ? { dismissed_player_id: swap(b.dismissed_player_id) ?? null }
        : {}),
    };
  });
}

/**
 * The batter out on `ball` when it names someone the later entries still
 * have at the crease (a wicket added after they batted on), with those
 * entries; null otherwise. `balls` in `seq` order.
 */
export function battedOnAfter<T extends CorrectableBall & { dismissal_type?: string | null }>(
  balls: readonly T[],
  ball: T,
): { outId: string; later: T[] } | null {
  if (!isWicketFall(ball)) return null;
  const outId = ball.dismissed_player_id ?? ball.batsman_id;
  if (!outId) return null;
  const at = balls.findIndex((b) => b.id === ball.id);
  if (at < 0) return null;
  const later = balls
    .slice(at + 1)
    .filter((b) => b.batsman_id === outId || b.non_striker_id === outId);
  return later.length ? { outId, later } : null;
}

/** `balls` with `fixes` applied (the screen's preview of a correction). */
export function withFixes<T extends CorrectableBall>(
  balls: readonly T[],
  fixes: readonly BallPlayersFix[],
): T[] {
  const byId = new Map(fixes.map((f) => [f.ball_id, f]));
  return balls.map((ball) => {
    const fix = byId.get(ball.id);
    if (!fix) return ball;
    const { ball_id: _id, ...fields } = fix;
    void _id;
    return { ...ball, ...fields };
  });
}

/**
 * Entries naming a batter at the crease after that batter was out (a
 * retirement hurt is not out), as `entryId:playerId`. `balls` in `seq`
 * order. A correction may not add any: the engine refuses it, and the
 * screen says so before sending.
 */
export function battingAfterOut(
  balls: readonly (CorrectableBall & {
    dismissal_type?: string | null;
  })[],
): Set<string> {
  const out = new Set<string>();
  const found = new Set<string>();
  for (const b of balls) {
    for (const id of [b.batsman_id, b.non_striker_id])
      if (id && out.has(id)) found.add(`${b.id}:${id}`);
    if (isWicketFall(b)) {
      const who = b.dismissed_player_id ?? b.batsman_id;
      if (who) out.add(who);
    }
  }
  return found;
}

/** "2.3": the over (0-based) and ball, as a scorecard writes them. */
function ballText(over: number | null | undefined, ball: number | null | undefined) {
  return over == null || ball == null ? null : `${over}.${ball}`;
}

/**
 * The correction in words, without who made it: "changed the bowler of
 * over 4 to Karan Rajbhar". `nameOf` gives a player's name (the scorecard's
 * names); unknown players read "a player".
 */
export function describeCorrection(
  note: CorrectionNote,
  nameOf: (id: string) => string | null | undefined,
): string {
  const name = (id: string | null | undefined) =>
    (id ? nameOf(id)?.trim() : null) || "a player";
  const at = ballText(note.over, note.ball);
  switch (note.kind) {
    case "over_bowler":
      return note.over == null
        ? `changed the bowler of an over to ${name(note.to_id)}`
        : `changed the bowler of over ${note.over + 1} to ${name(note.to_id)}`;
    case "swap_batters": {
      const until = ballText(note.to_over, note.to_ball);
      const range = at
        ? until
          ? ` from ${at} to ${until}`
          : ` from ${at} to the end of the innings`
        : "";
      return `swapped ${name(note.from_id)} and ${name(note.to_id)}${range}`;
    }
    case "replace_batter":
      return `replaced ${name(note.from_id)} with ${name(note.to_id)} for this innings`;
    case "replace_player":
      return `replaced ${name(note.from_id)} with ${name(note.to_id)} for the whole match`;
    case "rename_batter": {
      const until = ballText(note.to_over, note.to_ball);
      const range = at
        ? until
          ? ` from ${at} to ${until}`
          : ` from ${at} to the end of the innings`
        : "";
      return `gave ${name(note.from_id)}'s batting${range} to ${name(note.to_id)}`;
    }
    case "swap_players":
      return `swapped ${name(note.from_id)} and ${name(note.to_id)} for the whole match`;
    case "edit_ball":
      return at ? `corrected ball ${at}` : "corrected a ball";
    case "undo":
      return "undid a correction";
  }
}

/** The fields of an entry a stamp covers (what a correction reads). */
const STAMP_FIELDS = [
  "seq",
  "batsman_id",
  "non_striker_id",
  "bowler_id",
  "dismissed_player_id",
  "fielder_id",
  "is_wicket",
  "dismissal_type",
  "runs_scored",
  "extras",
  "extra_type",
  "no_ball_runs",
] as const;

const NUMERIC = new Set(["seq", "runs_scored", "extras"]);

/**
 * A short fingerprint of ball-log entries: a correction sends the stamp of
 * the entries it was worked out from, and the engine refuses it
 * (`changed_meanwhile`) when the entries it reads stamp differently, so a
 * correction never lands on balls another scorer changed meanwhile. Absent
 * fields read as their defaults, so a stored entry and the screen's copy of
 * it stamp alike.
 */
export function logStamp(entries: readonly object[]): string {
  const text = entries
    .map((e) => {
      const r = e as Record<string, unknown>;
      return [
        String(r.id ?? ""),
        ...STAMP_FIELDS.map((f) => {
          const v = r[f];
          if (f === "is_wicket") return v ? "1" : "0";
          if (NUMERIC.has(f)) return String(Number(v ?? 0));
          return v == null ? "" : String(v);
        }),
      ].join("|");
    })
    .join("\n");
  // FNV-1a, 32 bits: a check against a change, not a security measure.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** The fields of an entry a correction may change (for its history). */
export const CORRECTED_FIELDS = [
  "batsman_id",
  "non_striker_id",
  "dismissed_player_id",
  "bowler_id",
  "fielder_id",
  "runs_scored",
  "extras",
  "extra_type",
  "is_wicket",
  "dismissal_type",
  "no_ball_runs",
] as const;

/** One entry a correction changed: the changed fields before and after. */
export interface CorrectedEntry {
  id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

/**
 * The entries of `before` that `after` changed (same ids, any order), with
 * only the fields that differ; an absent field is recorded as null.
 */
export function changedEntries(
  before: readonly object[],
  after: readonly object[],
): CorrectedEntry[] {
  const was = new Map(
    before.map((e) => [String((e as { id?: unknown }).id), e as Record<string, unknown>]),
  );
  const out: CorrectedEntry[] = [];
  for (const e of after) {
    const now = e as Record<string, unknown>;
    const old = was.get(String(now.id));
    if (!old) continue;
    const b: Record<string, unknown> = {};
    const a: Record<string, unknown> = {};
    for (const f of CORRECTED_FIELDS) {
      const ov = old[f] ?? null;
      const nv = now[f] ?? null;
      if (ov !== nv) {
        b[f] = ov;
        a[f] = nv;
      }
    }
    if (Object.keys(a).length) out.push({ id: String(now.id), before: b, after: a });
  }
  return out;
}
