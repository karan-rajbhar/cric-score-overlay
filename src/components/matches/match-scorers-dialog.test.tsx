import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MatchScorersDialog } from "./match-scorers-dialog";
import {
  getMatchScorers,
  addMatchScorer,
  removeMatchScorer,
} from "~/app/matches/mutations";
import { toast } from "sonner";

vi.mock("~/app/matches/mutations", () => ({
  getMatchScorers: vi.fn(),
  addMatchScorer: vi.fn(),
  removeMatchScorer: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("MatchScorersDialog Component", () => {
  const mockScorersData = {
    createdBy: {
      id: "u-creator",
      full_name: "Lead Scorer",
      email: "lead@test.com",
      avatar_url: null,
    },
    matchAdmins: [
      {
        id: "u-admin-1",
        full_name: "Assistant Scorer",
        email: "asst@test.com",
        avatar_url: null,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMatchScorers).mockResolvedValue({
      data: mockScorersData,
      error: null,
    });
  });

  it("renders trigger button", () => {
    render(<MatchScorersDialog matchId="match-1" />);
    expect(
      screen.getByRole("button", { name: /invite scorer/i })
    ).toBeInTheDocument();
  });

  it("opens dialog and fetches active scorers", async () => {
    render(<MatchScorersDialog matchId="match-1" />);

    fireEvent.click(screen.getByRole("button", { name: /invite scorer/i }));

    expect(
      screen.getByRole("heading", { name: /match scorers/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(getMatchScorers).toHaveBeenCalledWith("match-1");
      expect(screen.getByText("Lead Scorer")).toBeInTheDocument();
      expect(screen.getByText("Assistant Scorer")).toBeInTheDocument();
      expect(screen.getByText("Creator")).toBeInTheDocument();
      expect(screen.getByText("Co-Scorer")).toBeInTheDocument();
    });
  });

  it("copies scoring link to clipboard", async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    render(<MatchScorersDialog matchId="match-1" />);
    fireEvent.click(screen.getByRole("button", { name: /invite scorer/i }));

    const copyBtn = screen.getByRole("button", { name: /copy link/i });
    fireEvent.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith(
      expect.stringContaining("/matches/match-1/score")
    );
    expect(toast.success).toHaveBeenCalledWith("Scoring link copied to clipboard");
  });

  it("submits new scorer and updates list", async () => {
    vi.mocked(addMatchScorer).mockResolvedValueOnce({
      success: true,
      user: {
        id: "u-new",
        full_name: "New Scorer",
        email: "new@test.com",
        avatar_url: null,
      },
      error: null,
    });

    render(<MatchScorersDialog matchId="match-1" />);
    fireEvent.click(screen.getByRole("button", { name: /invite scorer/i }));

    const input = screen.getByPlaceholderText(/scorer email or player uuid/i);
    fireEvent.change(input, { target: { value: "new@test.com" } });

    const addBtn = screen.getByRole("button", { name: /^add$/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(addMatchScorer).toHaveBeenCalledWith("match-1", "new@test.com");
      expect(toast.success).toHaveBeenCalledWith(
        "Added New Scorer as match scorer!"
      );
    });
  });

  it("handles error when adding scorer fails", async () => {
    vi.mocked(addMatchScorer).mockResolvedValueOnce({
      success: false,
      error: "User not found with email",
    });

    render(<MatchScorersDialog matchId="match-1" />);
    fireEvent.click(screen.getByRole("button", { name: /invite scorer/i }));

    const input = screen.getByPlaceholderText(/scorer email or player uuid/i);
    fireEvent.change(input, { target: { value: "unknown@test.com" } });

    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("User not found with email");
    });
  });

  it("removes a co-scorer when confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(removeMatchScorer).mockResolvedValueOnce({
      success: true,
      error: null,
    });

    render(<MatchScorersDialog matchId="match-1" isCreator={true} />);
    fireEvent.click(screen.getByRole("button", { name: /invite scorer/i }));

    await waitFor(() => {
      expect(screen.getByText("Assistant Scorer")).toBeInTheDocument();
    });

    const removeBtn = screen.getByTitle("Remove scorer");
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(removeMatchScorer).toHaveBeenCalledWith("match-1", "u-admin-1");
      expect(toast.success).toHaveBeenCalledWith(
        "Removed Assistant Scorer from match scorers"
      );
    });
  });
});
