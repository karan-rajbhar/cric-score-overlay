import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource } from "~/lib/firebase/datasource";
import { canSetMatchClub } from "~/lib/firebase/permissions";
import { QueryBuilder } from "~/lib/firebase/query-builder";
import { builderContextFor } from "~/lib/firebase/server-client";
import {
  canChangeMatchClub,
  clubsForMatch,
  clubWithRecords,
  fetchMyClubs,
  guessClubSide,
  offerAddToClub,
  type MyClub,
} from "./club-data";

const admin: MyClub = { id: "c1", name: "Riverside CC", role: "admin" };
const member: MyClub = { id: "c2", name: "Hill CC", role: "member" };

describe("adding a match to a club", () => {
  it("lists every club to a scorer, only the clubs they run to anyone else", () => {
    expect(clubsForMatch([admin, member], true)).toEqual([admin, member]);
    expect(clubsForMatch([admin, member], false)).toEqual([admin]);
    expect(canSetMatchClub("admin", false)).toBe(true);
    expect(canSetMatchClub("member", true)).toBe(true);
    expect(canSetMatchClub("member", false)).toBe(false);
    expect(canSetMatchClub(null, true)).toBe(false);
  });

  it("is never offered for a tournament match, nor for a club the user cannot leave", () => {
    expect(canChangeMatchClub({}, [admin])).toBe(true);
    expect(canChangeMatchClub({ tournament_id: "t" }, [admin])).toBe(false);
    expect(canChangeMatchClub({ club_id: "c1" }, [admin])).toBe(true);
    expect(canChangeMatchClub({ club_id: "c9" }, [admin])).toBe(false);
    expect(canChangeMatchClub({}, [])).toBe(false);
  });

  it("is still offered to a scorer with no club, so the dialog can say how", () => {
    expect(offerAddToClub({}, [], true)).toBe(true);
    expect(offerAddToClub({}, [], false)).toBe(false);
    expect(offerAddToClub({ club_id: "c9" }, [], true)).toBe(false);
    expect(offerAddToClub({ tournament_id: "t" }, [], true)).toBe(false);
  });

  it("starts from the one side that has played for the club, else both", () => {
    expect(guessClubSide(true, false)).toBe("team1");
    expect(guessClubSide(false, true)).toBe("team2");
    expect(guessClubSide(true, true)).toBe("both");
    expect(guessClubSide(false, false)).toBe("both");
    expect(guessClubSide(true, undefined)).toBeNull();
  });

  it("suggests the first club whose matches the players have played in", async () => {
    const ds = new MemoryDataSource({
      player_matches: [
        { id: "m9_p2", match_id: "m9", user_id: "p2", club_id: "c2" },
      ],
    });
    const { ctx } = builderContextFor(ds, null);
    const from = (t: string) => new QueryBuilder(ctx, t as "clubs");
    const db = { from } as never;
    expect(await clubWithRecords(db, [admin, member], ["p1", "p2"])).toEqual(
      member,
    );
    expect(await clubWithRecords(db, [admin], ["p1", "p2"])).toBeNull();
    expect(await clubWithRecords(db, [admin, member], ["p9"])).toBeNull();
  });

  it("reads the user's clubs with their role", async () => {
    const ds = new MemoryDataSource({
      clubs: [
        { id: "c1", name: "Riverside CC", owner_id: "u1" },
        { id: "c2", name: "Hill CC", owner_id: "x" },
        { id: "c3", name: "Bay CC", owner_id: "x" },
        { id: "c4", name: "Old CC", owner_id: "x" },
      ],
      club_memberships: [
        { id: "k2", club_id: "c2", user_id: "u1", role: "member", status: "active" },
        { id: "k3", club_id: "c3", user_id: "u1", role: "admin", status: "active" },
        { id: "k4", club_id: "c4", user_id: "u1", role: "member", status: "left" },
      ],
    });
    const { ctx } = builderContextFor(ds, null);
    const from = (t: string) => new QueryBuilder(ctx, t as "clubs");
    expect(await fetchMyClubs({ from } as never, "u1")).toEqual([
      { id: "c3", name: "Bay CC", role: "admin" },
      { id: "c2", name: "Hill CC", role: "member" },
      { id: "c1", name: "Riverside CC", role: "admin" },
    ]);
  });
});
