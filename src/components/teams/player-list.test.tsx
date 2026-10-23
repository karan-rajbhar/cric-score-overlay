import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setPlayerClaimEmail } from "~/app/teams/actions";
import { PlayerList } from "./player-list";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("~/app/teams/actions", () => ({
  removePlayerFromTeam: vi.fn(),
  updatePlayerRole: vi.fn(),
  setPlayerClaimEmail: vi.fn(),
}));
vi.mock("~/lib/auth", () => ({
  useAuth: () => ({ user: { user_metadata: { full_name: "Asha K" } } }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const players = [
  { id: "tp1", user_id: "p1", user: { id: "p1", full_name: "Ravi Kumar" } },
  { id: "tp2", user_id: "p2", user: { id: "p2", full_name: "Kiran Shah" } },
  { id: "tp3", user_id: "p3", user: { id: "p3", full_name: "Asha Rao" } },
];
const claims = {
  p1: { state: "placeholder" as const },
  p2: { state: "invited" as const, maskedEmail: "k…@gmail.com" },
};

function openMenu(name: string) {
  const trigger = screen.getByRole("button", { name: `Player actions for ${name}` });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
}

describe("PlayerList claims", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks players without an account, for team admins", () => {
    render(
      <PlayerList teamId="t1" teamName="Lions" players={players} claims={claims} allowEdit />,
    );
    expect(screen.getByText("Not on CricScore")).toBeInTheDocument();
    expect(
      screen.getByText(/Invite sent to k…@gmail.com, not signed in yet/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Not on CricScore")).toHaveLength(1);
  });

  it("invites a placeholder to claim the profile and gives the message", async () => {
    vi.mocked(setPlayerClaimEmail).mockResolvedValue({
      error: null,
      maskedEmail: "r…@gmail.com",
      shareEmail: "ravi@gmail.com",
    });
    render(
      <PlayerList teamId="t1" teamName="Lions" players={players} claims={claims} allowEdit />,
    );
    openMenu("Ravi Kumar");
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Invite to claim profile" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Their Google email"), {
      target: { value: "Ravi@Gmail.com" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save and get the message" }),
    );
    await waitFor(() =>
      expect(setPlayerClaimEmail).toHaveBeenCalledWith("t1", "p1", "Ravi@Gmail.com"),
    );
    const message = (await within(dialog).findByLabelText(
      /invite message/i,
    )) as HTMLTextAreaElement;
    expect(message.value).toContain("Asha K added you to Lions on CricScore");
    expect(message.value).toContain("/auth/login?invite=ravi@gmail.com");
    expect(message.value).toContain("using ravi@gmail.com");
    expect(refresh).toHaveBeenCalled();
  });

  it("lets the admin remove a pending invite", async () => {
    vi.mocked(setPlayerClaimEmail).mockResolvedValue({
      error: null,
      maskedEmail: null,
      shareEmail: null,
    });
    render(
      <PlayerList teamId="t1" teamName="Lions" players={players} claims={claims} allowEdit />,
    );
    openMenu("Kiran Shah");
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Change or remove invite" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Invite sent to k…@gmail.com");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove email" }));
    await waitFor(() =>
      expect(setPlayerClaimEmail).toHaveBeenCalledWith("t1", "p2", null),
    );
    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "Email removed",
    );
  });

  it("shows the refusal when the email belongs to someone else", async () => {
    vi.mocked(setPlayerClaimEmail).mockResolvedValue({
      error: "That email is already on CricScore as Asha Rao",
    });
    render(
      <PlayerList teamId="t1" teamName="Lions" players={players} claims={claims} allowEdit />,
    );
    openMenu("Ravi Kumar");
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Invite to claim profile" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Their Google email"), {
      target: { value: "asha@gmail.com" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save and get the message" }),
    );
    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "That email is already on CricScore as Asha Rao",
    );
    expect(within(dialog).queryByLabelText(/invite message/i)).toBeNull();
  });

  it("shows no marks to people who cannot manage the team", () => {
    render(<PlayerList teamId="t1" players={players} />);
    expect(screen.queryByText("Not on CricScore")).toBeNull();
  });
});
