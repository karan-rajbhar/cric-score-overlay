import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamPlayer } from "~/lib/match-types";

const actions = vi.hoisted(() => ({
  addPlayerToTeam: vi.fn(),
  removePlayerFromTeam: vi.fn(),
  searchUsers: vi.fn(),
}));
vi.mock("~/app/teams/actions", () => actions);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
    actions.searchUsers.mockResolvedValue({ data: [] });
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
    expect(screen.getByText(/Nobody in Mumbai matches/)).toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Enter" });
    await waitFor(() =>
      expect(props.onCreatePlayer).toHaveBeenCalledWith("batting", "Ravi"),
    );
  });

  it("warns before adding a duplicate name", () => {
    renderDialog();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "bhuvneshwar" },
    });
    expect(
      screen.getByText(/Bhuvneshwar is already in Mumbai/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add another .bhuvneshwar./ }),
    ).toBeEnabled();
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
    expect(actions.searchUsers).not.toHaveBeenCalled();
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
    actions.searchUsers.mockResolvedValue({
      data: [{ id: "u9", full_name: "Rohit Sharma", username: "rohit" }],
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
});
