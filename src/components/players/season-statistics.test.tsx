import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeasonStatistics } from "./season-statistics";

const batting = [
  {
    match_id: "a",
    runs_scored: 104,
    balls_faced: 60,
    is_out: false,
    created_at: "2025-03-01T10:00:00Z",
  },
  {
    match_id: "b",
    runs_scored: 20,
    balls_faced: 20,
    is_out: true,
    created_at: "2026-01-10T10:00:00Z",
  },
];

const allTime = {
  matches: 9,
  runs: 500,
  wickets: 12,
  catches: 4,
  batting: [["Runs", 500]] as [string, number][],
  bowling: [["Wickets", 12]] as [string, number][],
  fielding: [["Catches", 4]] as [string, number][],
};

describe("SeasonStatistics", () => {
  it("shows career figures first, with fielding", () => {
    render(
      <SeasonStatistics batting={batting} bowling={[]} allTime={allTime} />,
    );
    expect(screen.getByText("Fielding")).toBeInTheDocument();
    expect(screen.getAllByText("500").length).toBeGreaterThan(0);
  });

  it("offers each season with a record", () => {
    render(
      <SeasonStatistics batting={batting} bowling={[]} allTime={allTime} />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Season" }));
    const list = screen.getByRole("listbox");
    expect(
      within(list)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["All time", "2026", "2025"]);
  });

  it("has no season picker without records", () => {
    render(<SeasonStatistics batting={[]} bowling={[]} allTime={allTime} />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
