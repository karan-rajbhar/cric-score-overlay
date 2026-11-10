import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { createNextRound, previewNextRound } from "~/app/tournaments/bracket-actions";
import {
  NextRoundDialog,
  isBracketFormat,
  suggestedStart,
} from "./next-round-dialog";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("~/app/tournaments/bracket-actions", () => ({
  previewNextRound: vi.fn(),
  createNextRound: vi.fn(),
}));

const knockoutPreview = {
  kind: "knockout" as const,
  label: "Semi-final",
  matches: [
    { label: "Semi-final 1", home: "Strikers", away: "Titans" },
    { label: "Semi-final 2", home: "Warriors", away: "Thunder" },
  ],
  byes: [],
  message: null,
  needsGroupCount: false,
  needsQualifiers: false,
  teamCount: 4,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isBracketFormat", () => {
  it("is for knockout and mixed tournaments", () => {
    expect(isBracketFormat("knockout")).toBe(true);
    expect(isBracketFormat("mixed")).toBe(true);
    expect(isBracketFormat("league")).toBe(false);
  });
});

describe("NextRoundDialog", () => {
  it("previews the round and creates it", async () => {
    vi.mocked(previewNextRound).mockResolvedValue({ data: knockoutPreview, error: null });
    vi.mocked(createNextRound).mockResolvedValue({
      data: { count: 2, label: "Semi-final" },
      error: null,
    });
    render(<NextRoundDialog tournamentId="r1" startDate="2026-12-10" />);
    fireEvent.click(screen.getByRole("button", { name: "Create next round" }));
    expect(await screen.findByText("Strikers vs Titans")).toBeInTheDocument();
    // The start date at 10:00 local time is offered; the organiser moves it.
    expect(screen.getByLabelText("First match day")).toHaveValue("2026-12-10");
    expect(screen.getByLabelText("Start time")).toHaveValue("10:00");
    fireEvent.change(screen.getByLabelText("Start time"), {
      target: { value: "14:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create 2 matches" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Semi-final: 2 matches created"),
    );
    expect(createNextRound).toHaveBeenCalledWith(
      "r1",
      { groupCount: 2, qualifiersPerGroup: 2 },
      new Date("2026-12-10T14:30").toISOString(),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("offers the day after the latest fixture, at its time", () => {
    const latest = new Date("2026-12-10T14:30").toISOString();
    expect(suggestedStart(latest, "2026-12-01")).toEqual({
      day: "2026-12-11",
      time: "14:30",
    });
    expect(suggestedStart(null, null, new Date("2026-12-31T09:00"))).toEqual({
      day: "2027-01-01",
      time: "10:00",
    });
  });

  it("says why nothing can be created yet", async () => {
    vi.mocked(previewNextRound).mockResolvedValue({
      data: {
        ...knockoutPreview,
        kind: "waiting",
        label: null,
        matches: [],
        message: "1 match of the current round still to finish.",
      },
      error: null,
    });
    render(<NextRoundDialog tournamentId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: "Create next round" }));
    expect(
      await screen.findByText("1 match of the current round still to finish."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("asks how many groups for a mixed tournament", async () => {
    vi.mocked(previewNextRound).mockResolvedValue({
      data: {
        ...knockoutPreview,
        kind: "groups",
        label: "Group stage",
        needsGroupCount: true,
        teamCount: 8,
      },
      error: null,
    });
    render(<NextRoundDialog tournamentId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: "Create next round" }));
    expect(await screen.findByLabelText("Groups")).toBeInTheDocument();
  });
});
