import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditUsernameDialog } from "./edit-username-dialog";
import * as actions from "~/app/players/actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("~/app/players/actions", () => ({
  checkUsernameAvailability: vi.fn(),
  updateUsername: vi.fn(),
}));

describe("EditUsernameDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers to change the username", () => {
    render(<EditUsernameDialog currentUsername="karan" />);
    expect(screen.getByRole("button", { name: "Change username" })).toBeInTheDocument();
  });

  it("opens dialog when trigger button is clicked", () => {
    render(<EditUsernameDialog currentUsername="karan" />);
    fireEvent.click(screen.getByRole("button", { name: "Change username" }));
    // Called "username" throughout, never "handle" (P9).
    expect(
      screen.getByRole("dialog", { name: "Change username" }),
    ).not.toHaveTextContent(/handle/i);
    expect(screen.getByLabelText("Username")).toHaveValue("karan");
  });

  it("checks a new username as it is typed", async () => {
    vi.mocked(actions.checkUsernameAvailability).mockResolvedValueOnce({
      available: true,
      cleanUsername: "karan_cricketer",
    });

    render(<EditUsernameDialog currentUsername="karan" />);
    fireEvent.click(screen.getByRole("button", { name: "Change username" }));

    const input = screen.getByDisplayValue("karan");
    fireEvent.change(input, { target: { value: "karan_cricketer" } });

    await waitFor(() => {
      expect(actions.checkUsernameAvailability).toHaveBeenCalledWith("karan_cricketer");
    });
  });
});
