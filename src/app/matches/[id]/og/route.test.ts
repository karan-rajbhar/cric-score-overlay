// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Doc } from "~/lib/firebase/datasource";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;
const live = seed.matches!.find((m) => m.status === "live")!;

vi.mock("~/lib/match-share-server", () => ({
  loadShareMatch: async (id: string) =>
    seed.matches!.find((m) => m.id === id) ?? null,
}));

import { GET } from "./route";

const call = (id: string) =>
  GET(new Request(`http://localhost/matches/${id}/og`), {
    params: Promise.resolve({ id }),
  });

describe("match preview image", () => {
  it("renders a PNG with a short cache for live matches", async () => {
    const res = await call(live.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("max-age=60");
    const bytes = new Uint8Array(await res.arrayBuffer());
    // PNG signature
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }, 30_000);

  it("still renders a generic image for an unknown match", async () => {
    const res = await call("00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  }, 30_000);
});
