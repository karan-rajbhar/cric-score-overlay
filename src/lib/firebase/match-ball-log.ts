/**
 * A match's ball log from the ball-log archives of its completed innings
 * (see `ball-log-archive.ts`), building the missing ones, plus the over
 * documents of the innings in play. Server only (the `match_ball_log` rpc
 * behind `getMatchBallLog`). Kept apart from `ball-log-archive.ts`, which
 * the scoring transaction imports: this imports the transaction.
 */

import type { Firestore } from "firebase-admin/firestore";
import {
  BALL_LOGS_COLLECTION,
  ballLogStamp,
  type BallLogDoc,
  type InningsDoc,
} from "./ball-log-archive";
import type { DataSource, Doc } from "./datasource";
import { ballRowsOf, OVERS_COLLECTION, type OversRow } from "./scorecard";
import { runScoringTransaction } from "./scoring/tx";

/** Ball rows of over documents, with the innings they belong to. */
function rowsOf(
  overs: Array<Pick<OversRow, "over_number" | "balls">>,
  innings: InningsDoc,
  matchId: string,
): Doc[] {
  const embed = {
    innings_number: innings.innings_number ?? null,
    team_id: innings.team_id ?? null,
  };
  return overs.flatMap((o) =>
    ballRowsOf({
      match_id: matchId,
      innings_id: innings.id,
      over_number: o.over_number,
      balls: o.balls,
    }).map((row) => ({ ...row, innings: { ...embed } }) as unknown as Doc),
  );
}

const byOver = (
  a: Pick<OversRow, "over_number">,
  b: Pick<OversRow, "over_number">,
) => a.over_number - b.over_number;

/**
 * Archive a completed innings (in a transaction over it and its overs) and
 * return its overs; null when it is no longer completed.
 */
async function archiveInnings(
  ctx: { ds: DataSource; db?: Firestore | null },
  inningsId: string,
): Promise<{ innings: InningsDoc; overs: OversRow[] } | null> {
  return runScoringTransaction(ctx, async (t) => {
    const [innings, overs] = await Promise.all([
      t.doc<InningsDoc>("innings", inningsId),
      t.where<OversRow>(OVERS_COLLECTION, [["innings_id", "==", inningsId]]),
    ]);
    if (!innings || innings.is_completed !== true) return null;
    const sorted = [...overs].sort(byOver);
    const doc: BallLogDoc = {
      match_id: String(innings.match_id ?? ""),
      innings_id: inningsId,
      stamp: ballLogStamp(innings),
      overs: sorted.map((o) => ({
        over_number: o.over_number,
        balls: o.balls,
      })),
      built_at: new Date().toISOString(),
    };
    t.put(BALL_LOGS_COLLECTION, inningsId, doc);
    return { innings, overs: sorted };
  });
}

/**
 * Every ball of a match as `ball_by_ball` rows (with `innings` =
 * `{ innings_number, team_id }`), in `seq` order: what
 * `from("ball_by_ball").select("*, innings(innings_number, team_id)")
 * .eq("match_id", id).order("seq")` returns, read from the archives of its
 * completed innings (building the missing ones) and the over documents of
 * the innings in play.
 */
export async function matchBallLog(
  ctx: { ds: DataSource; db?: Firestore | null },
  matchId: string,
): Promise<Doc[]> {
  const { ds } = ctx;
  const innings = (await ds.query("innings", [
    { field: "match_id", op: "==", value: matchId },
  ])) as InningsDoc[];
  const completed = innings.filter((i) => i.is_completed === true);
  const archives = new Map(
    (completed.length
      ? await ds.getByIds(
          BALL_LOGS_COLLECTION,
          completed.map((i) => i.id),
        )
      : []
    ).map((a) => [a.id, a as unknown as BallLogDoc & { id: string }]),
  );

  const rows: Doc[] = [];
  const unarchived: InningsDoc[] = [];
  for (const inn of innings) {
    const archive = archives.get(inn.id);
    if (inn.is_completed === true && archive?.stamp === ballLogStamp(inn)) {
      rows.push(...rowsOf(archive.overs ?? [], inn, matchId));
    } else {
      unarchived.push(inn);
    }
  }
  const inPlay: InningsDoc[] = [];
  for (const inn of unarchived) {
    const built =
      inn.is_completed === true ? await archiveInnings(ctx, inn.id) : null;
    if (built) rows.push(...rowsOf(built.overs, built.innings, matchId));
    else inPlay.push(inn);
  }
  if (inPlay.length) {
    const overs = (await ds.query(OVERS_COLLECTION, [
      { field: "innings_id", op: "in", value: inPlay.map((i) => i.id) },
    ])) as unknown as OversRow[];
    for (const inn of inPlay) {
      rows.push(
        ...rowsOf(
          overs.filter((o) => o.innings_id === inn.id).sort(byOver),
          inn,
          matchId,
        ),
      );
    }
  }
  return rows.sort(
    (a, b) =>
      Number(a.seq ?? 0) - Number(b.seq ?? 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
