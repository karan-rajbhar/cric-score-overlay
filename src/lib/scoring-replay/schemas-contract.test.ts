import { describe, expect, it } from "vitest";
import { parseReplayAction, replayBatchSchemaV1 } from "./schemas";

/**
 * The replay contract, spelled out independently of the validation library:
 * queues outlive deploys, so a payload an older build recorded must keep its
 * meaning, or a scorer's real balls land in the unsaved list. It was written
 * against zod 3 and must hold whatever parses these schemas.
 */

const MATCH = "m1";
const action = (type: string, payload: unknown, id = "a1") => ({
  id,
  type,
  payload,
  queuedAt: 1_700_000_000_000,
});
const parse = (type: string, payload: unknown) =>
  parseReplayAction(MATCH, action(type, payload) as never);

const accepted = (type: string, payload: unknown) => {
  const res = parse(type, payload);
  expect(res, JSON.stringify(payload)).toMatchObject({ ok: true });
  return (res as unknown as { action: { payload: Record<string, unknown> } })
    .action.payload;
};
const refused = (type: string, payload: unknown) =>
  expect(parse(type, payload), JSON.stringify(payload)).toMatchObject({
    ok: false,
    code: "invalid_action",
  });

const ball = { matchId: MATCH, batsmanId: "s", nonStrikerId: "n", bowlerId: "b" };

describe("replay batch envelope", () => {
  const batch = (actions: unknown[], extra = {}) => ({
    v: 1,
    matchId: MATCH,
    actions,
    ...extra,
  });
  const ok = (value: unknown) =>
    replayBatchSchemaV1.safeParse(value).success;

  it("takes a normal batch", () => {
    expect(ok(batch([action("setBowler", { bowlerId: "b" })]))).toBe(true);
  });

  it("takes an action recorded with no payload, queuedAt or resent", () => {
    expect(ok(batch([{ id: "a1", type: "undoLastBall" }]))).toBe(true);
  });

  it("takes payloads of any shape: each is checked in its place afterwards", () => {
    for (const payload of [null, 1, "x", [], {}]) {
      expect(ok(batch([action("setBowler", payload)]))).toBe(true);
    }
  });

  it("drops what a newer client adds", () => {
    expect(ok(batch([action("x", {})], { future: true }))).toBe(true);
  });

  it("refuses a wrong version, an empty batch and too many actions", () => {
    expect(ok({ ...batch([action("x", {})]), v: 2 })).toBe(false);
    expect(ok(batch([]))).toBe(false);
    const many = Array.from({ length: 500 }, (_, i) =>
      action("x", {}, `a${i}`),
    );
    expect(ok(batch(many))).toBe(false);
  });
});

describe("payloads older queues hold", () => {
  it("keeps a plain delivery", () => {
    expect(
      accepted("recordBall", { ...ball, event: { runsScored: 4 } }),
    ).toMatchObject({ event: { runsScored: 4 } });
  });

  it("reads a stored null as absent", () => {
    const { event } = accepted("recordBall", {
      ...ball,
      event: {
        runsScored: 1,
        extras: null,
        extraType: null,
        isWicket: null,
        dismissalType: null,
        commentary: null,
        noBallRuns: null,
      },
    }) as { event: Record<string, unknown> };
    expect(event.runsScored).toBe(1);
    for (const key of ["extras", "extraType", "isWicket", "noBallRuns"]) {
      expect(event[key]).toBeUndefined();
    }
  });

  it("keeps nullable ids nullable", () => {
    const { event } = accepted("recordBall", {
      ...ball,
      event: { runsScored: 0, fielderId: null, shotZone: null },
    }) as { event: Record<string, unknown> };
    expect(event.fielderId).toBeNull();
    expect(event.shotZone).toBeNull();
  });

  it("drops a field a newer client adds, rather than refusing the ball", () => {
    const { event } = accepted("recordBall", {
      ...ball,
      future: 1,
      event: { runsScored: 2, future: "x" },
    }) as { event: Record<string, unknown> };
    expect(event.runsScored).toBe(2);
    expect(event).not.toHaveProperty("future");
  });

  it("takes an action with no payload as empty", () => {
    expect(parse("undoLastBall", undefined)).toMatchObject({ ok: true });
    expect(parse("undoLastBall", null)).toMatchObject({ ok: true });
  });

  it("takes each simple action", () => {
    accepted("setBatsmen", { strikerId: "s", nonStrikerId: "n" });
    accepted("setBowler", { bowlerId: "b" });
    accepted("reassignOverBowler", { bowlerId: "b" });
    accepted("replaceBatter", { fromId: "a", toId: "b" });
    accepted("retireBatter", { playerId: "p", type: "retired_hurt" });
    accepted("retireBatter", { playerId: "p", type: "retired_out", reason: null });
    accepted("awardPenalty", {
      teamId: "t",
      runs: 5,
      reason: "Time wasting",
      type: "penalty",
    });
  });

  it("takes an edit from a client older than its optional fields", () => {
    const edit = {
      ballId: "b1",
      runsScored: 1,
      extras: 0,
      isWicket: false,
    };
    expect(accepted("updateBall", edit)).toMatchObject(edit);
    accepted("updateBall", {
      ...edit,
      extraType: null,
      dismissalType: null,
      fielderId: null,
      noBallRuns: null,
      batsmanId: null,
      bowlerId: null,
    });
  });
});

describe("what stays refused", () => {
  it("wrong or missing required fields", () => {
    refused("setBowler", {});
    refused("setBowler", { bowlerId: "" });
    refused("setBowler", { bowlerId: 7 });
    refused("setBatsmen", { strikerId: "s" });
    refused("retireBatter", { playerId: "p", type: "gone" });
    refused("awardPenalty", { teamId: "t", runs: 0, reason: "", type: "penalty" });
    refused("updateBall", { ballId: "b1" });
  });

  it("runs that are not a small whole number", () => {
    for (const runsScored of [-1, 100, 1.5, "4", Number.NaN]) {
      refused("recordBall", { ...ball, event: { runsScored } });
    }
  });

  it("an unknown extra type", () => {
    refused("recordBall", { ...ball, event: { extraType: "free_hit" } });
  });

  it("ids and text over their limit", () => {
    refused("setBowler", { bowlerId: "x".repeat(129) });
    refused("recordBall", {
      ...ball,
      event: { commentary: "x".repeat(2001) },
    });
  });

  it("a payload for another match", () => {
    expect(
      parse("recordBall", { ...ball, matchId: "other", event: {} }),
    ).toMatchObject({ ok: false, code: "invalid_action" });
  });

  it("names the field that failed", () => {
    expect(parse("setBowler", {})).toMatchObject({
      error: expect.stringMatching(/^invalid_action: bowlerId /),
    });
  });

  it("a type the server does not know", () => {
    expect(parse("noSuchAction", {})).toMatchObject({
      ok: false,
      code: "unsupported_action_type",
    });
  });
});
