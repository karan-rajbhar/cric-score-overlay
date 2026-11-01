import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource, type Doc } from "./datasource";
import { searchFieldsOf } from "./derive.mjs";
import { QueryBuilder } from "./query-builder";
import { PLAYER_SEARCH_LIMIT, searchPlayers } from "./search-players";
import { builderContextFor } from "./server-client";
import type { TableName } from "./types";

const person = (id: string, full_name: string, username: string): Doc => ({
  id,
  full_name,
  username,
  ...searchFieldsOf("users", { full_name, username }),
});

function clientOver(data: Record<string, Doc[]>) {
  const { ctx } = builderContextFor(new MemoryDataSource(data), null);
  return {
    from: <T extends TableName>(table: T) => new QueryBuilder<T>(ctx, table),
  };
}

/** `count` people sharing a first name, in name order. */
const crowd = (count: number, first: string): Doc[] =>
  Array.from({ length: count }, (_, i) => {
    const letter = String.fromCharCode(97 + i);
    return person(`c${i}`, `${first} ${letter}${letter}`, `user_${letter}${i}`);
  });

describe("searchPlayers", () => {
  it("answers with who they are and the matches they played", async () => {
    const db = clientOver({
      users: [person("u1", "Rahul Sharma", "rahul_s")],
      player_career_stats: [{ id: "u1", total_matches: 42 }],
    });
    const { data } = await searchPlayers(db, "rah");
    expect(data).toEqual({
      players: [
        {
          id: "u1",
          name: "Rahul Sharma",
          username: "rahul_s",
          matches: 42,
          clubMember: false,
        },
      ],
      more: false,
    });
  });

  it("a duplicate under the short name does not hide the real profile", async () => {
    const db = clientOver({
      users: [
        person("dup", "Karan Rajbhar", "karan_rajbhar"),
        person("real", "Karan Kumar Rajbhar", "karan"),
      ],
      player_career_stats: [{ id: "real", total_matches: 42 }],
    });
    const { data } = await searchPlayers(db, "karan rajbhar");
    expect(data?.players.map((p) => p.id)).toEqual(["dup", "real"]);
    expect(data?.players[1]?.matches).toBe(42);
  });

  it("says nobody plainly: an empty list, no error", async () => {
    const db = clientOver({ users: [], player_career_stats: [] });
    expect(await searchPlayers(db, "zzz")).toEqual({
      data: { players: [], more: false },
      error: null,
    });
  });

  it("puts the exact @username first, past everyone of that name", async () => {
    const db = clientOver({
      // Twenty Karans sort before the player whose handle is "karan".
      users: [...crowd(20, "Karan"), person("me", "Zubin Mehta", "karan")],
      player_career_stats: [],
    });
    const { data } = await searchPlayers(db, "@karan");
    expect(data?.players[0]).toMatchObject({ id: "me", username: "karan" });
  });

  it("ignores case in a @username", async () => {
    const db = clientOver({
      users: [person("me", "Zubin Mehta", "karan")],
      player_career_stats: [],
    });
    const { data } = await searchPlayers(db, "@Karan");
    expect(data?.players.map((p) => p.id)).toEqual(["me"]);
  });

  it("lists handles starting with what is typed before names matching it", async () => {
    const db = clientOver({
      users: [
        person("name", "Aarav Rahul", "aarav"),
        person("handle", "Zubin Mehta", "rahul_99"),
      ],
      player_career_stats: [],
    });
    const { data } = await searchPlayers(db, "@rahul");
    expect(data?.players.map((p) => p.id)).toEqual(["handle", "name"]);
  });

  it("lists the club's own players first, and says so", async () => {
    const db = clientOver({
      users: [
        person("stranger", "Rahul Agarwal", "rahul_a"),
        person("member", "Rahul Zaveri", "rahul_z"),
      ],
      player_career_stats: [],
      club_memberships: [{ id: "m1", club_id: "c1", user_id: "member" }],
    });
    const { data } = await searchPlayers(db, "rahul", { clubId: "c1" });
    expect(data?.players.map((p) => [p.id, p.clubMember])).toEqual([
      ["member", true],
      ["stranger", false],
    ]);
  });

  it("ignores another club's members", async () => {
    const db = clientOver({
      users: [person("u1", "Rahul Zaveri", "rahul_z")],
      player_career_stats: [],
      club_memberships: [{ id: "m1", club_id: "c2", user_id: "u1" }],
    });
    const { data } = await searchPlayers(db, "rahul", { clubId: "c1" });
    expect(data?.players[0]?.clubMember).toBe(false);
  });

  it("says when more people match than were read", async () => {
    const db = clientOver({
      users: crowd(PLAYER_SEARCH_LIMIT + 3, "Rahul"),
      player_career_stats: [],
    });
    const { data } = await searchPlayers(db, "rahul");
    expect(data?.players).toHaveLength(PLAYER_SEARCH_LIMIT);
    expect(data?.more).toBe(true);
  });

  it("reports a query that failed as an error, not as nobody found", async () => {
    const failing = {
      from: () => {
        throw new Error("index missing");
      },
    } as never;
    await expect(searchPlayers(failing, "rahul")).rejects.toThrow();
  });
});
