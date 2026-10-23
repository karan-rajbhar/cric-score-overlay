import { beforeEach, describe, expect, it } from "vitest";
import { MemoryDataSource } from "~/lib/firebase/datasource";
import {
  FOLLOWS,
  FollowLimitError,
  MAX_FOLLOWS,
  followKey,
  followerIds,
  idsOfKind,
  nextTargets,
  parseFollowKey,
  readFollows,
  setFollowTarget,
} from "./store";

let ds: MemoryDataSource;

beforeEach(() => {
  ds = new MemoryDataSource({});
});

describe("keys", () => {
  it("round-trips and rejects junk", () => {
    expect(parseFollowKey(followKey("team", "abc-1"))).toEqual({
      kind: "team",
      id: "abc-1",
    });
    expect(parseFollowKey("club:x")).toBeNull();
    expect(parseFollowKey("team:a/b")).toBeNull();
    expect(parseFollowKey("nonsense")).toBeNull();
    expect(idsOfKind(["team:a", "match:m", "team:b"], "team")).toEqual(["a", "b"]);
  });
});

describe("nextTargets", () => {
  it("adds once, at the end, and removes", () => {
    expect(nextTargets(["team:a"], "team:b", true)).toEqual(["team:a", "team:b"]);
    expect(nextTargets(["team:a", "team:b"], "team:a", true)).toEqual([
      "team:b",
      "team:a",
    ]);
    expect(nextTargets(["team:a", "team:b"], "team:a", false)).toEqual(["team:b"]);
  });

  it("drops the oldest match follows past the limit, else refuses", () => {
    const full = [
      "match:old",
      ...Array.from({ length: MAX_FOLLOWS - 1 }, (_, i) => `team:t${i}`),
    ];
    const next = nextTargets(full, "team:new", true);
    expect(next).toHaveLength(MAX_FOLLOWS);
    expect(next).not.toContain("match:old");
    const teamsOnly = Array.from({ length: MAX_FOLLOWS }, (_, i) => `team:t${i}`);
    expect(() => nextTargets(teamsOnly, "team:new", true)).toThrow(FollowLimitError);
  });
});

describe("setFollowTarget / readFollows / followerIds", () => {
  it("stores one document per user and finds followers by key", async () => {
    expect(await readFollows(ds, "u1")).toEqual([]);
    await setFollowTarget(ds, "u1", "team:a", true);
    await setFollowTarget(ds, "u1", "match:m", true);
    await setFollowTarget(ds, "u2", "team:b", true);
    await setFollowTarget(ds, "u3", "tournament:t", true);
    expect(await readFollows(ds, "u1")).toEqual(["team:a", "match:m"]);
    expect(await ds.getById(FOLLOWS, "u1")).toMatchObject({ user_id: "u1" });

    const before = ds.billedReads;
    expect(
      (await followerIds(ds, ["match:m", "team:a", "team:b", "tournament:x"])).sort(),
    ).toEqual(["u1", "u2"]);
    // One query per key; an empty one still bills a read.
    expect(ds.billedReads - before).toBe(1 + 1 + 1 + 1);

    await setFollowTarget(ds, "u1", "team:a", false);
    expect(await readFollows(ds, "u1")).toEqual(["match:m"]);
  });

  it("costs 1 read and 1 write per change", async () => {
    await setFollowTarget(ds, "u1", "team:a", true);
    const reads = ds.billedReads;
    const writes = ds.writes;
    await setFollowTarget(ds, "u1", "team:b", true);
    expect(ds.billedReads - reads).toBe(1);
    expect(ds.writes - writes).toBe(1);
  });
});
