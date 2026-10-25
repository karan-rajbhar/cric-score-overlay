import fg from "fast-glob";
import { describe, expect, it } from "vitest";
import config from "../../../tailwind.config";

/*
 * Tailwind only generates the classes it finds in the files it scans. The
 * figure table's class strings live in a plain .ts module (so server
 * components can import them); when the scan covered only .tsx files their
 * first:/last: variants silently vanished from the CSS, and table name
 * columns collapsed. Tests do not render with Tailwind, so check the scan.
 */
describe("tailwind content", () => {
  const content = (config.content as string[]).filter(
    (c) => typeof c === "string",
  );
  const files = fg
    .sync(content, { cwd: process.cwd() })
    .map((f) => f.replace(/^\.\//, ""));

  it("scans the .ts modules that hold class strings", () => {
    expect(files).toContain("src/components/ds/fig-table.ts");
  });

  it("still scans components, and leaves tests out", () => {
    expect(files).toContain("src/components/ds/scorecard.tsx");
    expect(files.some((f) => /\.test\.tsx?$/.test(f))).toBe(false);
  });
});
