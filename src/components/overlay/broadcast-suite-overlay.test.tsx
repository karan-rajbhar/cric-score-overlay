import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DEMO_MATCH_DETAILS,
  DEMO_MATCH_STATE,
} from "~/app/overlay/[matchId]/demo-data";
import {
  BROADCAST_VIEW_OPTIONS,
  BroadcastSuiteOverlay,
  broadcastViewAvailable,
} from "./broadcast-suite-overlay";
import { LEGACY_OVERLAY_THEME_IDS } from "./overlay-themes";
import type { BroadcastViewId, OverlaySnapshots } from "./types";

const S = DEMO_MATCH_STATE;
const M = DEMO_MATCH_DETAILS;

const show = (view: BroadcastViewId, extra: { snapshots?: OverlaySnapshots } = {}) =>
  render(<BroadcastSuiteOverlay state={S} match={M} activeView={view} {...extra} />);

describe("BroadcastSuiteOverlay", () => {
  it("draws the score bar", () => {
    show("1");
    expect(screen.getByTestId("score-bug")).toBeInTheDocument();
    expect(screen.getByText(`${S.total_runs}/${S.total_wickets}`)).toBeInTheDocument();
    expect(screen.getByText(S.striker_name!)).toBeInTheDocument();
    expect(screen.getByText(S.current_bowler_name!)).toBeInTheDocument();
  });

  it("shows each innings' batting and bowling cards", () => {
    show("2");
    expect(screen.getByText(`${S.bowling_team_name} batting`)).toBeInTheDocument();
    show("5");
    expect(screen.getByText(`${S.bowling_team_name} bowling`)).toBeInTheDocument();
  });

  it("shows the striker's figures over the score bar", () => {
    show("16");
    expect(screen.getByText("On strike")).toBeInTheDocument();
    expect(screen.getByTestId("score-bug")).toBeInTheDocument();
  });

  it("invents nothing: views without data render no graphic", () => {
    for (const view of ["20", "29", "36", "43", "44"] as BroadcastViewId[]) {
      expect(broadcastViewAvailable(view, { state: S, match: M })).toBe(false);
    }
    const { container } = show("20");
    // Only the score bar stays up.
    expect(container.querySelector("table")).toBeNull();
    expect(screen.queryByText(/Standings/)).not.toBeInTheDocument();
  });

  it("shows the points table the control room sends", () => {
    const snapshots: OverlaySnapshots = {
      pointsTable: {
        title: "Group A",
        rows: [
          { team: "Harbour Hawks", played: 5, won: 4, lost: 1, points: 8, nrr: 0.81 },
          { team: "Riverside Rangers", played: 5, won: 3, lost: 2, points: 6, nrr: -0.12, highlight: true },
        ],
      },
    };
    expect(broadcastViewAvailable("20", { state: S, match: M, snapshots })).toBe(true);
    show("20", { snapshots });
    expect(screen.getByText("Group A")).toBeInTheDocument();
    expect(screen.getByText("+0.810")).toBeInTheDocument();
  });

  it("draws the charts from the innings' balls", () => {
    show("21");
    expect(screen.getByText("Runs per over")).toBeInTheDocument();
    show("41");
    expect(screen.getByText("Powerplay")).toBeInTheDocument();
  });

  it("labels the win predictor as an estimate", () => {
    show("42");
    expect(screen.getByText("Win predictor")).toBeInTheDocument();
    expect(screen.getAllByText(/Estimate/).length).toBeGreaterThan(0);
  });

  it("offers every view in the bar, disabling the ones without data", () => {
    const onSelect = vi.fn();
    render(
      <BroadcastSuiteOverlay
        state={S}
        match={M}
        activeView="1"
        showControls
        onSelectView={onSelect}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(BROADCAST_VIEW_OPTIONS.length);
    expect(screen.getByRole("button", { name: "Points table" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Batting card, 1st innings" }));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("keeps the old view ids", () => {
    const ids = BROADCAST_VIEW_OPTIONS.map((o) => o.id);
    for (const id of ["1", "2", "8", "13", "14", "20", "29", "39"]) {
      expect(ids).toContain(id);
    }
  });

  it.each(LEGACY_OVERLAY_THEME_IDS)("accepts the old %s theme id", (theme) => {
    render(<BroadcastSuiteOverlay state={S} match={M} activeView="1" theme={theme} />);
    expect(screen.getByTestId("score-bug")).toBeInTheDocument();
  });
});
