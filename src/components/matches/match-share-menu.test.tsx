import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMatch } from "~/test/factories";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
const image = vi.hoisted(() => ({ prepare: vi.fn(), share: vi.fn() }));
vi.mock("./use-match-share", () => ({
  useMatchShare: () => ({ ...image, busy: false }),
}));

import { MatchShareMenu } from "./match-share-menu";

describe("MatchShareMenu", () => {
  beforeEach(() => vi.clearAllMocks());

  const open = () => {
    render(<MatchShareMenu match={makeMatch()} title="A vs B" />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Share" }), {
      button: 0,
      ctrlKey: false,
    });
  };

  it("holds the link, the image and the report behind one button", async () => {
    open();
    for (const name of ["Share link", "Share image", "Match report"]) {
      expect(
        await screen.findByRole("menuitem", { name }),
      ).toBeInTheDocument();
    }
    // The data file is in the ⋯ menu.
    expect(screen.queryByRole("menuitem", { name: /cricsheet/i })).toBeNull();
  });

  it("starts the image when it opens, ready for the tap", () => {
    open();
    expect(image.prepare).toHaveBeenCalled();
  });

  it("shares the image", async () => {
    open();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Share image" }));
    expect(image.share).toHaveBeenCalled();
  });

  it("opens the report in a new tab", async () => {
    const opened = vi.spyOn(window, "open").mockReturnValue({} as Window);
    open();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Match report" }));
    expect(opened.mock.calls[0]?.[0]).toBe("/matches/m1/report");
    opened.mockRestore();
  });
});
