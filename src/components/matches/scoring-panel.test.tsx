import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScoringPanel, readBallLabel } from "./scoring-panel";

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

  it.each([
    ["a dot ball", null, "0 runs (dot ball)", 0, undefined],
    ["a wide", "wide", "1 run", 0, { type: "wide", runs: 2 }],
    ["a bye", "bye", "1 run", 0, { type: "bye", runs: 1 }],
    ["a leg bye", "leg bye", "1 run", 0, { type: "leg_bye", runs: 1 }],
  ] as const)(
    "scores %s straight away: no shot direction to pick",
    (_label, extra, runsButton, runs, extras) => {
      const onScore = vi.fn();
      render(<ScoringPanel {...defaultProps} onScore={onScore} />);
      if (extra) {
        fireEvent.click(
          screen.getByRole("button", { name: new RegExp(`^${extra}`, "i") }),
        );
      }
      fireEvent.click(screen.getByRole("button", { name: runsButton }));
      expect(
        screen.queryByText(/select shot direction/i),
      ).not.toBeInTheDocument();
      expect(onScore).toHaveBeenCalledWith(runs, extras, undefined);
    },
  );

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
    const midWicketSector = screen.getByRole("button", { name: /mid-wicket/i });
    fireEvent.click(midWicketSector);

    expect(onScore).toHaveBeenCalledWith(
      4,
      { type: "no_ball", runs: 1 },
      "mid_wicket",
    );
  });

  it("supports scoring 5 runs directly from the keypad", () => {
    const onScore = vi.fn();
    render(
      <ScoringPanel
        {...defaultProps}
        onScore={onScore}
        wagonWheelPrompt={false}
      />,
    );
    const fiveBtn = screen.getByRole("button", { name: /^5 runs$/i });
    fireEvent.click(fiveBtn);

    expect(onScore).toHaveBeenCalledWith(5, undefined, undefined);
  });

  it("opens high runs drawer on +More and allows selecting 7 to 13 runs", () => {
    const onScore = vi.fn();
    render(
      <ScoringPanel
        {...defaultProps}
        onScore={onScore}
        wagonWheelPrompt={false}
      />,
    );
    const moreBtn = screen.getByRole("button", { name: /more run options/i });
    fireEvent.click(moreBtn);

    expect(screen.getByText(/^more runs$/i)).toBeInTheDocument();
    const sevenBtn = screen.getByRole("button", { name: "7" });
    fireEvent.click(sevenBtn);

    expect(onScore).toHaveBeenCalledWith(7, undefined, undefined);
  });

  it("scores directly in 1-tap when the wagon wheel prompt preference is off", () => {
    const onScore = vi.fn();
    render(
      <ScoringPanel
        {...defaultProps}
        onScore={onScore}
        wagonWheelPrompt={false}
      />,
    );

    const oneButton = screen.getByRole("button", { name: /^1 run$/i });
    fireEvent.click(oneButton);

    expect(onScore).toHaveBeenCalledWith(1, undefined, undefined);
    expect(
      screen.queryByText(/select shot direction/i),
    ).not.toBeInTheDocument();
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

  it("exposes the sunlight preference on the panel for high-contrast styling", () => {
    const { rerender } = render(
      <ScoringPanel {...defaultProps} sunlightMode={false} />,
    );
    const panel = screen
      .getByRole("group", { name: /runs scored/i })
      .closest("[data-sunlight]");
    expect(panel).toHaveAttribute("data-sunlight", "false");

    rerender(<ScoringPanel {...defaultProps} sunlightMode={true} />);
    expect(panel).toHaveAttribute("data-sunlight", "true");
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
      screen.getByText(/selected: tap the runs/i),
    ).toBeInTheDocument();
  });

  it("scores directly in 1-tap with zero modals when wagonWheelPrompt is false", () => {
    const onScore = vi.fn();
    render(
      <ScoringPanel
        {...defaultProps}
        onScore={onScore}
        wagonWheelPrompt={false}
      />,
    );

    const fourBtn = screen.getByRole("button", { name: /4.*four/i });
    fireEvent.click(fourBtn);

    expect(onScore).toHaveBeenCalledWith(4, undefined, undefined);
    expect(
      screen.queryByText(/select shot direction/i),
    ).not.toBeInTheDocument();
  });
});

describe("ScoringPanel keyboard guards", () => {
  const base = {
    currentOver: 4,
    currentBall: 2,
    lastBalls: ["1", "4", "0"],
  };

  it("ignores scoring hotkeys while a dialog owns the keyboard", () => {
    const onScore = vi.fn();
    render(
      <ScoringPanel
        {...base}
        onScore={onScore}
        onWicket={vi.fn()}
        onUndo={vi.fn()}
        wagonWheelPrompt={false}
        keyboardSuppressed
      />,
    );
    fireEvent.keyDown(window, { key: "4" });
    expect(onScore).not.toHaveBeenCalled();
  });

  it("keeps undo usable via button and hotkey when run buttons are disabled", () => {
    const onUndo = vi.fn();
    render(
      <ScoringPanel
        {...base}
        onScore={vi.fn()}
        onWicket={vi.fn()}
        onUndo={onUndo}
        wagonWheelPrompt={false}
        disabled
        undoDisabled={false}
      />,
    );
    const undoBtn = screen.getByRole("button", { name: /undo last ball/i });
    expect(undoBtn).toBeEnabled();
    fireEvent.click(undoBtn);

    fireEvent.keyDown(window, { key: "u" });
    expect(onUndo).toHaveBeenCalledTimes(2);
  });

  it("discards the pending delivery when the wagon wheel modal is dismissed", async () => {
    const user = userEvent.setup();
    const onScore = vi.fn();
    render(
      <ScoringPanel
        {...base}
        onScore={onScore}
        onWicket={vi.fn()}
        onUndo={vi.fn()}
        wagonWheelPrompt
      />,
    );

    await user.keyboard("4");
    expect(screen.getByText(/select shot direction/i)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(onScore).not.toHaveBeenCalled();
  });
});

describe("ScoringPanel guards against mis-taps and says what undo did", () => {
  const base = {
    onScore: vi.fn(),
    onWicket: vi.fn(),
    currentOver: 3,
    currentBall: 5,
    lastBalls: ["1", "0", "4", "2", "1"],
  };

  it("keeps penalty and bonus out of the keypad (they are in Match Tools)", () => {
    render(<ScoringPanel {...base} onUndo={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /penalty/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /bonus/i })).toBeNull();
    for (const name of ["Wide", "No ball", "Bye", "Leg bye"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("turns Undo into Cancel while an extra is armed, so a mis-tap costs no ball", () => {
    const onUndo = vi.fn();
    render(<ScoringPanel {...base} onUndo={onUndo} />);
    fireEvent.click(screen.getByRole("button", { name: "Wide" }));
    const cancel = screen.getByRole("button", { name: "Cancel wide" });
    fireEvent.click(cancel);
    expect(onUndo).not.toHaveBeenCalled();
    expect(screen.queryByText(/wide selected/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo last ball" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("says in words which ball was removed, with Restore ball", () => {
    const onRedo = vi.fn();
    render(
      <ScoringPanel
        {...base}
        onUndo={vi.fn()}
        onRedo={onRedo}
        undoNotice={{
          label: "4",
          position: "3.6",
          players: "Starc to Kohli",
          note: "The bowler chosen after it was taken back too",
          pending: false,
          canRedo: true,
        }}
      />,
    );
    const notice = screen.getByTestId("undo-notice");
    expect(notice).toHaveTextContent("Ball removed: Four · 3.6, Starc to Kohli");
    expect(notice).toHaveTextContent("The bowler chosen after it was taken back too");
    fireEvent.click(screen.getByRole("button", { name: "Restore ball" }));
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it("says it is removing the ball while the server does it", () => {
    render(
      <ScoringPanel
        {...base}
        onUndo={vi.fn()}
        undoNotice={{
          label: "W",
          position: "3.6",
          players: null,
          note: null,
          pending: true,
          canRedo: false,
        }}
      />,
    );
    expect(screen.getByTestId("undo-notice")).toHaveTextContent(
      "Removing ball: Wicket · 3.6",
    );
    expect(screen.queryByRole("button", { name: "Restore ball" })).toBeNull();
  });
});

describe("ScoringPanel's This over", () => {
  it("shows a retirement between balls: not numbered, not editable, no wicket", () => {
    const onSelectBall = vi.fn();
    render(
      <ScoringPanel
        onScore={vi.fn()}
        onWicket={vi.fn()}
        onUndo={vi.fn()}
        onSelectBall={onSelectBall}
        currentOver={2}
        currentBall={2}
        lastBalls={["1", "rh", "nb+4", "wd"]}
      />,
    );
    const balls = screen.getByRole("group", { name: "Balls this over" });
    expect(balls).toHaveTextContent("Retired hurt, not a ball");
    // Numbered without the retirement; extras read in words.
    expect(
      screen.getByRole("button", { name: "Ball 2: No ball + 4 runs" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ball 3: Wide" }));
    expect(onSelectBall).toHaveBeenCalledWith(3);
    // 1 + (1 + 4) + 1 runs, and retired hurt is not a wicket.
    expect(screen.getByText("7r")).toBeInTheDocument();
  });
});

describe("ScoringPanel: byes off a no-ball and other prompts", () => {
  const props = {
    onScore: vi.fn(),
    onWicket: vi.fn(),
    onUndo: vi.fn(),
    currentOver: 4,
    currentBall: 2,
    lastBalls: ["1"],
    wagonWheelPrompt: false,
  };

  it("asks under an armed no-ball whether the runs were off the bat or byes", () => {
    const onScore = vi.fn();
    render(<ScoringPanel {...props} onScore={onScore} />);
    expect(screen.queryByRole("radiogroup", { name: /no-ball were/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "No ball" }));
    const group = screen.getByRole("radiogroup", {
      name: "The runs off this no-ball were",
    });
    // Off the bat unless the scorer says otherwise.
    expect(
      screen.getByRole("radio", { name: "Off the bat" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(group).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Byes" }));
    expect(screen.getByText(/tap the byes they ran/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2 runs" }));
    expect(onScore).toHaveBeenCalledWith(
      0,
      { type: "no_ball", runs: 3, noBallRuns: "bye" },
      undefined,
    );
    // The next no-ball starts again from off the bat.
    fireEvent.click(screen.getByRole("button", { name: "No ball" }));
    expect(
      screen.getByRole("radio", { name: "Off the bat" }),
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "4 runs (four)" }));
    expect(onScore).toHaveBeenLastCalledWith(
      4,
      { type: "no_ball", runs: 1 },
      undefined,
    );
  });

  it("does not take 0 as a bye", () => {
    const onScore = vi.fn();
    render(<ScoringPanel {...props} onScore={onScore} />);
    fireEvent.click(screen.getByRole("button", { name: "Bye" }));
    expect(screen.getByRole("button", { name: "0 runs (dot ball)" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "0" });
    expect(onScore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "1 run" }));
    expect(onScore).toHaveBeenCalledWith(0, { type: "bye", runs: 1 }, undefined);
  });

  it("says why the keypad waits, and offers to correct any ball", () => {
    const onEditBalls = vi.fn();
    render(
      <ScoringPanel
        {...props}
        disabled
        waitingNote="Saving the last ball. The next innings opens after it."
        onEditBalls={onEditBalls}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Saving the last ball. The next innings opens after it.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Correct a ball" }));
    expect(onEditBalls).toHaveBeenCalled();
  });

  it("explains a free hit without law numbers", () => {
    render(<ScoringPanel {...props} isFreeHit />);
    expect(
      screen.getByText(/Free hit: the batter can be out only run out/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Law/)).toBeNull();
  });
});

describe("readBallLabel", () => {
  it("reads byes off a no-ball, counting them in the over", () => {
    expect(readBallLabel("nb+2b")).toMatchObject({
      kind: "extra",
      spoken: "No ball + 2 byes",
      runs: 3,
    });
    expect(readBallLabel("nb+1lb")).toMatchObject({
      spoken: "No ball + 1 leg bye",
      runs: 2,
    });
    expect(readBallLabel("nb+4")).toMatchObject({
      spoken: "No ball + 4 runs",
      runs: 5,
    });
  });
});
