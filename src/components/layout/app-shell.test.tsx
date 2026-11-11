import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppShell } from "./app-shell";
import { useSidebarStore } from "~/lib/stores/useSidebarStore";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("~/components/navigation-bar", () => ({
  NavigationBar: () => <nav data-testid="mock-nav-bar">Mock NavigationBar</nav>,
}));

vi.mock("~/components/layout/mobile-tab-bar", () => ({
  MobileTabBar: () => <nav data-testid="mock-tab-bar">Mock MobileTabBar</nav>,
}));

vi.mock("~/components/layout/app-sidebar", () => ({
  AppSidebar: () => <aside data-testid="mock-sidebar">Mock AppSidebar</aside>,
}));

describe("AppShell Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSidebarStore.setState({ collapsed: false });
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

  it("renders dedicated scoring container without navigation, sidebar, or footer for /matches/.../score routes", () => {
    mockUsePathname.mockReturnValue("/matches/match-123/score");

    render(
      <AppShell>
        <div data-testid="scoring-child">Live Scoring Cockpit</div>
      </AppShell>
    );

    expect(screen.getByTestId("scoring-child")).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: "Clubs" })).toHaveAttribute("href", "/clubs");
  });

  it("starts with a link past the navigation to the page (N26)", () => {
    mockUsePathname.mockReturnValue("/matches");
    const { container } = render(
      <AppShell>
        <div>Match Center</div>
      </AppShell>,
    );
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(container.querySelector("a, button")).toBe(skip);
    expect(skip).toHaveAttribute("href", "#content");
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "content");
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("leaves the rail's room on tablets and the full sidebar's from lg when not collapsed (N5)", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    useSidebarStore.setState({ collapsed: false, narrowOpen: false });

    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const main = container.querySelector("main");
    expect(main).toHaveClass("md:pl-[72px]", "lg:pl-[260px]");
    expect(main).not.toHaveClass("md:pl-[260px]");

    const footer = container.querySelector("footer");
    expect(footer).toHaveClass("lg:pl-[260px]");
  });

  it("leaves the full sidebar's room from md when opened on a tablet", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    useSidebarStore.setState({ collapsed: false, narrowOpen: true });
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );
    expect(container.querySelector("main")).toHaveClass("md:pl-[260px]");
    useSidebarStore.setState({ narrowOpen: false });
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
