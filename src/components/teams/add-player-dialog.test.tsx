import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddPlayerDialog } from "./add-player-dialog";

const lookUpPlayers = vi.fn();
const addPlayerToTeam = vi.fn();
const createPlayerQuick = vi.fn();
vi.mock("~/app/teams/actions", () => ({
  addPlayerToTeam: (teamId: string, userId: string) =>
    addPlayerToTeam(teamId, userId),
  createPlayerQuick: (teamId: string, name: string) =>
    createPlayerQuick(teamId, name),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("~/lib/player-lookup", () => ({
  lookUpPlayers: (q: string) => lookUpPlayers(q),
}));

async function openAndSearch(query: string) {
  const user = userEvent.setup();
  render(<AddPlayerDialog teamId="t1" />);
  await user.click(screen.getByRole("button", { name: /add player/i }));
  await user.type(screen.getByLabelText(/search players/i), query);
  return user;
}

describe("AddPlayerDialog", () => {
  beforeEach(() => {
    lookUpPlayers.mockReset();
    addPlayerToTeam.mockReset();
    createPlayerQuick.mockReset();
  });

  it("adds exactly one player when a registered player is picked", async () => {
    lookUpPlayers.mockResolvedValue({
      players: [{ id: "u9", name: "Rahul Sharma", username: "rahul" }],
      more: false,
    });
    addPlayerToTeam.mockResolvedValue({ success: true });
    const user = await openAndSearch("Rahul");

    await user.click(await screen.findByRole("button", { name: /rahul sharma/i }));

    expect(addPlayerToTeam).toHaveBeenCalledTimes(1);
    expect(addPlayerToTeam).toHaveBeenCalledWith("t1", "u9");
    expect(createPlayerQuick).not.toHaveBeenCalled();
  });

  it("lists results outside the add-new button", async () => {
    lookUpPlayers.mockResolvedValue({
      players: [{ id: "u9", name: "Rahul Sharma" }],
      more: false,
    });
    await openAndSearch("Rahul");

    const result = await screen.findByRole("button", { name: /rahul sharma/i });
    const addNew = screen.getByRole("button", {
      name: /add “rahul” as a new player/i,
    });
    expect(addNew.contains(result)).toBe(false);
    expect(result.parentElement?.closest("button")).toBeNull();
  });

  it("creates a new player from the typed name", async () => {
    lookUpPlayers.mockResolvedValue({ players: [], more: false });
    createPlayerQuick.mockResolvedValue({
      data: { user_id: "p1", full_name: "New Guy" },
      error: null,
    });
    const user = await openAndSearch("New Guy");

    const addNew = screen.getByRole("button", {
      name: /add “new guy” as a new player/i,
    });
    // Only once the search has said nobody has that name.
    expect(addNew).toBeDisabled();
    await waitFor(() => expect(addNew).toBeEnabled());
    await user.click(addNew);

    expect(createPlayerQuick).toHaveBeenCalledTimes(1);
    expect(createPlayerQuick).toHaveBeenCalledWith("t1", "New Guy");
    expect(addPlayerToTeam).not.toHaveBeenCalled();
  });

  it("says a failed search failed instead of that nobody matches", async () => {
    lookUpPlayers.mockRejectedValue(new Error("offline"));
    await openAndSearch("Rahul");
    await screen.findByText(
      /Could not check whether “Rahul” is already on CricScore/,
    );
    expect(screen.queryByText(/Nobody on CricScore/)).toBeNull();
  });

  it("offers no new player for a @username", async () => {
    lookUpPlayers.mockResolvedValue({ players: [], more: false });
    await openAndSearch("@rahul");
    await screen.findByText("Nobody has the username @rahul.");
    expect(screen.queryByRole("button", { name: /as a new player/i })).toBeNull();
  });
});
