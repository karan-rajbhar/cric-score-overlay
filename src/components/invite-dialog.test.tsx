import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InviteDialog } from "./invite-dialog";

const inviteToApp = vi.fn();
vi.mock("~/app/invitations/actions", () => ({
  inviteToApp: (email: string) => inviteToApp(email),
}));
vi.mock("~/lib/auth", () => ({
  useAuth: () => ({ user: { user_metadata: { full_name: "Karan R" } } }),
}));

async function invite(email: string) {
  const user = userEvent.setup();
  render(<InviteDialog />);
  await user.click(screen.getByRole("button", { name: /invite/i }));
  await user.type(screen.getByLabelText(/google email/i), email);
  await user.click(screen.getByRole("button", { name: /create invite/i }));
  return user;
}

describe("InviteDialog", () => {
  beforeEach(() => inviteToApp.mockReset());

  it("shows a share message with WhatsApp and copy actions", async () => {
    inviteToApp.mockResolvedValue({
      success: true,
      message: "Invite saved. Send them the message below.",
      shareEmail: "friend+cric@gmail.com",
    });
    await invite("Friend+Cric@gmail.com");

    const message = (await screen.findByLabelText(
      /invite message/i,
    )) as HTMLTextAreaElement;
    expect(message.value).toContain("Karan R invited you to CricScore");
    expect(message.value).toContain(
      `${window.location.origin}/auth/login?invite=friend%2Bcric@gmail.com`,
    );
    expect(message.value).toContain("using friend+cric@gmail.com");

    const whatsapp = screen.getByRole("link", { name: /share on whatsapp/i });
    expect(whatsapp).toHaveAttribute(
      "href",
      `https://wa.me/?text=${encodeURIComponent(message.value)}`,
    );
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("shows no share message for someone who already has access", async () => {
    inviteToApp.mockResolvedValue({
      success: true,
      message: "That person already has access.",
      shareEmail: null,
    });
    await invite("member@gmail.com");

    expect(
      await screen.findByText("That person already has access."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/invite message/i)).not.toBeInTheDocument();
  });

  it("shows the error when the invite fails", async () => {
    inviteToApp.mockResolvedValue({ error: "Enter a valid email address" });
    await invite("bad@x");

    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeInTheDocument();
  });
});

describe("InviteDialog when the server cannot be reached", () => {
  beforeEach(() => inviteToApp.mockReset());

  it("says so and lets the user try again", async () => {
    inviteToApp.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const user = await invite("friend@gmail.com");

    expect(
      await screen.findByText("Could not reach the server. Try again."),
    ).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: /create invite/i });
    expect(submit).toBeEnabled();

    inviteToApp.mockResolvedValueOnce({
      success: true,
      message: "Invite saved. Send them the message below.",
      shareEmail: "friend@gmail.com",
    });
    await user.click(submit);
    expect(await screen.findByLabelText(/invite message/i)).toBeInTheDocument();
  });
});
