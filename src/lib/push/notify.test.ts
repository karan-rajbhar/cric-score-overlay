import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const after = vi.fn();
vi.mock("next/server", () => ({ after: (fn: () => unknown) => after(fn) }));
const adminDataSource = vi.fn(() => {
  throw new Error("must not read without push configured");
});
vi.mock("~/lib/admin-data-source", () => ({ adminDataSource: () => adminDataSource() }));

import { MemoryDataSource } from "~/lib/firebase/datasource";
import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "~/lib/firebase/scoring/__fixtures__/golden";
import { stage2Driver } from "~/lib/firebase/scoring/__fixtures__/stage2";
import { setFollowTarget } from "~/lib/follows/store";
import {
  PUSH_LOG,
  inningsEndEventOf,
  matchEventOf,
  matchMessage,
  notifyFollowersAfter,
  notifyMatchEvent,
  progressEventOf,
  type EventState,
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
    {
      team_id: "t1",
      innings_number: 1,
      total_runs: 150,
      total_wickets: 9,
      total_balls: 118,
      is_completed: true,
    },
    {
      team_id: "t2",
      innings_number: 2,
      total_runs: 0,
      total_wickets: 0,
      total_balls: 0,
      is_completed: false,
      target_runs: 151,
    },
  ],
};

/** What the engine answers once an innings has ended: the next one, 0/0. */
const nextInningsReply = {
  current_innings: 2,
  total_runs: 0,
  total_wickets: 0,
  total_balls: 0,
  innings_completed: false,
};

describe("matchEventOf", () => {
  it("reports structural changes only", () => {
    expect(matchEventOf(null)).toBeNull();
    expect(matchEventOf({ match_completed: false, innings_completed: false })).toBeNull();
    expect(matchEventOf({ innings_completed: true })).toBe("innings_break");
    expect(matchEventOf({ innings_break: true })).toBe("innings_break");
    expect(matchEventOf({ innings_completed: true, match_completed: true })).toBe("result");
    // A reply to "End innings" has no flag: on its own it reports nothing.
    expect(matchEventOf(nextInningsReply)).toBeNull();
  });
});

describe("inningsEndEventOf", () => {
  it("is the innings break unless the match is over", () => {
    expect(inningsEndEventOf(null)).toBeNull();
    expect(inningsEndEventOf(nextInningsReply)).toBe("innings_break");
    expect(inningsEndEventOf({ ...nextInningsReply, innings_break: true })).toBe(
      "innings_break",
    );
    expect(inningsEndEventOf({ innings_completed: true, match_completed: true })).toBe(
      "result",
    );
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
    expect(matchMessage(match, "result").body).toBe("Strikers won by 12 runs");
    expect(matchMessage(match, "abandoned").body).toBe("Match abandoned.");
  });

  // 118 balls = 19.4 overs.
  const firstInnings =
    "Innings break. Strikers 150/9 (19.4 overs). Warriors need 151 to win.";

  it("reports the innings that ended, not the next one the reply describes", () => {
    for (const reply of [
      { ...nextInningsReply, innings_break: true },
      nextInningsReply,
    ]) {
      expect(matchMessage(match, "innings_break", reply)).toMatchObject({
        key: "innings_break:1",
        body: firstInnings,
      });
    }
    // A reply about the ended innings itself, and no reply at all (the
    // latest completed innings).
    expect(
      matchMessage(match, "innings_break", { current_innings: 1, innings_completed: true }),
    ).toMatchObject({ key: "innings_break:1", body: firstInnings });
    expect(matchMessage(match, "innings_break")).toMatchObject({
      key: "innings_break:1",
      body: firstInnings,
    });
  });

  it("takes the target from the next innings, or the first innings' runs", () => {
    const [first, second] = match.innings_summary!;
    // A stored target that is not runs + 1.
    const revised = { ...match, innings_summary: [first!, { ...second!, target_runs: 140 }] };
    expect(matchMessage(revised, "innings_break", nextInningsReply).body).toBe(
      "Innings break. Strikers 150/9 (19.4 overs). Warriors need 140 to win.",
    );
    const unopened = { ...match, innings_summary: [first!] };
    expect(matchMessage(unopened, "innings_break", nextInningsReply).body).toBe(firstInnings);
    // A super over: the side batting second chases the first one's score.
    const superOver = {
      ...match,
      innings_summary: [
        first!,
        { ...second!, total_runs: 150, total_balls: 120, is_completed: true },
        {
          team_id: "t2",
          innings_number: 3,
          total_runs: 12,
          total_wickets: 1,
          total_balls: 6,
          is_completed: true,
        },
        { team_id: "t1", innings_number: 4, is_completed: false, target_runs: 13 },
      ],
    };
    expect(
      matchMessage(superOver, "innings_break", { current_innings: 4, innings_break: true }),
    ).toMatchObject({
      key: "innings_break:3",
      body: "Innings break. Warriors 12/1 (1 over). Strikers need 13 to win.",
    });
  });

  it("names no score it does not have", () => {
    const bare = { ...match, innings_summary: null };
    expect(matchMessage(bare, "innings_break", nextInningsReply)).toMatchObject({
      key: "innings_break:1",
      body: "Innings break.",
    });
  });
});

describe("progressEventOf", () => {
  const live = { status: "live", current_innings: 2 };
  it("reports what an edit, penalty or retirement changed", () => {
    const won = { status: "completed", current_innings: 2, result_description: "Bravo won" };
    expect(progressEventOf(live, won)).toEqual({
      event: "result",
      state: { current_innings: 2, result_description: "Bravo won", match_completed: true },
    });
    expect(
      progressEventOf({ status: "live", current_innings: 1 }, live)?.event,
    ).toBe("innings_break");
    expect(progressEventOf(live, live)).toBeNull();
    // A finished match edited: its result was told already.
    expect(progressEventOf(won, won)).toBeNull();
    expect(progressEventOf(null, won)).toBeNull();
  });
});

describe("matchMessage for a match ended early", () => {
  it("names the side the match was awarded to", () => {
    const awarded = {
      ...match,
      result_type: "win",
      result_description: "Match awarded to Warriors: Match Forfeited / Walkover",
    };
    expect(matchMessage(awarded, "abandoned").body).toBe(
      "Match awarded to Warriors: Match Forfeited / Walkover",
    );
  });
});

// The replies below come from the engine itself: the message used to be
// built from totals the reply was assumed to carry, and read "0/0".
describe.each([true, false])(
  "innings break from the engine's replies (incremental: %s)",
  (incremental) => {
    const snapshot = (id: string, name: string) => ({
      id,
      name,
      short_name: name.slice(0, 3).toUpperCase(),
      logo_url: null,
    });
    const play = (overs: number) => {
      const side = stage2Driver(
        syntheticTables({
          overs_per_innings: overs,
          team1_snapshot: snapshot("TA", "Alpha"),
          team2_snapshot: snapshot("TB", "Bravo"),
        }),
        incremental,
      );
      const stored = () =>
        side.ds.all("matches").find((m) => m.id === "M") as unknown as MatchDoc;
      return { replay: new GoldenReplay(side, "M", SYNTHETIC_ROSTERS), stored };
    };

    it("after the ball that ends the innings", async () => {
      const { replay, stored } = play(1);
      let reply: EventState = {};
      for (let i = 0; i < 6; i += 1) {
        expect(matchEventOf(reply)).toBeNull();
        reply = (await replay.step({ kind: "ball", ball: { runs: 1 } })) as EventState;
      }
      expect(reply).toMatchObject({ current_innings: 2, innings_break: true });
      const event = matchEventOf(reply);
      expect(event).toBe("innings_break");
      expect(matchMessage(stored(), event!, reply)).toMatchObject({
        title: "Alpha vs Bravo",
        key: "innings_break:1",
        body: "Innings break. Alpha 6/0 (1 over). Bravo need 7 to win.",
      });
    });

    it("after the innings is ended by hand", async () => {
      const { replay, stored } = play(5);
      for (let i = 0; i < 4; i += 1) {
        await replay.step({ kind: "ball", ball: { runs: 2 } });
      }
      const reply = (await replay.step({ kind: "end_innings" })) as EventState;
      expect(reply).toMatchObject({ current_innings: 2, innings_completed: false });
      const event = inningsEndEventOf(reply);
      expect(event).toBe("innings_break");
      expect(matchMessage(stored(), event!, reply)).toMatchObject({
        key: "innings_break:1",
        body: "Innings break. Alpha 8/0 (0.4 overs). Bravo need 9 to win.",
      });
    });
  },
);

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
