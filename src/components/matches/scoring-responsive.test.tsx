import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ScoringPanel } from "./scoring-panel";
import { LiveMatchHUD } from "./live-match-hud";
import type { Match, Innings } from "~/lib/match-types";

describe("Scoring Page UI & Responsive Inspection (Mobile & Desktop)", () => {
  const mockMatchChasing: Match = {
    id: "m-chase",
    title: "Premier T20 Championship",
    match_format: "T20",
    overs_per_innings: 20,
    balls_per_over: 6,
    status: "live",
    current_innings: 2,
    current_over: 15,
    current_ball: 4,
    team1_id: "team-alpha",
    team2_id: "team-beta",
    team1: { id: "team-alpha", name: "Alpha Titans" },
    team2: { id: "team-beta", name: "Beta Blasters" },
    innings: [
      {
        id: "inn-1",
        match_id: "m-chase",
        innings_number: 1,
        team_id: "team-alpha",
        total_runs: 172,
        total_wickets: 6,
        total_balls: 120,
        total_overs: 20,
        is_completed: true,
        target_runs: 173,
        extras_total: 8,
        extras_byes: 1,
        extras_leg_byes: 1,
        extras_wides: 4,
        extras_no_balls: 2,
        extras_penalties: 0,
      },
    ],
  };

  const mockCurrentInnings: Innings = {
    id: "inn-2",
    match_id: "m-chase",
    innings_number: 2,
    team_id: "team-beta",
    total_runs: 148,
    total_wickets: 4,
    total_balls: 94, // 15.4 overs
    total_overs: 15.4,
    is_completed: false,
    target_runs: 173,
    extras_total: 10,
    extras_wides: 5,
    extras_no_balls: 2,
    extras_byes: 1,
    extras_leg_byes: 2,
    extras_penalties: 0,
  };

  const mockStriker = {
    id: "bat-1",
    name: "Rohit Sharma",
    runs: 76,
    balls: 44,
    fours: 8,
    sixes: 4,
    isStriker: true,
  };

  const mockNonStriker = {
    id: "bat-2",
    name: "Suryakumar Yadav",
    runs: 34,
    balls: 18,
    fours: 3,
    sixes: 2,
    isStriker: false,
  };

  const mockBowler = {
    id: "bowl-1",
    name: "Jasprit Bumrah",
    overs: 3.4,
    maidens: 1,
    runs: 22,
    wickets: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Mobile Screen Ergonomics (360px - 414px)", () => {
    it("renders compact cockpit with striker, non-striker, bowler, and equation", () => {
      // Set mobile viewport width
      window.innerWidth = 375;
      window.innerHeight = 667;

      render(
        <div className="w-[375px] max-w-full">
          <LiveMatchHUD
            match={mockMatchChasing}
            currentInnings={mockCurrentInnings}
            striker={mockStriker}
            nonStriker={mockNonStriker}
            bowler={mockBowler}
            lastBalls={["1", "4", "0", "6"]}
          />
        </div>,
      );

      // Scoreboard strip shows score & overs
      expect(screen.getByText("148/4")).toBeInTheDocument();
      expect(screen.getByText(/15.4 ov/i)).toBeInTheDocument();

      // Chase equation title
      expect(screen.getByTestId("chase-equation-title")).toHaveTextContent(
        /Need 25 runs from 26 balls/i,
      );

      // Striker is highlighted with asterisk and stats
      expect(screen.getByText(/Rohit Sharma \*/i)).toBeInTheDocument();
      expect(screen.getByText("76")).toBeInTheDocument();
      expect(screen.getByText(/\(44\)/i)).toBeInTheDocument();

      // Non-striker is visible
      expect(screen.getByText(/Suryakumar Yadav/i)).toBeInTheDocument();
      expect(screen.getByText("34")).toBeInTheDocument();

      // Bowler is visible with figures and overs limit
      expect(screen.getByText(/Jasprit Bumrah/i)).toBeInTheDocument();
      expect(screen.getByText("3/22")).toBeInTheDocument();
      expect(screen.getByText(/\/ 4/i)).toBeInTheDocument();
    });

    it("renders thumb-optimized keypad with boundaries side-by-side (4 and 6)", () => {
      window.innerWidth = 375;
      const onScore = vi.fn();

      render(
        <div className="w-[375px]">
          <ScoringPanel
            onScore={onScore}
            onWicket={vi.fn()}
            onUndo={vi.fn()}
            currentOver={15}
            currentBall={4}
            lastBalls={["1", "4", "0", "6"]}
            wagonWheelPrompt={false}
          />
        </div>,
      );

      // Boundaries 4 and 6 are directly accessible
      const fourBtn = screen.getByRole("button", { name: /4.*four/i });
      const sixBtn = screen.getByRole("button", { name: /6.*six/i });
      const dotBtn = screen.getByRole("button", { name: /0 runs/i });

      expect(fourBtn).toBeInTheDocument();
      expect(sixBtn).toBeInTheDocument();
      expect(dotBtn).toBeInTheDocument();

      // Direct scoring on boundary 4
      fireEvent.click(fourBtn);
      expect(onScore).toHaveBeenCalledWith(4, undefined, undefined);

      // Direct scoring on boundary 6
      fireEvent.click(sixBtn);
      expect(onScore).toHaveBeenCalledWith(6, undefined, undefined);
    });

    it("provides streamlined primary actions in the thumb zone: WICKET and UNDO", () => {
      window.innerWidth = 375;
      const onWicket = vi.fn();
      const onUndo = vi.fn();

      render(
        <div className="w-[375px]">
          <ScoringPanel
            onScore={vi.fn()}
            onWicket={onWicket}
            onUndo={onUndo}
            currentOver={15}
            currentBall={4}
            lastBalls={["1", "4"]}
          />
        </div>,
      );

      // Primary actions are rendered cleanly
      const wicketBtn = screen.getByRole("button", { name: /wicket dismissal/i });
      const undoBtn = screen.getByRole("button", { name: /undo last ball/i });

      expect(wicketBtn).toBeInTheDocument();
      expect(undoBtn).toBeInTheDocument();

      // No duplicate Swap button or confusing Edit button in scoring panel
      expect(screen.queryByRole("button", { name: /swap active striker/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /edit last ball/i })).not.toBeInTheDocument();

      // Clicking UNDO fires callback
      fireEvent.click(undoBtn);
      expect(onUndo).toHaveBeenCalledTimes(1);

      // Clicking WICKET fires callback
      fireEvent.click(wicketBtn);
      expect(onWicket).toHaveBeenCalledTimes(1);
    });

    it("handles fast mobile extras selection (Wide, No ball, Byes)", () => {
      const onScore = vi.fn();

      render(
        <div className="w-[375px]">
          <ScoringPanel
            onScore={onScore}
            onWicket={vi.fn()}
            currentOver={15}
            currentBall={4}
            lastBalls={["1"]}
            wagonWheelPrompt={false}
          />
        </div>,
      );

      // Tap Wide
      const wideBtn = screen.getByRole("button", { name: /^wide$/i });
      fireEvent.click(wideBtn);
      expect(wideBtn).toHaveAttribute("aria-pressed", "true");

      // Verify staged delivery alert banner is visible
      expect(screen.getByText(/wide ball/i)).toBeInTheDocument();

      // Tap 0 (1 Wide recorded)
      const dotBtn = screen.getByRole("button", { name: /0 runs/i });
      fireEvent.click(dotBtn);

      expect(onScore).toHaveBeenCalledWith(
        0,
        { type: "wide", runs: 1 },
        undefined,
      );
    });
  });

  describe("Desktop Screen Inspection (1024px - 1440px)", () => {
    it("renders full match situation grid with CRR, RRR, Target, and Balls remaining", () => {
      window.innerWidth = 1280;

      render(
        <div className="w-[1024px]">
          <LiveMatchHUD
            match={mockMatchChasing}
            currentInnings={mockCurrentInnings}
            striker={mockStriker}
            nonStriker={mockNonStriker}
            bowler={mockBowler}
            lastBalls={["1", "4"]}
          />
        </div>,
      );

      expect(screen.getByText("Target")).toBeInTheDocument();
      expect(screen.getByText("Req RR")).toBeInTheDocument();
      expect(screen.getByText("Curr RR")).toBeInTheDocument();
      expect(screen.getByText("Remain")).toBeInTheDocument();
      expect(screen.getByText("26b")).toBeInTheDocument();
    });

    it("supports keyboard-driven fast scoring", () => {
      const onScore = vi.fn();
      const onWicket = vi.fn();
      const onUndo = vi.fn();
      const onSwapStriker = vi.fn();

      render(
        <ScoringPanel
          onScore={onScore}
          onWicket={onWicket}
          onUndo={onUndo}
          onSwapStriker={onSwapStriker}
          currentOver={15}
          currentBall={4}
          lastBalls={["1"]}
          wagonWheelPrompt={false}
        />,
      );

      // Press '4' key
      fireEvent.keyDown(window, { key: "4" });
      expect(onScore).toHaveBeenCalledWith(4, undefined, undefined);

      // Press 'w' key for wicket
      fireEvent.keyDown(window, { key: "w" });
      expect(onWicket).toHaveBeenCalledTimes(1);

      // Press 'u' key for undo
      fireEvent.keyDown(window, { key: "u" });
      expect(onUndo).toHaveBeenCalledTimes(1);

      // Press 's' key for swap striker
      fireEvent.keyDown(window, { key: "s" });
      expect(onSwapStriker).toHaveBeenCalledTimes(1);
    });
  });

  describe("Outdoor Sunlight High-Contrast Mode", () => {
    it("applies pure high-contrast borders and solid fills for bright sunlight", () => {
      render(
        <ScoringPanel
          onScore={vi.fn()}
          onWicket={vi.fn()}
          currentOver={15}
          currentBall={4}
          lastBalls={["1", "4"]}
          sunlightMode={true}
        />,
      );

      const panelCard = screen.getByRole("group", { name: /runs scored/i }).closest("[data-sunlight]");
      expect(panelCard).toHaveAttribute("data-sunlight", "true");

      const fourBtn = screen.getByRole("button", { name: /4.*four/i });
      expect(fourBtn.className).toContain("border-2");
      expect(fourBtn.className).toContain("border-black");
    });
  });
});
