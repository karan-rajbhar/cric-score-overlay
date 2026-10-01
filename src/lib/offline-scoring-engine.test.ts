import { describe, it, expect } from "vitest";
import {
  processDeliveryLocally,
  buildContextFromMatch,
  deliveryResultToScoringState,
  type LocalScoringContext,
  type MatchLike,
} from "./offline-scoring-engine";

describe("offline-scoring-engine", () => {
  const baseContext: LocalScoringContext = {
    currentInnings: 1,
    currentOver: 0,
    currentBall: 0,
    totalRuns: 0,
    totalWickets: 0,
    totalBalls: 0,
    strikerId: "bat-1",
    nonStrikerId: "bat-2",
    bowlerId: "bowl-1",
    strikerRuns: 0,
    strikerBalls: 0,
    nonStrikerRuns: 0,
    nonStrikerBalls: 0,
    bowlerRunsConceded: 0,
    bowlerBallsBowled: 0,
    bowlerWickets: 0,
    ballsPerOver: 6,
    oversPerInnings: 20,
    wicketsPerInnings: 10,
    targetRuns: null,
  };

  it("handles standard legal dot ball", () => {
    const result = processDeliveryLocally(baseContext, { runsScored: 0 });
    expect(result.totalRuns).toBe(0);
    expect(result.currentBall).toBe(1);
    expect(result.totalBalls).toBe(1);
    expect(result.strikerBalls).toBe(1);
    expect(result.strikerRuns).toBe(0);
    expect(result.strikerId).toBe("bat-1"); // No strike change
    expect(result.bowlerBallsBowled).toBe(1);
    expect(result.bowlerRunsConceded).toBe(0);
    expect(result.overCompleted).toBe(false);
  });

  it("handles single run with strike rotation", () => {
    const result = processDeliveryLocally(baseContext, { runsScored: 1 });
    expect(result.totalRuns).toBe(1);
    expect(result.currentBall).toBe(1);
    expect(result.strikerId).toBe("bat-2"); // Strike rotated!
    expect(result.nonStrikerId).toBe("bat-1");
    expect(result.nonStrikerRuns).toBe(1);
    expect(result.nonStrikerBalls).toBe(1);
    expect(result.strikerRuns).toBe(0);
    expect(result.strikerBalls).toBe(0);
  });

  it("handles boundary 4 without strike rotation", () => {
    const result = processDeliveryLocally(baseContext, { runsScored: 4 });
    expect(result.totalRuns).toBe(4);
    expect(result.strikerRuns).toBe(4);
    expect(result.strikerBalls).toBe(1);
    expect(result.strikerId).toBe("bat-1");
  });

  it("handles wide ball (extra run, bowler charged, no ball incremented, no strike change)", () => {
    const result = processDeliveryLocally(baseContext, {
      extras: 1,
      extraType: "wide",
    });
    expect(result.totalRuns).toBe(1);
    expect(result.currentBall).toBe(0); // Illegal: does not advance ball count
    expect(result.totalBalls).toBe(0);
    expect(result.strikerBalls).toBe(0); // Batsman does not face
    expect(result.bowlerRunsConceded).toBe(1);
    expect(result.bowlerBallsBowled).toBe(0);
    expect(result.strikerId).toBe("bat-1");
  });

  it("handles no-ball with runs scored off the bat", () => {
    const result = processDeliveryLocally(baseContext, {
      runsScored: 1,
      extras: 1,
      extraType: "no_ball",
    });
    expect(result.totalRuns).toBe(2); // 1 extra + 1 off bat
    expect(result.currentBall).toBe(0); // Illegal delivery
    expect(result.strikerId).toBe("bat-2"); // Strike rotated on odd runs
    expect(result.nonStrikerId).toBe("bat-1");
    expect(result.nonStrikerRuns).toBe(1); // bat-1 scored 1 and moved to non-striker
    expect(result.nonStrikerBalls).toBe(1); // bat-1 faced
    expect(result.bowlerRunsConceded).toBe(2);
  });

  it("handles bye (legal ball, bowler not charged, strike rotates on odd runs)", () => {
    const result = processDeliveryLocally(baseContext, {
      extras: 1,
      extraType: "bye",
    });
    expect(result.totalRuns).toBe(1);
    expect(result.currentBall).toBe(1);
    expect(result.totalBalls).toBe(1);
    expect(result.strikerId).toBe("bat-2"); // Strike rotated on 1 bye
    expect(result.nonStrikerId).toBe("bat-1");
    expect(result.nonStrikerBalls).toBe(1); // bat-1 faced the bye
    expect(result.nonStrikerRuns).toBe(0); // Not credited to batsman
    expect(result.bowlerRunsConceded).toBe(0); // Byes not charged to bowler
  });

  it("handles wicket falling", () => {
    const result = processDeliveryLocally(baseContext, {
      isWicket: true,
      runsScored: 0,
    });
    expect(result.totalWickets).toBe(1);
    expect(result.bowlerWickets).toBe(1);
    expect(result.needsBatsman).toBe(true);
    expect(result.inningsCompleted).toBe(false);
  });

  it("detects over completion at 6 legal balls and swaps strike for new over", () => {
    const almostOverContext: LocalScoringContext = {
      ...baseContext,
      currentBall: 5,
      totalBalls: 5,
      bowlerBallsBowled: 5,
    };
    // 6th ball is a dot ball
    const result = processDeliveryLocally(almostOverContext, { runsScored: 0 });
    expect(result.overCompleted).toBe(true);
    expect(result.needsBowler).toBe(true);
    expect(result.currentOver).toBe(1);
    expect(result.currentBall).toBe(0);
    // End of over strike rotation! bat-1 was on strike, now bat-2 is on strike
    expect(result.strikerId).toBe("bat-2");
    expect(result.nonStrikerId).toBe("bat-1");
  });

  it("detects all-out innings completion", () => {
    const nineWicketsContext: LocalScoringContext = {
      ...baseContext,
      totalWickets: 9,
      wicketsPerInnings: 10,
    };
    const result = processDeliveryLocally(nineWicketsContext, {
      isWicket: true,
    });
    expect(result.totalWickets).toBe(10);
    expect(result.inningsCompleted).toBe(true);
    expect(result.needsBatsman).toBe(false); // No new batsman needed when all out
  });

  it("detects target chased in 2nd innings and completes match", () => {
    const chasingContext: LocalScoringContext = {
      ...baseContext,
      currentInnings: 2,
      targetRuns: 100,
      totalRuns: 98,
      wicketsPerInnings: 10,
      totalWickets: 3,
    };
    // Hits a four to win
    const result = processDeliveryLocally(chasingContext, { runsScored: 4 });
    expect(result.totalRuns).toBe(102);
    expect(result.inningsCompleted).toBe(true);
    expect(result.matchCompleted).toBe(true);
    expect(result.resultDescription).toContain("Batting team won by 7 wickets");
  });

  it("buildContextFromMatch extracts accurate data from match object", () => {
    const matchLike: MatchLike = {
      current_innings: 1,
      current_over: 2,
      current_ball: 3,
      overs_per_innings: 20,
      balls_per_over: 6,
      wickets_per_innings: 10,
      innings: [
        {
          innings_number: 1,
          total_runs: 25,
          total_wickets: 1,
          total_balls: 15,
          target_runs: null,
          batting_performances: [
            { user_id: "p1", runs_scored: 18, balls_faced: 10 },
            { user_id: "p2", runs_scored: 5, balls_faced: 5 },
          ],
          bowling_performances: [
            { user_id: "b1", runs_conceded: 12, balls_bowled: 9, wickets_taken: 1 },
          ],
        },
      ],
    };

    const ctx = buildContextFromMatch(matchLike, "p1", "p2", "b1");
    expect(ctx.currentInnings).toBe(1);
    expect(ctx.currentOver).toBe(2);
    expect(ctx.currentBall).toBe(3);
    expect(ctx.totalRuns).toBe(25);
    expect(ctx.strikerRuns).toBe(18);
    expect(ctx.nonStrikerRuns).toBe(5);
    expect(ctx.bowlerRunsConceded).toBe(12);
    expect(ctx.bowlerWickets).toBe(1);
  });

  it("deliveryResultToScoringState produces valid ScoringState object", () => {
    const result = processDeliveryLocally(baseContext, { runsScored: 4 });
    const scoringState = deliveryResultToScoringState(
      result,
      "bowl-1",
      [
        { id: "1", team_id: "t1", user_id: "bat-1", user: { id: "bat-1", full_name: "Virat Kohli" } },
        { id: "2", team_id: "t1", user_id: "bat-2", user: { id: "bat-2", full_name: "Rohit Sharma" } },
      ],
      [
        { id: "3", team_id: "t2", user_id: "bowl-1", user: { id: "bowl-1", full_name: "Mitchell Starc" } },
      ],
    );

    expect(scoringState.ok).toBe(true);
    expect(scoringState.total_runs).toBe(4);
    expect(scoringState.striker_name).toBe("Virat Kohli");
    expect(scoringState.non_striker_name).toBe("Rohit Sharma");
    expect(scoringState.bowler_name).toBe("Mitchell Starc");
    expect(scoringState.striker_runs).toBe(4);
    expect(scoringState.current_ball).toBe(1);
  });

  it("does not mutate score or advance overs if innings is already completed (overs exhausted)", () => {
    const oversDoneContext: LocalScoringContext = {
      ...baseContext,
      currentOver: 20,
      currentBall: 0,
      oversPerInnings: 20,
      totalRuns: 150,
      totalBalls: 120,
    };

    const res = processDeliveryLocally(oversDoneContext, { runsScored: 4 });
    expect(res.totalRuns).toBe(150);
    expect(res.currentOver).toBe(20);
    expect(res.currentBall).toBe(0);
    expect(res.inningsCompleted).toBe(true);
  });

  it("does not mutate score if innings is already all-out", () => {
    const allOutContext: LocalScoringContext = {
      ...baseContext,
      totalWickets: 10,
      wicketsPerInnings: 10,
      totalRuns: 80,
    };

    const res = processDeliveryLocally(allOutContext, { runsScored: 1 });
    expect(res.totalRuns).toBe(80);
    expect(res.inningsCompleted).toBe(true);
  });

  it("deliveryResultToScoringState forwards ball details and bowler figures on over complete", () => {
    const overDoneResult = processDeliveryLocally(
      {
        ...baseContext,
        currentBall: 5,
        totalBalls: 5,
        bowlerBallsBowled: 5,
        bowlerRunsConceded: 4,
      },
      { runsScored: 2 }
    );

    expect(overDoneResult.overCompleted).toBe(true);

    const scoringState = deliveryResultToScoringState(
      overDoneResult,
      "bowl-1",
      [
        { id: "1", team_id: "t1", user_id: "bat-1", user: { id: "bat-1", full_name: "Virat Kohli" } },
        { id: "2", team_id: "t1", user_id: "bat-2", user: { id: "bat-2", full_name: "Rohit Sharma" } },
      ],
      [
        { id: "3", team_id: "t2", user_id: "bowl-1", user: { id: "bowl-1", full_name: "Mitchell Starc" } },
      ],
      { runsScored: 2 }
    );

    expect(scoringState.runs_scored).toBe(2);
    expect(scoringState.over_completed).toBe(true);
    expect(scoringState.last_bowler_id).toBe("bowl-1");
    expect(scoringState.last_bowler_runs).toBe(6); // 4 + 2
    expect(scoringState.last_bowler_overs).toBe(1); // 6 balls = 1 over
    expect(scoringState.bowler_id).toBeNull(); // bowler selection required
  });
});

