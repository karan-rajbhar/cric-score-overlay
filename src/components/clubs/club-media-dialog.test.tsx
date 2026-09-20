import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClubMediaDialog } from "./club-media-dialog";
import * as clubActions from "~/app/clubs/actions";

vi.mock("~/app/clubs/actions", () => ({
  updateClubLogo: vi.fn(),
  removeClubLogo: vi.fn(),
  updateClubBanner: vi.fn(),
  removeClubBanner: vi.fn(),
}));

describe("ClubMediaDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trigger and opens dialog on click", async () => {
    render(
      <ClubMediaDialog
        clubId="club-1"
        clubName="Apex Cricket Club"
        shortName="ACC"
      />,
    );

    const trigger = screen.getByRole("button", { name: /branding & media/i });
    expect(trigger).toBeInTheDocument();
    fireEvent.click(trigger);

    expect(screen.getByText("Club Branding & Media")).toBeInTheDocument();
    expect(screen.getByText(/Club Emblem \/ Logo/i)).toBeInTheDocument();
    expect(screen.getByText(/Club Hero Banner/i)).toBeInTheDocument();
  });

  it("triggers logo upload on file selection", async () => {
    vi.mocked(clubActions.updateClubLogo).mockResolvedValueOnce({
      data: "https://example.com/new-logo.png",
      error: null,
    });

    render(
      <ClubMediaDialog
        clubId="club-1"
        clubName="Apex Cricket Club"
        shortName="ACC"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /branding & media/i }));

    const input = screen.getByTestId("club-logo-input");
    const file = new File(["logo-binary"], "logo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(clubActions.updateClubLogo).toHaveBeenCalledWith("club-1", file);
    });
  });

  it("triggers banner removal when clicking remove banner", async () => {
    vi.mocked(clubActions.removeClubBanner).mockResolvedValueOnce({
      success: true,
      error: null,
    });

    render(
      <ClubMediaDialog
        clubId="club-1"
        clubName="Apex Cricket Club"
        shortName="ACC"
        initialBannerUrl="https://example.com/banner.jpg"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /branding & media/i }));

    const removeBannerBtn = screen.getByRole("button", { name: /remove/i });
    fireEvent.click(removeBannerBtn);

    await waitFor(() => {
      expect(clubActions.removeClubBanner).toHaveBeenCalledWith("club-1");
    });
  });
});
