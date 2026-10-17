import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import { MemoryDataSource, type Doc } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { getTeams } from "./actions";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

async function names(search: string) {
  state.client = serverClientFor({
    ds: new MemoryDataSource(seed),
    db: null,
    getUser: async () => null,
  });
  const { data } = await getTeams({ search });
  return ((data ?? []) as { name: string }[]).map((t) => t.name).sort();
}

describe("getTeams search", () => {
  it("matches word starts and, for 3+ letters, inside words", async () => {
    expect(await names("metro")).toEqual([
      "Metropolitan Strikers",
      "Metropolitan Thunder",
    ]);
    expect(await names("rike")).toEqual(["Metropolitan Strikers"]);
    expect(await names("tan")).toEqual([
      "Metropolitan Strikers",
      "Metropolitan Thunder",
      "Riverside Titans",
    ]);
    expect(await names("zz")).toEqual([]);
  });
});
