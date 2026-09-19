import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CurrentBowler } from "./current-bowler";

describe("CurrentBowler component", () => {
  it("renders live bowler figures accurately", () => {
    render(
      <CurrentBowler
        bowler={{
          id: "bw1",
          name: "Jasprit Bumrah",
          overs: 2.3,
          maidens: 1,
          runs: 14,
          wickets: 2,
        }}
      />,
    );

    expect(screen.getByText("Current Bowler")).toBeInTheDocument();
    expect(screen.getByText("Jasprit Bumrah")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // wickets
    expect(screen.getByText("14")).toBeInTheDocument(); // runs
    expect(screen.getByText("(2.3)")).toBeInTheDocument(); // overs
    expect(screen.getByText("1 maiden")).toBeInTheDocument();
    expect(screen.getByText(/Econ 5.60/)).toBeInTheDocument();
  });

  it("updates live bowler figures when stats change after scoring a ball", () => {
    const { rerender } = render(
      <CurrentBowler
        bowler={{
          id: "bw1",
          name: "Jasprit Bumrah",
          overs: 0.5,
          maidens: 0,
          runs: 4,
          wickets: 0,
        }}
      />,
    );

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("(0.5)")).toBeInTheDocument();

    // After scoring ball 6 (dot ball, maiden over complete):
    rerender(
      <CurrentBowler
        bowler={{
          id: "bw1",
          name: "Jasprit Bumrah",
          overs: 1.0,
          maidens: 1,
          runs: 4,
          wickets: 0,
        }}
      />,
    );

    expect(screen.getByText("(1.0)")).toBeInTheDocument();
    expect(screen.getByText("1 maiden")).toBeInTheDocument();
    expect(screen.getByText(/Econ 4.00/)).toBeInTheDocument();
  });

  it("renders empty state and allows selecting bowler", () => {
    const onChangeBowler = vi.fn();
    render(<CurrentBowler bowler={null} onChangeBowler={onChangeBowler} />);

    expect(screen.getByText("No bowler selected")).toBeInTheDocument();
    const selectBtn = screen.getByRole("button", { name: /select bowler/i });
    fireEvent.click(selectBtn);
    expect(onChangeBowler).toHaveBeenCalledTimes(1);
  });
});
