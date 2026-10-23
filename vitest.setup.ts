import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

/**
 * `next/font/google` is a build-time transform (its runtime module is
 * empty), and overlay packages load their fonts with it: in tests every
 * font function returns stand-in class names.
 */
const isFontName = (key: string | symbol): key is string =>
  typeof key === "string" && /^[A-Z]/.test(key);

vi.mock("next/font/google", () =>
  new Proxy(
    {},
    {
      has: (_target, key) => isFontName(key),
      get: (_target, key) =>
        isFontName(key)
          ? () => ({
              className: `font-${key}`,
              variable: `font-var-${key}`,
              style: { fontFamily: key },
            })
          : undefined,
    },
  ),
);
