import type {
  BattingPerformance,
  BowlingPerformance,
  TeamPlayer,
} from "~/lib/match-types";

/** One selectable row in the scoring screen's player picker. */
export interface PickerRow {
  id: string;
  name: string;
  /** Finds them by "@name", and tells two of one name apart. */
  username?: string | null;
  /** "(c)", "(wk)", "(vc)" */
  role?: string | null;
  /** Today's figures, e.g. "23 (17)" or "2-0-14-1". */
  detail?: string | null;
  /** Neutral marker such as "Striker", "Bowling". */
  tag?: string | null;
  /** Why the row cannot be picked; the row is disabled when set. */
  disabledReason?: string | null;
  /** Soft warning that does not block the pick, e.g. "Retired hurt". */
  note?: string | null;
}

export function roleLabel(role?: string | null): string | null {
  switch (role) {
    case "captain":
      return "(c)";
    case "vice_captain":
      return "(vc)";
    case "wicket_keeper":
      return "(wk)";
    default:
      return null;
  }
}

type PickablePlayer = Pick<TeamPlayer, "user_id"> &
  Partial<Pick<TeamPlayer, "batting_order" | "role_in_team">> & {
    user?: { full_name?: string | null; username?: string | null } | null;
  };

/** Dedupe by user id, drop blanks and excluded ids, keep roster order. */
function rosterOf<T extends PickablePlayer>(
  players: T[],
  exclude: Array<Set<string> | string | null | undefined> = [],
): T[] {
  const isExcluded = (id: string) =>
    exclude.some((e) => (typeof e === "string" ? e === id : e?.has(id)));
  const seen = new Map<string, T>();
  for (const p of players) {
    if (!p?.user_id || seen.has(p.user_id) || isExcluded(p.user_id)) continue;
    seen.set(p.user_id, p);
  }
  return Array.from(seen.values());
}

const nameOf = (p: PickablePlayer) => p.user?.full_name || "Unknown";

/**
 * Who may play for this side today (`sideRuleOf` in `~/lib/match-players`):
 * a reason means they played for the other side, and their row is shown
 * disabled with it rather than left out. `alsoIn` names the other squad
 * of someone in both, so the scorer knows why they are offered twice.
 */
export interface SideRules {
  unavailable?: (playerId: string) => string | null;
  alsoIn?: ReadonlyMap<string, string>;
}

/** The side's reason against a player, or a note that they are in both squads. */
function applySide(row: PickerRow, side: SideRules = {}): boolean {
  const reason = side.unavailable?.(row.id) ?? null;
  if (reason) {
    row.disabledReason = reason;
    return true;
  }
  const other = side.alsoIn?.get(row.id);
  if (other && !row.note) {
    row.note = `Also in ${other}${other.endsWith("s") ? "'" : "'s"} squad`;
  }
  return false;
}

/**
 * Batting candidates, ordered: yet to bat (batting order, then roster order;
 * in batting order, nobody preselected), retired hurt (may resume), the pair at the crease
 * (picking one swaps the slots), then dismissed batters (disabled).
 */
export function buildBatterRows({
  players,
  performances = [],
  dismissedIds,
  excludeIds,
  bowlerId,
  strikerId,
  nonStrikerId,
  side,
}: {
  players: PickablePlayer[];
  performances?: BattingPerformance[];
  dismissedIds?: Set<string>;
  excludeIds?: Set<string>;
  bowlerId?: string | null;
  strikerId?: string | null;
  nonStrikerId?: string | null;
  side?: SideRules;
}): { rows: PickerRow[] } {
  const perfs = new Map(performances.map((p) => [p.user_id, p]));
  const roster = rosterOf(players, [excludeIds, bowlerId]);

  const yetToBat: Array<{ row: PickerRow; order: number; index: number }> = [];
  const retired: PickerRow[] = [];
  const crease: PickerRow[] = [];
  const out: Array<{ row: PickerRow; position: number }> = [];
  const otherSide: PickerRow[] = [];

  roster.forEach((p, index) => {
    const perf = perfs.get(p.user_id);
    const row: PickerRow = {
      id: p.user_id,
      name: nameOf(p),
      username: p.user?.username,
      role: roleLabel(p.role_in_team),
      detail: perf
        ? `${perf.runs_scored ?? 0} (${perf.balls_faced ?? 0})`
        : null,
    };
    const isOut = perf?.is_out || dismissedIds?.has(p.user_id);
    if (!perf && applySide(row, side)) {
      otherSide.push(row);
    } else if (p.user_id === strikerId || p.user_id === nonStrikerId) {
      row.tag = p.user_id === strikerId ? "Striker" : "Non-striker";
      crease.push(row);
    } else if (isOut) {
      row.disabledReason =
        perf?.dismissal_type === "retired_out" ? "Retired out" : "Out";
      out.push({ row, position: perf?.batting_position ?? 99 });
    } else if (perf?.dismissal_type === "retired_hurt") {
      row.note = "Retired hurt";
      retired.push(row);
    } else {
      yetToBat.push({ row, order: p.batting_order ?? 99, index });
    }
  });

  yetToBat.sort((a, b) => a.order - b.order || a.index - b.index);
  out.sort((a, b) => a.position - b.position);

  return {
    rows: [
      ...yetToBat.map((y) => y.row),
      ...retired,
      ...crease,
      ...out.map((o) => o.row),
      ...otherSide,
    ],
  };
}

/** Standard limited-overs cap: a fifth of the innings, rounded up. */
export function bowlerQuota(oversPerInnings?: number | null): number | null {
  if (!oversPerInnings || oversPerInnings < 5) return null;
  return Math.ceil(oversPerInnings / 5);
}

/**
 * Bowling candidates, ordered: bowlers already in the attack (most overs
 * first), then the rest of the side in roster order, then those past the
 * usual quota (still allowed: the engine does not enforce it), then the
 * bowler of the previous over (disabled).
 */
export function buildBowlerRows({
  players,
  performances = [],
  excludeIds,
  batterIds = [],
  currentBowlerId,
  lastOverBowlerId,
  oversPerInnings,
  side,
}: {
  players: PickablePlayer[];
  performances?: BowlingPerformance[];
  excludeIds?: Set<string>;
  batterIds?: Array<string | null | undefined>;
  currentBowlerId?: string | null;
  lastOverBowlerId?: string | null;
  oversPerInnings?: number | null;
  side?: SideRules;
}): { rows: PickerRow[]; onlyEligibleId: string | null } {
  const perfs = new Map(performances.map((p) => [p.user_id, p]));
  const quota = bowlerQuota(oversPerInnings);
  const roster = rosterOf(players, [excludeIds, ...batterIds]);

  const used: Array<{ row: PickerRow; overs: number }> = [];
  const fresh: PickerRow[] = [];
  const capped: PickerRow[] = [];
  const blocked: PickerRow[] = [];

  for (const p of roster) {
    const perf = perfs.get(p.user_id);
    const completed = Math.floor(perf?.overs_bowled ?? 0);
    const left = quota !== null ? Math.max(quota - completed, 0) : null;
    const figures = perf
      ? `${perf.overs_bowled ?? 0}-${perf.maidens ?? 0}-${perf.runs_conceded ?? 0}-${perf.wickets_taken ?? 0}`
      : null;
    const row: PickerRow = {
      id: p.user_id,
      name: nameOf(p),
      username: p.user?.username,
      role: roleLabel(p.role_in_team),
      detail:
        figures && left !== null && left > 0
          ? `${figures} · ${left} left`
          : figures,
      tag: p.user_id === currentBowlerId ? "Bowling" : null,
    };
    if (!perf && applySide(row, side)) {
      blocked.push(row);
    } else if (lastOverBowlerId && p.user_id === lastOverBowlerId) {
      row.disabledReason = "Bowled last over";
      blocked.push(row);
    } else if (left === 0) {
      row.note = "Quota used";
      capped.push(row);
    } else if (perf) {
      used.push({ row, overs: perf.overs_bowled ?? 0 });
    } else {
      fresh.push(row);
    }
  }

  used.sort((a, b) => b.overs - a.overs);
  const eligible = [...used.map((u) => u.row), ...fresh, ...capped];
  return {
    rows: [...eligible, ...blocked],
    onlyEligibleId: eligible.length === 1 ? (eligible[0]?.id ?? null) : null,
  };
}

/** Fielders: the keeper first for a stumping, otherwise roster order. */
export function buildFielderRows({
  players,
  bowlerId,
  keeperFirst = false,
  side,
}: {
  players: PickablePlayer[];
  bowlerId?: string | null;
  keeperFirst?: boolean;
  side?: SideRules;
}): PickerRow[] {
  const all = rosterOf(players).map<PickerRow>((p) => ({
    id: p.user_id,
    name: nameOf(p),
    username: p.user?.username,
    role: roleLabel(p.role_in_team),
    tag: p.user_id === bowlerId ? "Bowler" : null,
  }));
  const otherSide = all.filter(
    (r) => r.id !== bowlerId && applySide(r, side),
  );
  const rows = all.filter((r) => !otherSide.includes(r));
  const ordered = keeperFirst
    ? [
        ...rows.filter((r) => r.role === "(wk)"),
        ...rows.filter((r) => r.role !== "(wk)"),
      ]
    : rows;
  return [...ordered, ...otherSide];
}
