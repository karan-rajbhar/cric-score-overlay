import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScoringPanel } from "./scoring-panel";

describe("ScoringPanel with Wagon Wheel selection", () => {
  const defaultProps = {
    onScore: vi.fn(),
    onWicket: vi.fn(),
    onUndo: vi.fn(),
    currentOver: 4,
    currentBall: 2,
    lastBalls: ["1", "4", "0"],
  };

  it("does not render the old flat shot zone pill buttons", () => {
    render(<ScoringPanel {...defaultProps} />);

    // Old text header should not be present
    expect(
      screen.queryByText(/shot zone \(optional for live wagon radar\)/i),
    ).not.toBeInTheDocument();
  });

  it("opens the wagon wheel selection dialog when a run button is clicked (Stumps app style)", () => {
    render(<ScoringPanel {...defaultProps} />);

    const fourButton = screen.getByRole("button", { name: /4.*four/i });
    fireEvent.click(fourButton);

    // Wagon wheel shot selection dialog should appear
    expect(screen.getByText(/select shot direction/i)).toBeInTheDocument();
    expect(screen.getByText(/4 runs/i)).toBeInTheDocument();
  });

  it("scores delivery with selected wagon wheel zone when a sector is clicked", () => {
    const onScore = vi.fn();
    render(<ScoringPanel {...defaultProps} onScore={onScore} />);

    // Click 4 runs
    const fourButton = screen.getByRole("button", { name: /4.*four/i });
    fireEvent.click(fourButton);

    // Modal is open; click Cover on the wagon wheel selector
    const coverSector = screen.getByRole("button", { name: /cover/i });
    fireEvent.click(coverSector);

    expect(onScore).toHaveBeenCalledWith(4, undefined, "cover");
  });

  it("scores delivery when clicking inside the boundary on the grass turf", () => {
    const onScore = vi.fn();
    render(<ScoringPanel {...defaultProps} onScore={onScore} />);

    // Click 2 runs
    const twoButton = screen.getByRole("button", { name: /2.*runs/i });
    fireEvent.click(twoButton);

    // Modal is open; find Point button and click its inside-boundary turf wedge
    const pointSector = screen.getByRole("button", { name: /point/i });
    const paths = pointSector.querySelectorAll("path");
    const insideBoundaryTurf = paths[0]!; // Inside boundary turf wedge
    fireEvent.click(insideBoundaryTurf);

    expect(onScore).toHaveBeenCalledWith(2, undefined, "point");
  });

  it("allows skipping shot direction in wagon wheel modal to score directly", () => {
    const onScore = vi.fn();
    render(<ScoringPanel {...defaultProps} onScore={onScore} />);

    const sixButton = screen.getByRole("button", { name: /6 runs|6.*six/i });
    fireEvent.click(sixButton);

    const skipButton = screen.getByRole("button", {
      name: /skip.*without zone/i,
    });
    fireEvent.click(skipButton);

    expect(onScore).toHaveBeenCalledWith(6, undefined, undefined);
  });

  it("supports scoring extras with wagon wheel shot direction", () => {
    const onScore = vi.fn();
    render(<ScoringPanel {...defaultProps} onScore={onScore} />);

    // Click No ball
    const noBallButton = screen.getByRole("button", { name: /no ball/i });
    fireEvent.click(noBallButton);

    // Click 4 runs
    const fourButton = screen.getByRole("button", { name: /4.*four/i });
    fireEvent.click(fourButton);

    // Modal appears with No Ball context
    expect(screen.getAllByText(/no ball/i).length).toBeGreaterThanOrEqual(1);

    // Select Mid Wicket
    const midWicketSector = screen.getByRole("button", { name: /mid wicket/i });
    fireEvent.click(midWicketSector);

    expect(onScore).toHaveBeenCalledWith(
      4,
      { type: "no_ball", runs: 1 },
      "mid_wicket",
    );
  });

  it("supports awarding 5 penalty runs via Penalty extra button", () => {
    const onScore = vi.fn();
    render(<ScoringPanel {...defaultProps} onScore={onScore} />);

    // Click Penalty (+5)
    const penaltyButton = screen.getByRole("button", { name: /penalty/i });
    fireEvent.click(penaltyButton);

    // Click 0 runs / dot ball
    const dotButton = screen.getByRole("button", { name: /0 runs/i });
    fireEvent.click(dotButton);

    // Skip wagon wheel to record
    const skipButton = screen.getByRole("button", {
      name: /skip.*without zone/i,
    });
    fireEvent.click(skipButton);

    expect(onScore).toHaveBeenCalledWith(
      0,
      { type: "penalty", runs: 5 },
      undefined,
    );
  });

  it("allows toggling auto wagon wheel prompt off for direct 1-tap scoring", () => {
    const onScore = vi.fn();
    render(<ScoringPanel {...defaultProps} onScore={onScore} />);

    // Find the Wagon Wheel toggle button
    const toggleButton = screen.getByRole("button", {
      name: /wagon wheel.*(on|prompt)/i,
    });
    fireEvent.click(toggleButton);

    // Now clicking 1 run should score directly without opening dialog
    const oneButton = screen.getByRole("button", { name: /^1 run$/i });
    fireEvent.click(oneButton);

    expect(onScore).toHaveBeenCalledWith(1, undefined, undefined);
    expect(screen.queryByText(/select shot direction/i)).not.toBeInTheDocument();
  });

  it("triggers onUndo when undo button is clicked", () => {
    const onUndo = vi.fn();
    render(<ScoringPanel {...defaultProps} onUndo={onUndo} />);

    const undoButton = screen.getByTitle(/undo last ball/i);
    fireEvent.click(undoButton);

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("triggers onWicket when wicket button is clicked", () => {
    const onWicket = vi.fn();
    render(<ScoringPanel {...defaultProps} onWicket={onWicket} />);

    const wicketButton = screen.getByRole("button", {
      name: /wicket dismissal/i,
    });
    fireEvent.click(wicketButton);

    expect(onWicket).toHaveBeenCalledTimes(1);
  });

  it("supports outdoor sunlight high-contrast mode toggle", () => {
    render(<ScoringPanel {...defaultProps} />);
    const sunBtn = screen.getByRole("button", { name: /sunlight mode/i });
    expect(sunBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(sunBtn);
    expect(sunBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("provides a prominent undo button in the scoring controls", () => {
    const onUndo = vi.fn();
    render(<ScoringPanel {...defaultProps} onUndo={onUndo} />);

    const undoButtons = screen.getAllByRole("button", { name: /undo/i });
    expect(undoButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(undoButtons[0]!);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("renders visible high-contrast extras buttons with no dark: background classes when sunlightMode is active", () => {
    render(<ScoringPanel {...defaultProps} sunlightMode={true} />);
    const wideButton = screen.getByRole("button", { name: "Wide" });
    const noBallButton = screen.getByRole("button", { name: "No ball" });

    expect(wideButton).toBeInTheDocument();
    expect(wideButton.className).toContain("border-2 border-black");
    expect(wideButton.className).toContain("bg-white");
    expect(wideButton.className).toContain("text-black");
    expect(wideButton.className).not.toContain("dark:bg-[#141a17]");

    expect(noBallButton).toBeInTheDocument();
    expect(noBallButton.className).toContain("border-2 border-black");
    expect(noBallButton.className).toContain("bg-white");
    expect(noBallButton.className).toContain("text-black");
    expect(noBallButton.className).not.toContain("dark:bg-[#141a17]");
  });

  it("renders high-contrast active state for selected extra in sunlightMode", () => {
    render(<ScoringPanel {...defaultProps} sunlightMode={true} />);
    const wideButton = screen.getByRole("button", { name: "Wide" });
    fireEvent.click(wideButton);

    expect(wideButton).toHaveAttribute("aria-pressed", "true");
    expect(wideButton.className).toContain("border-2 border-black");
    expect(wideButton.className).toContain("bg-black");
    expect(wideButton.className).toContain("text-white");
    expect(
      screen.getByText(/Tap runs to record delivery/i),
    ).toBeInTheDocument();
  });
});
