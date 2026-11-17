import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { makeInnings, makeMatch } from "~/test/factories";
import { buildMatchReport } from "~/lib/match-report";
import type { Match } from "~/lib/match-types";
import { MatchReportView } from "./match-report-view";
import { PDF_LIBS } from "./report-pdf";

const pdf = vi.hoisted(() => ({
  build: vi.fn<(name: string) => Promise<File>>(),
  canShare: vi.fn(() => true),
  download: vi.fn(),
}));
vi.mock("./report-pdf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./report-pdf")>()),
  buildReportPdf: pdf.build,
  canShareFiles: pdf.canShare,
  downloadFile: pdf.download,
}));

const batter = (id: string, name: string, runs: number) => ({
  id: `bp-${id}`,
  match_id: "m1",
  innings_id: "inn-1",
  user_id: id,
  batting_position: 1,
  runs_scored: runs,
  balls_faced: runs,
  fours: 0,
  sixes: 0,
  is_out: true,
  user: { id, full_name: name },
});

function matchOf(overrides: Partial<Match> = {}): Match {
  return makeMatch({
    id: "11111111-2222-3333-4444-555555555555",
    status: "completed",
    result_description: "Royal Tigers won by 18 runs",
    winning_team_id: "t1",
    team1: {
      id: "t1",
      name: "Royal Tigers",
      short_name: "RTG",
      logo_url: "https://cdn.test/rtg.png",
    },
    innings: [
      makeInnings({
        id: "inn-1",
        total_runs: 178,
        total_wickets: 5,
        total_balls: 120,
        is_completed: true,
        batting_performances: [batter("u1", "Virat Kohli", 82)],
      }),
      makeInnings({
        id: "inn-2",
        innings_number: 2,
        team_id: "t2",
        total_runs: 160,
        total_wickets: 9,
        total_balls: 120,
        is_completed: true,
        target_runs: 179,
      }),
    ],
    ...overrides,
  });
}

const QR = "QR code linking to this match";

function renderReport(match = matchOf()) {
  return render(
    <MatchReportView
      match={match}
      report={buildMatchReport(match, "https://x.test/m")}
      qrDataUrl="data:image/png;base64,AAAA"
    />,
  );
}

describe("MatchReportView", () => {
  beforeEach(() => {
    pdf.build.mockReset().mockReturnValue(new Promise(() => {}));
    pdf.canShare.mockReturnValue(true);
  });

  it("opens on the summary, then a sheet an innings, then the rest", () => {
    const { container } = renderReport();
    const pages = container.querySelectorAll(".report-page");
    expect(pages).toHaveLength(4);
    // Page 1 is the summary image's layout: each side's batters beside the
    // bowlers who bowled at them, no scorecards, no impact points.
    const summary = pages[0] as HTMLElement;
    expect(summary).toHaveTextContent("Royal Tigers won by 18 runs");
    // Under the report's header, the hero names no competition and no
    // "Result" chip.
    expect(within(summary).queryByText("Result")).not.toBeInTheDocument();
    const tigers = within(summary)
      .getByRole("heading", { name: "Royal Tigers", level: 2 })
      .closest("div")!.parentElement!;
    expect(tigers).toHaveTextContent("178/5 (20.0 ov)");
    expect(tigers).toHaveTextContent("Bowling: Coastal Kings");
    expect(tigers).toHaveTextContent("Virat Kohli82(82)");
    expect(summary).not.toHaveTextContent("1st innings");
    expect(summary).not.toHaveTextContent("Match impact");
    expect(within(summary).getByRole("img", { name: QR })).toBeInTheDocument();
    // The summary has no running header; every detail sheet has.
    expect(summary).not.toHaveAttribute("data-running-header");
    for (const page of Array.from(pages).slice(1)) {
      expect(page).toHaveAttribute("data-running-header");
    }

    expect(pages[1]).toHaveTextContent("1st innings");
    expect(pages[1]).toHaveTextContent("Bowling Coastal Kings");
    expect(pages[1]).not.toHaveTextContent("2nd innings");
    expect(pages[2]).toHaveTextContent("2nd innings");
    expect(pages[2]).toHaveTextContent("Target 179");
    // The analysis closes the report; no sign-off outside a tournament, and
    // the link is on the first page only.
    expect(pages[3]).toHaveTextContent("Match impact");
    expect(pages[3]).toHaveTextContent("Match information");
    expect(pages[3]).not.toHaveTextContent("Official verification");
    expect(screen.getAllByAltText(QR)).toHaveLength(1);
  });

  it("names the match, its day and its organiser for the running header", () => {
    const { container } = renderReport(
      matchOf({
        scheduled_at: "2026-11-15T03:50:00Z",
        club: { id: "c1", name: "Unity Cricket Club" } as Match["club"],
      }),
    );
    const heading = container.querySelector("[data-report-heading]");
    expect(heading).toHaveTextContent(
      /^Royal Tigers vs Coastal Kings · 1[45] Nov 2026 · Unity Cricket Club$/,
    );
  });

  it("keeps a one-innings report to the summary, the innings and the rest", () => {
    const { container } = renderReport(
      matchOf({ innings: matchOf().innings!.slice(0, 1) }),
    );
    const pages = container.querySelectorAll(".report-page");
    expect(pages).toHaveLength(3);
    // The side yet to bat is just its header.
    expect(pages[0]).toHaveTextContent("Coastal KingsYet to bat");
    expect(pages[1]).toHaveTextContent("1st innings");
    expect(pages[2]).toHaveTextContent("Match information");
  });

  it("closes a report with no innings on its one page", () => {
    const { container } = renderReport(matchOf({ innings: [] }));
    const pages = container.querySelectorAll(".report-page");
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveTextContent("No innings recorded yet.");
    expect(pages[0]).toHaveTextContent("Match information");
  });

  it("puts super overs after the second innings, on its page", () => {
    const base = matchOf().innings!;
    const { container } = renderReport(
      matchOf({
        innings: [
          ...base,
          makeInnings({
            id: "inn-3",
            innings_number: 3,
            team_id: "t2",
            total_runs: 14,
            total_wickets: 1,
            total_balls: 6,
            is_completed: true,
          }),
          makeInnings({
            id: "inn-4",
            innings_number: 4,
            team_id: "t1",
            total_runs: 18,
            total_wickets: 0,
            total_balls: 5,
            is_completed: true,
          }),
        ],
      }),
    );
    const pages = container.querySelectorAll(".report-page");
    expect(pages).toHaveLength(4);
    const supers = within(pages[2] as HTMLElement).getAllByRole("region", {
      name: /^Super over/,
    });
    expect(supers).toHaveLength(2);
  });

  it("asks a tournament match's captains, umpire and scorer to sign", () => {
    const { container } = renderReport(
      matchOf({
        tournament_id: "t9",
        tournament: { id: "t9", name: "Unity League" } as Match["tournament"],
      }),
    );
    expect(container).toHaveTextContent("Official verification and sign-off");
    expect(container.querySelectorAll("[data-blank-name]")).toHaveLength(4);
    expect(screen.getByText("RTG captain")).toBeInTheDocument();
    expect(screen.getAllByText("Signature and date")).toHaveLength(4);
  });

  it("marks team logos with their initials for the PDF", () => {
    const { container } = renderReport();
    const logo = container.querySelector('img[src="https://cdn.test/rtg.png"]');
    expect(logo).toHaveAttribute("data-initials", "RTG");
  });

  it("offers the PDF once it is built, and shares the file alone", async () => {
    const file = new File(["%PDF"], "x.pdf", { type: "application/pdf" });
    pdf.build.mockResolvedValue(file);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    renderReport();
    const button = screen.getByRole("button", { name: "Preparing PDF…" });
    expect(button).toBeDisabled();
    // Named after the sides in batting order.
    expect(button).toHaveAttribute(
      "data-file-name",
      "Royal Tigers vs Coastal Kings – match report.pdf",
    );
    await act(() => vi.waitFor(() => expect(pdf.build).toHaveBeenCalled()));
    const ready = await screen.findByRole("button", { name: "Share PDF" });
    fireEvent.click(ready);
    // The file alone: WhatsApp on iOS drops it when text comes with it.
    expect(share).toHaveBeenCalledWith({ files: [file] });
  });

  it("waits for the fonts, then prints", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderReport();
    fireEvent.click(screen.getByRole("button", { name: /^Print/ }));
    await vi.waitFor(() => expect(print).toHaveBeenCalled());
  });

  it("loads pinned PDF libraries, checked by the browser", () => {
    expect(PDF_LIBS.map(([src]) => src)).toEqual([
      expect.stringContaining("html2canvas@1.4.1"),
      expect.stringContaining("jspdf@2.5.2"),
    ]);
    for (const [, integrity] of PDF_LIBS) {
      expect(integrity).toMatch(/^sha384-[A-Za-z0-9+/=]{64}$/);
    }
  });
});
