import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { createNextRound, previewNextRound } from "~/app/tournaments/bracket-actions";
import { NextRoundDialog, isBracketFormat } from "./next-round-dialog";

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
    render(<NextRoundDialog tournamentId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: "Create next round" }));
    expect(await screen.findByText("Strikers vs Titans")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create 2 matches" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Semi-final: 2 matches created"),
    );
    expect(createNextRound).toHaveBeenCalledWith("r1", {
      groupCount: 2,
      qualifiersPerGroup: 2,
    });
    expect(refresh).toHaveBeenCalled();
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
