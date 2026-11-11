import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TossDialog } from "./TossDialog";

const match = {
  team1: { id: "t1", name: "Lions" },
  team2: { id: "t2", name: "Tigers" },
};

function Harness({ onConfirm }: { onConfirm: (w: string, d: string) => void }) {
  const [winner, setWinner] = useState("");
  const [decision, setDecision] = useState("");
  return (
    <TossDialog
      open
      onOpenChange={() => {}}
      match={match}
      tossWinner={winner}
      tossDecision={decision}
      onTossWinnerChange={setWinner}
      onTossDecisionChange={setDecision}
      onConfirm={() => onConfirm(winner, decision)}
      isProcessing={false}
    />
  );
}

describe("TossDialog", () => {
  it("needs the toss winner and the decision before the match can start", () => {
    render(<Harness onConfirm={vi.fn()} />);
    // Nothing preselected; the button says what is missing.
    const start = screen.getByRole("button", { name: "Choose who won the toss" });
    expect(start).toBeDisabled();
    expect(start).toHaveAccessibleDescription("Choose who won the toss.");
    for (const name of ["Lions", "Bat", "Bowl"]) {
      expect(screen.getByRole("radio", { name })).toHaveAttribute(
        "aria-checked",
        "false",
      );
    }
    fireEvent.click(screen.getByRole("radio", { name: "Lions" }));
    expect(
      screen.getByRole("button", { name: "Choose bat or bowl" }),
    ).toBeDisabled();
  });

  it("records the toss in two taps and says who bats first", () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("radio", { name: "Tigers" }));
    fireEvent.click(screen.getByRole("radio", { name: "Bowl" }));
    expect(
      screen.getByText(
        "Tigers won the toss and chose to bowl. Lions bat first.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));
    expect(onConfirm).toHaveBeenCalledWith("t2", "bowl");
  });
});
