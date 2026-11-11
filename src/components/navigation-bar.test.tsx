import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NavigationBar } from "./navigation-bar";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => window.location.pathname,
}));

const mockUseAuth = vi.fn();
const mockSignOut = vi.fn();

vi.mock("~/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("~/app/invitations/actions", () => ({
  inviteToApp: vi.fn(),
}));

vi.mock("~/lib/firebase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { username: "karan_scorer" } }),
        }),
      }),
    }),
  }),
}));

const mockToggleCollapsed = vi.fn();
const mockToggleMobile = vi.fn();

vi.mock("~/lib/stores/useSidebarStore", () => ({
  useSidebarStore: () => ({
    collapsed: false,
    narrowOpen: false,
    toggleCollapsed: mockToggleCollapsed,
    toggleMobile: mockToggleMobile,
  }),
  sidebarModeOf: () => "auto",
  useSidebarExpanded: () => true,
}));

describe("NavigationBar Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Brand and unauthenticated buttons when user is logged out", () => {
    window.history.replaceState(null, "", "/matches/m1?tab=scorecard");
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: mockSignOut,
    });

    render(<NavigationBar />);

    expect(screen.getByText("CricScore")).toBeInTheDocument();
    // Signing in comes back to the page on screen (N31).
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      `/auth/login?redirect=${encodeURIComponent("/matches/m1?tab=scorecard")}`,
    );
    // Invite-only: there is no sign-up link.
    expect(screen.queryByRole("link", { name: /get started|join/i })).not.toBeInTheDocument();
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
    // The same avatar as Home and More: the full name's initials (N22).
    expect(screen.getByRole("button", { name: /user menu/i })).toHaveTextContent(
      "KS",
    );
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

  it("toggles the sidebar from its button and from Ctrl+B, as its title says", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: mockSignOut,
    });

    render(<NavigationBar />);

    expect(
      screen.queryByRole("button", { name: /open navigation drawer/i }),
    ).not.toBeInTheDocument();

    const desktopCollapseBtn = screen.getByRole("button", {
      name: /toggle sidebar/i,
    });
    // It says whether the sidebar is open, and which one (N26).
    expect(desktopCollapseBtn).toHaveAttribute("aria-expanded", "true");
    expect(desktopCollapseBtn).toHaveAttribute("aria-controls", "app-sidebar");
    expect(screen.getByRole("banner")).toContainElement(desktopCollapseBtn);
    fireEvent.click(desktopCollapseBtn);
    expect(mockToggleCollapsed).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(mockToggleCollapsed).toHaveBeenCalledTimes(2);
  });
});
