import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ClubSettingsDialog } from "./club-settings-dialog";
import { updateClub, updateClubSocialLinks } from "~/app/clubs/actions";
import { toast } from "sonner";

vi.mock("~/app/clubs/actions", () => ({
  updateClub: vi.fn(),
  updateClubSocialLinks: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ClubSettingsDialog Component", () => {
  const mockClub = {
    id: "club-99",
    name: "Surrey County CC",
    short_name: "SUR",
    location: "The Oval, London",
    description: "Historic cricket club",
    contact_email: "info@surrey.test",
    contact_phone: "+44 20 7820 5757",
    website_url: "https://surreycricket.com",
    club_type: "professional",
    founded_year: 1845,
    is_public: true,
    social_links: {
      twitter: "@surreycricket",
      instagram: "@surreycricket",
      youtube: "surreycricket",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Club Settings trigger button", () => {
    render(<ClubSettingsDialog club={mockClub} />);
    expect(
      screen.getByRole("button", { name: /club settings/i })
    ).toBeInTheDocument();
  });

  it("opens modal dialog and populates current club data", () => {
    render(<ClubSettingsDialog club={mockClub} />);
    fireEvent.click(screen.getByRole("button", { name: /club settings/i }));

    expect(
      screen.getByRole("heading", { name: /club settings & profile/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/club name \*/i)).toHaveValue("Surrey County CC");
    expect(screen.getByLabelText(/short name/i)).toHaveValue("SUR");
    expect(screen.getByLabelText(/home ground \/ location/i)).toHaveValue(
      "The Oval, London"
    );
    expect(screen.getByLabelText(/contact email/i)).toHaveValue("info@surrey.test");
  });

  it("submits updated form data and handles success", async () => {
    vi.mocked(updateClub).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(updateClubSocialLinks).mockResolvedValueOnce({ success: true } as never);

    render(<ClubSettingsDialog club={mockClub} />);
    fireEvent.click(screen.getByRole("button", { name: /club settings/i }));

    fireEvent.change(screen.getByLabelText(/club name \*/i), {
      target: { value: "Surrey Cricket Club" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateClub).toHaveBeenCalledWith("club-99", expect.any(FormData));
      expect(updateClubSocialLinks).toHaveBeenCalledWith(
        "club-99",
        expect.objectContaining({
          twitter: "@surreycricket",
        })
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Club profile & settings updated!"
      );
    });
  });

  it("handles server error when updateClub fails", async () => {
    vi.mocked(updateClub).mockResolvedValueOnce({
      error: "Permission denied",
    } as never);

    render(<ClubSettingsDialog club={mockClub} />);
    fireEvent.click(screen.getByRole("button", { name: /club settings/i }));

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Permission denied");
    });
  });
});
