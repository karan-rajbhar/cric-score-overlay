/**
 * Duckworth-Lewis-Stern (DLS) Standard Edition: revised targets for
 * rain-interrupted limited-overs matches.
 *
 * ICC playing conditions use the DLS software (the Professional Edition, whose
 * figures are not published) and fall back to the Standard Edition when no
 * computer is available. This module is that Standard Edition: the published
 * table of resources remaining by overs left (50 to 0) and wickets lost (0 to
 * 9), as a percentage of a full 50-over innings (the 2002 update, in use since
 * then), with the target rules that go with it. A shorter match (a T20 starts
 * on the 20-overs row, 56.6%) uses the same table and the same rules.
 *
 * Sources, identical cell for cell: the ICC documents in every cell of the
 * over-by-over and ball-by-ball sheets (compared as text), the ECB's in every
 * over-by-over cell (read off its images), Wikipedia's in all 68 it gives.
 * - ICC, "Duckworth Lewis Stern Standard Edition table" (TABS2002, "2002
 *   update"), linked from icc-cricket.com/about/cricket/rules-and-regulations/duckworth-lewis-stern:
 *   https://images.icc-cricket.com/image/upload/prd/g9vlypi15msmrfnhucyx.pdf
 * - ICC, "Duckworth-Lewis methodology for re-calculating the target score in an
 *   interrupted match" (playing conditions, 2014: rules, worked examples and
 *   ball-by-ball sheets; the same pages are in the ICC Playing Handbooks
 *   2010-11 and 2012-13):
 *   https://images.icc-cricket.com/image/upload/prd/orlbya4cqyhqaceje3b2.pdf
 * - ECB, "Duckworth/Lewis/Stern methodology of re-calculating the target score
 *   in an interrupted match" (2025, Standard Edition appendix):
 *   https://resources.ecb.co.uk/ecb/document/2026/03/24/0ec6d250-8e00-4150-b3b3-1afb64e4853b/Duckworth-Lewis-Stern-Methodology.pdf
 * - Wikipedia, "Duckworth–Lewis–Stern method": extracts of the 2002 table.
 *
 * Part-overs are interpolated linearly between whole overs. Against the ICC's
 * ball-by-ball sheets that is within 0.1 in 2,496 of 2,500 cells, and 0.3 at
 * most (under an over left with 9 down).
 *
 * Overs here are decimal overs (balls / 6: 7.5 is 7 overs 3 balls), not the
 * scorebook's 7.3.
 */

// Resources remaining (%), indexed by whole overs left, then wickets lost.
// prettier-ignore
const STANDARD_EDITION_TABLE: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 0
  [3.6, 3.6, 3.6, 3.6, 3.6, 3.5, 3.5, 3.4, 3.2, 2.5], // 1
  [7.2, 7.1, 7.1, 7.0, 7.0, 6.8, 6.6, 6.2, 5.5, 3.7], // 2
  [10.6, 10.5, 10.4, 10.3, 10.2, 9.9, 9.5, 8.7, 7.2, 4.2], // 3
  [13.9, 13.8, 13.7, 13.5, 13.2, 12.7, 12.0, 10.7, 8.4, 4.5], // 4
  [17.2, 17.0, 16.8, 16.5, 16.1, 15.4, 14.3, 12.5, 9.4, 4.6], // 5
  [20.3, 20.1, 19.8, 19.4, 18.8, 17.8, 16.4, 13.9, 10.1, 4.6], // 6
  [23.4, 23.1, 22.7, 22.2, 21.4, 20.1, 18.2, 15.2, 10.5, 4.7], // 7
  [26.4, 26.0, 25.5, 24.8, 23.8, 22.3, 19.9, 16.2, 10.9, 4.7], // 8
  [29.3, 28.9, 28.2, 27.4, 26.1, 24.2, 21.4, 17.1, 11.2, 4.7], // 9
  [32.1, 31.6, 30.8, 29.8, 28.3, 26.1, 22.8, 17.9, 11.4, 4.7], // 10
  [34.9, 34.2, 33.4, 32.1, 30.4, 27.8, 24.0, 18.5, 11.5, 4.7], // 11
  [37.6, 36.8, 35.8, 34.3, 32.3, 29.4, 25.1, 19.0, 11.6, 4.7], // 12
  [40.2, 39.3, 38.1, 36.5, 34.2, 30.8, 26.1, 19.5, 11.7, 4.7], // 13
  [42.7, 41.7, 40.4, 38.5, 35.9, 32.2, 27.0, 19.9, 11.8, 4.7], // 14
  [45.2, 44.1, 42.6, 40.5, 37.6, 33.5, 27.8, 20.2, 11.8, 4.7], // 15
  [47.6, 46.3, 44.7, 42.3, 39.1, 34.7, 28.5, 20.5, 11.8, 4.7], // 16
  [49.9, 48.5, 46.7, 44.1, 40.6, 35.8, 29.2, 20.7, 11.9, 4.7], // 17
  [52.2, 50.7, 48.6, 45.9, 42.0, 36.8, 29.8, 20.9, 11.9, 4.7], // 18
  [54.4, 52.8, 50.5, 47.5, 43.4, 37.7, 30.3, 21.1, 11.9, 4.7], // 19
  [56.6, 54.8, 52.4, 49.1, 44.6, 38.6, 30.8, 21.2, 11.9, 4.7], // 20
  [58.7, 56.7, 54.1, 50.6, 45.8, 39.4, 31.2, 21.3, 11.9, 4.7], // 21
  [60.7, 58.6, 55.8, 52.0, 47.0, 40.2, 31.6, 21.4, 11.9, 4.7], // 22
  [62.7, 60.4, 57.4, 53.4, 48.0, 40.9, 32.0, 21.5, 11.9, 4.7], // 23
  [64.6, 62.2, 59.0, 54.7, 49.0, 41.6, 32.3, 21.6, 11.9, 4.7], // 24
  [66.5, 63.9, 60.5, 56.0, 50.0, 42.2, 32.6, 21.6, 11.9, 4.7], // 25
  [68.3, 65.6, 62.0, 57.2, 50.9, 42.8, 32.8, 21.7, 11.9, 4.7], // 26
  [70.1, 67.2, 63.4, 58.4, 51.8, 43.3, 33.0, 21.7, 11.9, 4.7], // 27
  [71.8, 68.8, 64.8, 59.5, 52.6, 43.8, 33.2, 21.8, 11.9, 4.7], // 28
  [73.5, 70.3, 66.1, 60.5, 53.4, 44.2, 33.4, 21.8, 11.9, 4.7], // 29
  [75.1, 71.8, 67.3, 61.6, 54.1, 44.7, 33.6, 21.8, 11.9, 4.7], // 30
  [76.7, 73.2, 68.6, 62.5, 54.8, 45.1, 33.7, 21.9, 11.9, 4.7], // 31
  [78.3, 74.6, 69.7, 63.5, 55.4, 45.4, 33.9, 21.9, 11.9, 4.7], // 32
  [79.8, 75.9, 70.9, 64.4, 56.0, 45.8, 34.0, 21.9, 11.9, 4.7], // 33
  [81.3, 77.2, 72.0, 65.2, 56.6, 46.1, 34.1, 21.9, 11.9, 4.7], // 34
  [82.7, 78.5, 73.0, 66.0, 57.2, 46.4, 34.2, 21.9, 11.9, 4.7], // 35
  [84.1, 79.7, 74.1, 66.8, 57.7, 46.6, 34.3, 21.9, 11.9, 4.7], // 36
  [85.4, 80.9, 75.0, 67.6, 58.2, 46.9, 34.4, 21.9, 11.9, 4.7], // 37
  [86.7, 82.0, 76.0, 68.3, 58.7, 47.1, 34.5, 21.9, 11.9, 4.7], // 38
  [88.0, 83.1, 76.9, 69.0, 59.1, 47.4, 34.5, 22.0, 11.9, 4.7], // 39
  [89.3, 84.2, 77.8, 69.6, 59.5, 47.6, 34.6, 22.0, 11.9, 4.7], // 40
  [90.5, 85.3, 78.7, 70.3, 59.9, 47.8, 34.6, 22.0, 11.9, 4.7], // 41
  [91.7, 86.3, 79.5, 70.9, 60.3, 47.9, 34.7, 22.0, 11.9, 4.7], // 42
  [92.8, 87.3, 80.3, 71.4, 60.7, 48.1, 34.7, 22.0, 11.9, 4.7], // 43
  [93.9, 88.2, 81.0, 72.0, 61.0, 48.3, 34.8, 22.0, 11.9, 4.7], // 44
  [95.0, 89.1, 81.8, 72.5, 61.3, 48.4, 34.8, 22.0, 11.9, 4.7], // 45
  [96.1, 90.0, 82.5, 73.0, 61.6, 48.5, 34.8, 22.0, 11.9, 4.7], // 46
  [97.1, 90.9, 83.2, 73.5, 61.9, 48.6, 34.9, 22.0, 11.9, 4.7], // 47
  [98.1, 91.7, 83.8, 74.0, 62.2, 48.8, 34.9, 22.0, 11.9, 4.7], // 48
  [99.1, 92.6, 84.5, 74.4, 62.5, 48.9, 34.9, 22.0, 11.9, 4.7], // 49
  [100.0, 93.4, 85.1, 74.9, 62.7, 49.0, 34.9, 22.0, 11.9, 4.7], // 50
];

const TABLE_OVERS = STANDARD_EDITION_TABLE.length - 1;

/**
 * Average first-innings score of an uninterrupted 50-over match (G50), used
 * only to raise a target when Team 2 have more resources than Team 1. The
 * ICC and ECB give 245 for full-member and first-class teams and 200 for lower
 * levels; this app scores club cricket. It is a 50-over figure whatever the
 * format, because the resources are shares of a 50-over innings.
 */
const DEFAULT_G50 = 200;

const round1 = (x: number): number => Math.round(x * 10) / 10;

/**
 * Resources remaining (%) with `oversRemaining` decimal overs left and
 * `wicketsLost` down, read from the Standard Edition table (one decimal).
 * 0 with no overs left or 10 wickets down; overs beyond 50 count as 50.
 */
export function getDlsResourcePercentage(
  oversRemaining: number,
  wicketsLost: number,
): number {
  if (!Number.isFinite(oversRemaining) || !Number.isFinite(wicketsLost)) {
    return 0;
  }
  const overs = Math.min(TABLE_OVERS, Math.max(0, oversRemaining));
  const wickets = Math.max(0, Math.floor(wicketsLost));
  if (overs === 0 || wickets >= 10) return 0;

  const whole = Math.floor(overs);
  const low = STANDARD_EDITION_TABLE[whole]?.[wickets] ?? 0;
  if (whole === overs) return low;
  const high = STANDARD_EDITION_TABLE[whole + 1]?.[wickets] ?? low;
  return round1(low + (high - low) * (overs - whole));
}

/**
 * Resources an innings had: those at its start, less what a stoppage took
 * (the resources left when play stopped minus those left on resumption, at the
 * same wickets). A stoppage that ends the innings leaves none on resumption.
 * Without a stoppage the cut is taken to come before the first ball, which
 * gives the resources of `revisedOvers` from the start.
 */
function inningsResources(
  startOvers: number,
  revisedOvers: number,
  stopOversRemaining: number,
  stopWickets: number,
): number {
  const bowled = Math.max(0, startOvers - stopOversRemaining);
  const resumedOversRemaining = Math.max(0, revisedOvers - bowled);
  const lost =
    getDlsResourcePercentage(stopOversRemaining, stopWickets) -
    getDlsResourcePercentage(resumedOversRemaining, stopWickets);
  return round1(Math.max(0, getDlsResourcePercentage(startOvers, 0) - lost));
}

/**
 * Team 2's par score (the target less one run). Fewer resources than Team 1:
 * Team 1's score scaled by R2 / R1. More: Team 1's score plus the excess
 * resources' share of G50. Fractions of a run are dropped. Worked in tenths of
 * a percent, the table's precision, so 250 x 86.8 / 100 is exactly 217.
 */
function parScore(
  team1Runs: number,
  r1: number,
  r2: number,
  g50: number,
): number {
  const t1 = Math.round(r1 * 10);
  const t2 = Math.round(r2 * 10);
  if (t2 < t1) return Math.floor((team1Runs * t2) / t1);
  return team1Runs + Math.floor(((t2 - t1) * g50) / 1000);
}

export interface DlsTargetInput {
  /** Team 1's total (penalty runs included). */
  team1Runs: number;
  /** Overs per innings when the match started. */
  team1OversScheduled: number;
  /**
   * The overs Team 1's innings was cut to. With the stoppage fields below:
   * its length after that stoppage, or the overs faced when the stoppage
   * ended it. Alone: a cut made before its first ball. Leave it out when Team 1
   * had their overs or were bowled out (that uses up all their resources).
   */
  team1OversBatted?: number;
  /** A stoppage in Team 1's innings: overs left when play stopped. */
  team1InterruptionOversRemaining?: number;
  /** A stoppage in Team 1's innings: wickets down when play stopped. */
  team1InterruptionWicketsLost?: number;
  /** Overs Team 2 had when their innings started. */
  team2OversScheduled: number;
  /** Overs Team 2 have after the stoppage (their revised allocation). */
  team2OversAvailable: number;
  /** Not used: the Standard Edition uses one table for every format. */
  format?: "T20" | "ODI" | "Custom";
  /** A stoppage in Team 2's innings: overs left when play stopped. */
  interruptionOversRemaining?: number;
  /** A stoppage in Team 2's innings: wickets down when play stopped. */
  interruptionWicketsLost?: number;
  /** Not used: the runs scored do not change the Standard Edition target. */
  interruptionRunsScored?: number;
  /** Average 50-over first-innings score for the level of cricket (default 200). */
  g50?: number;
}

export interface DlsTargetResult {
  targetRuns: number;
  team1Resource: number;
  team2Resource: number;
  resourceDifference: number;
  methodDescription: string;
}

/**
 * Team 2's target by the Standard Edition, for at most one stoppage in each
 * innings: the par score plus one run.
 */
export function calculateDlsTarget(input: DlsTargetInput): DlsTargetResult {
  const r1 = inningsResources(
    input.team1OversScheduled,
    input.team1OversBatted ?? input.team1OversScheduled,
    input.team1InterruptionOversRemaining ?? input.team1OversScheduled,
    input.team1InterruptionWicketsLost ?? 0,
  );
  const r2 = inningsResources(
    input.team2OversScheduled,
    input.team2OversAvailable,
    input.interruptionOversRemaining ?? input.team2OversScheduled,
    input.interruptionWicketsLost ?? 0,
  );
  const target =
    parScore(input.team1Runs, r1, r2, input.g50 ?? DEFAULT_G50) + 1;
  const targetRuns = Math.max(1, target);
  const overs = input.team2OversAvailable;

  return {
    targetRuns,
    team1Resource: r1,
    team2Resource: r2,
    resourceDifference: round1(r2 - r1),
    methodDescription:
      r2 === r1
        ? `Target is ${targetRuns} runs in ${overs} overs (DLS method)`
        : `Target revised to ${targetRuns} runs in ${overs} overs (DLS method, ${r2}% of resources against ${r1}%)`,
  };
}

/**
 * Team 2's par score at a point in the chase: the score that ties if no more
 * play is possible (above it wins). Team 1 had `team1Overs` overs, Team 2
 * started with `team2InitialOvers` and now have `oversRemaining` left with
 * `wicketsLost` down; no earlier stoppage in the chase.
 */
export function calculateDlsParScore(
  team1Runs: number,
  team1Overs: number,
  team2InitialOvers: number,
  oversRemaining: number,
  wicketsLost: number,
): number {
  const r1 = getDlsResourcePercentage(team1Overs, 0);
  if (r1 <= 0) return 0;
  const r2Used = round1(
    Math.max(
      0,
      getDlsResourcePercentage(team2InitialOvers, 0) -
        getDlsResourcePercentage(oversRemaining, wicketsLost),
    ),
  );
  return parScore(team1Runs, r1, r2Used, DEFAULT_G50);
}
