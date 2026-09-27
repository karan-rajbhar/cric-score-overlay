import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("~/app/matches/queries", () => ({
  getFullMatchForExport: vi.fn(),
}));

vi.mock("~/lib/match-report", () => ({
  buildMatchReportHtml: vi
    .fn()
    .mockResolvedValue("<!doctype html><html><body>Report</body></html>"),
}));

import { getFullMatchForExport } from "~/app/matches/queries";

describe("GET /matches/[id]/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with HTML when match exists", async () => {
    vi.mocked(getFullMatchForExport).mockResolvedValue({
      data: {
        id: "11111111-1111-1111-1111-111111111111",
        title: "Test Match",
      } as unknown as import("~/lib/match-types").Match,
      error: null,
    });

    const request = new NextRequest(
      "http://localhost:3000/matches/11111111-1111-1111-1111-111111111111/report",
    );
    const response = await GET(request, {
      params: Promise.resolve({
        id: "11111111-1111-1111-1111-111111111111",
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const text = await response.text();
    expect(text).toContain("Report");
  });

  it("returns 404 when match is not found", async () => {
    vi.mocked(getFullMatchForExport).mockResolvedValue({
      data: null,
      error: "Match not found",
    });

    const request = new NextRequest(
      "http://localhost:3000/matches/11111111-1111-1111-1111-111111111111/report",
    );
    const response = await GET(request, {
      params: Promise.resolve({
        id: "11111111-1111-1111-1111-111111111111",
      }),
    });

    expect(response.status).toBe(404);
  });
});
