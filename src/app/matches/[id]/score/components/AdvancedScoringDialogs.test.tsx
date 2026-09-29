import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AbandonMatchDialog } from "./AbandonMatchDialog";
import { PenaltyBonusDialog } from "./PenaltyBonusDialog";
import { RetirePlayerDialog } from "./RetirePlayerDialog";
import { ReviseTargetDialog } from "./ReviseTargetDialog";

describe("Advanced Scoring Dialogs", () => {
  const team1 = { id: "t-1", name: "Lions" };
  const team2 = { id: "t-2", name: "Tigers" };

  describe("AbandonMatchDialog", () => {
    it("renders and calls onConfirm with chosen reason and result type", () => {
      const onConfirm = vi.fn();
      render(
        <AbandonMatchDialog
          open={true}
          onOpenChange={vi.fn()}
          team1={team1}
          team2={team2}
          onConfirm={onConfirm}
        />,
      );

      expect(
        screen.getByRole("heading", { name: /abandon match/i }),
      ).toBeInTheDocument();
      const notesInput = screen.getByPlaceholderText(/thunderstorm/i);
      fireEvent.change(notesInput, { target: { value: "Waterlogged pitch after torrential rain" } });

      const confirmButton = screen.getByRole("button", { name: /confirm abandon match/i });
      fireEvent.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "Rain / Inclement Weather",
          resultType: "abandoned",
          notes: "Waterlogged pitch after torrential rain",
        }),
      );
    });
  });

  describe("PenaltyBonusDialog", () => {
    it("renders and awards penalty runs to fielding or batting team", () => {
      const onConfirm = vi.fn();
      render(
        <PenaltyBonusDialog
          open={true}
          onOpenChange={vi.fn()}
          battingTeam={team1}
          bowlingTeam={team2}
          onConfirm={onConfirm}
        />,
      );

      expect(
        screen.getByRole("heading", { name: /award penalty or bonus runs/i }),
      ).toBeInTheDocument();

      // Change runs
      const runsInput = screen.getByRole("spinbutton");
      fireEvent.change(runsInput, { target: { value: "5" } });

      const submitButton = screen.getByRole("button", { name: /award \+5 runs/i });
      fireEvent.click(submitButton);

      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: "t-1",
          runs: 5,
          type: "penalty",
        }),
      );
    });

    it("allows switching to bonus runs mode", () => {
      const onConfirm = vi.fn();
      render(
        <PenaltyBonusDialog
          open={true}
          onOpenChange={vi.fn()}
          battingTeam={team1}
          bowlingTeam={team2}
          onConfirm={onConfirm}
        />,
      );

      // Click Bonus Runs button
      const bonusTab = screen.getByRole("button", { name: /bonus runs/i });
      fireEvent.click(bonusTab);

      // By default clicking bonus sets runs to 1
      const submitButton = screen.getByRole("button", { name: /award \+1 runs/i });
      fireEvent.click(submitButton);

      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "bonus",
          runs: 1,
        }),
      );
    });
  });

  describe("RetirePlayerDialog", () => {
    it("renders and confirms retired hurt without counting as an out wicket", () => {
      const onConfirm = vi.fn();
      render(
        <RetirePlayerDialog
          open={true}
          onOpenChange={vi.fn()}
          playerId="player-10"
          playerName="Virat Kohli"
          onConfirm={onConfirm}
        />,
      );

      expect(screen.getByText(/retire batsman/i)).toBeInTheDocument();
      expect(screen.getByText(/virat kohli/i)).toBeInTheDocument();

      const reasonInput = screen.getByPlaceholderText(/hamstring strain/i);
      fireEvent.change(reasonInput, { target: { value: "Finger contusion from bouncer" } });

      const confirmButton = screen.getByRole("button", { name: /retire hurt \(not out\)/i });
      fireEvent.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledWith({
        playerId: "player-10",
        type: "retired_hurt",
        reason: "Finger contusion from bouncer",
      });
    });

    it("allows selecting retired out", () => {
      const onConfirm = vi.fn();
      render(
        <RetirePlayerDialog
          open={true}
          onOpenChange={vi.fn()}
          playerId="player-20"
          playerName="R. Ashwin"
          onConfirm={onConfirm}
        />,
      );

      // Select retired out option
      const retiredOutOption = screen.getByText("Retire Out");
      fireEvent.click(retiredOutOption);

      const confirmButton = screen.getByRole("button", { name: /retire out \(wicket\)/i });
      fireEvent.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledWith({
        playerId: "player-20",
        type: "retired_out",
        reason: null,
      });
    });
  });

  describe("ReviseTargetDialog", () => {
    it("allows setting revised target runs and overs", () => {
      const onConfirm = vi.fn();
      render(
        <ReviseTargetDialog
          open={true}
          onOpenChange={vi.fn()}
          currentTarget={180}
          currentOvers={20}
          onConfirm={onConfirm}
        />,
      );

      expect(screen.getByText(/revise target \/ overs/i)).toBeInTheDocument();
      const targetInput = screen.getByLabelText(/target runs to win/i);
      fireEvent.change(targetInput, { target: { value: "142" } });

      const oversInput = screen.getByLabelText(/revised overs/i);
      fireEvent.change(oversInput, { target: { value: "15" } });

      const submitButton = screen.getByRole("button", { name: /save revised target/i });
      fireEvent.click(submitButton);

      expect(onConfirm).toHaveBeenCalledWith({
        targetRuns: 142,
        overs: 15,
      });
    });
  });
});
