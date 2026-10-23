import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterTeamDialog } from "./register-team-dialog";
import { getRegistrableTeams } from "~/app/tournaments/actions";

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
});

vi.mock("~/app/tournaments/actions", () => ({
  getRegistrableTeams: vi.fn(),
  registerTeamForTournament: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("RegisterTeamDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads an organiser's team list only when the dialog opens", async () => {
    vi.mocked(getRegistrableTeams).mockResolvedValue({
      data: [
        { id: "t1", name: "Lions", short_name: "LIO" },
        { id: "t2", name: "Tigers", short_name: null },
      ],
      error: null,
    });
    render(
      <RegisterTeamDialog
        tournamentId="tour-1"
        registeredTeamIds={["t2"]}
        isOrganiser
      />,
    );
    expect(getRegistrableTeams).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /register team/i }));
    await waitFor(() =>
      expect(screen.getByLabelText("Select team")).toBeInTheDocument(),
    );
    expect(getRegistrableTeams).toHaveBeenCalledTimes(1);
    expect(getRegistrableTeams).toHaveBeenCalledWith("tour-1");
  });

  it("uses the teams it is given without reading any", () => {
    render(
      <RegisterTeamDialog
        tournamentId="tour-1"
        availableTeams={[{ id: "t1", name: "Lions", short_name: null }]}
        registeredTeamIds={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /register team/i }));
    expect(screen.getByLabelText("Select team")).toBeInTheDocument();
    expect(getRegistrableTeams).not.toHaveBeenCalled();
  });
});
