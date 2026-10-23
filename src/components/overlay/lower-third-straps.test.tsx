import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEMO_MATCH_STATE } from "~/app/overlay/[matchId]/demo-data";
import {
  HoldScreen,
  LowerThirdStraps,
  strapAvailable,
  strapHidesScoreBug,
  useHeldState,
} from "./lower-third-straps";
import type { ActiveLowerThirdStrap, LiveMatchState } from "./types";

const S = DEMO_MATCH_STATE;

function show(strap: Partial<ActiveLowerThirdStrap>, state: LiveMatchState = S) {
  return render(
    <LowerThirdStraps
      strap={{ id: "x", type: "custom", title: "", durationMs: 5000, ...strap }}
      state={state}
      layout="bottom"
      onDismiss={vi.fn()}
    />,
  );
}

describe("LowerThirdStraps", () => {
  it("renders nothing without a strap", () => {
    const { container } = render(
      <LowerThirdStraps strap={null} state={S} layout="bottom" onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the striker's innings with boundaries and strike rate", () => {
    show({ type: "batsman" });
    expect(screen.getByText(S.striker_name!)).toBeInTheDocument();
    expect(
      screen.getByText(`${S.striker_runs} off ${S.striker_balls} balls`),
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`4s ${S.striker_fours}`))).toBeInTheDocument();
    expect(screen.getByText(/SR \d+\.\d/)).toBeInTheDocument();
  });

  it("shows the bowler's figures with maidens and economy", () => {
    show({ type: "bowler" });
    expect(screen.getByText(S.current_bowler_name!)).toBeInTheDocument();
    expect(screen.getByText(/Maidens \d+ · Econ \d+\.\d{2}/)).toBeInTheDocument();
  });

  it("shows the chase", () => {
    show({ type: "target" });
    expect(
      screen.getByText(`Need ${S.runs_needed} from ${S.balls_remaining} balls`),
    ).toBeInTheDocument();
    expect(screen.getByText(`Target ${S.target_runs}`)).toBeInTheDocument();
  });

  it("shows the last wicket from the live row", () => {
    show({ type: "last_wicket" });
    expect(screen.getByText(S.last_wicket!.name!)).toBeInTheDocument();
  });

  it("labels the win predictor as an estimate", () => {
    show({ type: "win_predictor" });
    expect(screen.getByText("Estimate")).toBeInTheDocument();
    expect(screen.getByText(/\d+% · .* \d+%/)).toBeInTheDocument();
  });

  it("renders nothing for a strap without data, and says so", () => {
    const noPowerplay = { ...S, powerplay: null };
    expect(strapAvailable("powerplay", noPowerplay)).toBe(false);
    const { container } = show({ type: "powerplay" }, noPowerplay);
    expect(container.firstChild).toBeNull();
    expect(strapAvailable("powerplay", { ...S, powerplay: { end_over: 6 } })).toBe(true);
    expect(strapAvailable("commentary", { ...S, last_ball_commentary: null })).toBe(false);
    expect(strapAvailable("custom", S)).toBe(true);
  });

  it("shows producer messages in three forms", () => {
    const { rerender } = show({
      type: "message",
      form: "double",
      title: "Lunch",
      subtitle: "Play resumes at 1.40pm",
    });
    expect(screen.getByText("Lunch")).toBeInTheDocument();
    expect(screen.getByText("Play resumes at 1.40pm")).toBeInTheDocument();
    for (const form of ["single", "baseline"] as const) {
      rerender(
        <LowerThirdStraps
          strap={{ id: form, type: "message", form, title: `A ${form} line` }}
          state={S}
          layout="bottom"
          onDismiss={vi.fn()}
        />,
      );
      expect(screen.getByText(`A ${form} line`)).toBeInTheDocument();
    }
  });

  it("hides the score bar only for a single-line message", () => {
    expect(strapHidesScoreBug({ id: "a", type: "message", title: "x", form: "single" })).toBe(true);
    expect(strapHidesScoreBug({ id: "b", type: "message", title: "x", form: "baseline" })).toBe(false);
    expect(strapHidesScoreBug(null)).toBe(false);
  });
});

describe("holding", () => {
  it("covers the picture in black, or shows a holding line", () => {
    const { rerender, container } = render(<HoldScreen mode="black" />);
    expect(screen.getByLabelText("Holding")).toHaveClass("bg-black");
    rerender(<HoldScreen mode="card" />);
    expect(screen.getByText("Score being updated")).toBeInTheDocument();
    rerender(<HoldScreen mode="clean" />);
    expect(container.firstChild).toBeNull();
  });

  it("freezes the live row while held", () => {
    const { result, rerender } = renderHook(
      ({ state, held }) => useHeldState(state, held),
      { initialProps: { state: 1, held: false } },
    );
    expect(result.current).toBe(1);
    rerender({ state: 2, held: true });
    expect(result.current).toBe(1);
    rerender({ state: 3, held: true });
    expect(result.current).toBe(1);
    rerender({ state: 4, held: false });
    expect(result.current).toBe(4);
  });
});
