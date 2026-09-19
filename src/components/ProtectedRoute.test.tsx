import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProtectedRoute from "./ProtectedRoute";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

const mockUseAuth = vi.fn();
vi.mock("~/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading screen while auth is initializing", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Loading...")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("renders custom loading component when provided", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(
      <ProtectedRoute loadingComponent={<div>Custom Loader</div>}>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Custom Loader")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("redirects unauthenticated user to default /auth/login", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(pushMock).toHaveBeenCalledWith("/auth/login");
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("redirects unauthenticated user to custom redirectTo", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(
      <ProtectedRoute redirectTo="/custom-login">
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(pushMock).toHaveBeenCalledWith("/custom-login");
  });

  it("renders protected content when user is authenticated", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-123" }, loading: false });
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Protected Content")).toBeDefined();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
