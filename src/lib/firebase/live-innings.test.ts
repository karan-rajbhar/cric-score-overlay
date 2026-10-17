/**
 * A live match's innings in progress in match lists: its summary entry is
 * not rewritten per ball, so lists that show it bring it up to date from
 * documents they read anyway (leaderboards: the live innings; player page:
 * the live scorecard) or with one read per live match (team page).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource, type Doc } from "./datasource";
import { inningsSummaryEntry } from "./derive.mjs";
import { loadScopeLeaderboard, type ScopeMatch } from "./leaderboards";
import { liveScorecardInnings, withLiveInnings } from "./live-innings";
import { buildLiveScorecard } from "./live-scorecard";
import { serverClientFor } from "./server-client";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;
const live = seed.matches!.find((m) => m.status === "live")!;
const inProgress = seed.innings!.find(
  (i) => i.match_id === live.id && !i.is_completed,
)!;

const SELECT =
  "id, status, team1_id, team2_id, innings(id, team_id, innings_number, total_runs, total_wickets, total_balls, total_overs, is_completed)";

/** The seed with the live match's summary left behind its innings. */
function staleSeed() {
  const data = structuredClone(seed);
  const m = data.matches!.find((x) => x.id === live.id)!;
  m.innings_summary = (m.innings_summary as Doc[]).map((e) =>
    e.id === inProgress.id
      ? {
          ...e,
          total_runs: 0,
          total_wickets: 0,
          total_balls: 0,
          total_overs: 0,
        }
      : e,
  );
  return new MemoryDataSource(data);
}

async function listed(ds: MemoryDataSource) {
  const db = serverClientFor({ ds, db: null, getUser: async () => null });
  const { data } = await db.from("matches").select(SELECT).eq("id", live.id);
  return { db, rows: (data ?? []) as unknown as ScopeMatch[] };
}

const entryOf = (rows: ScopeMatch[]) =>
  rows[0]!.innings!.find((i) => i.id === inProgress.id)!;
const expected = {
  total_runs: inProgress.total_runs,
  total_wickets: inProgress.total_wickets,
  total_balls: inProgress.total_balls,
  total_overs: inProgress.total_overs,
};

describe("live innings in match lists", () => {
  it("lists embed the summary (no innings read), behind for a live innings", async () => {
    const ds = staleSeed();
    const before = ds.billedReads;
    const { rows } = await listed(ds);
    expect(ds.billedReads - before).toBe(1);
    expect(entryOf(rows).total_runs).toBe(0);
  });

  it("withLiveInnings re-reads the innings in progress: 1 read per live match", async () => {
    const ds = staleSeed();
    const { db, rows } = await listed(ds);
    const before = ds.billedReads;
    await withLiveInnings(db, rows);
    expect(ds.billedReads - before).toBe(1);
    expect(entryOf(rows)).toMatchObject(expected);
    // Nothing to do for matches that are not live.
    const done = ds.billedReads;
    await withLiveInnings(db, [{ ...rows[0]!, status: "completed" }]);
    expect(ds.billedReads).toBe(done);
  });

  it("the scope leaderboard updates them from the innings it reads anyway", async () => {
    const ds = staleSeed();
    const { db, rows } = await listed(ds);
    await loadScopeLeaderboard(db, "club", String(live.club_id), rows);
    expect(entryOf(rows)).toMatchObject(expected);
  });

  it("the player page updates them from the live scorecard it holds", () => {
    const doc = buildLiveScorecard({
      matchId: live.id,
      innings: seed.innings!.filter((i) => i.match_id === live.id) as never,
      nameOf: () => null,
      version: 1,
      now: "x",
    });
    const stale = {
      status: "live",
      innings: (live.innings_summary as Doc[]).map((e) =>
        e.id === inProgress.id ? { ...e, total_runs: 0 } : e,
      ),
    };
    const out = liveScorecardInnings(stale, doc);
    expect(out.innings!.find((i) => i.id === inProgress.id)).toEqual(
      inningsSummaryEntry(inProgress),
    );
  });
});
