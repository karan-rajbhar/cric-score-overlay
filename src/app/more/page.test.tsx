import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuth = vi.fn();
vi.mock("~/lib/auth", () => ({ useAuth: () => useAuth() }));
vi.mock("~/lib/hooks/useAccount", () => ({
  useSignOut: () => ({ signOut: vi.fn(), pending: false }),
  useUsername: () => "rahul",
}));
vi.mock("~/lib/theme-provider", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}));
vi.mock("~/components/pwa/install-app", () => ({ useInstallApp: () => null }));
vi.mock("~/components/follow/push-settings", () => ({
  NotificationSettings: () => null,
}));
vi.mock("~/components/invite-dialog", () => ({ InviteDialog: () => null }));

import MorePage from "./page";

describe("More", () => {
  beforeEach(() => useAuth.mockReset());

  it("offers a visitor Sign in and the theme, nothing that needs an account", () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    render(<MorePage />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/login",
    );
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    expect(screen.queryByText("New match")).toBeNull();
    expect(screen.queryByText("Sign out")).toBeNull();
  });

  it("gives a signed-in user their profile, Create, invites and Sign out", () => {
    useAuth.mockReturnValue({
      user: { id: "u1", user_metadata: { full_name: "Rahul Sharma" } },
      loading: false,
    });
    render(<MorePage />);
    expect(screen.getByRole("link", { name: /Rahul Sharma/ })).toHaveAttribute(
      "href",
      "/players/@rahul",
    );
    for (const name of ["New match", "New team", "New tournament", "New club"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Manage invites" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it.each([
    ["a visitor", null],
    ["a signed-in user", { id: "u1", user_metadata: {} }],
  ])("takes %s to Teams and Players, which have no tab", (_who, user) => {
    useAuth.mockReturnValue({ user, loading: false });
    render(<MorePage />);
    expect(screen.getByRole("link", { name: "Teams" })).toHaveAttribute(
      "href",
      "/teams",
    );
    expect(screen.getByRole("link", { name: "Players" })).toHaveAttribute(
      "href",
      "/players",
    );
  });

  it("repeats no tab, and has the way to Search", () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    render(<MorePage />);
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/search",
    );
    for (const tab of ["Home", "Matches", "Clubs", "Tournaments"]) {
      expect(screen.queryByRole("link", { name: tab })).toBeNull();
    }
  });
});
