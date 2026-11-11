import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("the installed app (N34)", () => {
  it("opens on the landing page, which sends a signed-in person Home", () => {
    const m = manifest();
    expect(m.start_url).toBe("/");
    // The identity of apps installed before stays.
    expect(m.id).toBe("/");
  });
});
