import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamPlayer } from "~/lib/match-types";

const actions = vi.hoisted(() => ({
  addPlayerToTeam: vi.fn(),
  removePlayerFromTeam: vi.fn(),
}));
vi.mock("~/app/teams/actions", () => actions);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("~/lib/player-lookup", () => ({ lookUpPlayers: vi.fn() }));

import { lookUpPlayers } from "~/lib/player-lookup";
import { PlayerSearchContext } from "./PlayerPicker";
import { SquadManagerDialog } from "./SquadManagerDialog";

const player = (id: string, name: string): TeamPlayer => ({
  id: `tp-${id}`,
  team_id: "t1",
  user_id: id,
  user: { id, full_name: name },
});

const batting = {
  id: "t1",
  name: "Mumbai",
  players: [
    player("a", "Ajinkya Rahane"),
    player("b", "Bhuvneshwar"),
    player("c", "Cheteshwar Pujara"),
  ],
};

function renderDialog(overrides: Record<string, unknown> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    batting,
    bowling: { id: "t2", name: "Chennai", players: [] },
    activeIds: new Set(["a"]),
    usedIds: new Set(["a", "b"]),
    dismissedIds: new Set(["b"]),
    onCreatePlayer: vi.fn().mockResolvedValue({}),
    onChanged: vi.fn(),
    isProcessing: false,
    ...overrides,
  };
  render(<SquadManagerDialog {...props} />);
  return props;
}

describe("SquadManagerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lookUpPlayers).mockResolvedValue({ players: [], more: false });
    actions.removePlayerFromTeam.mockResolvedValue({ error: null });
  });

  it("separates players yet to play from those who played, and only the former can be removed", () => {
    renderDialog();
    const yet = screen.getByRole("region", { name: "Yet to play" });
    const played = screen.getByRole("region", { name: "Played in this match" });
    expect(yet).toHaveTextContent("Cheteshwar Pujara");
    expect(played).toHaveTextContent("Ajinkya Rahane");
    expect(played).toHaveTextContent("Out");
    expect(
      screen.getByRole("button", {
        name: "Remove Cheteshwar Pujara from Mumbai",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Remove Ajinkya Rahane from Mumbai",
      }),
    ).not.toBeInTheDocument();
  });

  it("filters the squad and adds a new player from the same field", async () => {
    const props = renderDialog();
    const search = screen.getByRole("searchbox", {
      name: "Find or add a player for Mumbai",
    });
    fireEvent.change(search, { target: { value: "Ravi" } });
    await screen.findByText("Nobody on CricScore matches “Ravi”.");
    fireEvent.keyDown(search, { key: "Enter" });
    await waitFor(() =>
      expect(props.onCreatePlayer).toHaveBeenCalledWith("batting", "Ravi"),
    );
  });

  it("warns before adding a duplicate name", async () => {
    renderDialog();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "bhuvneshwar" },
    });
    expect(
      screen.getByText(/Bhuvneshwar is already in Mumbai/),
    ).toBeInTheDocument();
    const addAnother = screen.getByRole("button", {
      name: /Add another .bhuvneshwar./,
    });
    await waitFor(() => expect(addAnother).toBeEnabled());
  });

  it("disables squad changes while offline and does not search", () => {
    renderDialog({ isOffline: true });
    expect(
      screen.getByRole("button", {
        name: "Remove Cheteshwar Pujara from Mumbai",
      }),
    ).toBeDisabled();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Ravi" },
    });
    expect(screen.getByRole("button", { name: /Add .Ravi./ })).toBeDisabled();
    expect(
      screen.getByText("Changing squads needs a connection."),
    ).toBeInTheDocument();
    expect(lookUpPlayers).not.toHaveBeenCalled();
  });

  it("asks before removing a player from the team, and says it is the team", async () => {
    const props = renderDialog();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Cheteshwar Pujara from Mumbai" }),
    );
    // Nothing is removed until the scorer confirms.
    expect(actions.removePlayerFromTeam).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("dialog", {
      name: "Remove Cheteshwar Pujara from Mumbai?",
    });
    expect(confirm).toHaveTextContent("not just this match");

    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(actions.removePlayerFromTeam).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Cheteshwar Pujara from Mumbai" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove from team" }),
    );
    await waitFor(() =>
      expect(actions.removePlayerFromTeam).toHaveBeenCalledWith("t1", "c"),
    );
    await waitFor(() => expect(props.onChanged).toHaveBeenCalled());
  });

  it("adds a registered player through the scorer's add", async () => {
    vi.mocked(lookUpPlayers).mockResolvedValue({
      players: [{ id: "u9", name: "Rohit Sharma", username: "rohit" }],
      more: false,
    });
    const props = renderDialog();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Rohit" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Rohit Sharma to Mumbai" }),
    );
    await waitFor(() =>
      expect(props.onCreatePlayer).toHaveBeenCalledWith(
        "batting",
        "Rohit Sharma",
        "u9",
      ),
    );
    expect(actions.addPlayerToTeam).not.toHaveBeenCalled();
  });

  const typeName = (value: string) =>
    fireEvent.change(screen.getByRole("searchbox"), { target: { value } });

  it("lists existing players above Add as new, so they are seen first", async () => {
    vi.mocked(lookUpPlayers).mockResolvedValue({
      players: [{ id: "u9", name: "Rohit Sharma" }],
      more: false,
    });
    renderDialog();
    typeName("Rohit");
    const found = await screen.findByRole("button", {
      name: "Add Rohit Sharma to Mumbai",
    });
    const addNew = screen.getByRole("button", { name: /as a new player/ });
    expect(
      found.compareDocumentPosition(addNew) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("does not add a new player while the search has not answered", async () => {
    vi.mocked(lookUpPlayers).mockReturnValue(new Promise(() => {}));
    const props = renderDialog();
    typeName("Rohit Sharma");
    const box = screen.getByRole("searchbox");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByRole("button", { name: /as a new player/ })).toBeDisabled();
    expect(props.onCreatePlayer).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/Looking for/);
  });

  it("does not add on Enter while existing players are listed", async () => {
    vi.mocked(lookUpPlayers).mockResolvedValue({
      players: [{ id: "u9", name: "Rohit Sharma" }],
      more: false,
    });
    const props = renderDialog();
    typeName("Rohit");
    await screen.findByRole("button", { name: "Add Rohit Sharma to Mumbai" });
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(props.onCreatePlayer).not.toHaveBeenCalled();
  });

  it("says a failed search failed, and adding new stays a deliberate tap", async () => {
    vi.mocked(lookUpPlayers).mockRejectedValue(new Error("offline"));
    const props = renderDialog();
    typeName("Rohit");
    await screen.findByText(
      /Could not check whether “Rohit” is already on CricScore/,
    );
    await screen.findByRole("button", { name: "Try again" });
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(props.onCreatePlayer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /as a new player/ }));
    await waitFor(() =>
      expect(props.onCreatePlayer).toHaveBeenCalledWith("batting", "Rohit"),
    );
  });

  it("finds a squad player by @username and offers no new player for it", async () => {
    renderDialog({
      batting: {
        ...batting,
        players: [
          {
            ...player("c", "Cheteshwar Pujara"),
            user: { id: "c", full_name: "Cheteshwar Pujara", username: "cheteshwar" },
          },
        ],
      },
    });
    typeName("@chet");
    expect(screen.getByText("Cheteshwar Pujara")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /as a new player/ })).toBeNull();
  });

  it("uses the screen's search: the other squad is shown, a player of the other side is refused", async () => {
    const find = vi.fn().mockResolvedValue({
      players: [
        { id: "t", name: "Tushar", teams: ["Chennai"] },
        { id: "m", name: "Moeen", teams: ["Chennai"], playedFor: "Chennai" },
      ],
      more: false,
    });
    render(
      <PlayerSearchContext.Provider value={find}>
        <SquadManagerDialog
          open
          onOpenChange={vi.fn()}
          batting={batting}
          bowling={{ id: "t2", name: "Chennai", players: [] }}
          activeIds={new Set()}
          usedIds={new Set()}
          dismissedIds={new Set()}
          onCreatePlayer={vi.fn()}
          onChanged={vi.fn()}
          isProcessing={false}
        />
      </PlayerSearchContext.Provider>,
    );
    typeName("mo");
    const free = await screen.findByRole("button", {
      name: "Add Tushar to Mumbai",
    });
    expect(free).toBeEnabled();
    expect(free).toHaveTextContent("Plays for Chennai");
    const refused = screen.getByRole("button", {
      name: "Moeen: Played for Chennai",
    });
    expect(refused).toBeDisabled();
  });
});
