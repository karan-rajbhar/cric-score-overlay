import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("~/lib/auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
const wizard = {
  teams: [
    { id: "t1", name: "Lions", short_name: "LIO", created_by: "u1", player_count: 12 },
    { id: "t2", name: "Tigers", short_name: "TIG", created_by: "u1", player_count: 11 },
    { id: "t3", name: "Hawks", short_name: "HAW", created_by: "u1", player_count: 0 },
    { id: "t9", name: "Strangers", created_by: "someone-else" },
  ],
  tournaments: [],
  clubs: [],
  playerTeamIds: [],
  clubAdminIds: [],
  error: null,
};
vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useMatchWizardDataQuery: () => ({
    data: wizard,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useTournamentRegistrationsQuery: () => ({ data: undefined }),
}));
vi.mock("../mutations", () => ({ createMatch: vi.fn() }));
vi.mock("../../teams/actions", () => ({
  createTeamQuick: vi.fn(),
  createPlayerQuick: vi.fn(),
}));

import CreateMatchPage from "./page";
import { createMatch } from "../mutations";
import { createPlayerQuick, createTeamQuick } from "../../teams/actions";
import { SETUP_STORAGE_KEY } from "./match-setup";

const startButton = () => screen.getByRole("button", { name: "Start match" });

function chooseTeam(label: RegExp, teamName: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(teamName) }));
}

describe("New match form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("starts on T20 with a reason why it cannot start yet", () => {
    render(<CreateMatchPage />);
    expect(screen.getByRole("radio", { name: "T20" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Overs per side")).toHaveValue(20);
    expect(screen.getByRole("radio", { name: "Start now" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(startButton()).toBeDisabled();
    expect(startButton()).toHaveAccessibleDescription("Choose your team");
  });

  it("fills overs from a preset and switches to Custom when edited", () => {
    render(<CreateMatchPage />);
    fireEvent.click(screen.getByRole("radio", { name: "T10" }));
    expect(screen.getByLabelText("Overs per side")).toHaveValue(10);
    fireEvent.change(screen.getByLabelText("Overs per side"), {
      target: { value: "16" },
    });
    expect(screen.getByRole("radio", { name: "Custom" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.change(screen.getByLabelText("Overs per side"), {
      target: { value: "0" },
    });
    expect(screen.getByLabelText("Overs per side")).toHaveAccessibleDescription(
      "Overs must be between 1 and 50",
    );
  });

  it("creates the match from two existing teams and opens scoring", async () => {
    vi.mocked(createMatch).mockResolvedValue({
      data: { id: "m1" },
      error: null,
    } as never);
    render(<CreateMatchPage />);

    chooseTeam(/your team/i, "Lions");
    expect(startButton()).toHaveAccessibleDescription("Choose the opponent");
    // Only teams the user may pick are offered.
    fireEvent.click(screen.getByRole("button", { name: /opponent/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("Strangers")).toBeNull();
    expect(within(dialog).queryByText("Lions")).toBeNull();
    fireEvent.change(within(dialog).getByLabelText("Search teams"), {
      target: { value: "tig" },
    });
    fireEvent.keyDown(within(dialog).getByLabelText("Search teams"), {
      key: "Enter",
    });

    expect(startButton()).toBeEnabled();
    fireEvent.click(startButton());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/matches/m1/score"));
    const args = vi.mocked(createMatch).mock.calls[0]![0];
    expect(args).toMatchObject({
      title: "Lions vs Tigers",
      matchFormat: "T20",
      oversPerInnings: 20,
      wicketsPerInnings: 10,
      ballsPerOver: 6,
      team1Id: "t1",
      team2Id: "t2",
    });
    expect(Number.isNaN(Date.parse(args.scheduledAt!))).toBe(false);

    // The next match remembers the host and lists recent teams first.
    const stored = JSON.parse(window.localStorage.getItem(SETUP_STORAGE_KEY)!);
    expect(stored).toMatchObject({ lastTeam1Id: "t1", recentTeamIds: ["t1", "t2"] });
  });

  it("remembers the last format and host team", () => {
    window.localStorage.setItem(
      SETUP_STORAGE_KEY,
      JSON.stringify({
        matchFormat: "ODI",
        oversPerInnings: 50,
        lastTeam1Id: "t1",
        recentTeamIds: ["t1", "t3"],
      }),
    );
    render(<CreateMatchPage />);
    expect(screen.getByRole("radio", { name: "ODI" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("button", { name: /your team/i })).toHaveTextContent(
      "Lions",
    );
    fireEvent.click(screen.getByRole("button", { name: /opponent/i }));
    const recent = within(screen.getByRole("dialog")).getByRole("group", {
      name: "Recent",
    });
    expect(recent).toHaveTextContent("Hawks");
  });

  it("creates an opponent inline with a short name and selects it", async () => {
    vi.mocked(createTeamQuick).mockResolvedValue({
      data: { id: "new", name: "Rivals", short_name: "RIV", club_id: null },
      error: null,
    } as never);
    render(<CreateMatchPage />);
    fireEvent.click(screen.getByRole("button", { name: /opponent/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Search teams"), {
      target: { value: "Rivals" },
    });
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "No team matches",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: /new team/i }));
    expect(within(dialog).getByLabelText("Team name")).toHaveValue("Rivals");
    expect(within(dialog).getByLabelText("Short name")).toHaveValue("RIV");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create team" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /opponent/i })).toHaveTextContent(
        "Rivals",
      ),
    );
    expect(createTeamQuick).toHaveBeenCalledWith("Rivals", "RIV");
    expect(screen.getByText(/No players yet/)).toBeInTheDocument();
  });

  it("shows the server's message when a new team cannot be created", async () => {
    vi.mocked(createTeamQuick).mockResolvedValue({
      data: null,
      error: "Team name already taken",
    } as never);
    render(<CreateMatchPage />);
    fireEvent.click(screen.getByRole("button", { name: /opponent/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /new team/i }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create team" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter a team name");
    expect(createTeamQuick).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("Team name"), {
      target: { value: "Lions" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create team" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Team name already taken",
    );
  });

  it("adds players to a team with an empty squad without leaving the form", async () => {
    vi.mocked(createPlayerQuick).mockResolvedValue({
      data: { user_id: "p1", full_name: "Ravi" },
      error: null,
    } as never);
    render(<CreateMatchPage />);
    chooseTeam(/opponent/i, "Hawks");
    fireEvent.click(screen.getByRole("button", { name: "Add players to Hawks" }));
    const input = screen.getByLabelText("Add a player to Hawks");
    fireEvent.change(input, { target: { value: "Ravi" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(createPlayerQuick).toHaveBeenCalledWith("t3", "Ravi"),
    );
    expect(await screen.findByText(/Added: Ravi/)).toHaveTextContent(
      "1 player in the squad",
    );
  });

  it("schedules for later only once a date is set", async () => {
    vi.mocked(createMatch).mockResolvedValue({
      data: { id: "m2" },
      error: null,
    } as never);
    render(<CreateMatchPage />);
    chooseTeam(/your team/i, "Lions");
    chooseTeam(/opponent/i, "Tigers");
    fireEvent.click(screen.getByRole("radio", { name: "Schedule" }));
    const button = screen.getByRole("button", { name: "Schedule match" });
    expect(button).toHaveAccessibleDescription("Pick a date and time");
    fireEvent.change(screen.getByLabelText("Date and time"), {
      target: { value: "2026-10-20T15:30" },
    });
    fireEvent.click(button);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/matches/m2"));
    expect(vi.mocked(createMatch).mock.calls[0]![0].scheduledAt).toBe(
      new Date("2026-10-20T15:30").toISOString(),
    );
  });

  it("keeps the form and shows the error when creation fails", async () => {
    vi.mocked(createMatch).mockResolvedValue({
      data: null,
      error: "You do not have permission",
    } as never);
    render(<CreateMatchPage />);
    chooseTeam(/your team/i, "Lions");
    chooseTeam(/opponent/i, "Tigers");
    fireEvent.click(startButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You do not have permission",
    );
    expect(push).not.toHaveBeenCalled();
    expect(startButton()).toBeEnabled();
  });

  it("keeps optional details behind More options", () => {
    render(<CreateMatchPage />);
    const toggle = screen.getByRole("button", { name: /more options/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Venue")).not.toBeVisible();
    fireEvent.click(toggle);
    expect(screen.getByLabelText("Venue")).toBeVisible();
    expect(screen.getByLabelText("Balls per over")).toHaveValue(6);
  });
});
