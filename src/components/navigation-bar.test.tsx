import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NavigationBar } from "./navigation-bar";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockUseAuth = vi.fn();
const mockSignOut = vi.fn();

vi.mock("~/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockToggleCollapsed = vi.fn();
const mockToggleMobile = vi.fn();

vi.mock("~/components/layout/app-shell", () => ({
  useSidebar: () => ({
    isCollapsed: false,
    isMobileOpen: false,
    toggleCollapsed: mockToggleCollapsed,
    toggleMobile: mockToggleMobile,
  }),
}));

describe("NavigationBar Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Brand and unauthenticated buttons when user is logged out", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: mockSignOut,
    });

    render(<NavigationBar />);

    expect(screen.getByText("CricScore")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get started|join/i })).toBeInTheDocument();
  });

  it("renders authenticated controls and user menu when user is logged in", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "usr-1",
        email: "scorer@cricscore.test",
        user_metadata: { full_name: "Karan Scorer" },
      },
      loading: false,
      signOut: mockSignOut,
    });

    render(<NavigationBar />);

    expect(screen.getByRole("button", { name: /create/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /user menu/i })).toBeInTheDocument();
    expect(screen.getByText("K")).toBeInTheDocument(); // Avatar initial
  });

  it("triggers search navigation on query submission", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: mockSignOut,
    });

    render(<NavigationBar />);

    const searchInput = screen.getByPlaceholderText(/search matches/i);
    fireEvent.change(searchInput, { target: { value: "Ashes Cup" } });
    fireEvent.submit(searchInput.closest("form")!);

    expect(mockPush).toHaveBeenCalledWith("/search?q=Ashes%20Cup");
  });

  it("calls sidebar toggles when desktop and mobile menu triggers are clicked", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: mockSignOut,
    });

    render(<NavigationBar />);

    const mobileMenuBtn = screen.getByRole("button", {
      name: /open navigation drawer/i,
    });
    fireEvent.click(mobileMenuBtn);
    expect(mockToggleMobile).toHaveBeenCalledTimes(1);

    const desktopCollapseBtn = screen.getByRole("button", {
      name: /toggle sidebar/i,
    });
    fireEvent.click(desktopCollapseBtn);
    expect(mockToggleCollapsed).toHaveBeenCalledTimes(1);
  });
});
