import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("~/app/matches/club", () => ({ setMatchClub: vi.fn() }));
/** Players who have played for the club before. */
const known = new Set(["l1", "l2"]);
vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useClubRecordsQuery: (clubId: string, ids: string[]) => ({
    data: clubId ? ids.some((id) => known.has(id)) : undefined,
  }),
}));

import { setMatchClub } from "~/app/matches/club";
import type { MyClub } from "~/app/matches/club-data";
import { MatchClubDialog, type MatchClubDialogMatch } from "./match-club-dialog";

const match: MatchClubDialogMatch = {
  id: "m1",
  club_id: null,
  team1: {
    id: "A",
    name: "Lions",
    team_players: [{ user_id: "l1" }, { user_id: "l2" }],
  },
  team2: {
    id: "B",
    name: "Tigers",
    team_players: [{ user_id: "t1" }, { user_id: "t2" }],
  },
};
const riverside: MyClub = { id: "c1", name: "Riverside CC", role: "member" };

function open(m: MatchClubDialogMatch, clubs: MyClub[]) {
  const onSaved = vi.fn();
  render(
    <MatchClubDialog
      open
      onOpenChange={vi.fn()}
      match={m}
      clubs={clubs}
      onSaved={onSaved}
    />,
  );
  return onSaved;
}

const sides = () =>
  screen.getByRole("group", { name: "Whose stats count for Riverside CC?" });

describe("Add to club", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setMatchClub).mockResolvedValue({ error: null });
  });

  it("counts only the side that has played for the club, against an outside team", async () => {
    const onSaved = open(match, [riverside]);
    // The only club: nothing to choose, it is named in the title.
    expect(
      screen.getByRole("heading", { name: "Add to Riverside CC" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Riverside CC" })).toBeNull();
    expect(
      within(sides()).getByRole("radio", { name: /only lions/i }),
    ).toBeChecked();
    expect(sides()).toHaveTextContent(
      "The other team, Tigers, is from outside the club. Its players keep their own stats.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Add to Riverside CC" }));
    await waitFor(() =>
      expect(setMatchClub).toHaveBeenCalledWith("m1", "c1", "team1"),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("lets you count both teams instead", async () => {
    open(match, [riverside]);
    fireEvent.click(within(sides()).getByRole("radio", { name: /both teams/i }));
    fireEvent.click(screen.getByRole("button", { name: "Add to Riverside CC" }));
    await waitFor(() =>
      expect(setMatchClub).toHaveBeenCalledWith("m1", "c1", "both"),
    );
  });

  it("counts both teams when both have played for the club", () => {
    open(
      {
        ...match,
        team2: { ...match.team2, team_players: [{ user_id: "l2" }] },
      },
      [riverside],
    );
    expect(
      within(sides()).getByRole("radio", { name: /both teams/i }),
    ).toBeChecked();
  });

  it("asks which club when there are several", () => {
    open(match, [riverside, { id: "c2", name: "Hill CC", role: "admin" }]);
    expect(screen.queryByRole("group", { name: /whose stats/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Add to club" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Riverside CC" }));
    expect(sides()).toBeInTheDocument();
  });

  it("takes a match out of its club", async () => {
    open({ ...match, club_id: "c1", club_side: "team1" }, [riverside]);
    expect(
      within(sides()).getByRole("radio", { name: /only lions/i }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /no club/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Remove from Riverside CC" }),
    );
    await waitFor(() =>
      expect(setMatchClub).toHaveBeenCalledWith("m1", null, "both"),
    );
  });

  it("shows the server's refusal", async () => {
    vi.mocked(setMatchClub).mockResolvedValue({ error: "Not allowed" });
    open(match, [riverside]);
    fireEvent.click(screen.getByRole("button", { name: "Add to Riverside CC" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not allowed");
  });

  it("tells a scorer without a club how to add the match", () => {
    open(match, []);
    expect(
      screen.getByText(/only members of a club can add matches to it/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find your club" })).toHaveAttribute(
      "href",
      "/clubs",
    );
  });
});
