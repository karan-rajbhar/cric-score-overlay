import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const mockUseAuth = vi.fn();
vi.mock("~/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useMatchesQuery: () => ({ data: [], isLoading: false }),
}));

describe("HomePage hero actions", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("shows neither Sign in nor New match while auth is resolving", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(<HomePage />);
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("link", { name: "New match" })).toBeNull();
    expect(screen.getAllByTestId("hero-action-loading")).toHaveLength(2);
  });

  it("shows New match for a signed-in user", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, loading: false });
    render(<HomePage />);
    expect(screen.getByRole("link", { name: "New match" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("shows Sign in once auth is known to be signed out", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<HomePage />);
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});
