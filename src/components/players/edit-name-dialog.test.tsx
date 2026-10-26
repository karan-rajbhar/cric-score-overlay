import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditNameDialog } from "./edit-name-dialog";
import * as actions from "~/app/players/actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("~/app/players/actions", () => ({
  updateFullName: vi.fn(),
}));

describe("EditNameDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps Save disabled until the name changes", () => {
    render(<EditNameDialog currentName="Karan R" />);
    fireEvent.click(screen.getByRole("button", { name: /Edit name/i }));
    expect(screen.getByRole("button", { name: /Save name/i })).toBeDisabled();
  });

  it("saves the trimmed name", async () => {
    vi.mocked(actions.updateFullName).mockResolvedValue({
      success: true,
      fullName: "Karan Rajbhar",
    });
    render(<EditNameDialog currentName="Karan R" />);
    fireEvent.click(screen.getByRole("button", { name: /Edit name/i }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "  Karan   Rajbhar " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save name/i }));
    await waitFor(() =>
      expect(actions.updateFullName).toHaveBeenCalledWith("Karan Rajbhar"),
    );
  });
});
