import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMatchScorers } from "~/app/matches/mutations";
import { MatchMoreMenu } from "./match-more-menu";
import { mistakeMessage, namesList } from "./report-mistake-dialog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("~/app/matches/mutations", () => ({
  deleteMatch: vi.fn(),
  getMatchScorers: vi.fn(),
}));
vi.mock("~/app/matches/reschedule", () => ({ rescheduleMatch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("~/lib/auth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
let isAdmin: boolean | undefined = false;
vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useMatchAdminQuery: () => ({ data: isAdmin }),
  useCanDeleteMatchQuery: () => ({ data: false }),
  useCanProduceOverlayQuery: () => ({ data: false }),
  useMatchClubChoices: () => ({ choosable: [], offer: false }),
}));
vi.mock("~/app/matches/club", () => ({ setMatchClub: vi.fn() }));

const finished = { id: "m1", title: "Lions vs Tigers", status: "completed" };

function openMenu() {
  fireEvent.pointerDown(
    screen.getByRole("button", { name: "More match actions" }),
    { button: 0, ctrlKey: false },
  );
}

describe("Something wrong? on a finished match", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin = false;
  });

  it("names the scorers to a viewer and gives the message to send them", async () => {
    vi.mocked(getMatchScorers).mockResolvedValue({
      data: {
        createdBy: { id: "k", full_name: "Karan", avatar_url: null },
        matchAdmins: [{ id: "r", full_name: "Ravi", avatar_url: null }],
      },
      error: null,
    });
    render(<MatchMoreMenu match={finished} />);
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Something wrong?" }));
    expect(
      await screen.findByText(/only this match's scorers can correct its scorecard: Karan and Ravi/i),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Message a scorer on WhatsApp/ });
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain(
      "Something looks wrong in the scorecard of Lions vs Tigers",
    );
  });

  it("takes a scorer to the Balls view to fix it instead", async () => {
    isAdmin = true;
    render(<MatchMoreMenu match={finished} />);
    openMenu();
    const fix = await screen.findByRole("menuitem", { name: "Fix a mistake" });
    expect(fix.closest("a") ?? fix).toHaveAttribute("href", "/matches/m1/score?tab=balls");
    expect(screen.queryByRole("menuitem", { name: "Something wrong?" })).toBeNull();
  });

  it("is not offered before the match is over", async () => {
    render(<MatchMoreMenu match={{ ...finished, status: "live" }} />);
    openMenu();
    await screen.findByRole("menuitem", { name: "Stream this match" });
    expect(screen.queryByRole("menuitem", { name: "Something wrong?" })).toBeNull();
  });
});

describe("report helpers", () => {
  it("lists names the way a sentence does", () => {
    expect(namesList(["Karan"])).toBe("Karan");
    expect(namesList(["Karan", "Ravi", "Amol"])).toBe("Karan, Ravi and Amol");
  });

  it("asks which ball or player, with the scorecard's link", () => {
    expect(mistakeMessage("Lions vs Tigers", "https://x/m")).toMatch(
      /Lions vs Tigers on CricScore: \(say which ball or player\) https:\/\/x\/m$/,
    );
  });
});
