import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OverData, ReportInnings } from "~/lib/match-report";
import { canvasScale } from "./report-pdf";
import { InningsSheet, OverGrid } from "./report-sheet";

const inn: ReportInnings = {
  id: "i1",
  heading: "1st innings",
  team: { name: "Vinayak 11", shortName: "VIN", logoUrl: null },
  score: "66/7",
  runs: 66,
  wickets: 7,
  declared: false,
  forfeited: false,
  overs: "8.0",
  runRate: "8.25",
  target: null,
  inProgress: false,
  batters: [
    {
      name: "Karan Rajbhar",
      userId: "u1",
      dismissal: "c Amit Jaiswal b Kalpesh Shelke",
      detail: null,
      notOut: false,
      runs: 28,
      balls: 13,
      fours: 0,
      sixes: 3,
      strikeRate: "215.4",
    },
    {
      name: "Kishor",
      userId: "u2",
      dismissal: "not out",
      detail: null,
      notOut: true,
      runs: 9,
      balls: 5,
      fours: 0,
      sixes: 1,
      strikeRate: "180.0",
    },
  ],
  extras: { total: 2, detail: "wd 2" },
  boundaries: "2 fours and 4 sixes: 32 runs, 48% of the total",
  didNotBat: ["Sandeep sir", "Raju"],
  fallOfWickets: [
    { score: "1-2", name: "Harsh", over: "0.5" },
    { score: "2-22", name: "Kumar", over: "3.5" },
  ],
  partnerships: [
    {
      wicketNumber: 2,
      runs: 20,
      balls: 18,
      batter1: { name: "Kumar", runs: 14, balls: 10 },
      batter2: { name: "Pritesh", runs: 5, balls: 8 },
    },
    {
      wicketNumber: 7,
      runs: 9,
      balls: 6,
      batter1: { name: "Kishor", runs: 8, balls: 4 },
      batter2: { name: "Mahesh", runs: 1, balls: 2 },
      isUnbroken: true,
    },
  ],
  bowlers: [
    {
      name: "Abhi",
      userId: "b1",
      overs: "1.0",
      maidens: 0,
      runs: 3,
      wickets: 1,
      economy: "3.00",
      dots: 4,
      fours: 0,
      sixes: 0,
      wides: 0,
      noBalls: 0,
    },
  ],
};

const over = (n: number): OverData => ({
  overNumber: n,
  runs: 6,
  wickets: 1,
  cumulativeRuns: 6 * n,
  cumulativeWickets: n,
  balls: [
    { text: "4", type: "four" },
    { text: "wd", type: "extra" },
    { text: "W", type: "wicket" },
  ],
  batters: [
    { name: "Harsh", runs: 1, balls: 4 },
    { name: "Pritesh", runs: 0, balls: 1 },
  ],
  bowlerName: "Amit Jaiswal",
  bowlerOvers: `${n}.0`,
  bowlerMaidens: 0,
  bowlerRuns: 6,
  bowlerWickets: 1,
});

describe("InningsSheet", () => {
  it("keeps everything a scorecard has, the two columns kept whole", () => {
    const { container } = render(
      <InningsSheet inn={inn} bowlingSide="Omkar 11" />,
    );
    const sheet = screen.getByRole("region", { name: "1st innings: Vinayak 11" });
    expect(sheet).toHaveAttribute("data-sheet-label", "1st innings");
    // Name over dismissal; not out said in words.
    expect(sheet).toHaveTextContent("Karan Rajbharc Amit Jaiswal b Kalpesh Shelke28130");
    expect(within(sheet).getByText("not out")).toBeInTheDocument();
    expect(sheet).toHaveTextContent("Extras wd 2");
    expect(sheet).toHaveTextContent("Total 7 wkts, 8.0 ov66Run rate 8.25");
    expect(sheet).toHaveTextContent("Did not bat Sandeep sir, Raju");
    expect(sheet).toHaveTextContent("48% of the total");
    expect(sheet).toHaveTextContent("Fall of wickets 1-2 Harsh, 0.5 ov");
    // One row a stand: ordinal, both batters, extras, the best, unbroken.
    expect(sheet).toHaveTextContent("2ndKumar 14 (10)Pritesh 5 (8)+1Best");
    expect(sheet).toHaveTextContent("Unbroken9*6");
    expect(sheet).toHaveTextContent("Bowling Omkar 11");
    expect(sheet).toHaveTextContent("Abhi1.003");
    expect(container.querySelector("[data-keep-whole]")).toHaveTextContent(
      "Batting",
    );
  });
});

describe("InningsSheet in a Test", () => {
  it("says a declaration and a forfeit on the total", () => {
    const { container, rerender } = render(
      <InningsSheet
        inn={{ ...inn, score: "66/7d", declared: true }}
        bowlingSide="Hil"
      />,
    );
    expect(container).toHaveTextContent("Total 7 wkts dec, 8.0 ov66");
    rerender(
      <InningsSheet
        inn={{
          ...inn,
          score: "forfeited",
          runs: 0,
          wickets: 0,
          declared: true,
          forfeited: true,
          overs: "0.0",
        }}
        bowlingSide="Hil"
      />,
    );
    expect(container).toHaveTextContent("Total forfeited, 0.0 ov0");
  });
});

describe("OverGrid", () => {
  it("puts both innings side by side, five overs a block kept whole", () => {
    const rows: [OverData | null, OverData | null][] = Array.from(
      { length: 12 },
      (_, i) => [over(i + 1), i < 11 ? over(i + 1) : null],
    );
    const { container } = render(
      <OverGrid overs={{ teams: ["Vinayak 11", "Omkar 11"], rows }} />,
    );
    const blocks = container.querySelectorAll("[data-keep-whole]");
    expect(blocks).toHaveLength(3);
    expect(within(blocks[0] as HTMLElement).getAllByRole("listitem")).toHaveLength(5);
    expect(within(blocks[2] as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
    // Each block names the sides, so a sheet starting at any says which
    // column is which.
    for (const b of Array.from(blocks)) {
      expect(b).toHaveTextContent("Vinayak 11");
    }
    const first = within(blocks[0] as HTMLElement).getAllByRole("listitem")[0]!;
    expect(first).toHaveTextContent("14wdW6 runs 6/1");
    expect(first).toHaveTextContent("Amit Jaiswal 1/6 (1.0)");
    expect(first).toHaveTextContent("Harsh 1 (4) · Pritesh 0 (1)");
    // The 12th over of the side that bowled 11 is a dash.
    const last = within(blocks[2] as HTMLElement).getAllByRole("listitem")[1]!;
    expect(last).toHaveTextContent("12");
    expect(last).toHaveTextContent("–");
  });
});

describe("canvasScale", () => {
  it("draws at 2x unless a page would pass Safari's canvas limit", () => {
    expect(canvasScale({ width: 784, height: 1100 })).toBe(2);
    // Taller pages get a smaller scale, never a canvas over the limit.
    const tall = { width: 784, height: 9000 };
    const s = canvasScale(tall);
    expect(s).toBeLessThan(2);
    expect(820 * s * (9000 * s)).toBeLessThanOrEqual(15_000_000);
  });
});
