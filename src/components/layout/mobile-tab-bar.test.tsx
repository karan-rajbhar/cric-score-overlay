import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileTabBar } from "./mobile-tab-bar";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

const mockUseAuth = vi.fn();
vi.mock("~/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const TABS = ["Home", "Matches", "Clubs", "Tournaments", "More"];
const lit = () =>
  screen
    .getAllByRole("link")
    .filter((l) => l.getAttribute("aria-current") === "page")
    .map((l) => l.textContent);

describe("MobileTabBar", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null });
  });

  it("has five labelled tabs, every one a link to a place", () => {
    mockUsePathname.mockReturnValue("/matches/abc");
    render(<MobileTabBar />);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(TABS);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: "Clubs" })).toHaveAttribute(
      "href",
      "/clubs",
    );
    expect(screen.getByRole("link", { name: "More" })).toHaveAttribute(
      "href",
      "/more",
    );
  });

  it.each([
    ["/", "Home"],
    ["/dashboard", "Home"],
    ["/matches/abc", "Matches"],
    ["/clubs", "Clubs"],
    ["/clubs/abc", "Clubs"],
    ["/teams", "More"],
    ["/teams/abc", "More"],
    ["/players", "More"],
    ["/players/@rahul", "More"],
    ["/tournaments/abc", "Tournaments"],
    ["/more", "More"],
    ["/invitations", "More"],
  ])("on %s lights %s, and only that", (path, tab) => {
    mockUsePathname.mockReturnValue(path);
    render(<MobileTabBar />);
    expect(lit()).toEqual([tab]);
  });

  it("sends signed-in people to their own home", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    mockUseAuth.mockReturnValue({ user: { uid: "u1" } });
    render(<MobileTabBar />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});
