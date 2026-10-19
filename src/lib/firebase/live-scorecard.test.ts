import { describe, expect, it } from "vitest";
import {
  buildLiveScorecard,
  decodeLiveScorecard,
  liveScorecardUserIds,
  liveScorecardView,
  sameLiveScorecard,
  type ScorecardSource,
} from "./live-scorecard";

/** Firestore's stored size of a value (https://firebase.google.com/docs/firestore/storage-size). */
function firestoreSize(value: unknown): number {
  if (value === null || value === undefined) return 1;
  if (typeof value === "boolean") return 1;
  if (typeof value === "number") return 8;
  if (typeof value === "string") return Buffer.byteLength(value) + 1;
  if (Array.isArray(value))
    return value.reduce((s: number, v) => s + firestoreSize(v), 0);
  return Object.entries(value as Record<string, unknown>).reduce(
    (s, [k, v]) => s + Buffer.byteLength(k) + 1 + firestoreSize(v),
    0,
  );
}

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** A completed T20 innings: 11 batters, 7 bowlers, 10 wickets, 10 stands. */
function t20Innings(no: number, batters: string[], bowlers: string[]) {
  return {
    id: uuid(900 + no),
    match_id: uuid(999),
    team_id: uuid(800 + no),
    innings_number: no,
    total_runs: 187,
    total_wickets: 10,
    total_balls: 117,
    total_overs: 19.3,
    extras_total: 14,
    extras_byes: 2,
    extras_leg_byes: 3,
    extras_wides: 7,
    extras_no_balls: 2,
    extras_penalties: 0,
    extras_bonuses: 0,
    target_runs: no === 2 ? 188 : null,
    is_completed: true,
    batting: batters.map((id, i) => ({
      user_id: id,
      batting_position: i + 1,
      runs_scored: 10 + i * 3,
      balls_faced: 9 + i,
      minutes_batted: null,
      fours: i % 3,
      sixes: i % 2,
      is_out: i < 10,
      dismissal_type: i < 10 ? "caught" : null,
      bowler_id: i < 10 ? bowlers[i % bowlers.length]! : null,
      fielder_id: i < 10 ? bowlers[(i + 1) % bowlers.length]! : null,
      is_current_batsman: false,
      is_striker: false,
    })),
    bowling: bowlers.map((id, i) => ({
      user_id: id,
      overs_bowled: i < 5 ? 4 : 0.3,
      balls_bowled: i < 5 ? 24 : 3,
      runs_conceded: 30 + i,
      wickets_taken: i % 3,
      maidens: 0,
      wides: 1,
      no_balls: 0,
      is_current_bowler: false,
    })),
    fall_of_wickets: batters.slice(0, 10).map((id, i) => ({
      wicket_number: i + 1,
      runs_at_fall: 15 * (i + 1),
      overs_at_fall: 1.5 * (i + 1),
      batsman_out_id: id,
      dismissal_type: "caught",
      bowler_id: bowlers[i % bowlers.length]!,
      fielder_id: bowlers[(i + 1) % bowlers.length]!,
    })),
    partnerships: batters.slice(0, 10).map((id, i) => ({
      batsman1_id: i === 0 ? batters[0]! : id,
      batsman2_id: batters[i + 1]!,
      wicket_number: i + 1,
      runs: 15,
      balls: 11,
      batsman1_runs: 8,
      batsman1_balls: 6,
      batsman2_runs: 5,
      batsman2_balls: 5,
      start_over: 1.5 * i,
      end_over: 1.5 * (i + 1),
      is_current: false,
    })),
  } satisfies ScorecardSource;
}

function fullT20() {
  const team1 = Array.from({ length: 11 }, (_, i) => uuid(100 + i));
  const team2 = Array.from({ length: 11 }, (_, i) => uuid(200 + i));
  return [
    t20Innings(1, team1, team2.slice(4)),
    t20Innings(2, team2, team1.slice(4)),
  ];
}

const nameOf = (id: string) => `Player ${id.slice(-3)} Longsurname`;

describe("live_scorecard encoding", () => {
  it("round-trips every field and stays far below the 15 KB budget for a full T20", () => {
    const innings = fullT20();
    const doc = buildLiveScorecard({
      matchId: uuid(999),
      innings,
      nameOf,
      version: 7,
      now: "2026-01-01T00:00:00.000Z",
    });
    const decoded = decodeLiveScorecard(doc);
    expect(decoded.innings).toEqual(innings);
    expect(Object.keys(decoded.names).sort()).toEqual(
      liveScorecardUserIds(innings).sort(),
    );
    expect(decoded.names[uuid(100)]).toBe(nameOf(uuid(100)));

    const stored = firestoreSize(doc) + 16 + 32;
    const json = Buffer.byteLength(JSON.stringify(doc));
    console.info("live_scorecard full T20", { stored, json });
    expect(stored).toBeLessThan(6000);
    expect(json).toBeLessThan(6000);
  });

  it("renders getMatch-shaped rows with the stored ids and name embeds", () => {
    const innings = fullT20();
    const doc = buildLiveScorecard({
      matchId: uuid(999),
      innings,
      nameOf,
      version: 1,
      now: "x",
    });
    const view = liveScorecardView(doc);
    const first = view.innings[0]!;
    expect(first.id).toBe(innings[0]!.id);
    const bat = (
      first.batting_performances as Array<Record<string, unknown>>
    )[0]!;
    expect(bat).toMatchObject({
      id: `${innings[0]!.id}_${uuid(100)}`,
      innings_id: innings[0]!.id,
      match_id: uuid(999),
      user: { id: uuid(100), full_name: nameOf(uuid(100)) },
    });
    const fow = (first.fall_of_wickets as Array<Record<string, unknown>>)[0]!;
    expect(fow.id).toBe(`${innings[0]!.id}_w1`);
    expect(fow.bowler).toEqual({ full_name: nameOf(uuid(204)) });
    expect(view.partnerships).toHaveLength(20);
    expect(view.partnerships[0]).toMatchObject({
      id: `${innings[0]!.id}_p1`,
      batsman1: { full_name: nameOf(uuid(100)) },
    });
  });

  it("compares content regardless of version, time and key order", () => {
    const innings = fullT20();
    const a = buildLiveScorecard({
      matchId: "m",
      innings,
      nameOf,
      version: 1,
      now: "a",
    });
    const b = buildLiveScorecard({
      matchId: "m",
      innings,
      nameOf,
      version: 2,
      now: "b",
    });
    expect(sameLiveScorecard(a, b)).toBe(true);
    const changed = structuredClone(innings);
    changed[1]!.batting[0]!.runs_scored += 1;
    const c = buildLiveScorecard({
      matchId: "m",
      innings: changed,
      nameOf,
      version: 3,
      now: "c",
    });
    expect(sameLiveScorecard(a, c)).toBe(false);
  });

  it("keeps strings with separators intact", () => {
    const innings = fullT20();
    innings[0]!.batting[0]!.dismissal_type = "odd, value % here";
    const doc = buildLiveScorecard({
      matchId: "m",
      innings,
      nameOf,
      version: 1,
      now: "x",
    });
    expect(
      decodeLiveScorecard(doc).innings[0]!.batting![0]!.dismissal_type,
    ).toBe("odd, value % here");
  });
});
