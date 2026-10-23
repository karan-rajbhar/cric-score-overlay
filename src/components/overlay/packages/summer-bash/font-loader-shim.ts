/**
 * Outside Next's compiler (vitest), `next/font/google` is an empty module:
 * the font calls in `fonts.ts` are compile-time macros that Next replaces
 * with the generated stylesheet. This gives the two loaders this package
 * uses a stand-in under test, so any test that draws the stage (and with
 * it the registry and this package) can import it. In a Next build the
 * branch is dead code and the loaders are Next's own.
 *
 * Imported by its full path: Next's font transform only acts on the bare
 * `next/font/google` specifier.
 */

import * as nextFontGoogle from "next/font/google/index.js";

const stub = (family: string) => () => ({
  className: "",
  variable: "",
  style: { fontFamily: family },
});

if (process.env.NODE_ENV === "test") {
  const target = (nextFontGoogle as { default?: Record<string, unknown> })
    .default;
  if (target && typeof target === "object") {
    for (const family of ["Unbounded", "Archivo"]) {
      if (typeof target[family] !== "function") {
        try {
          target[family] = stub(family);
        } catch {
          // A frozen module: nothing to do (the test mocks it itself).
        }
      }
    }
  }
}
