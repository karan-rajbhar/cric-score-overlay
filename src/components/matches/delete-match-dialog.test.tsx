import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { deleteMatch } from "~/app/matches/mutations";
import { DeleteMatchDialog } from "./delete-match-dialog";
import { MatchMoreMenu } from "./match-more-menu";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));
vi.mock("~/app/matches/mutations", () => ({ deleteMatch: vi.fn() }));
vi.mock("~/app/matches/reschedule", () => ({ rescheduleMatch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let user: { id: string } | null = { id: "u1" };
let isAdmin: boolean | undefined = true;
let canDelete: boolean | undefined = true;
let canProduce: boolean | undefined = false;
const canProduceQuery = vi.fn();
const canDeleteQuery = vi.fn();
vi.mock("~/lib/auth", () => ({ useAuth: () => ({ user }) }));
vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useMatchAdminQuery: () => ({ data: isAdmin }),
  useCanDeleteMatchQuery: (...args: unknown[]) => {
    canDeleteQuery(...args);
    return { data: args[2] ? canDelete : undefined };
  },
  useMatchClubChoices: (...args: unknown[]) => {
    clubChoices(...args);
    return { choosable: [], offer: args[3] ? clubOffer : false };
  },
  useCanProduceOverlayQuery: (...args: unknown[]) => {
    canProduceQuery(...args);
    return { data: args[2] ? canProduce : undefined };
  },
  useClubRecordsQuery: () => ({ data: undefined }),
}));
vi.mock("~/app/matches/club", () => ({ setMatchClub: vi.fn() }));
let clubOffer = false;
const clubChoices = vi.fn();

const match = {
  id: "m1",
  title: "Strikers vs Warriors",
  tournament_id: null,
  club_id: "c1",
};

function renderDialog(onOpenChange = vi.fn()) {
  render(<DeleteMatchDialog open onOpenChange={onOpenChange} match={match} />);
  return {
    input: screen.getByLabelText("Type the match name to confirm"),
    button: screen.getByRole("button", { name: "Delete match" }),
    onOpenChange,
  };
}

describe("DeleteMatchDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explains what is deleted and shows the name to type", () => {
    renderDialog();
    expect(
      screen.getByText(/its scorecard and ball-by-ball log/),
    ).toBeInTheDocument();
    expect(screen.getByText(/can't be undone/)).toBeInTheDocument();
    expect(screen.getByText("Strikers vs Warriors")).toBeInTheDocument();
  });

  it("keeps the delete button disabled until the name matches", () => {
    const { input, button } = renderDialog();
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: "Strikers" } });
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: " strikers VS warriors " } });
    expect(button).toBeEnabled();
  });

  it("deletes, toasts and navigates to where the match belonged", async () => {
    vi.mocked(deleteMatch).mockResolvedValue({
      success: true,
      error: null,
      redirectTo: "/clubs/c1",
    });
    const { input, button, onOpenChange } = renderDialog();
    fireEvent.change(input, { target: { value: "Strikers vs Warriors" } });
    fireEvent.click(button);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/clubs/c1"));
    expect(deleteMatch).toHaveBeenCalledWith("m1", "Strikers vs Warriors");
    expect(toast.success).toHaveBeenCalledWith("Match deleted");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the server's error and stays open", async () => {
    vi.mocked(deleteMatch).mockResolvedValue({
      success: false,
      error: "Only the match creator can delete this match",
    });
    const { input, button, onOpenChange } = renderDialog();
    fireEvent.change(input, { target: { value: "Strikers vs Warriors" } });
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only the match creator can delete this match",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("MatchMoreMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    user = { id: "u1" };
    isAdmin = true;
    canDelete = true;
    canProduce = false;
  });

  const openMenu = () =>
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "More match actions" }),
      { button: 0, ctrlKey: false },
    );

  describe("once the match has ended", () => {
    const finished = { ...match, status: "completed" };

    it("keeps Stream for its scorers, the one way back to the control room", async () => {
      render(<MatchMoreMenu match={finished} />);
      openMenu();
      expect(
        await screen.findByRole("menuitem", { name: "Stream this match" }),
      ).toHaveAttribute("href", `/matches/${match.id}/stream`);
    });

    it("keeps Stream for its streamers, who are not scorers", async () => {
      isAdmin = false;
      canDelete = false;
      canProduce = true;
      render(<MatchMoreMenu match={finished} dlsMatch={finished as never} />);
      openMenu();
      expect(
        await screen.findByRole("menuitem", { name: "Stream this match" }),
      ).toBeInTheDocument();
    });

    it("hides Stream from everyone else", async () => {
      isAdmin = false;
      canDelete = false;
      user = null;
      render(<MatchMoreMenu match={finished} dlsMatch={finished as never} />);
      openMenu();
      await screen.findByRole("menuitem", { name: /Cricsheet/ });
      expect(
        screen.queryByRole("menuitem", { name: "Stream this match" }),
      ).toBeNull();
    });

    it("asks about streaming only when the answer could change the menu", () => {
      render(<MatchMoreMenu match={finished} />);
      expect(canProduceQuery).toHaveBeenCalledWith(match.id, "u1", false);
    });

    it("no longer offers to invite scorers", async () => {
      render(<MatchMoreMenu match={finished} />);
      openMenu();
      await screen.findByRole("menuitem", { name: "Stream this match" });
      expect(
        screen.queryByRole("menuitem", { name: "Invite scorers" }),
      ).toBeNull();
    });

    it("has no button at all with nothing to offer", () => {
      isAdmin = false;
      canDelete = false;
      user = null;
      render(<MatchMoreMenu match={{ ...match, status: "abandoned" }} />);
      expect(
        screen.queryByRole("button", { name: "More match actions" }),
      ).toBeNull();
    });
  });

  it("offers scorers Invite scorers until the match ends, viewers not", async () => {
    const { unmount } = render(
      <MatchMoreMenu match={{ ...match, status: "live" }} />,
    );
    openMenu();
    expect(
      await screen.findByRole("menuitem", { name: "Invite scorers" }),
    ).toBeInTheDocument();
    unmount();

    isAdmin = false;
    render(<MatchMoreMenu match={{ ...match, status: "live" }} />);
    openMenu();
    await screen.findByRole("menuitem", { name: "Stream this match" });
    expect(
      screen.queryByRole("menuitem", { name: "Invite scorers" }),
    ).toBeNull();
  });

  it("offers Delete match to users who may delete", async () => {
    render(<MatchMoreMenu match={match} />);
    const trigger = screen.getByRole("button", { name: "More match actions" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete match" }),
    );
    expect(
      await screen.findByLabelText("Type the match name to confirm"),
    ).toBeInTheDocument();
  });

  it("offers no Delete match to co-scorers and viewers", async () => {
    canDelete = false;
    const { rerender } = render(<MatchMoreMenu match={match} />);
    const trigger = screen.getByRole("button", { name: "More match actions" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    expect(
      await screen.findByRole("menuitem", { name: "Stream this match" }),
    ).toHaveAttribute("href", "/matches/m1/stream");
    // One way into streaming: that page leads on to the control room.
    expect(
      screen.queryByRole("menuitem", { name: "Overlay control room" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Delete match" }),
    ).not.toBeInTheDocument();
    // Non-admins are never asked (no reads for viewers).
    isAdmin = false;
    canDelete = true;
    rerender(<MatchMoreMenu match={match} />);
    expect(canDeleteQuery).toHaveBeenLastCalledWith("m1", "u1", false);
  });

  it("offers Add to club once the menu opens, reading the user's clubs only then", async () => {
    clubOffer = true;
    const full = {
      id: "m1",
      status: "completed",
      team1: { id: "A", name: "Lions" },
      team2: { id: "B", name: "Tigers" },
    };
    render(
      <MatchMoreMenu
        match={{ ...match, club_id: null }}
        dlsMatch={full as never}
      />,
    );
    expect(clubChoices).toHaveBeenLastCalledWith(
      expect.anything(),
      "u1",
      true,
      false,
    );
    const trigger = screen.getByRole("button", { name: "More match actions" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    expect(
      await screen.findByRole("menuitem", { name: "Add to club" }),
    ).toBeInTheDocument();
    expect(clubChoices).toHaveBeenLastCalledWith(
      expect.anything(),
      "u1",
      true,
      true,
    );
    clubOffer = false;
  });

  it("links scorers to the Players page to replace a player", async () => {
    render(<MatchMoreMenu match={match} />);
    const trigger = screen.getByRole("button", { name: "More match actions" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    expect(
      await screen.findByRole("menuitem", { name: "Replace a player" }),
    ).toHaveAttribute("href", "/matches/m1/players");
  });
});
