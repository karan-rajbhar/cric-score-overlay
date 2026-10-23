import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const after = vi.fn();
vi.mock("next/server", () => ({ after: (fn: () => unknown) => after(fn) }));
const adminDataSource = vi.fn(() => {
  throw new Error("must not read without push configured");
});
vi.mock("~/lib/admin-data-source", () => ({ adminDataSource: () => adminDataSource() }));

import { MemoryDataSource } from "~/lib/firebase/datasource";
import { setFollowTarget } from "~/lib/follows/store";
import {
  PUSH_LOG,
  matchEventOf,
  matchMessage,
  notifyFollowersAfter,
  notifyMatchEvent,
  type MatchDoc,
} from "./notify";
import { PUSH_SUBSCRIPTIONS, saveSubscription, subscriptionId } from "./subscriptions";
import type { VapidKeys } from "./web-push";

const P256DH =
  "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
const AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
const KEYS: VapidKeys = { publicKey: "pub", privateKey: "priv", subject: "mailto:x@y.z" };

const match: MatchDoc & Record<string, unknown> = {
  id: "m1",
  title: "Strikers vs Warriors",
  team1_id: "t1",
  team2_id: "t2",
  tournament_id: "r1",
  team1_snapshot: { name: "Strikers" },
  team2_snapshot: { name: "Warriors" },
  toss_winner_team_id: "t2",
  toss_decision: "bowl",
  result_description: "Strikers won by 12 runs",
  balls_per_over: 6,
  innings_summary: [
    { team_id: "t1", innings_number: 1, total_runs: 150, total_wickets: 9, total_balls: 118 },
  ],
};

describe("matchEventOf", () => {
  it("reports structural changes only", () => {
    expect(matchEventOf(null)).toBeNull();
    expect(matchEventOf({ match_completed: false, innings_completed: false })).toBeNull();
    expect(matchEventOf({ innings_completed: true })).toBe("innings_break");
    expect(matchEventOf({ innings_completed: true, match_completed: true })).toBe("result");
  });
});

describe("matchMessage", () => {
  it("writes plain messages for each event", () => {
    expect(matchMessage(match, "started")).toMatchObject({
      title: "Strikers vs Warriors",
      body: "Match started. Warriors won the toss and chose to bowl.",
      url: "/matches/m1",
      tag: "match-m1",
      key: "started",
    });
    expect(
      matchMessage(match, "innings_break", {
        current_innings: 1,
        total_runs: 156,
        total_wickets: 7,
        total_balls: 120,
      }),
    ).toMatchObject({
      key: "innings_break:1",
      body: "Innings break. Strikers 156/7 (20 overs). Warriors need 157 to win.",
    });
    // From the summary when the reply has no totals: 118 balls = 19.4 overs.
    expect(matchMessage(match, "innings_break").body).toBe(
      "Innings break. Strikers 150/9 (19.4 overs). Warriors need 151 to win.",
    );
    expect(matchMessage(match, "result").body).toBe("Strikers won by 12 runs");
    expect(matchMessage(match, "abandoned").body).toBe("Match abandoned.");
  });
});

describe("notifyMatchEvent", () => {
  let ds: MemoryDataSource;
  const send = vi.fn();

  beforeEach(async () => {
    ds = new MemoryDataSource({ matches: [match] });
    send.mockReset();
    send.mockImplementation(async (target: { endpoint: string }) => ({
      status: target.endpoint.endsWith("gone") ? 410 : 201,
      gone: target.endpoint.endsWith("gone"),
    }));
    await setFollowTarget(ds, "fan-team", "team:t1", true);
    await setFollowTarget(ds, "fan-match", "match:m1", true);
    await setFollowTarget(ds, "fan-other", "team:t9", true);
    const device = (user: string, name: string) =>
      saveSubscription(ds, user, {
        endpoint: `https://fcm.googleapis.com/fcm/send/${name}`,
        p256dh: P256DH,
        auth: AUTH,
      });
    await device("fan-team", "a");
    await device("fan-match", "b");
    await device("fan-match", "gone");
    await device("fan-other", "c");
  });

  it("sends to the followers' devices, drops expired ones and costs a few reads", async () => {
    const reads = ds.billedReads;
    const res = await notifyMatchEvent(ds, "m1", "result", { keys: KEYS, send });
    expect(res).toEqual({ sent: 2, removed: 1 });
    // match + push_log + 4 follower queries (match, 2 teams, tournament;
    // the empty tournament one bills 1) + 1 device query.
    expect(ds.billedReads - reads).toBe(1 + 1 + (1 + 1 + 1 + 1) + 3);
    const endpoints = send.mock.calls.map((c) => (c[0] as { endpoint: string }).endpoint).sort();
    expect(endpoints).toEqual([
      "https://fcm.googleapis.com/fcm/send/a",
      "https://fcm.googleapis.com/fcm/send/b",
      "https://fcm.googleapis.com/fcm/send/gone",
    ]);
    expect(JSON.parse(send.mock.calls[0]![1] as string)).toEqual({
      title: "Strikers vs Warriors",
      body: "Strikers won by 12 runs",
      url: "/matches/m1",
      tag: "match-m1",
    });
    expect(
      await ds.getById(PUSH_SUBSCRIPTIONS, subscriptionId("https://fcm.googleapis.com/fcm/send/gone")),
    ).toBeNull();
  });

  it("sends each event once per match", async () => {
    await notifyMatchEvent(ds, "m1", "started", { keys: KEYS, send });
    send.mockClear();
    expect(await notifyMatchEvent(ds, "m1", "started", { keys: KEYS, send })).toMatchObject({
      skipped: "already_sent",
    });
    expect(send).not.toHaveBeenCalled();
    expect(await ds.getById(PUSH_LOG, "m1")).toMatchObject({ sent: ["started"] });
  });

  it("stops early without followers or without the match", async () => {
    expect(await notifyMatchEvent(ds, "nope", "result", { keys: KEYS, send })).toMatchObject({
      skipped: "no_match",
    });
    const lonely = new MemoryDataSource({ matches: [{ ...match, team1_id: "x", team2_id: "y", tournament_id: null }] });
    expect(
      await notifyMatchEvent(lonely, "m1", "result", { keys: KEYS, send }),
    ).toMatchObject({ skipped: "no_followers" });
  });
});

describe("notifyFollowersAfter", () => {
  beforeEach(() => {
    after.mockReset();
    adminDataSource.mockClear();
    vi.unstubAllEnvs();
  });

  it("does nothing, and reads nothing, for a delivery or with push off", () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    notifyFollowersAfter("m1", "result");
    notifyFollowersAfter("m1", null);
    expect(after).not.toHaveBeenCalled();
    expect(adminDataSource).not.toHaveBeenCalled();
  });

  it("schedules the work after the response when push is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", P256DH);
    vi.stubEnv("VAPID_PRIVATE_KEY", "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94");
    notifyFollowersAfter("m1", null);
    expect(after).not.toHaveBeenCalled();
    notifyFollowersAfter("m1", "started");
    expect(after).toHaveBeenCalledTimes(1);
    expect(adminDataSource).not.toHaveBeenCalled();
  });
});
