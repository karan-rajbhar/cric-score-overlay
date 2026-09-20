import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { InviteMemberDialog } from "./invite-member-dialog";
import { inviteClubMember } from "~/app/clubs/actions";
import { toast } from "sonner";

vi.mock("~/app/clubs/actions", () => ({
  inviteClubMember: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("InviteMemberDialog Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Invite Member trigger button", () => {
    render(<InviteMemberDialog clubId="club-1" />);
    expect(
      screen.getByRole("button", { name: /invite member/i })
    ).toBeInTheDocument();
  });

  it("opens modal dialog on trigger click", () => {
    render(<InviteMemberDialog clubId="club-1" />);
    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));

    expect(
      screen.getByRole("heading", { name: /invite player or staff/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it("submits valid email and shows success toast", async () => {
    vi.mocked(inviteClubMember).mockResolvedValueOnce({ success: true } as never);

    render(<InviteMemberDialog clubId="club-1" />);
    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));

    const input = screen.getByLabelText(/email address/i);
    fireEvent.change(input, { target: { value: "allrounder@cricket.org" } });

    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));

    await waitFor(() => {
      expect(inviteClubMember).toHaveBeenCalledWith(
        "club-1",
        "allrounder@cricket.org"
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Invitation recorded for allrounder@cricket.org!"
      );
    });
  });

  it("handles error response from server action", async () => {
    vi.mocked(inviteClubMember).mockResolvedValueOnce({
      error: "This user is already an active member of the club",
    } as never);

    render(<InviteMemberDialog clubId="club-1" />);
    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));

    const input = screen.getByLabelText(/email address/i);
    fireEvent.change(input, { target: { value: "existing@cricket.org" } });

    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "This user is already an active member of the club"
      );
    });
  });
});
