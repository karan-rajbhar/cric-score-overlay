import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarStore } from "~/lib/stores/useSidebarStore";
import { AppSidebar } from "./app-sidebar";

const usePathname = vi.fn();
const useAuth = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));
vi.mock("~/lib/auth", () => ({ useAuth: () => useAuth() }));

const link = (name: string) => screen.getByRole("link", { name });

describe("AppSidebar", () => {
  beforeEach(() => {
    useSidebarStore.setState({ collapsed: false });
    usePathname.mockReturnValue("/matches");
    useAuth.mockReturnValue({ user: { id: "u1" } });
  });

  it("calls the signed-in home Home, and leads to it", () => {
    render(<AppSidebar />);
    expect(link("Home")).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByText("Dashboard")).toBeNull();
  });

  it("sends a visitor to the landing page and hides New match", () => {
    useAuth.mockReturnValue({ user: null });
    render(<AppSidebar />);
    expect(link("Home")).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "New match" })).toBeNull();
  });

  it("has no demo overlay link and no second way to Search", () => {
    render(<AppSidebar />);
    expect(screen.queryByText("Stream overlays")).toBeNull();
    expect(screen.queryByRole("link", { name: "Search" })).toBeNull();
  });

  it("lights the current page and only that", () => {
    usePathname.mockReturnValue("/matches/create");
    render(<AppSidebar />);
    expect(link("New match")).toHaveAttribute("aria-current", "page");
    expect(link("Matches")).not.toHaveAttribute("aria-current");
  });
});
