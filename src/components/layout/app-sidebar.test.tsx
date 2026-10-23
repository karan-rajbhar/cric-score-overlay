import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarStore } from "~/lib/stores/useSidebarStore";
import { AppSidebar } from "./app-sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("~/lib/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("~/components/layout/drawer-account", () => ({
  DrawerAccount: () => <a href="/auth/login">Sign in</a>,
  DrawerActions: () => null,
  DrawerFooter: () => null,
}));

describe("phone drawer", () => {
  beforeEach(() => {
    useSidebarStore.setState({ collapsed: false, mobileOpen: false });
  });

  it("is a labelled modal dialog that takes focus and closes on Escape", () => {
    render(<AppSidebar />);
    expect(screen.queryByRole("dialog")).toBeNull();

    useSidebarStore.setState({ mobileOpen: true });
    render(<AppSidebar />);
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(useSidebarStore.getState().mobileOpen).toBe(false);
  });

  it("closes from its close button", () => {
    useSidebarStore.setState({ mobileOpen: true });
    render(<AppSidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(useSidebarStore.getState().mobileOpen).toBe(false);
  });
});
