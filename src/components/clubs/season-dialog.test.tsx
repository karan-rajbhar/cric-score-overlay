import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SeasonDialog } from "./season-dialog";
import { createSeason } from "~/app/clubs/actions";
import { toast } from "sonner";

vi.mock("~/app/clubs/actions", () => ({
  createSeason: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SeasonDialog Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders New Season trigger button", () => {
    render(<SeasonDialog clubId="club-100" />);

    expect(screen.getByRole("button", { name: /new season/i })).toBeInTheDocument();
  });

  it("opens modal dialog when trigger button is clicked", () => {
    render(<SeasonDialog clubId="club-100" />);

    fireEvent.click(screen.getByRole("button", { name: /new season/i }));

    expect(screen.getByRole("heading", { name: /create club season/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/season name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/set as current active season/i)).toBeChecked();
  });

  it("validates that season name is not empty", async () => {
    render(<SeasonDialog clubId="club-100" />);

    fireEvent.click(screen.getByRole("button", { name: /new season/i }));
    fireEvent.click(screen.getByRole("button", { name: /create season/i }));

    expect(toast.error).toHaveBeenCalledWith("Please enter a season name");
    expect(createSeason).not.toHaveBeenCalled();
  });

  it("submits form data to createSeason and handles success", async () => {
    vi.mocked(createSeason).mockResolvedValueOnce({ success: true } as never);

    render(<SeasonDialog clubId="club-100" />);

    fireEvent.click(screen.getByRole("button", { name: /new season/i }));

    const nameInput = screen.getByLabelText(/season name/i);
    const startInput = screen.getByLabelText(/start date/i);
    const endInput = screen.getByLabelText(/end date/i);
    const currentCheckbox = screen.getByLabelText(/set as current active season/i);

    fireEvent.change(nameInput, { target: { value: "Premier League 2026" } });
    fireEvent.change(startInput, { target: { value: "2026-05-01" } });
    fireEvent.change(endInput, { target: { value: "2026-09-30" } });
    fireEvent.click(currentCheckbox); // toggles to false

    fireEvent.click(screen.getByRole("button", { name: /create season/i }));

    await waitFor(() => {
      expect(createSeason).toHaveBeenCalledWith(
        "club-100",
        "Premier League 2026",
        "2026-05-01",
        "2026-09-30",
        false
      );
      expect(toast.success).toHaveBeenCalledWith("Created season Premier League 2026!");
    });
  });

  it("handles server action error during season creation", async () => {
    vi.mocked(createSeason).mockResolvedValueOnce({ error: "Season already exists" } as never);

    render(<SeasonDialog clubId="club-100" />);

    fireEvent.click(screen.getByRole("button", { name: /new season/i }));
    fireEvent.change(screen.getByLabelText(/season name/i), { target: { value: "Duplicate Season" } });
    fireEvent.click(screen.getByRole("button", { name: /create season/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Season already exists");
    });
  });

  it("handles unexpected thrown errors gracefully", async () => {
    vi.mocked(createSeason).mockRejectedValueOnce(new Error("Database crash"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<SeasonDialog clubId="club-100" />);

    fireEvent.click(screen.getByRole("button", { name: /new season/i }));
    fireEvent.change(screen.getByLabelText(/season name/i), { target: { value: "Error Season" } });
    fireEvent.click(screen.getByRole("button", { name: /create season/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to create season");
    });
    consoleSpy.mockRestore();
  });
});
