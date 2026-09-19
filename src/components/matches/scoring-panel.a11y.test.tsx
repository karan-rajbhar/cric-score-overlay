import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoringPanel } from "./scoring-panel";

const baseProps = {
  onScore: vi.fn(),
  onWicket: vi.fn(),
  onUndo: vi.fn(),
  currentOver: 4,
  currentBall: 2,
  lastBalls: ["1", "4", "W"],
};

describe("ScoringPanel accessibility upgrades", () => {
  it("exposes run and extras groups with labels", () => {
    render(<ScoringPanel {...baseProps} />);
    expect(
      screen.getByRole("group", { name: /runs scored/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /extras/i })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /balls this over/i }),
    ).toBeInTheDocument();
  });

  it("labels ball trail with text meaning, not color alone", () => {
    render(<ScoringPanel {...baseProps} />);
    expect(screen.getByRole("button", { name: /ball 2: four/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ball 3: wicket/i }),
    ).toBeInTheDocument();
  });

  it("marks extras as toggle buttons with aria-pressed", () => {
    render(<ScoringPanel {...baseProps} />);
    const wide = screen.getByRole("button", { name: /^wide$/i });
    expect(wide).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(wide);
    expect(wide).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles sunlight mode with aria-pressed", () => {
    render(<ScoringPanel {...baseProps} />);
    const sun = screen.getByRole("button", { name: /sunlight mode/i });
    expect(sun).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(sun);
    expect(sun).toHaveAttribute("aria-pressed", "true");
  });

  it("announces over state via live region", () => {
    render(<ScoringPanel {...baseProps} />);
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toMatch(/over 4\.2/i);
    expect(live?.textContent).toMatch(/wicket/i);
  });

  it("scores via keyboard: 4 opens dialog, W wickets, U undoes", async () => {
    const user = userEvent.setup();
    const onWicket = vi.fn();
    const onUndo = vi.fn();
    render(
      <ScoringPanel {...baseProps} onWicket={onWicket} onUndo={onUndo} />,
    );

    await user.keyboard("4");
    expect(screen.getByText(/select shot direction/i)).toBeInTheDocument();

    // Close dialog via Cancel, then W and U
    await user.keyboard("{Escape}");
    await user.keyboard("w");
    expect(onWicket).toHaveBeenCalledTimes(1);
    await user.keyboard("u");
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
