import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AbandonMatchDialog } from "./AbandonMatchDialog";
import { PenaltyBonusDialog } from "./PenaltyBonusDialog";
import { RetirePlayerDialog } from "./RetirePlayerDialog";
import { ReviseTargetDialog } from "./ReviseTargetDialog";

// Radix Select scrolls the chosen option into view; jsdom has no layout.
Element.prototype.scrollIntoView ??= vi.fn();
Element.prototype.hasPointerCapture ??= vi.fn(() => false);
Element.prototype.releasePointerCapture ??= vi.fn();

/** Picks an option of a Radix select by its label. */
async function choose(label: RegExp, option: string | RegExp) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

describe("Advanced Scoring Dialogs", () => {
  const team1 = { id: "t-1", name: "Lions" };
  const team2 = { id: "t-2", name: "Tigers" };

  describe("AbandonMatchDialog", () => {
    it("asks for the reason and the result, then calls onConfirm with them", async () => {
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
        screen.getByRole("heading", { name: /end the match early/i }),
      ).toBeInTheDocument();
      const notesInput = screen.getByPlaceholderText(/thunderstorm/i);
      fireEvent.change(notesInput, { target: { value: "Waterlogged pitch after torrential rain" } });

      // Nothing chosen for the scorer: the button says what is missing.
      expect(
        screen.getByRole("button", { name: "Choose a reason" }),
      ).toBeDisabled();
      await choose(/reason for abandonment/i, "Rain / Inclement Weather");
      expect(
        screen.getByRole("button", { name: "Choose the result" }),
      ).toBeDisabled();
      await choose(/official result type/i, /abandoned \(points shared/i);

      const confirmButton = screen.getByRole("button", { name: "Abandon match" });
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
    it("preselects no team and names the team on the button", async () => {
      const onConfirm = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <PenaltyBonusDialog
          open={true}
          onOpenChange={onOpenChange}
          battingTeam={team1}
          bowlingTeam={team2}
          onConfirm={onConfirm}
        />,
      );

      expect(
        screen.getByRole("heading", { name: /award penalty or bonus runs/i }),
      ).toBeInTheDocument();
      // Nobody preselected: the scorer taps the team.
      expect(screen.getByRole("button", { name: "Choose a team" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: /Lions/ })).toHaveAttribute(
        "aria-checked",
        "false",
      );

      fireEvent.click(screen.getByRole("radio", { name: /Tigers/ }));
      // No reason preselected either.
      expect(
        screen.getByRole("button", { name: "Choose a reason" }),
      ).toBeDisabled();
      await choose(/^reason$/i, "Player misconduct");
      fireEvent.click(
        screen.getByRole("button", { name: "Award 5 runs to Tigers" }),
      );

      await waitFor(() =>
        expect(onConfirm).toHaveBeenCalledWith(
          expect.objectContaining({ teamId: "t-2", runs: 5, type: "penalty" }),
        ),
      );
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it("forgets the last team when it opens again (a new innings)", () => {
      const props = {
        onOpenChange: vi.fn(),
        onConfirm: vi.fn(),
      };
      const { rerender } = render(
        <PenaltyBonusDialog
          open={true}
          battingTeam={team1}
          bowlingTeam={team2}
          {...props}
        />,
      );
      fireEvent.click(screen.getByRole("radio", { name: /Lions/ }));
      rerender(
        <PenaltyBonusDialog
          open={false}
          battingTeam={team1}
          bowlingTeam={team2}
          {...props}
        />,
      );
      // Second innings: the sides have swapped.
      rerender(
        <PenaltyBonusDialog
          open={true}
          battingTeam={team2}
          bowlingTeam={team1}
          {...props}
        />,
      );
      expect(screen.getByRole("button", { name: "Choose a team" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: /Lions/ })).toHaveTextContent(
        "Fielding now",
      );
    });

    it("stays open when nothing was recorded", async () => {
      const onConfirm = vi.fn().mockResolvedValue(false);
      const onOpenChange = vi.fn();
      render(
        <PenaltyBonusDialog
          open={true}
          onOpenChange={onOpenChange}
          battingTeam={team1}
          bowlingTeam={team2}
          onConfirm={onConfirm}
        />,
      );
      fireEvent.click(screen.getByRole("radio", { name: /Lions/ }));
      fireEvent.click(screen.getByRole("button", { name: /Bonus runs/ }));
      await choose(/^reason$/i, "Target or powerplay bonus");
      fireEvent.click(
        screen.getByRole("button", { name: "Award 1 run to Lions" }),
      );
      await waitFor(() =>
        expect(onConfirm).toHaveBeenCalledWith(
          expect.objectContaining({ type: "bonus", runs: 1, teamId: "t-1" }),
        ),
      );
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });

  describe("RetirePlayerDialog", () => {
    it("asks how they retire (nothing preselected), then confirms retired hurt", async () => {
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

      expect(
        screen.getByRole("heading", { name: "Retire Virat Kohli" }),
      ).toBeInTheDocument();
      expect(screen.getByText(/not a ball/i)).toBeInTheDocument();
      const hurt = screen.getByRole("radio", { name: /retired hurt/i });
      expect(hurt).toHaveAttribute("aria-checked", "false");
      expect(
        screen.getByRole("button", { name: "Choose how they retire" }),
      ).toBeDisabled();

      fireEvent.click(hurt);
      fireEvent.change(screen.getByPlaceholderText(/hamstring strain/i), {
        target: { value: "Finger contusion from bouncer" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Retire hurt" }));

      await waitFor(() =>
        expect(onConfirm).toHaveBeenCalledWith({
          playerId: "player-10",
          type: "retired_hurt",
          reason: "Finger contusion from bouncer",
        }),
      );
    });

    it("allows selecting retired out", async () => {
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

      fireEvent.click(screen.getByRole("radio", { name: /retired out/i }));
      fireEvent.click(screen.getByRole("button", { name: "Retire out" }));

      await waitFor(() =>
        expect(onConfirm).toHaveBeenCalledWith({
          playerId: "player-20",
          type: "retired_out",
          reason: null,
        }),
      );
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
