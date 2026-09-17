import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CurrentBatsmen } from "./current-batsmen";

describe("CurrentBatsmen ('At the Crease' component)", () => {
  it("renders live player scores, balls faced, boundaries, and strike rate accurately", () => {
    render(
      <CurrentBatsmen
        batsman1={{
          id: "b1",
          name: "Virat Kohli",
          runs: 45,
          balls: 28,
          fours: 4,
          sixes: 2,
          isStriker: true,
        }}
        batsman2={{
          id: "b2",
          name: "Rohit Sharma",
          runs: 32,
          balls: 18,
          fours: 3,
          sixes: 1,
          isStriker: false,
        }}
      />,
    );

    expect(screen.getByText("At the Crease")).toBeInTheDocument();
    expect(screen.getByText("Virat Kohli")).toBeInTheDocument();
    expect(screen.getByText("Rohit Sharma")).toBeInTheDocument();

    // Striker score
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("(28)")).toBeInTheDocument();
    expect(screen.getByText("4×4")).toBeInTheDocument();
    expect(screen.getByText("2×6")).toBeInTheDocument();
    expect(screen.getByText("🏏 STRIKE")).toBeInTheDocument();

    // Non-striker score
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.getByText("(18)")).toBeInTheDocument();
    expect(screen.getByText("3×4")).toBeInTheDocument();
    expect(screen.getByText("1×6")).toBeInTheDocument();
  });

  it("renders empty batter seat and triggers select batter callback", () => {
    const onSelectNewBatsman = vi.fn();
    render(
      <CurrentBatsmen
        batsman1={{
          id: "b1",
          name: "Virat Kohli",
          runs: 10,
          balls: 5,
          fours: 1,
          sixes: 0,
          isStriker: true,
        }}
        batsman2={null}
        onSelectNewBatsman={onSelectNewBatsman}
      />,
    );

    expect(screen.getByText("Empty batter seat")).toBeInTheDocument();
    const selectButton = screen.getByRole("button", { name: /select batter/i });
    fireEvent.click(selectButton);
    expect(onSelectNewBatsman).toHaveBeenCalledTimes(1);
  });

  it("handles strike swap when onSwapStriker is provided", () => {
    const onSwapStriker = vi.fn();
    render(
      <CurrentBatsmen
        batsman1={{
          id: "b1",
          name: "Virat Kohli",
          runs: 10,
          balls: 5,
          fours: 1,
          sixes: 0,
          isStriker: true,
        }}
        batsman2={{
          id: "b2",
          name: "Rohit Sharma",
          runs: 5,
          balls: 4,
          fours: 0,
          sixes: 0,
          isStriker: false,
        }}
        onSwapStriker={onSwapStriker}
      />,
    );

    const swapButton = screen.getByRole("button", { name: /swap strike/i });
    expect(swapButton).toBeInTheDocument();
    fireEvent.click(swapButton);
    expect(onSwapStriker).toHaveBeenCalledTimes(1);
  });
});
