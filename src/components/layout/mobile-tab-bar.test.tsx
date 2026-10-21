import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileTabBar } from "./mobile-tab-bar";
import { useSidebarStore } from "~/lib/stores/useSidebarStore";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

const mockUseAuth = vi.fn();
vi.mock("~/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("MobileTabBar", () => {
  beforeEach(() => {
    useSidebarStore.setState({ collapsed: false, mobileOpen: false });
    mockUseAuth.mockReturnValue({ user: null });
  });

  it("marks the current section and keeps a label on every tab", () => {
    mockUsePathname.mockReturnValue("/matches/abc");
    render(<MobileTabBar />);
    expect(screen.getByRole("link", { name: "Matches" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
    for (const name of ["Tournaments", "Search"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("sends signed-in people home to their dashboard", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    mockUseAuth.mockReturnValue({ user: { uid: "u1" } });
    render(<MobileTabBar />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens and closes the drawer from More", () => {
    mockUsePathname.mockReturnValue("/");
    render(<MobileTabBar />);
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(useSidebarStore.getState().mobileOpen).toBe(true);
    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(useSidebarStore.getState().mobileOpen).toBe(false);
  });
});
