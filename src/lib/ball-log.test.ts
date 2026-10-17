/**
 * The ball log rebuilt in the browser from `overs` docs equals what the
 * `getMatchBallLog` server action returns (seed data), so re-reading only
 * the changed over docs keeps the cached log exact.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import { ballEventsOfOver, ballLogContext, mergeOvers } from "./ball-log";
import { MemoryDataSource, type Doc } from "./firebase/datasource";
import { overDocId, type OversRow } from "./firebase/scorecard";
import { serverClientFor } from "./firebase/server-client";
import type { BallEvent, Match } from "./match-types";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

const matchIds = [...new Set(seed.overs!.map((o) => String(o.match_id)))];

let ds: MemoryDataSource;
let queries: typeof import("~/app/matches/queries");

beforeAll(async () => {
  ds = new MemoryDataSource(seed);
  state.client = serverClientFor({ ds, db: null, getUser: async () => null });
  queries = await import("~/app/matches/queries");
});

async function load(matchId: string) {
  const log = (await queries.getMatchBallLog(matchId))
    .data as unknown as BallEvent[];
  const match = (await queries.getMatch(matchId, { skipCache: true }))
    .data as unknown as Match;
  const overs = ds
    .all("overs")
    .filter((o) => o.match_id === matchId) as unknown as OversRow[];
  return { log, match, overs };
}

describe("ball log from over docs", () => {
  it("equals getMatchBallLog for every seed match", async () => {
    expect(matchIds.length).toBeGreaterThan(3);
    for (const matchId of matchIds) {
      const { log, match, overs } = await load(matchId);
      expect(log.length).toBeGreaterThan(0);
      // Names from the fetched match's rosters alone.
      const ctx = ballLogContext([], match);
      const rebuilt = overs.flatMap((o) => ballEventsOfOver(o, ctx) ?? []);
      expect(mergeOvers([], [], rebuilt)).toEqual(log);
    }
  });

  it("replaces just the changed over docs in a cached log", async () => {
    const { log, match, overs } = await load(matchIds[0]!);
    const last = overs.reduce((a, b) =>
      (a.balls.at(-1)?.seq ?? 0) > (b.balls.at(-1)?.seq ?? 0) ? a : b,
    );
    const id = overDocId(last.innings_id, last.over_number);
    // A cached log from before the last ball (or with a stale over).
    const stale = log.slice(0, -1);
    const ctx = ballLogContext(stale, match);
    const fresh = ballEventsOfOver(last, ctx)!;
    expect(mergeOvers(stale, [id], fresh)).toEqual(log);
    // An undo that emptied the over (doc deleted): its balls go away.
    expect(mergeOvers(log, [id], [])).toEqual(
      log.filter((b) => overDocId(b.innings_id, b.over_number) !== id),
    );
  });

  it("asks for a full refetch when a player or innings is unknown", async () => {
    const { overs } = await load(matchIds[0]!);
    expect(ballEventsOfOver(overs[0]!, ballLogContext([], null))).toBeNull();
  });
});
