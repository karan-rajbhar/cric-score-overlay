import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import { RegisterClubTeamDialog } from "./register-club-team-dialog";
import { registerTeamForTournament } from "~/app/tournaments/actions";
import { toast } from "sonner";

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("~/app/tournaments/actions", () => ({
  registerTeamForTournament: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("RegisterClubTeamDialog Component", () => {
  const dummyTournament = {
    id: "tourn-1",
    name: "Club Super League",
  };

  const dummyClubTeams = [
    { id: "team-1", name: "Lions XI", short_name: "LXI", team_type: "club" },
    { id: "team-2", name: "Tigers XI", short_name: "TXI", team_type: "club" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trigger button and opens dialog", () => {
    render(
      <RegisterClubTeamDialog
        tournament={dummyTournament}
        clubTeams={dummyClubTeams}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: /enrol club squad into club super league/i,
    });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);

    expect(
      screen.getByRole("heading", { name: /enrol squad in tournament/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/club super league/i)).toBeInTheDocument();
  });

  it("shows empty message if all teams are already enrolled", () => {
    render(
      <RegisterClubTeamDialog
        tournament={dummyTournament}
        clubTeams={dummyClubTeams}
        registeredTeamIds={["team-1", "team-2"]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /enrol club squad into club super league/i,
      }),
    );

    expect(
      screen.getByText(
        /all club squads are already enrolled in this tournament\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirm enrolment/i }),
    ).toBeDisabled();
  });

  it("calls registerTeamForTournament and handles success", async () => {
    vi.mocked(registerTeamForTournament).mockResolvedValueOnce({
      success: true,
    } as never);

    render(
      <RegisterClubTeamDialog
        tournament={dummyTournament}
        clubTeams={dummyClubTeams}
        registeredTeamIds={["team-1"]} // team-2 is available
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /enrol club squad into club super league/i,
      }),
    );

    // Click select trigger to open select dropdown
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);

    // In Radix Select, option is rendered with role option
    const option = await screen.findByRole("option", { name: /tigers xi/i });
    fireEvent.click(option);

    const confirmBtn = screen.getByRole("button", {
      name: /confirm enrolment/i,
    });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(registerTeamForTournament).toHaveBeenCalledWith(
        "tourn-1",
        "team-2",
      );
      expect(toast.success).toHaveBeenCalledWith(
        'Enrolled "Tigers XI" into Club Super League!',
      );
    });
  });

  it("handles error response from server action", async () => {
    vi.mocked(registerTeamForTournament).mockResolvedValueOnce({
      error: "Tournament is full",
    } as never);

    render(
      <RegisterClubTeamDialog
        tournament={dummyTournament}
        clubTeams={dummyClubTeams}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /enrol club squad into club super league/i,
      }),
    );

    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);

    const option = await screen.findByRole("option", { name: /lions xi/i });
    fireEvent.click(option);

    const confirmBtn = screen.getByRole("button", {
      name: /confirm enrolment/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Tournament is full");
    });
  });
});
