// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("https://x/api/vitals", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }) as unknown as NextRequest,
  );

describe("POST /api/vitals", () => {
  it("logs a metric with the page path only", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await post({
      name: "INP",
      value: 312.4,
      rating: "poor",
      path: "/matches/m1/score?tab=x",
      navigationType: "navigate",
    });
    expect(res.status).toBe(204);
    const logged = JSON.parse(String(info.mock.calls[0]![0]));
    expect(logged).toMatchObject({
      source: "web-vitals",
      metric: "INP",
      rating: "poor",
      path: "/matches/m1/score",
    });
    info.mockRestore();
  });

  it("refuses anything that is not a known metric", async () => {
    expect((await post({ name: "XSS", value: 1, rating: "good" })).status).toBe(400);
    expect((await post({ name: "LCP", value: "1", rating: "good" })).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
    expect((await post("x".repeat(4000))).status).toBe(413);
  });
});
