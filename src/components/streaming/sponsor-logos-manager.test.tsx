import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const uploadSponsorLogo = vi.fn(async (_form: FormData) => ({
  data: [],
  error: null,
}));
vi.mock("~/app/overlay/sponsor-actions", () => ({
  getSponsorLogos: vi.fn(async () => ({ data: [], error: null })),
  saveSponsorLogos: vi.fn(),
  deleteSponsorLogo: vi.fn(),
  uploadSponsorLogo: (form: FormData) => uploadSponsorLogo(form),
}));
vi.mock("~/lib/image-resize", () => ({
  LOGO_MAX_PX: 512,
  resizeImageFile: vi.fn(),
}));

import { resizeImageFile } from "~/lib/image-resize";
import { SponsorLogosManager } from "./sponsor-logos-manager";

async function uploadLogo(file: File) {
  render(<SponsorLogosManager scope="club" scopeId="c1" />);
  fireEvent.change(screen.getByLabelText(/^Logo/), {
    target: { files: [file] },
  });
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Smith Builders" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Add|Upload/ }));
  await waitFor(() => expect(uploadSponsorLogo).toHaveBeenCalled());
  return uploadSponsorLogo.mock.calls[0]![0].get("file") as File;
}

describe("SponsorLogosManager", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scales a raster logo down before uploading it", async () => {
    const photo = new File([new Uint8Array(900_000)], "logo.png", {
      type: "image/png",
    });
    const small = new File([new Uint8Array(20_000)], "logo.webp", {
      type: "image/webp",
    });
    vi.mocked(resizeImageFile).mockResolvedValueOnce(small);
    expect(await uploadLogo(photo)).toBe(small);
    expect(resizeImageFile).toHaveBeenCalledWith(photo, 512);
  });

  it("sends an SVG as it is", async () => {
    const svg = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
    expect(await uploadLogo(svg)).toBe(svg);
    expect(resizeImageFile).not.toHaveBeenCalled();
  });
});
