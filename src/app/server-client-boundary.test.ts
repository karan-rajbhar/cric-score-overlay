/**
 * A server component may render what a "use client" module exports, but it
 * may not call it: Next.js replaces every client export with a reference,
 * and calling one throws ("Attempted to call isBracketFormat() from the
 * server"). That took the tournament page down for its organisers, and only
 * on the branch they see, so a render test of another branch passes.
 *
 * Walks every server entry (pages, layouts, route handlers, server actions)
 * and the plain modules they import, and fails on a call to a function
 * imported from a "use client" file. Helpers both sides need belong in a
 * plain module.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");
const ENTRY = /^(page|layout|template|default|not-found|route)\.(ts|tsx)$/;

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

const directive = (src: string, name: string) =>
  new RegExp(`^\\s*(//[^\\n]*\\n\\s*|/\\*[\\s\\S]*?\\*/\\s*)*["']${name}["']`).test(
    src,
  );

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("~/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const path = base + ext;
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return null;
}

const IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;

/** Calls to client functions in `file`, and the plain modules it imports. */
function scan(file: string): { calls: string[]; next: string[] } {
  const src = readFileSync(file, "utf8");
  const calls: string[] = [];
  const next: string[] = [];
  for (const m of src.matchAll(IMPORT)) {
    const target = resolveImport(file, m[3]!);
    if (!target) continue;
    const targetSrc = readFileSync(target, "utf8");
    if (!directive(targetSrc, "use client")) {
      next.push(target);
      continue;
    }
    if (m[1]) continue;
    const body = src.replace(m[0], "");
    for (const raw of m[2]!.split(",")) {
      const name = raw.trim();
      if (!name || name.startsWith("type ")) continue;
      const local = name.split(/\s+as\s+/).pop()!.trim();
      // Components are rendered, not called.
      if (/^[A-Z]/.test(local)) continue;
      if (new RegExp(`(^|[^.\\w])${local}\\s*\\(`).test(body)) {
        calls.push(`${relative(SRC, file)}: ${local}() from ${m[3]}`);
      }
    }
  }
  return { calls, next };
}

describe("server code and client modules", () => {
  it("never calls a function exported from a \"use client\" file", () => {
    const all = filesUnder(SRC);
    const entries = all.filter((f) => {
      const src = readFileSync(f, "utf8");
      if (directive(src, "use client")) return false;
      return (
        (f.startsWith(join(SRC, "app")) && ENTRY.test(f.split("/").pop()!)) ||
        directive(src, "use server")
      );
    });
    expect(entries.length).toBeGreaterThan(50);

    const seen = new Set<string>();
    const queue = [...entries];
    const calls: string[] = [];
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const found = scan(file);
      calls.push(...found.calls);
      queue.push(...found.next);
    }
    expect(calls).toEqual([]);
  });
});
