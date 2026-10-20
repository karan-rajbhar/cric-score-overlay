/**
 * Retirements and penalty runs applied one at a time (`eventDocsAfter`, what
 * the scoring screen predicts) give exactly the documents the server writes:
 * a full recompute of the ball log with the event appended (`retireBatter`,
 * `awardPenaltyRuns` in rpc/scoring.ts).
 */

import { describe, expect, it } from "vitest";
import {
  battingWithCrease,
  eventDocsAfter,
  newEventBall,
  penaltyFields,
  retirementFields,
} from "./ball-docs";
import { recomputeInnings, type BallInput } from "./recompute";
import { scorecardFields, oversOfBalls } from "../scorecard";
import type { BallByBallRow, InningsRow, MatchesRow } from "../types";

const NOW = "2026-01-01T00:00:00.000Z";
const SETTINGS = [false, true].flatMap((wideRuns) =>
  [false, true].map((noballExtras) => ({
    wide_runs_to_batsman: wideRuns,
    noball_extras_to_batsman: noballExtras,
    wide_counts_as_ball_faced: wideRuns && noballExtras,
  })),
);

type Match = MatchesRow & { id: string };
type Innings = InningsRow & { id: string };

function matchWith(settings: (typeof SETTINGS)[number]): Match {
  return {
    id: "m1",
    balls_per_over: 6,
    max_balls_per_over: null,
    current_innings: 1,
    status: "live",
    ...settings,
  } as unknown as Match;
}

/** The stored innings after `balls` (recomputed as the server stores it). */
function stored(
  match: Match,
  balls: BallInput[],
  previous: Innings | null,
): Innings {
  const out = recomputeInnings({
    match,
    innings: { id: "i1", match_id: "m1" },
    balls,
    existingBatting: previousRows(previous, "batting"),
    existingBowling: previousRows(previous, "bowling"),
    now: NOW,
  });
  return {
    ...(previous ?? {}),
    id: "i1",
    match_id: "m1",
    innings_number: 1,
    team_id: "t1",
    is_completed: false,
    ...out.inningsPatch,
    ...scorecardFields({
      batting: out.batting,
      bowling: out.bowling,
      fallOfWickets: out.fallOfWickets,
      partnerships: out.partnerships,
      balls: balls as BallByBallRow[],
      totalBalls: out.inningsPatch.total_balls ?? 0,
      ballsPerOver: 6,
    }),
    last_ball_seq: balls.at(-1)?.seq ?? 0,
  } as Innings;
}

function previousRows(previous: Innings | null, kind: "batting" | "bowling") {
  return ((previous?.[kind] ?? []) as object[]).map((e) => ({
    ...e,
    id: `i1_${(e as { user_id: string }).user_id}`,
    match_id: "m1",
    innings_id: "i1",
  })) as never[];
}

/** A generated ball log (seeded: the same on every run). */
function* deliveries(seed: number) {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let striker = "a1";
  let nonStriker = "a2";
  let next = 3;
  let legal = 0;
  let seq = 0;
  while (legal < 48 && next <= 11) {
    const over = Math.floor(legal / 6);
    const x = r();
    const base: BallInput = {
      id: `i1_${over}~b${seq + 1}`,
      match_id: "m1",
      innings_id: "i1",
      over_number: over,
      ball_number: (legal % 6) + 1,
      bowler_id: `w${(over % 3) + 1}`,
      batsman_id: striker,
      non_striker_id: nonStriker,
      runs_scored: 0,
      extras: 0,
      extra_type: null,
      is_wicket: false,
      dismissal_type: null,
      fielder_id: null,
      dismissed_player_id: null,
      commentary: null,
      shot_zone: null,
      seq: ++seq,
    };
    let ball: BallInput;
    if (x < 0.08) ball = { ...base, extras: 1, extra_type: "wide" };
    else if (x < 0.14)
      ball = {
        ...base,
        runs_scored: [0, 1, 4][Math.floor(r() * 3)]!,
        extras: 1,
        extra_type: "no_ball",
      };
    else if (x < 0.2)
      ball = { ...base, extras: 1 + Math.floor(r() * 3), extra_type: "bye" };
    else if (x < 0.26)
      ball = {
        ...base,
        is_wicket: true,
        dismissal_type: "bowled",
        dismissed_player_id: striker,
      };
    else
      ball = {
        ...base,
        runs_scored: [0, 0, 1, 1, 2, 3, 4, 6][Math.floor(r() * 8)]!,
      };
    const legalBall =
      ball.extra_type !== "wide" && ball.extra_type !== "no_ball";
    if (legalBall) legal += 1;
    yield ball;
    if (ball.is_wicket) striker = `a${next++}`;
    const run =
      (ball.runs_scored ?? 0) +
      (ball.extra_type === "bye" ? (ball.extras ?? 0) : 0);
    if (run % 2) [striker, nonStriker] = [nonStriker, striker];
    if (legalBall && legal % 6 === 0)
      [striker, nonStriker] = [nonStriker, striker];
  }
}

/** The fields the screen and the next prediction read. */
const comparable = (innings: Partial<InningsRow>) => {
  const strip = (v: unknown): unknown =>
    JSON.parse(
      JSON.stringify(v, (k, val) =>
        k === "updated_at" || k === "created_at" ? undefined : val,
      ),
    );
  return strip({
    totals: [
      innings.total_runs,
      innings.total_wickets,
      innings.total_balls,
      innings.total_overs,
      innings.extras_total,
      innings.extras_penalties,
      innings.extras_bonuses,
    ],
    batting: innings.batting,
    bowling: innings.bowling,
    fall_of_wickets: innings.fall_of_wickets,
    partnerships: innings.partnerships,
    last_ball: innings.last_ball,
    last_over_bowler_id: innings.last_over_bowler_id ?? null,
  });
};

describe("eventDocsAfter", () => {
  type Event =
    | {
        kind: "retire";
        who: "striker" | "non_striker";
        type: "retired_hurt" | "retired_out";
      }
    | { kind: "penalty"; type: "penalty" | "bonus"; runs: number };
  const EVENTS: Event[] = [
    { kind: "retire", who: "striker", type: "retired_hurt" },
    { kind: "retire", who: "non_striker", type: "retired_hurt" },
    { kind: "retire", who: "striker", type: "retired_out" },
    { kind: "retire", who: "non_striker", type: "retired_out" },
    { kind: "penalty", type: "penalty", runs: 5 },
    { kind: "penalty", type: "bonus", runs: 2 },
  ];

  for (const [si, settings] of SETTINGS.entries()) {
    it(`equals the server's recompute after every ball (setting ${si})`, () => {
      const match = matchWith(settings);
      let checked = 0;
      let refused = 0;
      for (const seed of [3, 17, 29]) {
        const log: BallInput[] = [];
        let doc: Innings | null = null;
        for (const ball of deliveries(seed * (si + 1))) {
          log.push(ball);
          doc = stored(match, log, doc);
          for (const ev of EVENTS) {
            const crease = (doc.batting ?? []).filter(
              (b) => b.is_current_batsman,
            );
            const striker = crease.find((b) => b.is_striker)?.user_id;
            const nonStriker = crease.find((b) => !b.is_striker)?.user_id;
            const fields =
              ev.kind === "retire"
                ? retirementFields(
                    doc,
                    (ev.who === "striker" ? striker : nonStriker) ?? "nobody",
                    ev.type,
                    "test",
                  )
                : penaltyFields(doc, ev.runs, ev.type, "test");
            const event = newEventBall(match, doc, fields, NOW, "ev");
            const over =
              oversOfBalls("m1", "i1", log as BallByBallRow[], NOW).find(
                (o) => o.over_number === event.over_number,
              ) ?? null;
            const docs = eventDocsAfter({
              match,
              innings: doc,
              overDoc: over,
              event,
              now: NOW,
            });
            if (!docs) {
              refused += 1;
              continue;
            }
            // The server: the ball log with the event appended, recomputed.
            const server = stored(match, [...log, event as BallInput], doc);
            expect(comparable({ ...doc, ...docs.inningsPatch })).toEqual(
              comparable(server),
            );
            expect(docs.inningsPatch.last_ball_seq).toBe(event.seq);
            checked += 1;
          }
        }
      }
      // Most points of the innings have a full crease and a bowler.
      expect(checked).toBeGreaterThan(refused);
    });
  }

  it("keeps the partner at the crease after a retirement", () => {
    const match = matchWith(SETTINGS[0]!);
    const log = [...deliveries(5)].slice(0, 3);
    const doc = stored(match, log, null);
    const crease = (doc.batting ?? []).filter((b) => b.is_current_batsman);
    const striker = crease.find((b) => b.is_striker)!.user_id;
    const partner = crease.find((b) => !b.is_striker)!.user_id;
    const event = newEventBall(
      match,
      doc,
      retirementFields(doc, striker, "retired_hurt", null),
      NOW,
      "ev",
    );
    expect(event).toMatchObject({
      batsman_id: striker,
      non_striker_id: partner,
      dismissed_player_id: striker,
      bowler_id: null,
    });
    const after = stored(match, [...log, event as BallInput], doc);
    const at = (after.batting ?? []).filter((b) => b.is_current_batsman);
    expect(at.map((b) => [b.user_id, b.is_striker])).toEqual([
      [partner, false],
    ]);
    expect(after.batting?.find((b) => b.user_id === striker)).toMatchObject({
      is_out: false,
      dismissal_type: "retired_hurt",
    });
  });

  it("brings a retired-hurt batter back as the server does", () => {
    const match = matchWith(SETTINGS[0]!);
    const log: BallInput[] = [...deliveries(5)].slice(0, 3);
    let doc = stored(match, log, null);
    const crease = (d: Innings) =>
      (d.batting ?? []).filter((b) => b.is_current_batsman);
    const retiree = crease(doc).find((b) => b.is_striker)!.user_id;
    const partner = crease(doc).find((b) => !b.is_striker)!.user_id;
    const retire = newEventBall(
      match,
      doc,
      retirementFields(doc, retiree, "retired_hurt", null),
      NOW,
      "r1",
    );
    log.push(retire as BallInput);
    doc = stored(match, log, doc);
    // Brought back (the scorer's pick, not in the log), then the partner
    // retires: the log names the retiree again, so they have resumed.
    doc = {
      ...doc,
      batting: battingWithCrease(doc.batting!, retiree, partner)!,
    };
    const event = newEventBall(
      match,
      doc,
      retirementFields(doc, partner, "retired_hurt", null),
      NOW,
      "r2",
    );
    const over =
      oversOfBalls("m1", "i1", log as BallByBallRow[], NOW).find(
        (o) => o.over_number === event.over_number,
      ) ?? null;
    const docs = eventDocsAfter({
      match,
      innings: doc,
      overDoc: over,
      event,
      now: NOW,
    });
    expect(docs).not.toBeNull();
    const server = stored(match, [...log, event as BallInput], doc);
    expect(comparable({ ...doc, ...docs!.inningsPatch })).toEqual(
      comparable(server),
    );
    expect(server.batting?.find((b) => b.user_id === retiree)).toMatchObject({
      is_current_batsman: true,
      dismissal_type: null,
    });
  });

  it("leaves other events to the recompute", () => {
    const match = matchWith(SETTINGS[0]!);
    const log = [...deliveries(7)].slice(0, 4);
    const doc = stored(match, log, null);
    const over = oversOfBalls("m1", "i1", log as BallByBallRow[], NOW)[0]!;
    // Penalty runs to the fielding side; a retirement of someone not at the crease.
    for (const fields of [
      { ...penaltyFields(doc, 5, "penalty", null), penalty_team_id: "t2" },
      retirementFields(doc, "someone-else", "retired_hurt", null),
    ]) {
      const event = newEventBall(match, doc, fields, NOW, "ev");
      expect(
        eventDocsAfter({ match, innings: doc, overDoc: over, event, now: NOW }),
      ).toBeNull();
    }
  });
});
