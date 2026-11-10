import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const getFullMatchForExport = vi.fn();
vi.mock("~/app/matches/queries", () => ({
  getFullMatchForExport: (id: string) => getFullMatchForExport(id),
}));
const downloadCricsheetJson = vi.fn();
vi.mock("~/lib/cricsheet", () => ({
  downloadCricsheetJson: (m: unknown) => downloadCricsheetJson(m),
}));

import type { Match } from "~/lib/match-types";
import { exportCricsheet } from "./cricsheet-export";

const match = {
  id: "m1",
  innings: [{ id: "i1", ball_by_ball: [] }],
} as unknown as Match;

describe("exportCricsheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("downloads nothing when the ball log cannot be read", async () => {
    getFullMatchForExport.mockResolvedValue({ data: null, error: "boom" });
    await exportCricsheet(match);
    expect(downloadCricsheetJson).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("downloads nothing when the match has no balls", async () => {
    getFullMatchForExport.mockResolvedValue({ data: match, error: null });
    await exportCricsheet(match);
    expect(downloadCricsheetJson).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/no ball-by-ball/i),
    );
  });

  it("downloads the match with its ball log", async () => {
    const full = {
      ...match,
      innings: [{ id: "i1", ball_by_ball: [{ id: "b1" }] }],
    } as unknown as Match;
    getFullMatchForExport.mockResolvedValue({ data: full, error: null });
    await exportCricsheet(match);
    expect(downloadCricsheetJson).toHaveBeenCalledWith(full);
    expect(toast.success).toHaveBeenCalled();
  });
});
