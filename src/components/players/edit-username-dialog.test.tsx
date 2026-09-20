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

  it("renders trigger button with current handle info", () => {
    render(<EditUsernameDialog currentUsername="karan" />);
    expect(screen.getByRole("button", { name: /Edit Handle/i })).toBeInTheDocument();
  });

  it("opens dialog when trigger button is clicked", () => {
    render(<EditUsernameDialog currentUsername="karan" />);
    fireEvent.click(screen.getByRole("button", { name: /Edit Handle/i }));
    expect(screen.getByText(/Claim Your Unique Handle/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("karan")).toBeInTheDocument();
  });

  it("calls checkUsernameAvailability when user types a new handle", async () => {
    vi.mocked(actions.checkUsernameAvailability).mockResolvedValueOnce({
      available: true,
      cleanUsername: "karan_cricketer",
    });

    render(<EditUsernameDialog currentUsername="karan" />);
    fireEvent.click(screen.getByRole("button", { name: /Edit Handle/i }));

    const input = screen.getByDisplayValue("karan");
    fireEvent.change(input, { target: { value: "karan_cricketer" } });

    await waitFor(() => {
      expect(actions.checkUsernameAvailability).toHaveBeenCalledWith("karan_cricketer");
    });
  });
});
