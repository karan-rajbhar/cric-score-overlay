import { describe, expect, it } from "vitest";
import { DEMO_MATCH_STATE } from "~/app/overlay/[matchId]/demo-data";
import type { LiveEvent } from "~/lib/firebase/types";
import {
  AUTO_RULE_IDS,
  autoGraphics,
  DEFAULT_AUTO_RULES,
  resolveAutoRules,
} from "./auto-graphics";
import type { LiveMatchState } from "./types";

const ev = (type: LiveEvent["type"], fields: Partial<LiveEvent> = {}): LiveEvent => ({
  type,
  player_id: null,
  name: null,
  value: null,
  runs: null,
  balls: null,
  wickets: null,
  number: null,
  ...fields,
});

const base: LiveMatchState = { ...DEMO_MATCH_STATE, events: [] };
/** The next ball after `base`, with these events. */
const next = (events: LiveEvent[], over: Partial<LiveMatchState> = {}): LiveMatchState => ({
  ...base,
  last_ball_seq: (base.last_ball_seq ?? 0) + 1,
  total_balls: (base.total_balls ?? 0) + 1,
  events,
  ...over,
});

describe("autoGraphics", () => {
  it("fires nothing for the first row after loading or a repeated row", () => {
    const row = next([ev("six", { name: "A" })]);
    expect(autoGraphics(null, row)).toEqual([]);
    expect(autoGraphics(row, row)).toEqual([]);
    expect(autoGraphics(row, { ...row })).toEqual([]);
  });

  it("shows a four sting with the batter's figures", () => {
    const row = next([ev("four", { player_id: base.striker_id ?? null, name: "A" })]);
    const out = autoGraphics(base, row);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: "sting",
      rule: "sting_four",
      at: 0,
      durationMs: 4000,
      sting: {
        type: "four",
        title: "Four",
        subtitle: "A",
        detail: `${base.striker_runs} (${base.striker_balls})`,
      },
    });
  });

  it("queues stings, then straps, then a card, one after another", () => {
    const row = next([
      ev("wicket", { name: "B", runs: 12, balls: 9 }),
      ev("over_end", { number: 19, runs: 7, wickets: 1, name: "C" }),
    ]);
    const out = autoGraphics(base, row);
    expect(out.map((g) => [g.kind, g.rule, g.at])).toEqual([
      ["sting", "sting_wicket", 0],
      ["strap", "over_end", 6000],
    ]);
  });

  it("follows the rules: off, and custom seconds", () => {
    const row = next([ev("six", { name: "A" })]);
    expect(autoGraphics(base, row, { sting_six: { on: false } })).toEqual([]);
    const out = autoGraphics(base, row, { sting_six: { seconds: 9 } });
    expect(out[0]).toMatchObject({ durationMs: 9000 });
  });

  it("prefers the hat-trick to the three-for it completes", () => {
    const row = next([
      ev("wicket", { name: "B" }),
      ev("bowler_milestone", { name: "K", value: 3, wickets: 3 }),
      ev("hat_trick", { name: "K", wickets: 3 }),
    ]);
    expect(autoGraphics(base, row).map((g) => g.rule)).toEqual([
      "sting_wicket",
      "hat_trick",
    ]);
  });

  it("names milestones", () => {
    const row = next([ev("batter_milestone", { name: "A", value: 100, runs: 101, balls: 60 })]);
    expect(autoGraphics(base, row)[0]).toMatchObject({
      sting: { title: "Hundred", detail: "101 (60)" },
    });
  });

  it("shows the innings break card after the last ball's graphics", () => {
    const row = next([
      ev("four", { name: "A" }),
      ev("over_end", { number: 20 }),
      ev("innings_end", { number: 1 }),
    ]);
    const out = autoGraphics(base, row);
    expect(out.map((g) => [g.kind, g.rule, g.at])).toEqual([
      ["sting", "sting_four", 0],
      ["view", "innings_break", 4000],
    ]);
  });

  it("shows the result card when the match ends", () => {
    const row = next([ev("match_end")], { status: "completed" });
    expect(autoGraphics(base, row)).toMatchObject([
      { kind: "card", card: "result", rule: "match_result" },
    ]);
  });

  it("shows the toss card when the toss is recorded", () => {
    const before = { ...base, toss_winner_team_id: null };
    expect(autoGraphics(before, { ...base, events: [] })).toMatchObject([
      { kind: "card", card: "toss" },
    ]);
  });

  it("asks for replays only when their rules are on", () => {
    const row = next([ev("wicket", { name: "B" })]);
    expect(autoGraphics(base, row).some((g) => g.kind === "replay")).toBe(false);
    const out = autoGraphics(base, row, { replay_wicket: { on: true } });
    expect(out.find((g) => g.kind === "replay")).toMatchObject({
      reason: "wicket",
      at: 0,
      durationMs: 20000,
    });
  });

  it("fires nothing for an undo (no events)", () => {
    const undone = { ...base, last_ball_seq: (base.last_ball_seq ?? 0) - 1, events: [] };
    expect(autoGraphics(base, undone)).toEqual([]);
  });
});

describe("resolveAutoRules", () => {
  it("fills the defaults and ignores bad values", () => {
    const rules = resolveAutoRules({
      sting_four: { on: false, seconds: -3 },
      unknown: { on: true },
    });
    expect(rules.sting_four).toEqual({ on: false, seconds: DEFAULT_AUTO_RULES.sting_four.seconds });
    expect(Object.keys(rules).sort()).toEqual([...AUTO_RULE_IDS].sort());
  });
});
