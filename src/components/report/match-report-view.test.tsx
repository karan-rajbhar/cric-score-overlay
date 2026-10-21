import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("puts the first innings on page 1 and the second on page 2", () => {
    const { container } = renderReport();
    const pages = container.querySelectorAll(".report-page");
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveTextContent("1st innings");
    expect(pages[0]).not.toHaveTextContent("2nd innings");
    expect(pages[1]).toHaveTextContent("2nd innings");
    expect(pages[1]).toHaveTextContent("Target 179");
    // The sign-off, link and QR code close the report.
    expect(pages[1]).toHaveTextContent("Official verification and sign-off");
    expect(
      screen.getByAltText("QR code linking to this match"),
    ).toBeInTheDocument();
  });

  it("keeps a one-innings report on one page", () => {
    const { container } = renderReport(
      matchOf({ innings: matchOf().innings!.slice(0, 1) }),
    );
    expect(container.querySelectorAll(".report-page")).toHaveLength(1);
    expect(container).toHaveTextContent("Official verification and sign-off");
  });

  it("leaves a line to write each unknown name on", () => {
    const { container } = renderReport();
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
