import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClubMediaDialog } from "./club-media-dialog";
import * as clubActions from "~/app/clubs/actions";
import * as imageResize from "~/lib/image-resize";

vi.mock("~/app/clubs/actions", () => ({
  updateClubLogo: vi.fn(),
  removeClubLogo: vi.fn(),
  updateClubBanner: vi.fn(),
  removeClubBanner: vi.fn(),
}));

// jsdom cannot decode images: by default the file goes up as picked.
vi.mock("~/lib/image-resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/image-resize")>()),
  resizeImageFile: vi.fn(async (file: File) => file),
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

    expect(screen.getByText("Club branding & media")).toBeInTheDocument();
    expect(screen.getByText(/Club Emblem \/ Logo/i)).toBeInTheDocument();
    expect(screen.getByText(/Club hero banner/i)).toBeInTheDocument();
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

describe("ClubMediaDialog uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads the banner scaled down to 1600 px", async () => {
    const scaled = new File(["small"], "banner.webp", { type: "image/webp" });
    vi.mocked(imageResize.resizeImageFile).mockResolvedValueOnce(scaled);
    vi.mocked(clubActions.updateClubBanner).mockResolvedValueOnce({
      data: "https://example.com/banner.webp",
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
    const picked = new File(["big"], "banner.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("club-banner-input"), {
      target: { files: [picked] },
    });

    await waitFor(() => {
      expect(clubActions.updateClubBanner).toHaveBeenCalledWith(
        "club-1",
        scaled,
      );
    });
    expect(imageResize.resizeImageFile).toHaveBeenCalledWith(
      picked,
      imageResize.BANNER_MAX_PX,
    );
  });
});
