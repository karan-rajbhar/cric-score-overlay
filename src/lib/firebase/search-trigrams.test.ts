/**
 * The search-trigrams migration plan (scripts/lib/search-trigrams.mjs):
 * backfills mid-word tokens on documents written before them, is
 * idempotent, and agrees with what the app writes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applySearchKeys,
  planSearchKeys,
  searchKeyColumns,
} from "../../../scripts/lib/search-trigrams.mjs";
import { planStage3, planWrites } from "../../../scripts/lib/stage3.mjs";
import type { Doc } from "./datasource";
import { searchFieldsOf } from "./derive.mjs";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

/** search_prefixes as stage 3 wrote them (prefixes only). */
const OLD_JOHN = [
  "jo",
  "joh",
  "john",
  "john s",
  "john sm",
  "john smi",
  "john smit",
  "john smith",
  "sm",
  "smi",
  "smit",
  "smith",
];

describe("search trigrams migration", () => {
  it("adds the trigrams to documents written before them", () => {
    const data = {
      users: [
        {
          id: "u1",
          full_name: "John Smith",
          username: null,
          name_lower: "john smith",
          search_prefixes: OLD_JOHN,
        },
      ],
      teams: [
        {
          id: "t1",
          name: "Riverside Titans",
          short_name: "RT",
          ...searchFieldsOf("teams", {
            name: "Riverside Titans",
            short_name: "RT",
          }),
        },
      ],
    } as Record<string, Doc[]>;
    const patches = planSearchKeys(data);
    expect(patches).toEqual([
      {
        table: "users",
        id: "u1",
        data: {
          search_prefixes: searchFieldsOf("users", data.users![0]!)!
            .search_prefixes,
        },
      },
    ]);
    expect(patches[0]!.data.search_prefixes).toEqual(
      expect.arrayContaining(["ohn", "mit", "ith"]),
    );
    // Applying, then planning again, changes nothing.
    expect(planSearchKeys(applySearchKeys(data, patches))).toEqual([]);
  });

  it("reads only the fields it derives from", () => {
    expect(searchKeyColumns("users").sort()).toEqual(
      ["full_name", "name_lower", "search_prefixes", "username"].sort(),
    );
    expect(searchKeyColumns("matches").sort()).toEqual(
      ["search_prefixes", "title", "title_lower"].sort(),
    );
  });

  it("the seed is already up to date (and still in the stage 3 shape)", () => {
    expect(planSearchKeys(seed)).toEqual([]);
    expect(
      planWrites(planStage3(seed, { now: "2024-06-01T00:00:00.000Z" })),
    ).toBe(0);
  });
});
