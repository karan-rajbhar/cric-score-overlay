import { describe, expect, it } from "vitest";
import { MemoryDataSource } from "~/lib/firebase/datasource";
import {
  createChannel,
  deleteChannel,
  listChannelsForMatch,
  listClubChannels,
  renameChannel,
  setChannelMatch,
  STREAM_CHANNELS,
} from "./channels";

/**
 * Club C1 (owner "owner"), its matches A and B (A in tournament T1 of
 * club C2), match X of another club; "streamer" streams A and B.
 */
function seed() {
  return new MemoryDataSource({
    clubs: [
      { id: "C1", owner_id: "owner" },
      { id: "C2", owner_id: "owner2" },
      { id: "C3", owner_id: "owner3" },
    ],
    tournaments: [{ id: "T1", club_id: "C2", created_by: "organiser" }],
    matches: [
      {
        id: "A",
        created_by: "creator",
        match_admins: [],
        match_streamers: ["streamer"],
        club_id: "C1",
        tournament_id: "T1",
      },
      {
        id: "B",
        created_by: "creator",
        match_admins: [],
        match_streamers: ["streamer"],
        club_id: "C1",
        tournament_id: null,
      },
      {
        id: "X",
        created_by: "other",
        match_admins: [],
        match_streamers: ["streamer"],
        club_id: "C3",
        tournament_id: null,
      },
    ],
  });
}

describe("stream channels", () => {
  it("lets club admins create, rename and delete the club's channels", async () => {
    const ds = seed();
    const ch = await createChannel(ds, "owner", {
      clubId: "C1",
      name: "  Main   ground ",
    });
    expect(ch).toMatchObject({ name: "Main ground", club_id: "C1" });
    expect(ch.match_id).toBeNull();

    await expect(
      createChannel(ds, "streamer", { clubId: "C1", name: "Nets" }),
    ).rejects.toThrow(/club admins/);
    await expect(
      renameChannel(ds, "streamer", ch.id, "Hijacked"),
    ).rejects.toThrow(/cannot change/);
    await expect(
      createChannel(ds, "owner", { clubId: "C1", name: "  " }),
    ).rejects.toThrow(/name/);

    await renameChannel(ds, "owner", ch.id, "Ground 2");
    expect((await listClubChannels(ds, "C1")).map((c) => c.name)).toEqual([
      "Ground 2",
    ]);
    await expect(deleteChannel(ds, "streamer", ch.id)).rejects.toThrow();
    await deleteChannel(ds, "owner", ch.id);
    expect(await listClubChannels(ds, "C1")).toEqual([]);
  });

  it("switches the match on a channel with one write per switch", async () => {
    const ds = seed();
    const ch = await createChannel(ds, "owner", { clubId: "C1", name: "Main" });

    // A streamer of A puts it on the club's channel, then switches to B.
    expect(
      (await setChannelMatch(ds, "streamer", ch.id, "A")).match_id,
    ).toBe("A");
    expect((await ds.getById(STREAM_CHANNELS, ch.id))!.match_id).toBe("A");

    const writes = ds.writes;
    await setChannelMatch(ds, "streamer", ch.id, "B");
    expect(ds.writes - writes).toBe(1);
    expect((await ds.getById(STREAM_CHANNELS, ch.id))!.match_id).toBe("B");

    // Same match again: nothing to write.
    const again = ds.writes;
    await setChannelMatch(ds, "streamer", ch.id, "B");
    expect(ds.writes).toBe(again);

    // Off air: the producer of the match on it, or a club admin.
    await setChannelMatch(ds, "streamer", ch.id, null);
    expect((await ds.getById(STREAM_CHANNELS, ch.id))!.match_id).toBeNull();
  });

  it("keeps other clubs' matches and outsiders off a club's channel", async () => {
    const ds = seed();
    const ch = await createChannel(ds, "owner", { clubId: "C1", name: "Main" });
    // X belongs to another club, even though "streamer" streams it.
    await expect(setChannelMatch(ds, "streamer", ch.id, "X")).rejects.toThrow(
      /another club/,
    );
    // Not a producer of A.
    await expect(setChannelMatch(ds, "stranger", ch.id, "A")).rejects.toThrow(
      /scorers and streamers/,
    );
    await setChannelMatch(ds, "owner", ch.id, "A");
    await expect(setChannelMatch(ds, "stranger", ch.id, null)).rejects.toThrow(
      /off air/,
    );
    await expect(setChannelMatch(ds, "owner", ch.id, "nope")).rejects.toThrow(
      /Match not found/,
    );
  });

  it("allows a tournament's club channel for its matches", async () => {
    const ds = seed();
    const ch = await createChannel(ds, "owner2", { clubId: "C2", name: "T" });
    await setChannelMatch(ds, "streamer", ch.id, "A");
    await expect(setChannelMatch(ds, "streamer", ch.id, "B")).rejects.toThrow(
      /another club/,
    );
  });

  it("gives clubless producers personal channels for any match they produce", async () => {
    const ds = seed();
    const mine = await createChannel(ds, "streamer", { name: "My stream" });
    expect(mine).toMatchObject({ club_id: null, owner_id: "streamer" });
    await setChannelMatch(ds, "streamer", mine.id, "X");
    await expect(setChannelMatch(ds, "creator", mine.id, "A")).rejects.toThrow(
      /another club/,
    );
    await expect(renameChannel(ds, "creator", mine.id, "x")).rejects.toThrow();
  });

  it("lists the channels a producer may use for a match", async () => {
    const ds = seed();
    await createChannel(ds, "owner", { clubId: "C1", name: "Main" });
    await createChannel(ds, "owner2", { clubId: "C2", name: "Cup" });
    await createChannel(ds, "owner3", { clubId: "C3", name: "Elsewhere" });
    await createChannel(ds, "streamer", { name: "Mine" });

    const names = async (user: string, matchId: string) =>
      (await listChannelsForMatch(ds, user, matchId)).map((c) => c.name);
    expect(await names("streamer", "A")).toEqual(["Main", "Cup", "Mine"]);
    expect(await names("streamer", "B")).toEqual(["Main", "Mine"]);
    expect(await names("stranger", "A")).toEqual([]);
  });
});
