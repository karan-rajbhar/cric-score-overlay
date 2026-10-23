import { describe, expect, it } from "vitest";
import {
  generateGroupFixtures,
  generateRoundRobinFixtures,
  groupStandings,
  knockoutFirstRound,
  knockoutRoundLabel,
  planNextRound,
  qualifiersFromGroups,
  splitIntoGroups,
  type BracketMatch,
  type KnockoutFixture,
} from "./tournament-scheduler";

const teams = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);
const pairs = (fixtures: KnockoutFixture[]) =>
  fixtures.map((f) => `${f.homeTeamId}-${f.awayTeamId}`);

let nextId = 0;
function played(
  stage: "group" | "knockout",
  team1Id: string,
  team2Id: string,
  winnerId: string | null,
  extra: Partial<BracketMatch> = {},
): BracketMatch {
  nextId += 1;
  return {
    id: `m${nextId}`,
    stage,
    round: stage === "knockout" ? 1 : 1,
    group: null,
    team1Id,
    team2Id,
    status: "completed",
    winnerId,
    resultType: winnerId ? "win" : "tie",
    ...extra,
  };
}

/** Plays a planned knockout round: the home side (better seed) wins unless told. */
function playRound(
  fixtures: KnockoutFixture[],
  upsets: string[] = [],
): BracketMatch[] {
  return fixtures.map((f) =>
    played(
      "knockout",
      f.homeTeamId,
      f.awayTeamId,
      upsets.includes(f.awayTeamId) ? f.awayTeamId : f.homeTeamId,
      { round: f.round },
    ),
  );
}

describe("generateRoundRobinFixtures", () => {
  it("pairs every team once", () => {
    const fixtures = generateRoundRobinFixtures(teams(5));
    expect(fixtures).toHaveLength(10);
    const seen = new Set(
      fixtures.map((f) => [f.homeTeamId, f.awayTeamId].sort().join("-")),
    );
    expect(seen.size).toBe(10);
  });
});

describe("knockoutRoundLabel", () => {
  it("names rounds by the teams in them", () => {
    expect(knockoutRoundLabel(2)).toBe("Final");
    expect(knockoutRoundLabel(4)).toBe("Semi-final");
    expect(knockoutRoundLabel(8)).toBe("Quarter-final");
    expect(knockoutRoundLabel(16)).toBe("Round of 16");
    expect(knockoutRoundLabel(6)).toBe("First round");
  });
});

describe("knockoutFirstRound", () => {
  it("pairs best against worst when the count is a power of two", () => {
    const { fixtures, byes } = knockoutFirstRound(teams(8));
    expect(byes).toEqual([]);
    expect(pairs(fixtures)).toEqual(["t1-t8", "t2-t7", "t3-t6", "t4-t5"]);
    expect(fixtures.map((f) => f.label)).toEqual([
      "Quarter-final 1",
      "Quarter-final 2",
      "Quarter-final 3",
      "Quarter-final 4",
    ]);
  });

  it("gives the top seeds byes down to a power of two", () => {
    expect(knockoutFirstRound(teams(6))).toMatchObject({
      byes: ["t1", "t2"],
    });
    expect(pairs(knockoutFirstRound(teams(6)).fixtures)).toEqual([
      "t3-t6",
      "t4-t5",
    ]);
    expect(knockoutFirstRound(teams(5)).byes).toEqual(["t1", "t2", "t3"]);
    expect(pairs(knockoutFirstRound(teams(5)).fixtures)).toEqual(["t4-t5"]);
    expect(knockoutFirstRound(teams(3)).byes).toEqual(["t1"]);
  });

  it("makes a two-team knockout the final", () => {
    const { fixtures } = knockoutFirstRound(teams(2));
    expect(fixtures).toEqual([
      {
        round: 1,
        slot: 1,
        label: "Final",
        homeTeamId: "t1",
        awayTeamId: "t2",
      },
    ]);
  });
});

describe("splitIntoGroups", () => {
  it("deals seeds in a snake so groups are balanced", () => {
    expect(splitIntoGroups(teams(8), 2)).toEqual([
      { name: "A", teamIds: ["t1", "t4", "t5", "t8"] },
      { name: "B", teamIds: ["t2", "t3", "t6", "t7"] },
    ]);
    const three = splitIntoGroups(teams(7), 3);
    expect(three.map((g) => g.teamIds.length)).toEqual([3, 2, 2]);
  });

  it("plays each group's rounds together", () => {
    const fixtures = generateGroupFixtures(splitIntoGroups(teams(8), 2));
    expect(fixtures).toHaveLength(12);
    expect(fixtures.slice(0, 4).map((f) => `${f.round}${f.group}`)).toEqual([
      "1A",
      "1A",
      "1B",
      "1B",
    ]);
  });
});

describe("groupStandings", () => {
  it("ranks by points, then net run rate", () => {
    const groups = [{ name: "A", teamIds: ["a", "b", "c"] }];
    const m = (x: string, y: string, w: string | null, totals: BracketMatch["totals"]) =>
      played("group", x, y, w, {
        group: "A",
        totals,
        quotaBalls: 120,
        ballsPerOver: 6,
        resultType: w ? "win" : "no_result",
      });
    const standings = groupStandings(groups, [
      m("a", "b", "a", [
        { teamId: "a", runs: 180, balls: 120, allOut: false },
        { teamId: "b", runs: 100, balls: 60, allOut: true },
      ]),
      m("b", "c", "b", [
        { teamId: "b", runs: 150, balls: 120, allOut: false },
        { teamId: "c", runs: 149, balls: 120, allOut: false },
      ]),
      m("c", "a", "c", [
        { teamId: "c", runs: 160, balls: 120, allOut: false },
        { teamId: "a", runs: 150, balls: 120, allOut: false },
      ]),
    ]).get("A")!;
    // All on 2 points: a has the best net run rate (b was all out, so
    // charged 20 overs, not 10).
    expect(standings.map((r) => [r.teamId, r.points])).toEqual([
      ["a", 2],
      ["c", 2],
      ["b", 2],
    ]);
    expect(standings[0]!.netRunRate).toBeCloseTo((330 / 40 - 260 / 40), 2);
  });

  it("gives a no result a point each and leaves net run rate alone", () => {
    const standings = groupStandings(
      [{ name: "A", teamIds: ["a", "b"] }],
      [
        played("group", "a", "b", null, {
          group: "A",
          status: "abandoned",
          resultType: "abandoned",
          totals: [{ teamId: "a", runs: 50, balls: 30, allOut: false }],
        }),
      ],
    ).get("A")!;
    expect(standings.map((r) => [r.points, r.noResults, r.netRunRate])).toEqual([
      [1, 1, 0],
      [1, 1, 0],
    ]);
  });
});

describe("qualifiersFromGroups", () => {
  it("lists winners first, then runners-up, so groups stay apart", () => {
    const row = (teamId: string, group: string) => ({
      teamId,
      group,
      played: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      noResults: 0,
      points: 0,
      netRunRate: 0,
    });
    const seeds = qualifiersFromGroups(
      new Map([
        ["B", [row("b1", "B"), row("b2", "B"), row("b3", "B")]],
        ["A", [row("a1", "A"), row("a2", "A"), row("a3", "A")]],
      ]),
      2,
    );
    expect(seeds).toEqual(["a1", "b1", "a2", "b2"]);
    expect(pairs(knockoutFirstRound(seeds).fixtures)).toEqual(["a1-b2", "b1-a2"]);
  });
});

describe("planNextRound: knockout", () => {
  const seeds = teams(6);

  it("creates the first round with byes", () => {
    const plan = planNextRound({ format: "knockout", seeds, matches: [] });
    expect(plan).toMatchObject({ kind: "knockout", round: 1, byes: ["t1", "t2"] });
  });

  it("waits for the round to finish, and for ties to be decided", () => {
    const first = knockoutFirstRound(seeds).fixtures;
    const [a, b] = playRound(first);
    expect(
      planNextRound({
        format: "knockout",
        seeds,
        matches: [a!, { ...b!, status: "live", winnerId: null }],
      }),
    ).toEqual({ kind: "waiting", matchIds: [b!.id] });
    expect(
      planNextRound({
        format: "knockout",
        seeds,
        matches: [a!, { ...b!, winnerId: null, resultType: "tie" }],
      }),
    ).toEqual({ kind: "undecided", matchIds: [b!.id] });
  });

  it("re-seeds the survivors best against worst, through to the champion", () => {
    const round1 = playRound(knockoutFirstRound(seeds).fixtures, ["t6"]);
    const semis = planNextRound({ format: "knockout", seeds, matches: round1 });
    expect(semis).toMatchObject({ kind: "knockout", round: 2, label: "Semi-final" });
    // Alive in seed order: t1, t2 (byes), t4, t6 (upset).
    expect(pairs((semis as { fixtures: KnockoutFixture[] }).fixtures)).toEqual([
      "t1-t6",
      "t2-t4",
    ]);
    const round2 = playRound((semis as { fixtures: KnockoutFixture[] }).fixtures);
    const final = planNextRound({
      format: "knockout",
      seeds,
      matches: [...round1, ...round2],
    });
    expect(final).toMatchObject({ kind: "knockout", round: 3, label: "Final" });
    expect(pairs((final as { fixtures: KnockoutFixture[] }).fixtures)).toEqual([
      "t1-t2",
    ]);
    const round3 = playRound(
      (final as { fixtures: KnockoutFixture[] }).fixtures,
      ["t2"],
    );
    expect(
      planNextRound({
        format: "knockout",
        seeds,
        matches: [...round1, ...round2, ...round3],
      }),
    ).toEqual({ kind: "complete", championId: "t2" });
  });

  it("refuses when the teams changed after the first round", () => {
    const round1 = playRound(knockoutFirstRound(seeds).fixtures);
    expect(
      planNextRound({ format: "knockout", seeds: teams(7), matches: round1 }),
    ).toMatchObject({ kind: "invalid" });
  });

  it("is only for knockout and mixed tournaments", () => {
    expect(
      planNextRound({ format: "league", seeds, matches: [] }),
    ).toMatchObject({ kind: "invalid" });
  });
});

describe("planNextRound: mixed", () => {
  const seeds = teams(8);

  it("creates the groups first", () => {
    const plan = planNextRound({ format: "mixed", seeds, matches: [], groupCount: 2 });
    expect(plan.kind).toBe("groups");
    if (plan.kind !== "groups") return;
    expect(plan.groups.map((g) => g.teamIds.length)).toEqual([4, 4]);
    expect(plan.fixtures).toHaveLength(12);
    expect(
      planNextRound({ format: "mixed", seeds: teams(3), matches: [], groupCount: 2 }),
    ).toMatchObject({ kind: "invalid" });
  });

  it("takes the top teams of each group into the knockout, then carries on", () => {
    const plan = planNextRound({ format: "mixed", seeds, matches: [], groupCount: 2 });
    if (plan.kind !== "groups") throw new Error("expected groups");
    // The better seed wins every group match.
    const rank = (t: string) => Number(t.slice(1));
    const groupMatches = plan.fixtures.map((f) => {
      const winner = rank(f.homeTeamId) < rank(f.awayTeamId) ? f.homeTeamId : f.awayTeamId;
      return played("group", f.homeTeamId, f.awayTeamId, winner, {
        group: f.group,
        round: f.round,
      });
    });
    expect(
      planNextRound({
        format: "mixed",
        seeds,
        matches: [{ ...groupMatches[0]!, status: "scheduled", winnerId: null }, ...groupMatches.slice(1)],
      }),
    ).toMatchObject({ kind: "waiting" });

    const semis = planNextRound({
      format: "mixed",
      seeds,
      matches: groupMatches,
      qualifiersPerGroup: 2,
    });
    // Group A: t1 t4 t5 t8, group B: t2 t3 t6 t7 -> A1 t1, B1 t2, A2 t4, B2 t3.
    expect(semis).toMatchObject({ kind: "knockout", round: 1, label: "Semi-final" });
    const semiFixtures = (semis as { fixtures: KnockoutFixture[] }).fixtures;
    expect(pairs(semiFixtures)).toEqual(["t1-t3", "t2-t4"]);

    // Later rounds work out who went through from the first round played,
    // whatever is passed now.
    const ko = playRound(semiFixtures);
    const final = planNextRound({
      format: "mixed",
      seeds,
      matches: [...groupMatches, ...ko],
      qualifiersPerGroup: 3,
    });
    expect(final).toMatchObject({ kind: "knockout", round: 2, label: "Final" });
    expect(pairs((final as { fixtures: KnockoutFixture[] }).fixtures)).toEqual([
      "t1-t2",
    ]);
  });
});
