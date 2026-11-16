import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateTeam } from "~/app/teams/actions";
import { setTeamClub } from "~/app/clubs/club-teams";
import { EditTeamDialog } from "./edit-team-dialog";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("~/app/teams/actions", () => ({
  updateTeam: vi.fn(),
  updateTeamLogo: vi.fn(),
  removeTeamLogo: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("~/app/clubs/club-teams", () => ({ setTeamClub: vi.fn() }));

const team = {
  id: "t1",
  name: "Lions",
  short_name: "LIO",
  description: null,
  logo_url: null,
  primary_color: null,
  secondary_color: null,
};

function open() {
  render(<EditTeamDialog team={team} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit team" }));
  return screen.getByRole("dialog");
}

describe("EditTeamDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the name, short name and chosen colours", async () => {
    vi.mocked(updateTeam).mockResolvedValue({ error: null });
    const dialog = open();
    fireEvent.change(within(dialog).getByLabelText("Team name"), {
      target: { value: "Mumbai Lions" },
    });
    const primary = within(dialog).getByRole("radiogroup", {
      name: "Primary colour",
    });
    fireEvent.click(within(primary).getByRole("radio", { name: /navy/i }));
    expect(within(primary).getByRole("radio", { name: /navy/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.change(
      within(dialog).getByLabelText("Secondary colour, hex code"),
      { target: { value: "#FACC15" } },
    );
    expect(
      within(dialog).getByRole("img", { name: /preview: lio/i }),
    ).toHaveTextContent("LIO");

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(updateTeam).toHaveBeenCalledWith("t1", {
        name: "Mumbai Lions",
        shortName: "LIO",
        description: "",
        primaryColor: "#1e3a8a",
        secondaryColor: "#FACC15",
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("warns, without blocking, when text would be hard to read", async () => {
    vi.mocked(updateTeam).mockResolvedValue({ error: null });
    const dialog = open();
    const primary = within(dialog).getByRole("radiogroup", {
      name: "Primary colour",
    });
    fireEvent.click(within(primary).getByRole("radio", { name: /yellow/i }));
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      /White text is hard to read on this colour/,
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateTeam).toHaveBeenCalled());
  });

  it("refuses a malformed hex code before sending", () => {
    const dialog = open();
    fireEvent.change(within(dialog).getByLabelText("Primary colour, hex code"), {
      target: { value: "blue" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Team colours must look like #1a2b3c",
    );
    expect(updateTeam).not.toHaveBeenCalled();
  });

  it("shows the server's refusal and a network failure", async () => {
    vi.mocked(updateTeam).mockResolvedValueOnce({
      error: "Only the team's creator, captain, vice-captain or a club admin can edit it",
    });
    const dialog = open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /can edit it/,
    );
    vi.mocked(updateTeam).mockRejectedValueOnce(new TypeError("fetch"));
    // The transition may still be settling: wait for Save to come back.
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Save" })).toBeEnabled(),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await within(dialog).findByText(
        "Could not reach the server. Try again.",
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
  });
});

describe("EditTeamDialog and the club", () => {
  it("takes the team out of its club after asking", async () => {
    vi.mocked(setTeamClub).mockResolvedValue({ error: null });
    render(<EditTeamDialog team={{ ...team, club: { id: "c1", name: "Unity CC" } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit team" }));
    expect(screen.getByText(/Plays for/)).toHaveTextContent("Plays for Unity CC");
    fireEvent.click(screen.getByRole("button", { name: "Take out of the club" }));
    fireEvent.click(await screen.findByRole("button", { name: "Take out" }));
    await waitFor(() => expect(setTeamClub).toHaveBeenCalledWith("t1", null));
  });

  it("offers nothing for a team in no club", () => {
    const dialog = open();
    expect(within(dialog).queryByRole("button", { name: "Take out of the club" })).toBeNull();
  });
});
