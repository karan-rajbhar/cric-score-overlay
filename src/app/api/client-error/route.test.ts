import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
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
});
