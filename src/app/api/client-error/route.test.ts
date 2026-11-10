import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { streamedRequest } from "~/test/streamed-request";
import { POST } from "./route";

function request(body: string, ua = "TestAgent/1.0"): NextRequest {
  return new Request("http://localhost/api/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json", "user-agent": ua },
    body,
  }) as unknown as NextRequest;
}

describe("POST /api/client-error", () => {
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => log.mockRestore());

  it("logs a structured ERROR entry and returns 204", async () => {
    const res = await POST(
      request(
        JSON.stringify({
          kind: "boundary",
          message: "boom",
          stack: "Error: boom\n at x",
          url: "https://cricscore.altorstudio.com/matches/1",
          digest: "abc",
        }),
      ),
    );
    expect(res.status).toBe(204);
    expect(log).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(String(log.mock.calls[0]![0])) as Record<
      string,
      string
    >;
    expect(entry).toMatchObject({
      severity: "ERROR",
      source: "client",
      message: "[client] boom",
      kind: "boundary",
      digest: "abc",
      userAgent: "TestAgent/1.0",
    });
  });

  it("clips long fields", async () => {
    await POST(request(JSON.stringify({ message: "x".repeat(2000) })));
    const entry = JSON.parse(String(log.mock.calls[0]![0])) as {
      message: string;
    };
    expect(entry.message.length).toBe("[client] ".length + 500);
  });

  it("rejects oversized, malformed and empty reports without logging", async () => {
    expect((await POST(request("x".repeat(9000)))).status).toBe(413);
    expect((await POST(request("{not json"))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ stack: "s" })))).status).toBe(
      400,
    );
    expect(log).not.toHaveBeenCalled();
  });

  it("stops reading a streamed body once it passes the cap", async () => {
    const { request, pulled } = streamedRequest(
      "http://localhost/api/client-error",
      { headers: { "Content-Type": "application/json" } },
    );
    expect((await POST(request)).status).toBe(413);
    expect(pulled()).toBeLessThan(20);
    expect(log).not.toHaveBeenCalled();
  });
});

it("logs at most 60 reports a minute per instance", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  // Later than every report above, so their minute is over.
  vi.useFakeTimers({ now: Date.now() + 3_600_000 });
  try {
    const statuses: number[] = [];
    for (let i = 0; i < 70; i++) {
      statuses.push(
        (await POST(request(JSON.stringify({ message: `m${i}` })))).status,
      );
    }
    expect(statuses.filter((s) => s === 204)).toHaveLength(60);
    expect(statuses.at(-1)).toBe(429);
    expect(log).toHaveBeenCalledTimes(60);
    vi.advanceTimersByTime(61_000);
    expect(
      (await POST(request(JSON.stringify({ message: "later" })))).status,
    ).toBe(204);
  } finally {
    vi.useRealTimers();
    log.mockRestore();
  }
});
