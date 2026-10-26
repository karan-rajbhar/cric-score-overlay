import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditProfileDialog } from "./edit-profile-dialog";
import * as actions from "~/app/players/actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("~/app/players/actions", () => ({
  updateProfile: vi.fn(),
}));

describe("EditProfileDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps Save disabled until something changes", () => {
    render(<EditProfileDialog currentName="Karan R" current={{}} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit profile/i }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves the trimmed name and location", async () => {
    vi.mocked(actions.updateProfile).mockResolvedValue({ success: true });
    render(
      <EditProfileDialog
        currentName="Karan R"
        current={{ batting_hand: "left" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Edit profile/i }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "  Karan   Rajbhar " },
    });
    fireEvent.change(screen.getByLabelText("Location"), {
      target: { value: "Pune" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(actions.updateProfile).toHaveBeenCalledWith({
        full_name: "Karan Rajbhar",
        location: "Pune",
        playing_role: "",
        batting_hand: "left",
        bowling_style: "",
      }),
    );
  });
});
