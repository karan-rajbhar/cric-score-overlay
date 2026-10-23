import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PointsTable, type StandingRow } from "./standings";

const row = (name: string, extra: Partial<StandingRow> = {}): StandingRow => ({
  team: { name },
  played: 3,
  won: 2,
  lost: 1,
  tied: 0,
  noResult: 0,
  points: 4,
  netRunRate: "+0.50",
  ...extra,
});

describe("PointsTable", () => {
  it("reads its short headings out in full", () => {
    render(<PointsTable title="Points table" rows={[row("Tigers")]} />);
    for (const name of ["Played", "Won", "Lost", "Points", "Net run rate"]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(screen.getByTitle("Net run rate")).toHaveTextContent("NRR");
  });

  it("leaves out T and NR until a team has one, then shows them on phones too", () => {
    const { rerender } = render(
      <PointsTable title="Points table" rows={[row("Tigers")]} />,
    );
    expect(screen.queryByRole("columnheader", { name: "No result" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Tied" })).toBeNull();

    rerender(
      <PointsTable
        title="Points table"
        rows={[
          row("Tigers", { played: 4, noResult: 1 }),
          row("Kings", { played: 3, won: 1, lost: 1, tied: 1 }),
        ]}
      />,
    );
    const nr = screen.getByRole("columnheader", { name: "No result" });
    const tied = screen.getByRole("columnheader", { name: "Tied" });
    // Not hidden on small screens: P must add up there too.
    expect(nr.className).not.toMatch(/hidden/);
    expect(tied.className).not.toMatch(/hidden/);
    const tigers = screen.getByRole("row", { name: /Tigers/ });
    expect(within(tigers).getAllByRole("cell").map((c) => c.textContent)).toEqual(
      ["4", "2", "1", "0", "1", "4", "+0.50"],
    );
  });
});
