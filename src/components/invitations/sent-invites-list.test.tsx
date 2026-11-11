import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SentInvite } from "~/app/invitations/data";

const revokeInvite = vi.fn<(id: string) => Promise<{ success: boolean }>>(
  async () => ({ success: true }),
);
vi.mock("~/app/invitations/actions", () => ({
  revokeInvite: (id: string) => revokeInvite(id),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("~/components/invite-dialog", () => ({
  InviteDialog: ({ open }: { open?: boolean }) =>
    open ? <div role="dialog" aria-label="Invite someone" /> : null,
}));

import { SentInvitesList } from "./sent-invites-list";

const pending: SentInvite = {
  id: "inv1",
  email: "sam@example.com",
  status: "pending",
  created_at: "2026-11-01T10:00:00Z",
  updated_at: null,
  accepted_by: null,
  scorer_matches: [],
};

describe("SentInvitesList (N36)", () => {
  beforeEach(() => revokeInvite.mockClear());

  it("asks before revoking, keeping the invite by default", async () => {
    render(<SentInvitesList invites={[pending]} />);
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    const ask = await screen.findByRole("dialog", {
      name: "Revoke the invite to sam@example.com?",
    });
    expect(within(ask).getByRole("button", { name: "Keep invite" })).toHaveFocus();
    expect(revokeInvite).not.toHaveBeenCalled();
    fireEvent.click(within(ask).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(revokeInvite).toHaveBeenCalledWith("inv1"));
  });

  it("offers an invite from the empty list, under an h2", () => {
    render(<SentInvitesList invites={[]} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "No invites yet" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Invite someone" }));
    expect(screen.getByRole("dialog", { name: "Invite someone" })).toBeInTheDocument();
  });
});
