import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemberRoleAction } from "./member-role-action";
import { updateMemberRole } from "~/app/clubs/actions";
import { toast } from "sonner";

vi.mock("~/app/clubs/actions", () => ({
  updateMemberRole: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("MemberRoleAction Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when currentRole is owner", () => {
    const { container } = render(
      <MemberRoleAction
        clubId="club-1"
        membershipId="mem-1"
        currentRole="owner"
        userName="Alice"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders Make Admin button when user is a member", () => {
    render(
      <MemberRoleAction
        clubId="club-1"
        membershipId="mem-1"
        currentRole="member"
        userName="Bob"
      />
    );

    const button = screen.getByRole("button", { name: /make admin/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("title", "Promote to Admin");
  });

  it("promotes member to admin when confirmed", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(updateMemberRole).mockResolvedValueOnce({ success: true } as never);

    render(
      <MemberRoleAction
        clubId="club-1"
        membershipId="mem-1"
        currentRole="member"
        userName="Bob"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /make admin/i }));

    expect(confirmSpy).toHaveBeenCalledWith("Promote Bob to club admin?");
    await waitFor(() => {
      expect(updateMemberRole).toHaveBeenCalledWith("club-1", "mem-1", "admin");
      expect(toast.success).toHaveBeenCalledWith("Bob is now a club admin!");
    });
  });

  it("does not trigger update if user cancels confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <MemberRoleAction
        clubId="club-1"
        membershipId="mem-1"
        currentRole="member"
        userName="Bob"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /make admin/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(updateMemberRole).not.toHaveBeenCalled();
  });

  it("renders Demote button when user is an admin and handles demotion", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(updateMemberRole).mockResolvedValueOnce({ success: true } as never);

    render(
      <MemberRoleAction
        clubId="club-1"
        membershipId="mem-2"
        currentRole="admin"
        userName="Charlie"
      />
    );

    const button = screen.getByRole("button", { name: /demote/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("title", "Demote to Member");

    fireEvent.click(button);

    expect(confirmSpy).toHaveBeenCalledWith("Demote Charlie to regular member?");
    await waitFor(() => {
      expect(updateMemberRole).toHaveBeenCalledWith("club-1", "mem-2", "member");
      expect(toast.success).toHaveBeenCalledWith("Charlie is now a club member!");
    });
  });

  it("handles error response from updateMemberRole", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(updateMemberRole).mockResolvedValueOnce({ error: "Permission denied" } as never);

    render(
      <MemberRoleAction
        clubId="club-1"
        membershipId="mem-2"
        currentRole="admin"
        userName="Charlie"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /demote/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Permission denied");
    });
  });

  it("handles unexpected exception gracefully", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(updateMemberRole).mockRejectedValueOnce(new Error("Network failure"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <MemberRoleAction
        clubId="club-1"
        membershipId="mem-2"
        currentRole="admin"
        userName="Charlie"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /demote/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update member role");
    });
    consoleSpy.mockRestore();
  });
});
