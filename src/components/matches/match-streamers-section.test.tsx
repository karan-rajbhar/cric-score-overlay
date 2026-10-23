import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  getMatchStreamers: vi.fn(),
  addMatchStreamer: vi.fn(),
  removeMatchStreamer: vi.fn(),
  inviteMatchStreamer: vi.fn(),
  searchScorers: vi.fn(),
}));
vi.mock("~/app/matches/streamers", () => ({
  getMatchStreamers: actions.getMatchStreamers,
  addMatchStreamer: actions.addMatchStreamer,
  removeMatchStreamer: actions.removeMatchStreamer,
  inviteMatchStreamer: actions.inviteMatchStreamer,
}));
vi.mock("~/app/matches/mutations", () => ({
  searchScorers: actions.searchScorers,
}));
vi.mock("~/lib/auth", () => ({
  useAuth: () => ({ user: { user_metadata: { full_name: "Karan R" } } }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { MatchStreamersSection } from "./match-streamers-section";

describe("MatchStreamersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.getMatchStreamers.mockResolvedValue({
      data: [{ id: "s1", full_name: "Sam Stream", avatar_url: null }],
      error: null,
    });
    actions.searchScorers.mockResolvedValue({
      data: [{ id: "u2", full_name: "Uma Two", avatar_url: null }],
      error: null,
    });
    actions.addMatchStreamer.mockResolvedValue({ success: true, error: null });
    actions.removeMatchStreamer.mockResolvedValue({ success: true, error: null });
  });

  it("lists the match's streamers and removes one", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MatchStreamersSection matchId="m1" />);
    expect(await screen.findByText("Sam Stream")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Sam Stream from streamers" }),
    );
    await waitFor(() =>
      expect(actions.removeMatchStreamer).toHaveBeenCalledWith("m1", "s1"),
    );
  });

  it("adds a registered player picked from the search", async () => {
    render(<MatchStreamersSection matchId="m1" />);
    fireEvent.change(screen.getByLabelText("Add streamer by name or email"), {
      target: { value: "Uma" },
    });
    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Add Uma Two as a streamer" },
        { timeout: 2000 },
      ),
    );
    await waitFor(() =>
      expect(actions.addMatchStreamer).toHaveBeenCalledWith("m1", "u2"),
    );
  });

  it("invites a new email with a sign-in link to the control room", async () => {
    actions.inviteMatchStreamer.mockResolvedValue({
      success: true,
      status: "invited",
      message: "Invite saved. Send them the message below.",
      shareEmail: "new@gmail.com",
    });
    render(<MatchStreamersSection matchId="m1" />);
    fireEvent.change(screen.getByLabelText("Add streamer by name or email"), {
      target: { value: "new@gmail.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    const message = (await screen.findByLabelText(
      "Invite message",
    )) as HTMLTextAreaElement;
    expect(actions.inviteMatchStreamer).toHaveBeenCalledWith(
      "new@gmail.com",
      "m1",
    );
    expect(message.value).toContain("Karan R invited you to run the broadcast graphics");
    expect(message.value).toContain(
      `next=${encodeURIComponent("/overlay/m1/control")}`,
    );
  });
});
