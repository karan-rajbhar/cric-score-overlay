import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SeasonDialog } from "./season-dialog";
import { createSeason } from "~/app/clubs/actions";
import { toast } from "sonner";

vi.mock("~/app/clubs/actions", () => ({
  createSeason: vi.fn(),
  deleteSeason: vi.fn(),
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

  it("renders the Seasons button", () => {
    render(<SeasonDialog clubId="club-100" />);

    expect(screen.getByRole("button", { name: "Seasons" })).toBeInTheDocument();
  });

  it("opens modal dialog when trigger button is clicked", () => {
    render(<SeasonDialog clubId="club-100" />);

    fireEvent.click(screen.getByRole("button", { name: "Seasons" }));

    expect(screen.getByRole("heading", { name: "Seasons" })).toBeInTheDocument();
    expect(screen.getByLabelText(/season name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/make it the current season/i)).toBeChecked();
  });

  it("validates that season name is not empty", async () => {
    render(<SeasonDialog clubId="club-100" />);

    fireEvent.click(screen.getByRole("button", { name: "Seasons" }));
    fireEvent.click(screen.getByRole("button", { name: "Add season" }));

    expect(toast.error).toHaveBeenCalledWith("Please enter a season name");
    expect(createSeason).not.toHaveBeenCalled();
  });

  it("submits form data to createSeason and handles success", async () => {
    vi.mocked(createSeason).mockResolvedValueOnce({ success: true } as never);

    render(<SeasonDialog clubId="club-100" />);

    fireEvent.click(screen.getByRole("button", { name: "Seasons" }));

    const nameInput = screen.getByLabelText(/season name/i);
    const startInput = screen.getByLabelText(/start date/i);
    const endInput = screen.getByLabelText(/end date/i);
    const currentCheckbox = screen.getByLabelText(/make it the current season/i);

    fireEvent.change(nameInput, { target: { value: "Premier League 2026" } });
    fireEvent.change(startInput, { target: { value: "2026-05-01" } });
    fireEvent.change(endInput, { target: { value: "2026-09-30" } });
    fireEvent.click(currentCheckbox); // toggles to false

    fireEvent.click(screen.getByRole("button", { name: "Add season" }));

    await waitFor(() => {
      expect(createSeason).toHaveBeenCalledWith(
        "club-100",
        "Premier League 2026",
        "2026-05-01",
        "2026-09-30",
        false
      );
      expect(toast.success).toHaveBeenCalledWith("Created season Premier League 2026");
    });
  });

  it("handles server action error during season creation", async () => {
    vi.mocked(createSeason).mockResolvedValueOnce({ error: "Season already exists" } as never);

    render(<SeasonDialog clubId="club-100" />);

    fireEvent.click(screen.getByRole("button", { name: "Seasons" }));
    fireEvent.change(screen.getByLabelText(/season name/i), { target: { value: "Duplicate Season" } });
    fireEvent.click(screen.getByRole("button", { name: "Add season" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Season already exists");
    });
  });

  it("handles unexpected thrown errors gracefully", async () => {
    vi.mocked(createSeason).mockRejectedValueOnce(new Error("Database crash"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<SeasonDialog clubId="club-100" />);

    fireEvent.click(screen.getByRole("button", { name: "Seasons" }));
    fireEvent.change(screen.getByLabelText(/season name/i), { target: { value: "Error Season" } });
    fireEvent.click(screen.getByRole("button", { name: "Add season" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to create season");
    });
    consoleSpy.mockRestore();
  });

  it("lists the seasons, each past one with a 44px delete (T5)", () => {
    render(
      <SeasonDialog
        clubId="club-100"
        seasons={[
          { id: "s1", name: "2024 Championship", is_current: true },
          { id: "s2", name: "2023 Summer League", is_current: false },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Seasons" }));
    const list = screen.getByRole("list", { name: "Seasons" });
    expect(list).toHaveTextContent("2024 ChampionshipCurrent");
    expect(
      screen.queryByRole("button", { name: "Delete the season 2024 Championship" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Delete the season 2023 Summer League" }),
    ).toHaveClass("h-11", "w-11");
  });
});
