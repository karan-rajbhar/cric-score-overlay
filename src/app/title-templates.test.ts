import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every layout.tsx under src/app, with whether pages sit below it. */
function layouts(dir: string): Array<{ file: string; nested: boolean }> {
  const out: Array<{ file: string; nested: boolean }> = [];
  const hasPageBelow = (d: string, depth: number): boolean =>
    readdirSync(d).some((name) => {
      const p = join(d, name);
      if (statSync(p).isDirectory()) return hasPageBelow(p, depth + 1);
      return depth > 0 && name === "page.tsx";
    });
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...layouts(p));
    else if (name === "layout.tsx")
      out.push({ file: p, nested: hasPageBelow(dir, 0) });
  }
  return out;
}

describe("page titles (N19)", () => {
  it("keeps \"| CricScore\": a layout with pages below it titles with a template", () => {
    const plain = layouts(join(process.cwd(), "src/app"))
      .filter(({ file, nested }) => {
        if (!nested) return false;
        const src = readFileSync(file, "utf8");
        // A plain string title replaces the root template for every page below.
        return /title:\s*["'`]/.test(src) && !/template:/.test(src);
      })
      .map(({ file }) => file);
    expect(plain).toEqual([]);
  });
});
