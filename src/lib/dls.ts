/**
 * Duckworth-Lewis-Stern (DLS) Standard Method Engine
 *
 * Implements the ICC Standard Edition mathematical model for rain-interrupted
 * cricket matches (resource percentage curve based on overs remaining and wickets lost).
 */

export interface DlsResourceParameters {
  r0: number;
  b: number;
}

// Standard ICC model parameters for wickets 0..9 (wickets lost)
export const DLS_STANDARD_PARAMETERS: DlsResourceParameters[] = [
  { r0: 100.0, b: 0.035 }, // 0 wickets down
  { r0: 93.4, b: 0.034 }, // 1 wicket down
  { r0: 85.1, b: 0.032 }, // 2 wickets down
  { r0: 74.9, b: 0.03 }, // 3 wickets down
  { r0: 62.7, b: 0.027 }, // 4 wickets down
  { r0: 49.0, b: 0.024 }, // 5 wickets down
  { r0: 34.9, b: 0.02 }, // 6 wickets down
  { r0: 22.0, b: 0.016 }, // 7 wickets down
  { r0: 11.9, b: 0.012 }, // 8 wickets down
  { r0: 4.7, b: 0.008 }, // 9 wickets down
];

// Scale factor so R(50, 0) == 100.0%
const SCALE_50_0 = 1 - Math.exp(-0.035 * 50);

/**
 * Calculates percentage of resources available given overs remaining and wickets lost.
 * @param oversRemaining Number of overs left (0 to 50)
 * @param wicketsLost Number of wickets lost (0 to 10)
 * @returns Resource percentage between 0 and 100
 */
export function getDlsResourcePercentage(
  oversRemaining: number,
  wicketsLost: number,
): number {
  const overs = Math.max(0, Math.min(50, oversRemaining));
  const wickets = Math.max(0, Math.min(10, wicketsLost));

  if (overs <= 0 || wickets >= 10) {
    return 0;
  }

  const params = DLS_STANDARD_PARAMETERS[wickets];
  if (!params) return 0;

  const raw = params.r0 * (1 - Math.exp(-params.b * overs));
  const normalized = raw / SCALE_50_0;
  return Math.min(100, Math.max(0, Math.round(normalized * 10) / 10));
}

export interface DlsTargetInput {
  team1Runs: number;
  team1OversScheduled: number;
  team1OversBatted?: number;
  team2OversScheduled: number;
  team2OversAvailable: number;
  format?: "T20" | "ODI" | "Custom";
  // If interruption occurred during Team 2's innings:
  interruptionOversRemaining?: number;
  interruptionWicketsLost?: number;
  interruptionRunsScored?: number;
}

export interface DlsTargetResult {
  targetRuns: number;
  team1Resource: number;
  team2Resource: number;
  resourceDifference: number;
  methodDescription: string;
}

/**
 * Calculates revised target according to ICC Standard DLS Method.
 */
export function calculateDlsTarget(input: DlsTargetInput): DlsTargetResult {
  const t1Overs = input.team1OversBatted ?? input.team1OversScheduled;
  const r1 = getDlsResourcePercentage(t1Overs, 0);

  let r2 = 0;
  if (
    input.interruptionOversRemaining !== undefined &&
    input.interruptionWicketsLost !== undefined
  ) {
    // Interruption mid-chase
    const totalResourceAtStart = getDlsResourcePercentage(
      input.team2OversScheduled,
      0,
    );
    const resourceAtInterruption = getDlsResourcePercentage(
      input.interruptionOversRemaining,
      input.interruptionWicketsLost,
    );
    const revisedOversLeft = Math.max(
      0,
      input.team2OversAvailable -
        (input.team2OversScheduled - input.interruptionOversRemaining),
    );
    const resourceAtRestart = getDlsResourcePercentage(
      revisedOversLeft,
      input.interruptionWicketsLost,
    );
    r2 = totalResourceAtStart - (resourceAtInterruption - resourceAtRestart);
  } else {
    // Interruption between innings (clean over reduction for Team 2)
    r2 = getDlsResourcePercentage(input.team2OversAvailable, 0);
  }

  const avgTotal = input.team1OversScheduled <= 20 ? 160 : 245;
  let target = 0;

  if (r2 < r1) {
    target = Math.floor(input.team1Runs * (r2 / r1)) + 1;
  } else if (r2 > r1) {
    target = input.team1Runs + Math.floor((avgTotal * (r2 - r1)) / 100) + 1;
  } else {
    target = input.team1Runs + 1;
  }

  const diff = Math.round((r2 - r1) * 10) / 10;
  const desc =
    r2 < r1
      ? `Target revised to ${target} runs in ${input.team2OversAvailable} overs (DLS method, resources: ${r2}% vs ${r1}%)`
      : `Target is ${target} runs in ${input.team2OversAvailable} overs (DLS method)`;

  return {
    targetRuns: Math.max(1, target),
    team1Resource: r1,
    team2Resource: r2,
    resourceDifference: diff,
    methodDescription: desc,
  };
}

/**
 * Calculates current DLS Par Score for Team 2 at any point during a chase.
 * If Team 2 score is > par, they are winning. If < par, they are trailing.
 */
export function calculateDlsParScore(
  team1Runs: number,
  team1Overs: number,
  team2InitialOvers: number,
  oversRemaining: number,
  wicketsLost: number,
): number {
  const r1 = getDlsResourcePercentage(team1Overs, 0);
  const r2Start = getDlsResourcePercentage(team2InitialOvers, 0);
  const r2Current = getDlsResourcePercentage(oversRemaining, wicketsLost);
  const r2Used = Math.max(0, r2Start - r2Current);

  if (r1 <= 0) return 0;
  return Math.floor(team1Runs * (r2Used / r1));
}
