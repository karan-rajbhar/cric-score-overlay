import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource, type Doc } from "./datasource";
import { expandEmbedded, legacyRowsDataSource } from "./legacy-rows";
import { QueryBuilder, type BuilderContext } from "./query-builder";
import { countingDataSource } from "./scoring/__fixtures__/legacy";
import { legacySeedOf } from "./scoring/__fixtures__/stage2";
import { resolveView } from "./views";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;
const legacy = legacySeedOf(seed);
const MATCH = "950e8400-e29b-41d4-a716-446655440001";
const LIVE = "950e8400-e29b-41d4-a716-446655440003";

/** A server-like client over the seed, counting billed reads. */
function client(data: Record<string, Doc[]> = seed) {
  const { ds, stats } = countingDataSource(new MemoryDataSource(data));
  const ctx: BuilderContext = {
    ds: legacyRowsDataSource(ds),
    expandEmbedded,
    resolveView: (view, filters) => resolveView(ds, view, filters),
  };
  return {
    from: (table: string) => new QueryBuilder(ctx, table as never),
    stats,
  };
}

const sortRows = (rows: Doc[]) =>
  rows
    .map((r) => {
      const c: Record<string, unknown> = { ...r };
      delete c.created_at;
      delete c.updated_at;
      return JSON.stringify(c, Object.keys(c).sort());
    })
    .sort();

describe("legacy row reads served from innings / over documents", () => {
  it.each([
    "batting_performances",
    "bowling_performances",
    "fall_of_wickets",
    "partnerships",
    "ball_by_ball",
  ])("%s by match_id returns the rows the collection held", async (table) => {
    const { from } = client();
    const { data, error } = await from(table).select("*").eq("match_id", MATCH);
    expect(error).toBeNull();
    expect(sortRows(data as Doc[])).toEqual(
      sortRows(legacy[table]!.filter((r) => r.match_id === MATCH)),
    );
  });

  it("reads one innings document per innings_id", async () => {
    const innings = seed.innings!.find((i) => i.match_id === MATCH)!;
    const { from, stats } = client();
    const { data } = await from("batting_performances")
      .select("user_id, runs_scored")
      .eq("innings_id", innings.id)
      .eq("is_out", true)
      .order("runs_scored", { ascending: false })
      .limit(2);
    expect(stats.reads).toBe(1);
    const expected = legacy
      .batting_performances!.filter(
        (r) => r.innings_id === innings.id && r.is_out === true,
      )
      .sort((a, b) => (b.runs_scored as number) - (a.runs_scored as number))
      .slice(0, 2)
      .map((r) => ({ user_id: r.user_id, runs_scored: r.runs_scored }));
    expect(data).toEqual(expected);
  });

  it("reads one over document for an over's balls", async () => {
    const innings = seed.innings!.find((i) => i.match_id === MATCH)!;
    const { from, stats } = client();
    const { data } = await from("ball_by_ball")
      .select("bowler_id, seq")
      .eq("innings_id", innings.id)
      .eq("over_number", 3)
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(stats.reads).toBe(1);
    const last = legacy
      .ball_by_ball!.filter(
        (b) => b.innings_id === innings.id && b.over_number === 3,
      )
      .sort((a, b) => (b.seq as number) - (a.seq as number))[0]!;
    expect(data).toEqual({ bowler_id: last.bowler_id, seq: last.seq });
  });

  it("serves a player's history from player_matches (completed innings)", async () => {
    const user = "550e8400-e29b-41d4-a716-446655440003";
    const { from, stats } = client();
    const { data } = await from("batting_performances")
      .select("match_id, innings_id, runs_scored")
      .eq("user_id", user);
    const records = seed.player_matches!.filter((d) => d.user_id === user);
    expect(stats.reads).toBe(records.length);
    const completed = new Set(
      seed.innings!.filter((i) => i.is_completed).map((i) => i.id),
    );
    expect(sortRows(data as Doc[])).toEqual(
      sortRows(
        legacy
          .batting_performances!.filter(
            (r) => r.user_id === user && completed.has(r.innings_id as string),
          )
          .map(
            (r) =>
              ({
                match_id: r.match_id,
                innings_id: r.innings_id,
                runs_scored: r.runs_scored,
              }) as unknown as Doc,
          ),
      ),
    );
  });

  it("shares identical concurrent reads", async () => {
    const ids = seed.matches!.map((m) => m.id);
    const { from, stats } = client();
    await Promise.all([
      from("batting_performances").select("user_id").in("match_id", ids),
      from("bowling_performances").select("user_id").in("match_id", ids),
      from("fall_of_wickets").select("fielder_id").in("match_id", ids),
    ]);
    expect(stats.reads).toBe(seed.innings!.length);
  });

  it("rejects writes and unbounded queries", async () => {
    const { from } = client();
    const write = await from("ball_by_ball").insert({ match_id: MATCH });
    expect(write.error?.message).toMatch(/derived/);
    const scan = await from("partnerships").select("*").eq("is_current", true);
    expect(scan.error?.message).toMatch(/not supported/);
    const byId = await from("batting_performances").select("*").eq("id", "x");
    expect(byId.error?.message).toMatch(/not supported/);
  });

  it("embeds innings scorecards without reading them again", async () => {
    const { from, stats } = client();
    const { data } = await from("matches")
      .select(
        "id, innings(id, batting_performances(user_id), fall_of_wickets(wicket_number))",
      )
      .eq("id", MATCH)
      .single();
    const innings = seed.innings!.filter((i) => i.match_id === MATCH);
    // match + its innings, nothing per relation
    expect(stats.reads).toBe(1 + innings.length);
    const embedded = (
      data as { innings: { batting_performances: unknown[] }[] }
    ).innings;
    expect(embedded.map((i) => i.batting_performances.length).sort()).toEqual(
      innings.map((i) => (i.batting as unknown[]).length).sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// Page costs on the seed (billed document reads), with the select strings
// the pages use. Figures before stage 2 in comments.
// ---------------------------------------------------------------------------

const MATCH_SELECT = `*,
  team1:teams!matches_team1_id_fkey(*, team_players(*, user:users!team_players_user_id_fkey(id, full_name, avatar_url))),
  team2:teams!matches_team2_id_fkey(*, team_players(*, user:users!team_players_user_id_fkey(id, full_name, avatar_url))),
  innings(*,
    batting_performances(*, user:users!batting_performances_user_id_fkey(id, full_name)),
    bowling_performances(*, user:users!bowling_performances_user_id_fkey(id, full_name)),
    fall_of_wickets(*,
      batsman:users!fall_of_wickets_batsman_out_id_fkey(id, full_name),
      bowler:users!fall_of_wickets_bowler_id_fkey(full_name),
      fielder:users!fall_of_wickets_fielder_id_fkey(full_name))),
  tournament:tournaments(id, name, tournament_format, venue),
  club:clubs(id, name),
  player_of_the_match:users!matches_player_of_the_match_id_fkey(id, full_name, avatar_url)`;

const BALL_LOG_SELECT = `*,
  batsman:users!ball_by_ball_batsman_id_fkey(id, full_name),
  bowler:users!ball_by_ball_bowler_id_fkey(id, full_name),
  non_striker:users!ball_by_ball_non_striker_id_fkey(id, full_name),
  fielder:users!ball_by_ball_fielder_id_fkey(id, full_name),
  dismissed_player:users!ball_by_ball_dismissed_player_id_fkey(id, full_name),
  innings(innings_number, team_id)`;

describe("page read costs", () => {
  it("match page: getMatch select (was 99 / 92)", async () => {
    for (const [id, max] of [
      [MATCH, 60],
      [LIVE, 56],
    ] as const) {
      const { from, stats } = client();
      const { data, error } = await from("matches")
        .select(MATCH_SELECT)
        .eq("id", id)
        .single();
      expect(error).toBeNull();
      const inn = (
        data as { innings: { batting_performances: { user: unknown }[] }[] }
      ).innings;
      expect(
        inn.every((i) => i.batting_performances.every((b) => b.user)),
      ).toBe(true);
      expect(stats.reads).toBeLessThanOrEqual(max);
    }
  });

  it("ball log (was 276): one read per over plus names", async () => {
    const { from, stats } = client();
    const { data } = await from("ball_by_ball")
      .select(BALL_LOG_SELECT)
      .eq("match_id", MATCH)
      .order("seq");
    const rows = data as Doc[];
    expect(rows).toHaveLength(
      legacy.ball_by_ball!.filter((b) => b.match_id === MATCH).length,
    );
    expect(rows.map((r) => r.seq)).toEqual(
      [...rows.map((r) => r.seq)].sort((a, b) => (a as number) - (b as number)),
    );
    expect(stats.reads).toBeLessThanOrEqual(65);
  });

  it("manhattan / worm over summaries (was 254)", async () => {
    const { from, stats } = client();
    await from("match_over_summaries")
      .select("innings_id, over_number, runs")
      .eq("match_id", MATCH)
      .order("over_number");
    expect(stats.reads).toBe(
      seed.overs!.filter((o) => o.match_id === MATCH).length,
    );
  });

  it("partnerships tab (was 32)", async () => {
    const { from, stats } = client();
    await from("partnerships")
      .select(
        "id, runs, batsman1:users!partnerships_batsman1_id_fkey(full_name), batsman2:users!partnerships_batsman2_id_fkey(full_name)",
      )
      .eq("match_id", MATCH)
      .order("start_over");
    expect(stats.reads).toBeLessThanOrEqual(20);
  });

  it("club / tournament leaderboards (was 276 for 7 matches)", async () => {
    const club = seed.clubs![0]!.id;
    const ids = seed
      .matches!.filter((m) => m.club_id === club)
      .map((m) => m.id);
    const { from, stats } = client();
    await Promise.all([
      from("batting_performances")
        .select(
          "match_id, user_id, runs_scored, user:users!batting_performances_user_id_fkey(id, full_name, avatar_url)",
        )
        .in("match_id", ids),
      from("bowling_performances")
        .select(
          "match_id, user_id, wickets_taken, user:users!bowling_performances_user_id_fkey(id, full_name, avatar_url)",
        )
        .in("match_id", ids),
      from("fall_of_wickets")
        .select(
          "match_id, fielder_id, fielder:users!fall_of_wickets_fielder_id_fkey(id, full_name, avatar_url)",
        )
        .in("match_id", ids),
    ]);
    const innings = seed.innings!.filter((i) =>
      ids.includes(i.match_id as string),
    ).length;
    // innings once, then names (each relation looks up its own users)
    expect(stats.reads).toBeLessThanOrEqual(innings + 60);
  });
});
