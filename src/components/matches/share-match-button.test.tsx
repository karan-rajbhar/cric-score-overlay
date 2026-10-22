import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareMatchButton } from "./share-match-button";

const url = `${window.location.origin}/matches/m1`;

function setNavigator(key: "share" | "clipboard", value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true });
}

describe("ShareMatchButton", () => {
  afterEach(() => {
    setNavigator("share", undefined);
    setNavigator("clipboard", undefined);
    vi.restoreAllMocks();
  });

  it("uses the system share sheet when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator("share", share);
    render(<ShareMatchButton matchId="m1" title="A vs B" />);
    fireEvent.click(screen.getByRole("button", { name: "Share link" }));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({ title: "A vs B", url }),
    );
  });

  it("copies the link otherwise", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator("clipboard", { writeText });
    render(<ShareMatchButton matchId="m1" title="A vs B" />);
    fireEvent.click(screen.getByRole("button", { name: "Share link" }));
    expect(
      await screen.findByRole("button", { name: "Link copied" }),
    ).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it("falls back to WhatsApp when copying fails", async () => {
    setNavigator("clipboard", {
      writeText: vi.fn().mockRejectedValue(new Error("denied")),
    });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<ShareMatchButton matchId="m1" title="A vs B" />);
    fireEvent.click(screen.getByRole("button", { name: "Share link" }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(open.mock.calls[0]![0]).toBe(
      `https://wa.me/?text=${encodeURIComponent(`A vs B\n${url}`)}`,
    );
  });

  it("sends the score with the link when given a message", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator("share", share);
    render(
      <ShareMatchButton
        matchId="m1"
        title="A vs B"
        text={"A vs B · Live\nA 85/3 (10.2 ov)"}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Share link" }));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: "A vs B",
        text: "A vs B · Live\nA 85/3 (10.2 ov)",
        url,
      }),
    );
  });
});
