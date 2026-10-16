import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MatchScorersDialog } from "./match-scorers-dialog";
import {
  getMatchScorers,
  addMatchScorer,
  removeMatchScorer,
  searchScorers,
} from "~/app/matches/mutations";
import { toast } from "sonner";

vi.mock("~/app/matches/mutations", () => ({
  getMatchScorers: vi.fn(),
  addMatchScorer: vi.fn(),
  removeMatchScorer: vi.fn(),
  searchScorers: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

const inviteToApp = vi.fn();
vi.mock("~/app/invitations/actions", () => ({
  inviteToApp: (email: string, matchId?: string) => inviteToApp(email, matchId),
}));

vi.mock("~/lib/auth", () => ({
  useAuth: () => ({ user: { user_metadata: { full_name: "Karan R" } } }),
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
    vi.mocked(searchScorers).mockResolvedValue({
      data: [],
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
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
    });

    render(<MatchScorersDialog matchId="match-1" />);
    fireEvent.click(screen.getByRole("button", { name: /invite scorer/i }));

    const copyBtn = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith(
        expect.stringContaining("/matches/match-1/score")
      );
      expect(toast.success).toHaveBeenCalledWith("Scoring link copied to clipboard");
    });
  });

  it("adds an existing user as scorer by email", async () => {
    inviteToApp.mockResolvedValueOnce({
      success: true,
      status: "added_scorer",
      message: "New Scorer can now score this match.",
      shareEmail: null,
    });

    render(<MatchScorersDialog matchId="match-1" />);
    fireEvent.click(screen.getByRole("button", { name: /invite scorer/i }));

    const input = screen.getByPlaceholderText(/search registered player or enter email/i);
    fireEvent.change(input, { target: { value: "new@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(inviteToApp).toHaveBeenCalledWith("new@test.com", "match-1");
      expect(toast.success).toHaveBeenCalledWith(
        "New Scorer can now score this match."
      );
    });
    expect(addMatchScorer).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/invite message/i)).not.toBeInTheDocument();
  });

  it("invites a new email as scorer and shows the share message", async () => {
    inviteToApp.mockResolvedValueOnce({
      success: true,
      status: "invited",
      message: "Invite saved. Send them the message below.",
      shareEmail: "friend@gmail.com",
    });

    render(<MatchScorersDialog matchId="match-1" />);
    fireEvent.click(screen.getByRole("button", { name: /invite scorer/i }));

    const input = screen.getByPlaceholderText(/search registered player or enter email/i);
    fireEvent.change(input, { target: { value: "friend@gmail.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    const message = (await screen.findByLabelText(
      /invite message/i
    )) as HTMLTextAreaElement;
    expect(message.value).toContain(
      "Karan R invited you to help score a match"
    );
    expect(message.value).toContain(
      "invite=friend@gmail.com&next=%2Fmatches%2Fmatch-1%2Fscore"
    );
    expect(
      screen.getByRole("link", { name: /share on whatsapp/i })
    ).toBeInTheDocument();
  });

  it("shows the error when inviting a scorer fails", async () => {
    inviteToApp.mockResolvedValueOnce({
      error: "Only this match's scorers can invite scorers",
    });

    render(<MatchScorersDialog matchId="match-1" />);
    fireEvent.click(screen.getByRole("button", { name: /invite scorer/i }));

    const input = screen.getByPlaceholderText(/search registered player or enter email/i);
    fireEvent.change(input, { target: { value: "x@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Only this match's scorers can invite scorers"
      );
    });
  });

  it("still adds a registered player by name", async () => {
    vi.mocked(addMatchScorer).mockResolvedValueOnce({
      success: false,
      error: "No registered player found",
    });

    render(<MatchScorersDialog matchId="match-1" />);
    fireEvent.click(screen.getByRole("button", { name: /invite scorer/i }));

    const input = screen.getByPlaceholderText(/search registered player or enter email/i);
    fireEvent.change(input, { target: { value: "Virat" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(addMatchScorer).toHaveBeenCalledWith("match-1", "Virat");
      expect(toast.error).toHaveBeenCalledWith("No registered player found");
    });
    expect(inviteToApp).not.toHaveBeenCalled();
  });

  it("shows search autocomplete results and allows 1-click addition", async () => {
    vi.mocked(searchScorers).mockResolvedValueOnce({
      data: [
        {
          id: "u-searched-1",
          full_name: "Virat Kohli",
          email: "virat@cricket.com",
          avatar_url: null,
        },
      ],
      error: null,
    });
    vi.mocked(addMatchScorer).mockResolvedValueOnce({
      success: true,
      user: {
        id: "u-searched-1",
        full_name: "Virat Kohli",
        email: "virat@cricket.com",
        avatar_url: null,
      },
      error: null,
    });

    render(<MatchScorersDialog matchId="match-1" />);
    fireEvent.click(screen.getByRole("button", { name: /invite scorer/i }));

    const input = screen.getByPlaceholderText(/search registered player or enter email/i);
    fireEvent.change(input, { target: { value: "virat" } });

    await waitFor(() => {
      expect(screen.getByText("Virat Kohli")).toBeInTheDocument();
    });

    const addQuickBtn = screen.getByRole("button", { name: /\+ add/i });
    fireEvent.click(addQuickBtn);

    await waitFor(() => {
      expect(addMatchScorer).toHaveBeenCalledWith("match-1", "u-searched-1");
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
