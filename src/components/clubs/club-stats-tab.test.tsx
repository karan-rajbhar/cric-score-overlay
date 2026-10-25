import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClubStatsTab } from "./club-stats-tab";

describe("ClubStatsTab Component", () => {
  const dummyMilestones = {
    totalMatches: 12,
    completedMatches: 10,
    totalRuns: 2840,
    totalWickets: 84,
    highestTeamScore: {
      runs: 224,
      wickets: 3,
      overs: 20,
      teamName: "Metro Lions",
    },
  };

  const dummyBattingLeaders = [
    {
      userId: "u-1",
      name: "Alice Smith",
      runs: 340,
      balls: 210,
      fours: 32,
      sixes: 12,
      inningsCount: 6,
      highestScore: 88,
      strikeRate: "161.9",
    },
  ];

  const dummyBowlingLeaders = [
    {
      userId: "u-2",
      name: "Bob Jones",
      wickets: 15,
      overs: "24.0",
      runs: 168,
      economy: "7.00",
    },
  ];

  it("renders milestone summary statistics", () => {
    render(
      <ClubStatsTab
        clubId="club-1"
        clubName="Metro CC"
        milestones={dummyMilestones}
        battingLeaders={dummyBattingLeaders}
        bowlingLeaders={dummyBowlingLeaders}
      />,
    );

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("2840")).toBeInTheDocument();
    expect(screen.getByText("84")).toBeInTheDocument();
    expect(screen.getByText("224/3")).toBeInTheDocument();
    expect(screen.getByText("Metro Lions")).toBeInTheDocument();
  });

  it("renders top run scorers and top wicket takers", () => {
    render(
      <ClubStatsTab
        clubId="club-1"
        clubName="Metro CC"
        milestones={dummyMilestones}
        battingLeaders={dummyBattingLeaders}
        bowlingLeaders={dummyBowlingLeaders}
      />,
    );

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("340")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("renders LeaderboardView when leaderboardData is provided", () => {
    const mockLbData = {
      batting: [
        {
          userId: "u-1",
          name: "Alice Smith",
          avatar: null,
          matches: 5,
          innings: 5,
          notOuts: 1,
          runs: 340,
          balls: 210,
          fours: 32,
          sixes: 12,
          highestScore: 88,
          isHighestNotOut: true,
          highestScoreDisplay: "88*",
          average: 85,
          averageDisplay: "85.00",
          strikeRate: 161.9,
          strikeRateDisplay: "161.90",
          centuries: 0,
          fifties: 3,
          boundaryPercent: "68.2%",
        },
      ],
      bowling: [],
      fielding: [],
      mvp: [],
      highlights: {
        orangeCap: null,
        purpleCap: null,
        mvpLeader: null,
        mostSixes: null,
        mostFours: null,
        highestScore: null,
        bestBowling: null,
        bestEconomy: null,
        topFielder: null,
      },
    };

    render(
      <ClubStatsTab
        clubId="club-1"
        clubName="Metro CC"
        milestones={dummyMilestones}
        battingLeaders={[]}
        bowlingLeaders={[]}
        leaderboardData={mockLbData}
      />,
    );

    expect(screen.getByText("Leaderboard")).toBeInTheDocument();
  });

  it("offers the statistics as CSV and PDF once there are ranked players", () => {
    const mvp = {
      userId: "u1",
      name: "Asha",
      avatar: null,
      matches: 2,
      totalPoints: 40,
      battingPoints: 30,
      bowlingPoints: 5,
      fieldingPoints: 5,
      runs: 60,
      wickets: 1,
      catches: 1,
      stumpings: 0,
      runOuts: 0,
      summary: "60 runs",
    };
    const none = {
      orangeCap: null,
      purpleCap: null,
      mvpLeader: null,
      mostSixes: null,
      mostFours: null,
      highestScore: null,
      bestBowling: null,
      bestEconomy: null,
      topFielder: null,
    };
    render(
      <ClubStatsTab
        clubId="club-1"
        clubName="Metro CC"
        milestones={dummyMilestones}
        battingLeaders={[]}
        bowlingLeaders={[]}
        leaderboardData={{
          batting: [],
          bowling: [],
          fielding: [],
          mvp: [mvp],
          highlights: none,
        }}
      />,
    );

    expect(
      screen.getByRole("link", { name: /all statistics csv/i }),
    ).toHaveAttribute("href", "/clubs/club-1/stats.csv");
    expect(
      screen.getByRole("link", { name: /all statistics pdf/i }),
    ).toHaveAttribute("href", "/clubs/club-1/stats-report");
  });

  it("offers no download while nobody is ranked", () => {
    render(
      <ClubStatsTab
        clubId="club-1"
        clubName="Metro CC"
        milestones={dummyMilestones}
        battingLeaders={dummyBattingLeaders}
        bowlingLeaders={dummyBowlingLeaders}
      />,
    );
    expect(screen.queryByRole("link", { name: /csv/i })).toBeNull();
  });
});
