import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { removeMember, updateMemberRole } from "~/app/clubs/actions";
import { MemberActions } from "./member-role-action";

vi.mock("~/app/clubs/actions", () => ({
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const props = {
  clubId: "club-1",
  membershipId: "mem-1",
  currentRole: "member",
  userName: "Bob",
  canChangeRole: true,
  canRemove: true,
};

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions for Bob" }));
  return user;
}

describe("MemberActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows nothing for the owner, or when there is nothing to do", () => {
    const { container, rerender } = render(
      <MemberActions {...props} currentRole="owner" />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(
      <MemberActions {...props} canChangeRole={false} canRemove={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("makes a member an admin after the app's own confirm, never the browser's", async () => {
    const browserConfirm = vi.spyOn(window, "confirm");
    vi.mocked(updateMemberRole).mockResolvedValue({ error: null } as never);
    render(<MemberActions {...props} />);
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Make admin" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Make Bob an admin?");
    await user.click(screen.getByRole("button", { name: "Make admin" }));

    await waitFor(() =>
      expect(updateMemberRole).toHaveBeenCalledWith("club-1", "mem-1", "admin"),
    );
    expect(toast.success).toHaveBeenCalledWith("Bob is now a club admin");
    expect(browserConfirm).not.toHaveBeenCalled();
  });

  it("changes nothing when the confirm is cancelled", async () => {
    render(<MemberActions {...props} currentRole="admin" />);
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Make member" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(updateMemberRole).not.toHaveBeenCalled();
  });

  it("removes a member, and reports a refusal", async () => {
    vi.mocked(removeMember).mockResolvedValue({ error: "Not allowed" } as never);
    render(<MemberActions {...props} canChangeRole={false} />);
    const user = await openMenu();
    expect(
      screen.queryByRole("menuitem", { name: /admin/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Remove from club" }));
    await user.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(removeMember).toHaveBeenCalledWith("club-1", "mem-1"),
    );
    expect(toast.error).toHaveBeenCalledWith("Not allowed");
  });
});
