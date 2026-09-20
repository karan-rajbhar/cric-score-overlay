import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppShell, useSidebar } from "./app-shell";
import { useSidebarStore } from "~/lib/stores/useSidebarStore";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("~/components/navigation-bar", () => ({
  NavigationBar: () => <nav data-testid="mock-nav-bar">Mock NavigationBar</nav>,
}));

vi.mock("~/components/layout/app-sidebar", () => ({
  AppSidebar: () => <aside data-testid="mock-sidebar">Mock AppSidebar</aside>,
}));

describe("AppShell Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSidebarStore.setState({ collapsed: false, mobileOpen: false });
  });

  it("exports useSidebar referencing useSidebarStore", () => {
    expect(useSidebar).toBe(useSidebarStore);
  });

  it("renders pure overlay container without navigation or footer for /overlay routes", () => {
    mockUsePathname.mockReturnValue("/overlay/match-123");

    render(
      <AppShell>
        <div data-testid="overlay-child">Live Stream Overlay</div>
      </AppShell>
    );

    expect(screen.getByTestId("overlay-child")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-nav-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it("renders standard shell with navbar, sidebar, content, and footer for regular pages", () => {
    mockUsePathname.mockReturnValue("/matches");

    render(
      <AppShell>
        <div data-testid="page-child">Match Center</div>
      </AppShell>
    );

    expect(screen.getByTestId("mock-nav-bar")).toBeInTheDocument();
    expect(screen.getByTestId("mock-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("page-child")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();

    const footerNav = screen.getByRole("navigation", { name: "Footer" });
    expect(footerNav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Matches" })).toHaveAttribute("href", "/matches");
    expect(screen.getByRole("link", { name: "Tournaments" })).toHaveAttribute("href", "/tournaments");
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
  });

  it("applies expanded sidebar padding (260px) when collapsed is false", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    useSidebarStore.setState({ collapsed: false });

    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const main = container.querySelector("main");
    expect(main).toHaveClass("md:pl-[260px]");
    expect(main).not.toHaveClass("md:pl-[72px]");

    const footer = container.querySelector("footer");
    expect(footer).toHaveClass("md:pl-[260px]");
  });

  it("applies collapsed sidebar padding (72px) when collapsed is true", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    useSidebarStore.setState({ collapsed: true });

    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const main = container.querySelector("main");
    expect(main).toHaveClass("md:pl-[72px]");
    expect(main).not.toHaveClass("md:pl-[260px]");

    const footer = container.querySelector("footer");
    expect(footer).toHaveClass("md:pl-[72px]");
  });
});
