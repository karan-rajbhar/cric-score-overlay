import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const screens = import.meta.glob<{ default: ComponentType }>("./**/loading.tsx", {
  eager: true,
});

describe("loading screens (N32)", () => {
  it("covers the routes that had none", () => {
    for (const route of ["more", "search", "invitations", "auth/login"]) {
      expect(Object.keys(screens)).toContain(`./${route}/loading.tsx`);
    }
  });

  it.each(Object.entries(screens))("%s tells screen readers it is loading", (_, mod) => {
    const Loading = mod.default;
    render(<Loading />);
    const status = screen.getAllByRole("status")[0]!;
    // Said as its text or its name (a tab's skeleton is labelled).
    expect(
      `${status.textContent} ${status.getAttribute("aria-label") ?? ""}`,
    ).toMatch(/loading/i);
  });
});
