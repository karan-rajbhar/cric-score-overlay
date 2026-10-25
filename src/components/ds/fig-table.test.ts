import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { figCell, figHead, figTable } from "./fig-table";

describe("figure table classes", () => {
  it("are plain strings in a module a server component can import", () => {
    // A "use client" module's exports reach a server component as client
    // references, not strings: the table would lose its classes.
    const source = readFileSync(
      join(process.cwd(), "src/components/ds/fig-table.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/^\s*["']use client["']/m);
    for (const c of [figTable, figHead, figCell]) {
      expect(typeof c).toBe("string");
    }
    expect(figCell).toContain("text-right");
  });

  it("are not imported from the client-only scorecard by server code", () => {
    for (const file of [
      "src/components/report/report-sections.tsx",
      "src/components/report/club-stats-report-view.tsx",
    ]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const fromScorecard = source.match(
        /import\s*\{([^}]*)\}\s*from\s*"~\/components\/ds\/scorecard"/,
      );
      expect(fromScorecard?.[1] ?? "").not.toMatch(/fig(Cell|Head|Table)/);
    }
  });
});
