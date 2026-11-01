import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import DesignLayout from "./layout";
import DesignSystemPage from "./page";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/design", () => {
  it("answers 404 in production builds", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => DesignLayout({ children: null })).toThrow("NEXT_NOT_FOUND");
  });

  it("renders every section on a dev server", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(
      <DesignLayout>
        <DesignSystemPage />
      </DesignLayout>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Design system" }),
    ).toBeInTheDocument();
    for (const name of [
      "Principles",
      "Foundations",
      "Controls",
      "Layout and content",
      "Feedback",
      "Cricket",
      "Screens",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name }),
      ).toBeInTheDocument();
    }
  });
});
