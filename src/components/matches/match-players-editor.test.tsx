import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("~/app/matches/mutations", () => ({ replacePlayerInMatch: vi.fn() }));
vi.mock("~/app/teams/actions", () => ({
  addExistingPlayerQuick: vi.fn(),
  createPlayerQuick: vi.fn(),
}));
vi.mock("~/lib/player-lookup", () => ({ lookUpPlayers: vi.fn() }));

import { replacePlayerInMatch } from "~/app/matches/mutations";
import { addExistingPlayerQuick, createPlayerQuick } from "~/app/teams/actions";
import { lookUpPlayers } from "~/lib/player-lookup";
import { makeMatch } from "~/test/factories";
import { MatchPlayersEditor } from "./match-players-editor";

const squad = (team: string, names: [string, string][]) =>
  names.map(([id, name]) => ({
    id: `${team}-${id}`,
    team_id: team,
    user_id: id,
    user: { id, full_name: name, username: id === "ravi" ? "ravi_k" : null },
  }));

const match = makeMatch({
  id: "m1",
  team1_id: "t1",
  team2_id: "t2",
  team1: {
    id: "t1",
    name: "Lions",
    team_players: squad("t1", [
      ["rahul", "Rahul Sharma"],
      ["ravi", "Ravi Kumar"],
    ]),
  },
  team2: {
    id: "t2",
    name: "Tigers",
    team_players: squad("t2", [["dev", "Dev Patel"]]),
  },
  innings: [
    {
      id: "i1",
      match_id: "m1",
      innings_number: 1,
      team_id: "t1",
      batting_performances: [
        { user_id: "rahul", runs_scored: 34, balls_faced: 22, is_out: true },
      ],
      bowling_performances: [
        { user_id: "dev", wickets_taken: 1, runs_conceded: 30 },
      ],
      fall_of_wickets: [],
    },
  ],
} as never);

describe("Players page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lookUpPlayers).mockResolvedValue({ players: [], more: false });
    vi.mocked(replacePlayerInMatch).mockResolvedValue({
      success: true,
      error: null,
    });
  });

  it("lists each team's players with what they did, and Replace beside each", () => {
    render(<MatchPlayersEditor match={match} />);
    expect(screen.getByRole("heading", { name: "Lions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tigers" })).toBeInTheDocument();
    expect(screen.getByText("34 (22)")).toBeInTheDocument();
    expect(screen.getByText("1/30")).toBeInTheDocument();
    // Ravi has no part in the match: not on the sheet, only offered.
    expect(screen.queryByText("Ravi Kumar")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Replace Rahul Sharma" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("replaces an out batter in place, under their row, without a dialog", async () => {
    render(<MatchPlayersEditor match={match} />);
    fireEvent.click(screen.getByRole("button", { name: "Replace Rahul Sharma" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const choices = screen.getByRole("radiogroup", {
      name: "Who really played instead of Rahul Sharma?",
    });
    expect(within(choices).queryByRole("radio", { name: /Rahul/ })).toBeNull();
    fireEvent.click(within(choices).getByRole("radio", { name: /Ravi Kumar/ }));
    expect(
      screen.getByText(/Rahul Sharma's 34 runs in this match move to Ravi Kumar/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() =>
      expect(replacePlayerInMatch).toHaveBeenCalledWith("m1", "rahul", "ravi"),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("adds the player who really played to the squad when they are not in it", async () => {
    vi.mocked(createPlayerQuick).mockResolvedValue({
      data: { user_id: "sam", full_name: "Sam Khan" },
      error: null,
    } as never);
    render(<MatchPlayersEditor match={match} />);
    fireEvent.click(screen.getByRole("button", { name: "Replace Dev Patel" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Sam Khan" },
    });
    const add = screen.getByRole("button", { name: /Add .Sam Khan. to Tigers/ });
    await waitFor(() => expect(add).toBeEnabled());
    fireEvent.click(add);
    await waitFor(() =>
      expect(createPlayerQuick).toHaveBeenCalledWith("t2", "Sam Khan", "m1"),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Replace" }));
    await waitFor(() =>
      expect(replacePlayerInMatch).toHaveBeenCalledWith("m1", "dev", "sam"),
    );
  });

  it("finds the squad player by @username and says which one they are", async () => {
    render(<MatchPlayersEditor match={match} />);
    fireEvent.click(screen.getByRole("button", { name: "Replace Rahul Sharma" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "@ravi_k" },
    });
    const row = screen.getByRole("radio", { name: /Ravi Kumar/ });
    expect(row).toHaveTextContent("@ravi_k");
    // A username finds a player; it is not a new player's name.
    await screen.findByRole("status");
    expect(screen.queryByRole("button", { name: /Add .@ravi_k./ })).toBeNull();
  });

  it("lists a squad player the search found even if the row has no username", async () => {
    vi.mocked(lookUpPlayers).mockResolvedValue({
      players: [{ id: "ravi", name: "Ravi Kumar", username: "another_handle" }],
      more: false,
    });
    render(<MatchPlayersEditor match={match} />);
    fireEvent.click(screen.getByRole("button", { name: "Replace Rahul Sharma" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "@another_handle" },
    });
    expect(
      await screen.findByRole("radio", { name: /Ravi Kumar/ }),
    ).toBeInTheDocument();
  });

  it("says why someone already in the match cannot replace, instead of hiding them", async () => {
    vi.mocked(lookUpPlayers).mockResolvedValue({
      players: [{ id: "dev", name: "Dev Patel", username: "dev", matches: 9 }],
      more: false,
    });
    render(<MatchPlayersEditor match={match} />);
    fireEvent.click(screen.getByRole("button", { name: "Replace Rahul Sharma" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Dev" },
    });
    const found = await screen.findByRole("button", { name: /^Dev Patel/ });
    expect(found).toBeDisabled();
    expect(found).toHaveTextContent("Already in this match");
    expect(addExistingPlayerQuick).not.toHaveBeenCalled();
  });

  it("says why a replacement was refused, and Cancel closes the choice", async () => {
    vi.mocked(replacePlayerInMatch).mockResolvedValue({
      success: false,
      error: "Add the player to the team's squad first.",
    });
    render(<MatchPlayersEditor match={match} />);
    fireEvent.click(screen.getByRole("button", { name: "Replace Rahul Sharma" }));
    fireEvent.click(screen.getByRole("radio", { name: /Ravi Kumar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Add the player to the team's squad first.",
    );
    // Cancel is disabled while the request is in flight: wait for it.
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toBeEnabled());
    fireEvent.click(cancel);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});
