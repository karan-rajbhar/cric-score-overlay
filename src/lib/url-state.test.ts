import { beforeEach, describe, expect, it } from "vitest";
import { setUrlParam } from "./url-state";

describe("setUrlParam", () => {
  beforeEach(() => window.history.replaceState(null, "", "/clubs/c1?matches=50"));

  it("sets a value and keeps the rest of the address", () => {
    setUrlParam("tab", "stats", "teams");
    expect(window.location.pathname + window.location.search).toBe(
      "/clubs/c1?matches=50&tab=stats",
    );
  });

  it("leaves the default out", () => {
    setUrlParam("tab", "stats", "teams");
    setUrlParam("tab", "teams", "teams");
    expect(window.location.search).toBe("?matches=50");
  });

  it("adds no history entry", () => {
    const before = window.history.length;
    setUrlParam("tab", "stats");
    expect(window.history.length).toBe(before);
  });
});
