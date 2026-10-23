// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
const state: { ds: unknown } = { ds: null };
vi.mock("~/lib/firebase/server", async () => {
  const { serverClientFor } = await import("~/lib/firebase/server-client");
  return {
    createServerClient: async () =>
      serverClientFor({ ds: state.ds as never, db: null, getUser: async () => null }),
  };
});

import { clearFeedCache } from "~/lib/calendar/feed";
import { MemoryDataSource, type Doc } from "~/lib/firebase/datasource";
import { GET, HEAD } from "./route";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;
const STRIKERS = "750e8400-e29b-41d4-a716-446655440001";

function get(scope: string, file: string, method: "GET" | "HEAD" = "GET") {
  const req = new Request(`https://cricscore.example/api/calendar/${scope}/${file}`, {
    method,
    headers: { Host: "cricscore.example", "X-Forwarded-Proto": "https" },
  }) as unknown as NextRequest;
  const ctx = { params: Promise.resolve({ scope, file }) };
  return method === "GET" ? GET(req, ctx) : HEAD(req, ctx);
}

beforeEach(() => {
  state.ds = new MemoryDataSource(seed);
  clearFeedCache();
  vi.useFakeTimers({ now: new Date("2024-08-01T12:00:00.000Z"), toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/calendar/<scope>/<id>.ics", () => {
  it("serves a cacheable iCalendar feed with links to this site", async () => {
    const res = await get("team", `${STRIKERS}.ics`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=900");
    expect(res.headers.get("Content-Disposition")).toBe(
      'inline; filename="metropolitan-strikers.ics"',
    );
    const body = await res.text();
    expect(body).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(body).toContain("URL:https://cricscore.example/matches/");
    expect(body).toContain("LOCATION:Central Park Cricket Ground");
  });

  it("answers HEAD without a body", async () => {
    const res = await get("club", "650e8400-e29b-41d4-a716-446655440001.ics", "HEAD");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("404s unknown scopes, bad file names and missing owners", async () => {
    expect((await get("player", `${STRIKERS}.ics`)).status).toBe(404);
    expect((await get("team", `${STRIKERS}.json`)).status).toBe(404);
    expect((await get("team", "no-such-team.ics")).status).toBe(404);
  });
});
