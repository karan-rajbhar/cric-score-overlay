import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TournamentManageDialog } from "./tournament-manage-dialog";
import { updateTournament, deleteTournament } from "~/app/tournaments/actions";
import { toast } from "sonner";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("~/app/tournaments/actions", () => ({
  updateTournament: vi.fn(),
  deleteTournament: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("TournamentManageDialog Component", () => {
  const dummyTournament = {
    id: "tourn-1",
    name: "Summer Championship 2026",
    description: "Annual club cup",
    tournament_format: "league",
    match_format: "T20",
    overs_per_innings: 20,
    venue: "Oval Ground",
    start_date: "2026-06-01",
    end_date: "2026-06-15",
    season_id: "season-1",
  };

  const dummySeasons = [
    { id: "season-1", name: "2026 Summer Season" },
    { id: "season-2", name: "2025 Winter Season" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders manage trigger button and opens dialog", () => {
    render(
      <TournamentManageDialog
        tournament={dummyTournament}
        seasons={dummySeasons}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: /manage tournament settings/i,
    });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);

    expect(
      screen.getByRole("heading", {
        name: /manage tournament: summer championship 2026/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/tournament name \*/i)).toHaveValue(
      "Summer Championship 2026",
    );
  });

  it("submits updated details to updateTournament action", async () => {
    vi.mocked(updateTournament).mockResolvedValueOnce({ success: true } as never);

    render(
      <TournamentManageDialog
        tournament={dummyTournament}
        seasons={dummySeasons}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /manage tournament settings/i }),
    );

    const nameInput = screen.getByLabelText(/tournament name \*/i);
    fireEvent.change(nameInput, {
      target: { value: "Updated Summer Cup 2026" },
    });

    const form = screen.getByTestId("tournament-manage-form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(updateTournament).toHaveBeenCalledWith(
        "tourn-1",
        expect.any(FormData),
      );
      expect(toast.success).toHaveBeenCalledWith("Tournament settings saved");
    });
  });

  it("validates that tournament name cannot be empty", async () => {
    render(
      <TournamentManageDialog
        tournament={dummyTournament}
        seasons={dummySeasons}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /manage tournament settings/i }),
    );

    const nameInput = screen.getByLabelText(/tournament name \*/i);
    fireEvent.change(nameInput, { target: { value: "   " } });

    const form = screen.getByTestId("tournament-manage-form");
    fireEvent.submit(form);

    expect(toast.error).toHaveBeenCalledWith("Tournament name is required");
    expect(updateTournament).not.toHaveBeenCalled();
  });

  it("switches to Danger Zone tab and deletes tournament when confirmed", async () => {
    vi.mocked(deleteTournament).mockResolvedValueOnce({ success: true } as never);

    render(
      <TournamentManageDialog
        tournament={dummyTournament}
        seasons={dummySeasons}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /manage tournament settings/i }),
    );

    // Switch to danger zone tab
    const dangerTab = screen.getByRole("tab", { name: /danger zone/i });
    fireEvent.pointerDown(dangerTab, { button: 0, ctrlKey: false });
    fireEvent.click(dangerTab);
    fireEvent.keyDown(dangerTab, { key: "Enter" });
    fireEvent.keyDown(dangerTab, { key: " " });

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /permanently delete tournament/i,
        }),
      ).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", {
      name: /permanently delete tournament/i,
    });
    expect(deleteBtn).toBeDisabled();

    // Type the confirmation tournament name
    const confirmInput = screen.getByLabelText(/type .* to confirm:/i);
    fireEvent.change(confirmInput, {
      target: { value: "Summer Championship 2026" },
    });

    expect(deleteBtn).not.toBeDisabled();

    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteTournament).toHaveBeenCalledWith("tourn-1");
      expect(toast.success).toHaveBeenCalledWith(
        "Tournament deleted successfully",
      );
    });
  });
});
