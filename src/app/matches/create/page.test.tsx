import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => search,
}));
vi.mock("~/lib/auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
const TEAMS: Record<string, unknown>[] = [
  { id: "t1", name: "Lions", short_name: "LIO", created_by: "u1", player_count: 12 },
  { id: "t2", name: "Tigers", short_name: "TIG", created_by: "u1", player_count: 11 },
  { id: "t3", name: "Hawks", short_name: "HAW", created_by: "u1", player_count: 0 },
  { id: "t9", name: "Strangers", created_by: "someone-else" },
];
const wizard = {
  teams: [...TEAMS],
  tournaments: [] as Record<string, unknown>[],
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
  useMatchWizardScopeQuery: () => ({ data: undefined }),
  useClubRecordsQuery: (clubId: string, ids: string[]) => ({
    data: clubId && ids.length ? ids.some((id) => knownToClub.has(id)) : undefined,
  }),
}));
/** Players who have played in the club (`hasClubRecords`). */
let knownToClub = new Set<string>();
vi.mock("../mutations", () => ({ createMatch: vi.fn() }));
vi.mock("../../teams/actions", () => ({
  createTeamQuick: vi.fn(),
  createPlayerQuick: vi.fn(),
  addExistingPlayerQuick: vi.fn(),
}));
vi.mock("~/lib/player-lookup", () => ({ lookUpPlayers: vi.fn() }));

import CreateMatchPage from "./page";
import { createMatch } from "../mutations";
import {
  addExistingPlayerQuick,
  createPlayerQuick,
  createTeamQuick,
} from "../../teams/actions";
import { lookUpPlayers } from "~/lib/player-lookup";
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
    search = new URLSearchParams();
    wizard.tournaments = [];
    wizard.clubs = [];
    wizard.clubAdminIds = [];
    wizard.teams = [...TEAMS];
    knownToClub = new Set();
    vi.mocked(lookUpPlayers).mockResolvedValue({ players: [], more: false });
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

  it("keeps the form when the server cannot be reached, and lets you retry", async () => {
    vi.mocked(createMatch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<CreateMatchPage />);
    chooseTeam(/your team/i, "Lions");
    chooseTeam(/opponent/i, "Tigers");
    fireEvent.click(startButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server. Try again.",
    );
    expect(startButton()).toBeEnabled();
    expect(screen.getByRole("button", { name: /your team/i })).toHaveTextContent(
      "Lions",
    );

    vi.mocked(createMatch).mockResolvedValueOnce({
      data: { id: "m3" },
      error: null,
    } as never);
    fireEvent.click(startButton());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/matches/m3/score"));
  });

  it("says so when a new team or player cannot reach the server", async () => {
    vi.mocked(createTeamQuick).mockRejectedValueOnce(new TypeError("fetch"));
    vi.mocked(createPlayerQuick).mockRejectedValueOnce(new TypeError("fetch"));
    render(<CreateMatchPage />);

    fireEvent.click(screen.getByRole("button", { name: /opponent/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /new team/i }));
    fireEvent.change(within(dialog).getByLabelText("Team name"), {
      target: { value: "Rivals" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create team" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Could not reach the server. Try again.",
    );
    expect(
      within(dialog).getByRole("button", { name: "Create team" }),
    ).toBeEnabled();
    fireEvent.keyDown(dialog, { key: "Escape" });

    chooseTeam(/opponent/i, "Hawks");
    fireEvent.click(screen.getByRole("button", { name: "Add players to Hawks" }));
    const input = screen.getByLabelText("Add a player to Hawks");
    fireEvent.change(input, { target: { value: "Ravi" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server. Try again.",
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("explains that a friendly lists only your own teams", () => {
    render(<CreateMatchPage />);
    fireEvent.click(screen.getByRole("button", { name: /opponent/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Search teams"), {
      target: { value: "Strangers" },
    });
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "No team matches",
    );
    expect(dialog).toHaveTextContent(/A friendly lists only your own teams/);
  });

  it("starts a tournament match with the tournament's overs and wickets", () => {
    wizard.tournaments = [
      {
        id: "tour",
        name: "Sixteen Cup",
        match_format: "Custom",
        overs_per_innings: 16,
        wickets_per_innings: 8,
        created_by: "u1",
      },
    ];
    search = new URLSearchParams("tournamentId=tour");
    render(<CreateMatchPage />);
    expect(screen.getByLabelText("Overs per side")).toHaveValue(16);
    expect(screen.getByRole("radio", { name: "Custom" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: /more options/i }));
    expect(screen.getByLabelText("Wickets per side")).toHaveValue(8);
  });

  describe("a club match", () => {
    const clubMatch = () => {
      wizard.clubs = [{ id: "c1", name: "Riverside CC" }] as never;
      wizard.clubAdminIds = ["c1"] as never;
      search = new URLSearchParams("clubId=c1");
      vi.mocked(createMatch).mockResolvedValue({
        data: { id: "m1" },
        error: null,
      } as never);
      render(<CreateMatchPage />);
      chooseTeam(/your team/i, "Lions");
      chooseTeam(/opponent/i, "Tigers");
    };
    const question = () =>
      screen.getByRole("group", { name: "Whose stats count for Riverside CC?" });
    const answer = (name: RegExp) =>
      within(question()).getByRole("radio", { name });

    it("asks whose stats count, the same way as everywhere else, and counts both teams by default", async () => {
      clubMatch();
      expect(answer(/both teams/i)).toBeChecked();
      expect(question()).toHaveTextContent(
        "Everyone's stats count: both teams are club players.",
      );
      fireEvent.click(startButton());
      await waitFor(() => expect(createMatch).toHaveBeenCalled());
      expect(vi.mocked(createMatch).mock.calls[0]![0]).toMatchObject({
        clubId: "c1",
        clubSide: "both",
      });
    });

    it("counts only your team against an outside team", async () => {
      clubMatch();
      fireEvent.click(answer(/only lions/i));
      expect(answer(/only lions/i)).toBeChecked();
      expect(question()).toHaveTextContent(
        "The other team, Tigers, is from outside the club. Its players keep their own stats.",
      );
      fireEvent.click(startButton());
      await waitFor(() => expect(createMatch).toHaveBeenCalled());
      expect(vi.mocked(createMatch).mock.calls[0]![0]).toMatchObject({
        clubSide: "team1",
      });
    });

    it("suggests only your team when none of the opponent's players has played for the club", () => {
      knownToClub = new Set(["l1"]);
      wizard.teams = wizard.teams.map((t) =>
        t.id === "t1"
          ? { ...t, player_ids: ["l1", "l2"] }
          : t.id === "t2"
            ? { ...t, player_ids: ["x1", "x2"] }
            : t,
      );
      clubMatch();
      expect(answer(/only lions/i)).toBeChecked();
      // The suggestion can be undone.
      fireEvent.click(answer(/both teams/i));
      expect(answer(/both teams/i)).toBeChecked();
    });

    it("makes no guess for a club nobody has played for yet", () => {
      wizard.teams = wizard.teams.map((t) =>
        t.id === "t2" ? { ...t, player_ids: ["x1", "x2"] } : t,
      );
      clubMatch();
      expect(answer(/both teams/i)).toBeChecked();
    });
  });

  describe("adding players by name", () => {
    const rahul = {
      id: "u-rahul",
      name: "Rahul Sharma",
      username: null,
      matches: 42,
    };
    const openHawks = () => {
      render(<CreateMatchPage />);
      chooseTeam(/opponent/i, "Hawks");
      fireEvent.click(
        screen.getByRole("button", { name: "Add players to Hawks" }),
      );
      return screen.getByLabelText("Add a player to Hawks");
    };

    it("offers the existing player instead of adding them twice", async () => {
      vi.mocked(lookUpPlayers).mockResolvedValue({
        players: [rahul],
        more: false,
      });
      vi.mocked(addExistingPlayerQuick).mockResolvedValue({
        data: { user_id: "u-rahul", full_name: "Rahul Sharma" },
        error: null,
      } as never);
      const input = openHawks();
      fireEvent.change(input, { target: { value: "rahul" } });
      // Enter before the suggestions show: it looks first, adds nobody.
      fireEvent.keyDown(input, { key: "Enter" });
      const pick = await screen.findByRole("button", {
        name: /Add Rahul Sharma/,
      });
      expect(pick).toHaveTextContent("42 matches");
      expect(createPlayerQuick).not.toHaveBeenCalled();

      fireEvent.click(pick);
      await waitFor(() =>
        expect(addExistingPlayerQuick).toHaveBeenCalledWith("t3", "u-rahul"),
      );
      expect(await screen.findByText(/Added: Rahul Sharma/)).toHaveTextContent(
        "1 player in the squad",
      );
    });

    it("offers people from your teams first, with their team, without guessing", async () => {
      wizard.teams = wizard.teams.map((t) =>
        t.id === "t1"
          ? {
              ...t,
              player_ids: ["u-rahul"],
              players: [{ id: "u-rahul", name: "Rahul Sharma" }],
            }
          : t,
      );
      // Someone else of that name elsewhere on CricScore.
      vi.mocked(lookUpPlayers).mockResolvedValue({
        players: [rahul, { ...rahul, id: "u-other", matches: 3 }],
        more: false,
      });
      const input = openHawks();
      fireEvent.change(input, { target: { value: "rah" } });
      const ours = within(
        screen.getByRole("group", { name: "From your teams" }),
      ).getByRole("button", { name: /Add Rahul Sharma/ });
      expect(ours).toHaveTextContent("Plays for Lions");
      fireEvent.keyDown(input, { key: "Enter" });
      expect(createPlayerQuick).not.toHaveBeenCalled();
      // The stranger is listed apart, with a warning, and not twice.
      const others = await screen.findByRole("group", {
        name: "Other players on CricScore",
      });
      expect(others).toHaveTextContent(/only if you know it's the same person/);
      expect(within(others).getAllByRole("button")).toHaveLength(1);
      expect(others).toHaveTextContent("3 matches");
    });

    it("looks up other CricScore players only from three letters", async () => {
      const input = openHawks();
      fireEvent.change(input, { target: { value: "ra" } });
      await new Promise((r) => setTimeout(r, 400));
      expect(lookUpPlayers).not.toHaveBeenCalled();
      fireEvent.change(input, { target: { value: "rah" } });
      await waitFor(() =>
        expect(lookUpPlayers).toHaveBeenCalledWith("rah", undefined),
      );
    });

    it("adds nobody on a guess when the search fails, and adding new stays a tap away", async () => {
      vi.mocked(lookUpPlayers).mockRejectedValue(new Error("offline"));
      vi.mocked(createPlayerQuick).mockResolvedValue({
        data: { user_id: "p2", full_name: "Rahul" },
        error: null,
      } as never);
      const input = openHawks();
      fireEvent.change(input, { target: { value: "Rahul" } });
      fireEvent.keyDown(input, { key: "Enter" });
      await screen.findByText(/Could not check whether “Rahul”/);
      expect(createPlayerQuick).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", { name: "Add “Rahul” as a new player" }),
      );
      await waitFor(() =>
        expect(createPlayerQuick).toHaveBeenCalledWith("t3", "Rahul"),
      );
    });

    it("does not make a player of a @username nobody has", async () => {
      const input = openHawks();
      fireEvent.change(input, { target: { value: "@rahul_s" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(
        await screen.findByText(/Nobody has the username @rahul_s/),
      ).toBeInTheDocument();
      expect(createPlayerQuick).not.toHaveBeenCalled();
    });

    it("still adds a different person of the same name as a new player", async () => {
      vi.mocked(lookUpPlayers).mockResolvedValue({
        players: [rahul],
        more: false,
      });
      vi.mocked(createPlayerQuick).mockResolvedValue({
        data: { user_id: "p2", full_name: "Rahul" },
        error: null,
      } as never);
      const input = openHawks();
      fireEvent.change(input, { target: { value: "Rahul" } });
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Add “Rahul” as a new player",
        }),
      );
      await waitFor(() =>
        expect(createPlayerQuick).toHaveBeenCalledWith("t3", "Rahul"),
      );
    });
  });
});
