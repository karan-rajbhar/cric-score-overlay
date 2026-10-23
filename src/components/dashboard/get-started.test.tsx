import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OnboardingProgress } from "~/app/dashboard/onboarding";
import { GetStarted, getStartedKey } from "./get-started";

const getOnboardingProgress = vi.fn<() => Promise<OnboardingProgress | null>>();
vi.mock("~/app/dashboard/actions", () => ({
  getOnboardingProgress: () => getOnboardingProgress(),
}));

const empty: OnboardingProgress = {
  teamId: null,
  hasPlayers: false,
  matchId: null,
  hasCoScorer: false,
};

describe("GetStarted", () => {
  beforeEach(() => {
    localStorage.clear();
    getOnboardingProgress.mockReset();
  });

  it("lists the steps for a new user, linking the next ones", async () => {
    getOnboardingProgress.mockResolvedValue({ ...empty, teamId: "t1" });
    render(<GetStarted userId="u1" />);
    expect(
      await screen.findByRole("heading", { name: "Get started" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 of 4/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add players/i })).toHaveAttribute(
      "href",
      "/teams/t1?tab=squad",
    );
    expect(
      screen.getByRole("link", { name: /create a match/i }),
    ).toHaveAttribute("href", "/matches/create");
    // Done steps and steps that need an earlier one are not links.
    expect(screen.queryByRole("link", { name: /create a team/i })).toBeNull();
    expect(
      screen.queryByRole("link", { name: /invite a co-scorer/i }),
    ).toBeNull();
  });

  it("remembers dismissal and then skips the request", async () => {
    getOnboardingProgress.mockResolvedValue(empty);
    const user = userEvent.setup();
    const { unmount } = render(<GetStarted userId="u1" />);
    await user.click(
      await screen.findByRole("button", { name: /dismiss get started/i }),
    );
    expect(screen.queryByRole("heading", { name: "Get started" })).toBeNull();
    expect(localStorage.getItem(getStartedKey("u1"))).toBe("dismissed");
    unmount();

    getOnboardingProgress.mockClear();
    render(<GetStarted userId="u1" />);
    expect(getOnboardingProgress).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Get started" })).toBeNull();
  });

  it("stays hidden once the required steps are done", async () => {
    getOnboardingProgress.mockResolvedValue({
      teamId: "t1",
      hasPlayers: true,
      matchId: "m1",
      hasCoScorer: false,
    });
    render(<GetStarted userId="u2" />);
    await waitFor(() =>
      expect(localStorage.getItem(getStartedKey("u2"))).toBe("done"),
    );
    expect(screen.queryByRole("heading", { name: "Get started" })).toBeNull();
  });
});
