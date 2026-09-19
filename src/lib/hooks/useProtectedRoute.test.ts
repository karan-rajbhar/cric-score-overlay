import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useProtectedRoute } from "./useProtectedRoute";

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

describe("useProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not trigger unauthenticated action when user is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const onUnauthenticated = vi.fn();

    const { result } = renderHook(() =>
      useProtectedRoute({ onUnauthenticated }),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(onUnauthenticated).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("calls onUnauthenticated once when user is not authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const onUnauthenticated = vi.fn();

    renderHook(() => useProtectedRoute({ onUnauthenticated }));

    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("redirects to default login when no onUnauthenticated handler is provided", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    renderHook(() => useProtectedRoute());

    expect(pushMock).toHaveBeenCalledWith("/auth/login");
  });

  it("does not re-trigger when inline onUnauthenticated callback changes reference on rerender", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u-1" }, loading: false });

    const { rerender } = renderHook(() =>
      useProtectedRoute({
        onUnauthenticated: () => {},
      }),
    );

    rerender();
    rerender();

    expect(pushMock).not.toHaveBeenCalled();
  });
});
