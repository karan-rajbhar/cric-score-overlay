import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

/**
 * next/font exists only in Next's compiler (its runtime module is empty),
 * so a module declaring fonts (an overlay package) would fail to load in
 * tests. Every family returns an empty class and its own name as the
 * font family.
 */
vi.mock("next/font/google", () => {
  const family = (name: string) => () => ({
    className: "",
    variable: "",
    style: { fontFamily: `'${name.replace(/_/g, " ")}'` },
  });
  return new Proxy(
    {},
    {
      get: (_target, key) =>
        typeof key === "string" && key !== "then" && key !== "__esModule"
          ? family(key)
          : undefined,
      has: (_target, key) => typeof key === "string" && key !== "then",
    },
  );
});
