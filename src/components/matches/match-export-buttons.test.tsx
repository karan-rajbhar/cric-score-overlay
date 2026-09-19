import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("~/app/matches/queries", () => ({
  getFullMatchForExport: vi.fn(),
}));

import { MatchExportButtons, drawSummary } from "./match-export-buttons";
import type { MatchExportSummary } from "~/lib/match-report";
import type { Match } from "~/lib/match-types";

describe("MatchExportButtons and drawSummary", () => {
  const mockSummary: MatchExportSummary = {
    title: "T20 Championship Final",
    format: "T20 · 20 ov",
    venue: "Melbourne Cricket Ground",
    playedAt: "18 Oct 2026, 19:30",
    result: "Royal Tigers won by 18 runs",
    matchUrl: "https://cricket.app/matches/match-124",
    playerOfTheMatch: "Virat Kohli",
    team1: {
      name: "Royal Tigers",
      shortName: "RTG",
      scoreLine: "178/5 (20.0)",
      batters: [
        { name: "Virat Kohli", runs: 82, balls: 53, sr: "154.7" },
        { name: "Rohit Sharma", runs: 45, balls: 28, sr: "160.7" },
      ],
      bowlers: [
        { name: "Mohammed Shami", overs: "4.0", runs: 28, wickets: 2, econ: "7.00" },
      ],
    },
    team2: {
      name: "Coastal Kings",
      shortName: "CKS",
      scoreLine: "160/9 (20.0)",
      batters: [
        { name: "Steve Smith", runs: 52, balls: 41, sr: "126.8" },
      ],
      bowlers: [
        { name: "Rashid Khan", overs: "4.0", runs: 24, wickets: 3, econ: "6.00" },
      ],
    },
  };

  const mockMatch = {
    id: "match-124",
    title: "T20 Championship Final",
    match_format: "T20",
    overs_per_innings: 20,
    status: "completed",
    venue: "Melbourne Cricket Ground",
    scheduled_at: "2026-10-18T19:30:00Z",
    result_description: "Royal Tigers won by 18 runs",
    team1_id: "team-1",
    team2_id: "team-2",
    team1: { id: "team-1", name: "Royal Tigers", short_name: "RTG" },
    team2: { id: "team-2", name: "Coastal Kings", short_name: "CKS" },
    innings: [],
  } as unknown as Match;

  it("renders export buttons including Share summary", () => {
    render(<MatchExportButtons match={mockMatch} />);

    expect(screen.getByRole("button", { name: /share summary/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /match report/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cricsheet json/i })).toBeInTheDocument();
  });

  it("drawSummary renders broadcast elements onto the canvas context", () => {
    const fillTextCalls: string[] = [];
    const mockCtx = {
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn((text: string) => {
        fillTextCalls.push(String(text));
      }),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      bezierCurveTo: vi.fn(),
      translate: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      roundRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
      set fillStyle(_: unknown) {},
      set strokeStyle(_: unknown) {},
      set lineWidth(_: unknown) {},
      set lineCap(_: unknown) {},
      set lineJoin(_: unknown) {},
      set font(_: unknown) {},
      set textAlign(_: unknown) {},
      set textBaseline(_: unknown) {},
      set shadowColor(_: unknown) {},
      set shadowBlur(_: unknown) {},
    } as unknown as CanvasRenderingContext2D;

    const mockQrImage = {} as HTMLImageElement;

    drawSummary(mockCtx, mockSummary, mockQrImage);

    // Verify key elements were drawn
    expect(fillTextCalls).toContain("T20 Championship Final");
    expect(fillTextCalls.some((t) => t.includes("Royal Tigers"))).toBe(true);
    expect(fillTextCalls.some((t) => t.includes("Coastal Kings"))).toBe(true);
    expect(fillTextCalls.some((t) => t.includes("178/5"))).toBe(true);
    expect(fillTextCalls.some((t) => t.includes("Virat Kohli"))).toBe(true);
    expect(fillTextCalls.some((t) => t.toLowerCase().includes("royal tigers won by 18 runs"))).toBe(true);
    expect(mockCtx.drawImage).toHaveBeenCalledWith(mockQrImage, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
  });
});
