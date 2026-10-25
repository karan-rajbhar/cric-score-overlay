import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { clubStatsRows, tabTable } from "~/lib/club-stats-export";
import { emptyAcc } from "~/lib/firebase/stats.mjs";
import { leaderboardFromPlayers } from "~/lib/leaderboard";
import { ClubStatsReportView, sheetsOfRows } from "./club-stats-report-view";

vi.mock("./report-pdf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./report-pdf")>()),
  buildReportPdf: vi.fn(() => new Promise(() => {})),
}));

const lb = leaderboardFromPlayers({
  a: {
    ...emptyAcc(),
    m: 3,
    bi: 3,
    no: 1,
    r: 120,
    b: 80,
    bp: 90,
    name: "Asha",
    avatar_url: null,
  },
  b: {
    ...emptyAcc(),
    m: 3,
    wi: 3,
    wb: 54,
    rc: 60,
    w: 7,
    wp: 140,
    name: "Bala",
    avatar_url: null,
  },
  c: { ...emptyAcc(), m: 2, ct: 2, name: "Chitra", avatar_url: null },
});
const rows = clubStatsRows(lb);

const tabOf = (t: "batting" | "bowling" | "fielding" | "mvp") =>
  tabTable(lb, t);

function view(r = rows, tab: Parameters<typeof tabOf>[0] | null = null) {
  return render(
    <ClubStatsReportView
      club={{ id: "c1", name: "Unity Cricket Club" }}
      clubUrl="https://cricscore.example/clubs/c1"
      rows={r}
      matches={5}
      generated="25 Oct 2026"
      fileName="Unity Cricket Club – statistics 2026-10-25.pdf"
      qrDataUrl="data:image/png;base64,AA=="
      tab={tab ? tabOf(tab) : null}
    />,
  );
}

describe("ClubStatsReportView", () => {
  it("heads the report with the club and its totals", () => {
    view();
    expect(
      screen.getByRole("heading", { level: 1, name: "Unity Cricket Club" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/5 matches · 3 players · 25 Oct 2026/),
    ).toBeInTheDocument();
  });

  it("ranks players by points on the first sheet", () => {
    const { container } = view();
    const first = container.querySelectorAll(".report-page")[0] as HTMLElement;
    const names = within(first)
      .getAllByRole("rowheader")
      .map((r) => r.textContent);
    expect(names).toEqual(["1Bala", "2Asha", "3Chitra"]);
  });

  it("puts batting, bowling and fielding on sheets of their own, only for those who have figures", () => {
    const { container } = view();
    const sheets = container.querySelectorAll<HTMLElement>(".report-page");
    // Points, batting, bowling, fielding.
    expect(sheets).toHaveLength(4);
    const batting = within(sheets[1]!);
    expect(batting.getByText("Batting")).toBeInTheDocument();
    expect(batting.getAllByRole("rowheader")).toHaveLength(1);
    const bowling = within(sheets[2]!);
    expect(bowling.getByText("Bowling")).toBeInTheDocument();
    expect(bowling.getAllByRole("rowheader")).toHaveLength(1);
    const fielding = within(sheets[3]!);
    expect(fielding.getByText("Chitra")).toBeInTheDocument();
    // The footer closes the last sheet, once.
    expect(screen.getAllByText("CricScore club statistics")).toHaveLength(1);
    expect(sheets[3]!.querySelector("img")).not.toBeNull();
  });

  it("lets a long name wrap, since the PDF cannot clip it", () => {
    const { container } = view();
    const name = within(
      container.querySelector(".report-page") as HTMLElement,
    ).getByText("Bala");
    expect(name.className).not.toContain("truncate");
    expect(name.className).toContain("break-words");
  });

  it("starts every sheet after the first on a new page", () => {
    const { container } = view();
    const sheets = [...container.querySelectorAll(".report-page")];
    expect(sheets[0]!.className).not.toContain("break-before-page");
    for (const s of sheets.slice(1)) {
      expect(s.className).toContain("break-before-page");
    }
  });

  it("says so when there are no statistics, with no empty tables", () => {
    const { container } = view([]);
    expect(screen.getByText("No statistics yet.")).toBeInTheDocument();
    expect(container.querySelectorAll(".report-page")).toHaveLength(1);
    expect(container.querySelector("table")).toBeNull();
  });

  describe("long tables", () => {
    const many = clubStatsRows(
      leaderboardFromPlayers(
        Object.fromEntries(
          Array.from({ length: 40 }, (_, i) => [
            `p${i}`,
            {
              ...emptyAcc(),
              m: 2,
              bi: 2,
              r: 100 - i,
              b: 80,
              bp: 100 - i,
              name: `Player ${i + 1}`,
              avatar_url: null,
            },
          ]),
        ),
      ),
    );

    it("runs over sheets that each repeat the title and the column heads", () => {
      const { container } = view(many);
      const sheets = [
        ...container.querySelectorAll<HTMLElement>(".report-page"),
      ];
      const pointSheets = sheets.filter((s) => s.querySelector("table"));
      expect(pointSheets.length).toBeGreaterThan(2);
      for (const sheet of pointSheets) {
        expect(
          within(sheet).getAllByRole("columnheader").length,
        ).toBeGreaterThan(3);
        expect(sheet.querySelectorAll("tbody tr").length).toBeLessThanOrEqual(
          22,
        );
      }
      const titles = pointSheets.map((s) => s.querySelector("h3")!.textContent);
      expect(titles[0]).toBe("Points");
      expect(titles[1]).toBe("Points (continued)");
      // Every player once, in rank order, across the points sheets.
      const names = pointSheets
        .slice(0, titles.lastIndexOf("Points (continued)") + 1)
        .flatMap((s) =>
          within(s)
            .getAllByRole("rowheader")
            .map((r) => r.textContent),
        );
      expect(names.slice(0, 3)).toEqual([
        "1Player 1",
        "2Player 2",
        "3Player 3",
      ]);
    });
  });

  it("renders one leaderboard tab on its own sheet", () => {
    const { container } = view(rows, "bowling");
    expect(container.querySelectorAll(".report-page")).toHaveLength(1);
    expect(screen.getByText(/ranked by wickets/i)).toBeInTheDocument();
    const names = screen.getAllByRole("rowheader").map((r) => r.textContent);
    expect(names).toEqual(["1Bala"]);
    expect(screen.getByText("Best bowling")).toBeInTheDocument();
    // Not the other tabs' figures.
    expect(screen.queryByText("Strike rate")).toBeNull();
  });

  it("says so when a tab has no players yet", () => {
    const empty = leaderboardFromPlayers({});
    render(
      <ClubStatsReportView
        club={{ id: "c1", name: "Unity Cricket Club" }}
        clubUrl="https://cricscore.example/clubs/c1"
        rows={[]}
        matches={0}
        generated="25 Oct 2026"
        fileName="x.pdf"
        qrDataUrl="data:image/png;base64,AA=="
        tab={tabTable(empty, "fielding")}
      />,
    );
    expect(screen.getByText(/no fielding statistics yet/i)).toBeInTheDocument();
  });
});

describe("sheetsOfRows", () => {
  const n = (k: number) => Array.from({ length: k }, (_, i) => i);
  const limits = { first: 14, max: 22, last: 18, only: 14 };
  const sizes = (k: number, l = limits) =>
    sheetsOfRows(n(k), l).map((s) => s.length);

  it("keeps a short table on one sheet", () => {
    expect(sizes(0)).toEqual([0]);
    expect(sizes(14)).toEqual([14]);
  });

  it("uses the fewest sheets and spreads the rows evenly", () => {
    expect(sizes(35)).toEqual([12, 12, 11]);
    // A tab report has more room on its first sheet.
    expect(sizes(35, { ...limits, first: 18 })).toEqual([18, 17]);
    expect(sizes(20)).toEqual([10, 10]);
    expect(sizes(15)).toEqual([8, 7]);
  });

  it("lets a last sheet without the footer take more", () => {
    expect(sizes(36, { ...limits, last: 22 })).toEqual([14, 22]);
  });

  it("never exceeds a limit, keeps order and loses no row", () => {
    for (let k = 0; k <= 150; k++) {
      const s = sheetsOfRows(n(k), limits);
      expect(s.flat()).toEqual(n(k));
      if (s.length === 1) {
        expect(s[0]!.length).toBeLessThanOrEqual(limits.only);
        continue;
      }
      expect(s[0]!.length).toBeLessThanOrEqual(limits.first);
      for (const sheet of s.slice(1)) {
        expect(sheet.length).toBeLessThanOrEqual(limits.last);
        expect(sheet.length).toBeGreaterThan(0);
      }
    }
  });
});
