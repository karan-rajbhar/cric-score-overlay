import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddPlayerDialog } from "./add-player-dialog";

const searchUsers = vi.fn();
const addPlayerToTeam = vi.fn();
const createPlayerQuick = vi.fn();
vi.mock("~/app/teams/actions", () => ({
  searchUsers: (q: string) => searchUsers(q),
  addPlayerToTeam: (teamId: string, userId: string) =>
    addPlayerToTeam(teamId, userId),
  createPlayerQuick: (teamId: string, name: string) =>
    createPlayerQuick(teamId, name),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

async function openAndSearch(query: string) {
  const user = userEvent.setup();
  render(<AddPlayerDialog teamId="t1" />);
  await user.click(screen.getByRole("button", { name: /add player/i }));
  await user.type(screen.getByLabelText(/search players/i), query);
  return user;
}

describe("AddPlayerDialog", () => {
  beforeEach(() => {
    searchUsers.mockReset();
    addPlayerToTeam.mockReset();
    createPlayerQuick.mockReset();
  });

  it("adds exactly one player when a registered player is picked", async () => {
    searchUsers.mockResolvedValue({
      data: [{ id: "u9", full_name: "Rahul Sharma", username: "rahul" }],
      error: null,
    });
    addPlayerToTeam.mockResolvedValue({ success: true });
    const user = await openAndSearch("Rahul");

    await user.click(await screen.findByRole("button", { name: /rahul sharma/i }));

    expect(addPlayerToTeam).toHaveBeenCalledTimes(1);
    expect(addPlayerToTeam).toHaveBeenCalledWith("t1", "u9");
    expect(createPlayerQuick).not.toHaveBeenCalled();
  });

  it("lists results outside the add-new button", async () => {
    searchUsers.mockResolvedValue({
      data: [{ id: "u9", full_name: "Rahul Sharma" }],
      error: null,
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
    searchUsers.mockResolvedValue({ data: [], error: null });
    createPlayerQuick.mockResolvedValue({
      data: { user_id: "p1", full_name: "New Guy" },
      error: null,
    });
    const user = await openAndSearch("New Guy");

    await user.click(
      screen.getByRole("button", { name: /add “new guy” as a new player/i }),
    );

    expect(createPlayerQuick).toHaveBeenCalledTimes(1);
    expect(createPlayerQuick).toHaveBeenCalledWith("t1", "New Guy");
    expect(addPlayerToTeam).not.toHaveBeenCalled();
  });
});
