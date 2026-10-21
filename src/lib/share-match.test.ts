import { afterEach, describe, expect, it, vi } from "vitest";
import type { Match } from "./match-types";
import {
  matchShareMessage,
  matchShareUrl,
  matchTitle,
  shareImage,
  shareMatch,
  whatsappShareUrl,
} from "./share-match";

function setNavigator(key: "share" | "canShare" | "clipboard", value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true });
}

const player = (id: string, full_name: string) => ({ id, full_name });

function sampleMatch(over: Partial<Match> = {}): Match {
  return {
    id: "m1",
    title: "Strikers vs Warriors",
    match_format: "T20",
    overs_per_innings: 20,
    balls_per_over: 6,
    status: "live",
    current_innings: 2,
    team1_id: "t1",
    team2_id: "t2",
    team1: { id: "t1", name: "Strikers" },
    team2: { id: "t2", name: "Warriors" },
    innings: [
      {
        id: "i1",
        innings_number: 1,
        team_id: "t2",
        total_runs: 158,
        total_wickets: 9,
        total_balls: 120,
        is_completed: true,
      },
      {
        id: "i2",
        innings_number: 2,
        team_id: "t1",
        total_runs: 85,
        total_wickets: 3,
        total_balls: 62,
        is_completed: false,
        target_runs: 159,
        batting_performances: [
          {
            user_id: "a",
            user: player("a", "A Kumar"),
            runs_scored: 12,
            balls_faced: 9,
            is_current_batsman: true,
            is_striker: false,
          },
          {
            user_id: "j",
            user: player("j", "J Smith"),
            runs_scored: 34,
            balls_faced: 22,
            is_current_batsman: true,
            is_striker: true,
          },
          {
            user_id: "o",
            user: player("o", "Out Batter"),
            runs_scored: 20,
            balls_faced: 15,
            is_current_batsman: false,
            is_out: true,
          },
        ],
        bowling_performances: [
          {
            user_id: "r",
            user: player("r", "R Patel"),
            balls_bowled: 14,
            runs_conceded: 18,
            wickets_taken: 1,
            is_current_bowler: true,
          },
        ],
      },
    ],
    ...over,
  } as unknown as Match;
}

describe("share messages", () => {
  it("describes a live chase: scores in batting order, the crease and the bowler", () => {
    expect(matchShareMessage(sampleMatch(), "https://x/matches/m1")).toBe(
      [
        "Strikers vs Warriors · Live",
        "Warriors 158/9 (20.0 ov)",
        "Strikers 85/3 (10.2 ov)",
        "Strikers need 74 runs from 58 balls",
        "Batting: J Smith 34* (22), A Kumar 12* (9)",
        "Bowling: R Patel 1/18 (2.2)",
        "Follow ball by ball: https://x/matches/m1",
      ].join("\n"),
    );
  });

  it("gives the result and player of the match once it is over", () => {
    const done = sampleMatch({
      status: "completed",
      result_description: "Warriors won by 20 runs",
      player_of_the_match: player("r", "R Patel"),
    });
    expect(matchShareMessage(done, "https://x/matches/m1")).toBe(
      [
        "Strikers vs Warriors",
        "Warriors 158/9 (20.0 ov)",
        "Strikers 85/3 (10.2 ov)",
        "Warriors won by 20 runs",
        "Player of the match: R Patel",
        "Full scorecard: https://x/matches/m1",
      ].join("\n"),
    );
  });

  it("names the match from its teams", () => {
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

describe("shareImage", () => {
  const file = new File(["png"], "match.png", { type: "image/png" });
  // jsdom has no matchMedia: a phone matches "(pointer: coarse)".
  const touch = (coarse: boolean) =>
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (q: string) => ({
        matches: coarse && q === "(pointer: coarse)",
        media: q,
      }),
    });

  afterEach(() => {
    setNavigator("share", undefined);
    setNavigator("canShare", undefined);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: undefined,
    });
    vi.restoreAllMocks();
  });

  it("opens the share sheet with the image and the message on phones", async () => {
    touch(true);
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator("share", share);
    setNavigator("canShare", () => true);
    await expect(shareImage(file, "A vs B\nlink")).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file], text: "A vs B\nlink" });
  });

  it("downloads the image on desktops, even where files can be shared", async () => {
    touch(false);
    const share = vi.fn();
    setNavigator("share", share);
    setNavigator("canShare", () => true);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => "blob:x");
    await expect(shareImage(file, "msg")).resolves.toBe("downloaded");
    expect(share).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });

  it("reports a cancelled sheet, and a tap that expired while drawing", async () => {
    touch(true);
    setNavigator("canShare", () => true);
    setNavigator(
      "share",
      vi.fn().mockRejectedValue(new DOMException("x", "AbortError")),
    );
    await expect(shareImage(file)).resolves.toBe("cancelled");
    setNavigator(
      "share",
      vi.fn().mockRejectedValue(new DOMException("x", "NotAllowedError")),
    );
    await expect(shareImage(file)).resolves.toBe("expired");
  });
});
