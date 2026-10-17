import { afterEach, describe, expect, it, vi } from "vitest";
import {
  liveShareText,
  matchShareUrl,
  matchTitle,
  shareMatch,
  whatsappShareUrl,
} from "./share-match";

function setNavigator(key: "share" | "clipboard", value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true });
}

describe("share messages", () => {
  const live = {
    team1: "Strikers",
    team2: "Warriors",
    battingTeam: "Strikers",
    runs: 85,
    wickets: 3,
    overs: "10.2",
    status: "live",
  };

  it("describes a live match with the current score", () => {
    expect(liveShareText(live)).toBe(
      "Live: Strikers 85/3 (10.2 ov) — Strikers vs Warriors. Follow ball by ball:",
    );
  });

  it("falls back to the match title when not live or no score yet", () => {
    expect(liveShareText({ ...live, status: "completed" })).toBe(
      "Strikers vs Warriors on CricScore:",
    );
    expect(liveShareText({ ...live, runs: null })).toBe(
      "Strikers vs Warriors on CricScore:",
    );
    expect(matchTitle({ team1: "Strikers" })).toBe("Strikers");
    expect(matchTitle({})).toBe("Cricket match");
  });

  it("builds the public match link and a WhatsApp link", () => {
    expect(matchShareUrl("m1")).toBe(`${window.location.origin}/matches/m1`);
    expect(whatsappShareUrl("a b\nc")).toBe("https://wa.me/?text=a%20b%0Ac");
  });
});

describe("shareMatch with a message", () => {
  afterEach(() => {
    setNavigator("share", undefined);
    setNavigator("clipboard", undefined);
    vi.restoreAllMocks();
  });

  it("sends the message through the share sheet", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator("share", share);
    await expect(
      shareMatch("https://x/m", "A vs B", "Live: A 10/1"),
    ).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({
      title: "A vs B",
      text: "Live: A 10/1",
      url: "https://x/m",
    });
  });

  it("treats closing the share sheet as cancelled", async () => {
    setNavigator(
      "share",
      vi.fn().mockRejectedValue(new DOMException("closed", "AbortError")),
    );
    await expect(shareMatch("https://x/m", "A vs B", "msg")).resolves.toBe(
      "cancelled",
    );
  });

  it("copies the message and link when sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator("clipboard", { writeText });
    await expect(shareMatch("https://x/m", "A vs B", "msg")).resolves.toBe(
      "copied",
    );
    expect(writeText).toHaveBeenCalledWith("msg\nhttps://x/m");
  });

  it("opens WhatsApp when copying fails too", async () => {
    setNavigator("clipboard", {
      writeText: vi.fn().mockRejectedValue(new Error("denied")),
    });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    await expect(shareMatch("https://x/m", "A vs B", "msg")).resolves.toBe(
      "whatsapp",
    );
    expect(open).toHaveBeenCalledWith(
      "https://wa.me/?text=msg%0Ahttps%3A%2F%2Fx%2Fm",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
