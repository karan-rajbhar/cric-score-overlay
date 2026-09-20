import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ClubMembershipButton } from "./club-membership-button";
import { joinClub, leaveClub } from "~/app/clubs/actions";
import { toast } from "sonner";

vi.mock("~/app/clubs/actions", () => ({
  joinClub: vi.fn(),
  leaveClub: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ClubMembershipButton Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login link when user is unauthenticated", () => {
    render(
      <ClubMembershipButton
        clubId="club-123"
        isMember={false}
        isOwner={false}
        isAuthenticated={false}
      />
    );

    const link = screen.getByRole("link", { name: /join club/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/auth/login?redirect=/clubs/club-123");
  });

  it("renders disabled owner button when user is club owner", () => {
    render(
      <ClubMembershipButton
        clubId="club-123"
        isMember={true}
        isOwner={true}
        isAuthenticated={true}
      />
    );

    const button = screen.getByRole("button", { name: /club owner/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("calls joinClub and shows success toast when non-member clicks Join Club", async () => {
    vi.mocked(joinClub).mockResolvedValueOnce({ success: true } as never);

    render(
      <ClubMembershipButton
        clubId="club-123"
        isMember={false}
        isOwner={false}
        isAuthenticated={true}
      />
    );

    const button = screen.getByRole("button", { name: /join club/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(joinClub).toHaveBeenCalledWith("club-123");
      expect(toast.success).toHaveBeenCalledWith("Welcome to the club!");
    });
  });

  it("shows error toast when joinClub fails", async () => {
    vi.mocked(joinClub).mockResolvedValueOnce({ error: "Could not join club" } as never);

    render(
      <ClubMembershipButton
        clubId="club-123"
        isMember={false}
        isOwner={false}
        isAuthenticated={true}
      />
    );

    const button = screen.getByRole("button", { name: /join club/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(joinClub).toHaveBeenCalledWith("club-123");
      expect(toast.error).toHaveBeenCalledWith("Could not join club");
    });
  });

  it("calls leaveClub and shows success toast when active member clicks Member (Leave)", async () => {
    vi.mocked(leaveClub).mockResolvedValueOnce({ success: true } as never);

    render(
      <ClubMembershipButton
        clubId="club-123"
        isMember={true}
        isOwner={false}
        isAuthenticated={true}
      />
    );

    const button = screen.getByRole("button", { name: /member \(leave\)/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(leaveClub).toHaveBeenCalledWith("club-123");
      expect(toast.success).toHaveBeenCalledWith("You have left the club");
    });
  });

  it("shows error toast when leaveClub fails", async () => {
    vi.mocked(leaveClub).mockResolvedValueOnce({ error: "Unable to leave club" } as never);

    render(
      <ClubMembershipButton
        clubId="club-123"
        isMember={true}
        isOwner={false}
        isAuthenticated={true}
      />
    );

    const button = screen.getByRole("button", { name: /member \(leave\)/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(leaveClub).toHaveBeenCalledWith("club-123");
      expect(toast.error).toHaveBeenCalledWith("Unable to leave club");
    });
  });
});
