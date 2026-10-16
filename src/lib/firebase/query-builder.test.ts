import { describe, expect, it } from "vitest";
import { MemoryDataSource } from "./datasource";
import { QueryBuilder, type BuilderContext } from "./query-builder";
import { parseSelect } from "./select-parser";
import { parseOrExpression } from "./filters";

function setup() {
  const ds = new MemoryDataSource({
    users: [
      {
        id: "u1",
        full_name: "Alice Striker",
        email: "alice@example.com",
        username: "alice",
      },
      {
        id: "u2",
        full_name: "Bob Bowler",
        email: "bob@example.com",
        username: "bob",
      },
      {
        id: "u3",
        full_name: "Cara Keeper",
        email: "cara@example.com",
        username: "cara",
      },
    ],
    clubs: [{ id: "c1", name: "Metro CC", owner_id: "u1", is_public: true }],
    teams: [
      {
        id: "t1",
        name: "Tigers",
        club_id: "c1",
        captain_id: "u1",
        created_by: "u1",
        created_at: "2024-01-02",
      },
      {
        id: "t2",
        name: "Kings",
        club_id: null,
        captain_id: "u2",
        created_by: "u2",
        created_at: "2024-01-01",
      },
    ],
    team_players: [
      { id: "tp1", team_id: "t1", user_id: "u1", batting_order: 2 },
      { id: "tp2", team_id: "t1", user_id: "u3", batting_order: 1 },
      { id: "tp3", team_id: "t2", user_id: "u2", batting_order: null },
    ],
    matches: [
      {
        id: "m1",
        title: "Derby",
        team1_id: "t1",
        team2_id: "t2",
        status: "live",
        scheduled_at: "2024-05-01",
        tournament_id: null,
        club_id: "c1",
      },
      {
        id: "m2",
        title: "Final",
        team1_id: "t2",
        team2_id: "t1",
        status: "completed",
        scheduled_at: "2024-06-01",
        tournament_id: null,
        club_id: null,
      },
    ],
    innings: [
      {
        id: "i2",
        match_id: "m1",
        innings_number: 2,
        team_id: "t2",
        total_runs: 50,
      },
      {
        id: "i1",
        match_id: "m1",
        innings_number: 1,
        team_id: "t1",
        total_runs: 120,
      },
    ],
  });
  const ctx: BuilderContext = { ds, now: () => "2024-07-01T00:00:00.000Z" };
  const from = (table: string) => new QueryBuilder(ctx, table);
  return { ds, from };
}

describe("parseSelect", () => {
  it("parses columns, aliases, hints and nested relations", () => {
    const sel = parseSelect(
      "*, team1:teams!matches_team1_id_fkey(id, name), innings(id, batting_performances(*, user:users(id))), _count:team_players(count)",
    );
    expect(sel.star).toBe(true);
    expect(sel.relations.map((r) => r.alias)).toEqual([
      "team1",
      "innings",
      "_count",
    ]);
    expect(sel.relations[0]).toMatchObject({
      target: "teams",
      hint: "matches_team1_id_fkey",
    });
    expect(
      sel.relations[1]!.selection.relations[0]!.selection.relations[0]!.alias,
    ).toBe("user");
    expect(sel.relations[2]!.countOnly).toBe(true);
  });
});

describe("parseOrExpression", () => {
  it("parses nested and/or groups with ilike and in", () => {
    const f = parseOrExpression(
      "full_name.ilike.%ali%,and(team1_id.eq.t1,team2_id.eq.t2),id.in.(a,b)",
    );
    expect(f.type).toBe("or");
    if (f.type !== "or") return;
    expect(f.filters[0]).toMatchObject({ type: "like", caseInsensitive: true });
    expect(f.filters[1]).toMatchObject({ type: "and" });
    expect(f.filters[2]).toMatchObject({ type: "in", values: ["a", "b"] });
  });
});

describe("QueryBuilder", () => {
  it("selects with embedded many-to-one and one-to-many relations", async () => {
    const { from } = setup();
    const { data, error } = await from("matches")
      .select(
        "id, title, team1:teams!matches_team1_id_fkey(id, name, team_players(*, user:users(id, full_name))), innings(id, innings_number)",
      )
      .eq("id", "m1")
      .single();
    expect(error).toBeNull();
    expect(data.title).toBe("Derby");
    expect(data.team1.name).toBe("Tigers");
    expect(data.team1.team_players).toHaveLength(2);
    expect(data.team1.team_players[0].user.full_name).toBe("Cara Keeper");
    expect(
      data.innings.map((i: { innings_number: number }) => i.innings_number),
    ).toEqual([1, 2]);
  });

  it("supports count relations and or/ilike/neq filters with ordering and limits", async () => {
    const { from } = setup();
    const { data } = await from("teams")
      .select("id, name, _count:team_players(count)")
      .or("captain_id.eq.u1,name.ilike.%kin%")
      .neq("id", "nope")
      .order("created_at", { ascending: false })
      .limit(5);
    expect(data!.map((t: { id: string }) => t.id)).toEqual(["t1", "t2"]);
    expect(data![0]._count).toEqual([{ count: 2 }]);
  });

  it("returns an error for single() with no rows and null for maybeSingle()", async () => {
    const { from } = setup();
    const single = await from("users")
      .select("id")
      .eq("id", "missing")
      .single();
    expect(single.data).toBeNull();
    expect(single.error?.code).toBe("PGRST116");
    const maybe = await from("users")
      .select("id")
      .eq("id", "missing")
      .maybeSingle();
    expect(maybe).toEqual({ data: null, error: null });
  });

  it("applies defaults and timestamps on insert and returns the row", async () => {
    const { from, ds } = setup();
    const { data, error } = await from("matches")
      .insert({
        title: "New",
        team1_id: "t1",
        team2_id: "t2",
        created_by: "u1",
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data.status).toBe("scheduled");
    expect(data.balls_per_over).toBe(6);
    expect(data.match_admins).toEqual([]);
    expect(data.created_at).toBe("2024-07-01T00:00:00.000Z");
    expect(ds.all("matches")).toHaveLength(3);
  });

  it("rejects duplicate rows the way a unique index would", async () => {
    const { from } = setup();
    const res = await from("team_players").insert({
      team_id: "t1",
      user_id: "u1",
    });
    expect(res.error?.code).toBe("23505");
  });

  it("updates matching rows and cascades deletes", async () => {
    const { from, ds } = setup();
    const upd = await from("matches")
      .update({ status: "completed" })
      .eq("id", "m1")
      .select()
      .single();
    expect(upd.data.status).toBe("completed");
    expect(upd.data.updated_at).toBe("2024-07-01T00:00:00.000Z");

    await from("matches").delete().eq("id", "m1");
    expect(ds.all("matches").map((m) => m.id)).toEqual(["m2"]);
    expect(ds.all("innings")).toHaveLength(0);
  });

  it("assigns a per-match sequence to ball_by_ball inserts", async () => {
    const { from, ds } = setup();
    await from("ball_by_ball").insert({
      match_id: "m1",
      innings_id: "i1",
      over_number: 0,
      ball_number: 1,
      extras: 5,
      extra_type: "penalty",
    });
    await from("ball_by_ball").insert({
      match_id: "m1",
      innings_id: "i1",
      over_number: 0,
      ball_number: 2,
    });
    const seqs = ds
      .all("ball_by_ball")
      .map((b) => b.seq)
      .sort();
    expect(seqs).toEqual([1, 2]);
    expect(ds.all("matches").find((m) => m.id === "m1")?.last_ball_seq).toBe(2);
  });
});
