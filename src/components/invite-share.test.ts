import { describe, expect, it } from "vitest";
import { inviteMessage } from "./invite-share";

describe("inviteMessage", () => {
  it("names the match a scorer is invited to: title, day, time and ground", () => {
    const text = inviteMessage("Karan", "ravi@gmail.com", {
      id: "m1",
      title: "Omkar 11 vs Vinayak 11",
      scheduled_at: new Date(2026, 10, 22, 10, 0).toISOString(),
      venue: "Kamothe ground",
    });
    const [first, second, third] = text.split("\n");
    expect(first).toBe("Karan invited you to help score Omkar 11 vs Vinayak 11 on CricScore");
    // The year shows only outside the current one.
    expect(second).toMatch(/^Sun 22 Nov( 2026)?, 10:00 · Kamothe ground$/);
    expect(third).toMatch(/\/auth\/login\?invite=ravi@gmail\.com&next=%2Fmatches%2Fm1%2Fscore/);
  });

  it("keeps the short message when only the match id is known", () => {
    expect(inviteMessage(undefined, "a@b.co", "m1").split("\n")[0]).toBe(
      "Someone invited you to help score a match on CricScore",
    );
  });
});
