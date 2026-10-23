import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { InviteMemberDialog } from "./invite-member-dialog";
import { inviteClubMember } from "~/app/clubs/actions";

vi.mock("~/app/clubs/actions", () => ({
  inviteClubMember: vi.fn(),
}));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("~/lib/auth", () => ({
  useAuth: () => ({ user: { user_metadata: { full_name: "Asha K" } } }),
}));

function openAndInvite(email: string) {
  render(<InviteMemberDialog clubId="club-1" clubName="Riverside CC" />);
  fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
  fireEvent.change(screen.getByLabelText(/google email/i), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: /create invite/i }));
}

describe("InviteMemberDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explains that they join the club when they sign in", () => {
    render(<InviteMemberDialog clubId="club-1" clubName="Riverside CC" />);
    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    expect(
      screen.getByRole("heading", { name: "Invite to Riverside CC" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/join the club as a member/i)).toBeInTheDocument();
  });

  it("gives a share message with a sign-in link to the club", async () => {
    vi.mocked(inviteClubMember).mockResolvedValueOnce({
      success: true,
      status: "invited",
      message: "Invite saved. Send them the message below.",
      shareEmail: "new@gmail.com",
    });
    openAndInvite("New@Gmail.com");

    const message = (await screen.findByLabelText(
      /invite message/i,
    )) as HTMLTextAreaElement;
    expect(inviteClubMember).toHaveBeenCalledWith("club-1", "New@Gmail.com");
    expect(message.value).toContain(
      "Asha K invited you to join Riverside CC on CricScore",
    );
    expect(message.value).toContain(
      `/auth/login?invite=new@gmail.com&next=${encodeURIComponent("/clubs/club-1")}`,
    );
    expect(
      screen.getByRole("link", { name: /share on whatsapp/i }),
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("needs no message for someone already on CricScore", async () => {
    vi.mocked(inviteClubMember).mockResolvedValueOnce({
      success: true,
      status: "added",
      message: "Ravi is now a member of the club.",
      shareEmail: null,
    });
    openAndInvite("ravi@gmail.com");
    expect(
      await screen.findByText("Ravi is now a member of the club."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/invite message/i)).toBeNull();
  });

  it("shows the server's error, and a network failure, without getting stuck", async () => {
    vi.mocked(inviteClubMember).mockResolvedValueOnce({
      error: "You are not authorized to invite members to this club",
    });
    openAndInvite("x@gmail.com");
    expect(
      await screen.findByText(
        "You are not authorized to invite members to this club",
      ),
    ).toBeInTheDocument();

    vi.mocked(inviteClubMember).mockRejectedValueOnce(new TypeError("fetch"));
    fireEvent.change(screen.getByLabelText(/google email/i), {
      target: { value: "x@gmail.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create invite/i }));
    expect(
      await screen.findByText("Could not reach the server. Try again."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /create invite/i })).toBeEnabled(),
    );
  });
});
