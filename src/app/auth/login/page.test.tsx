import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = { push: vi.fn(), refresh: vi.fn() };
const params = { value: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => params.value,
}));
vi.mock("~/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "u1" },
    signInWithGoogle: vi.fn(),
    redirectError: null,
  }),
}));

import LoginPage from "./page";

async function pushedFor(query: string) {
  params.value = new URLSearchParams(query);
  render(<LoginPage />);
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  return router.push.mock.calls[0]![0] as string;
}

describe("Login page: where a signed-in user goes", () => {
  beforeEach(() => {
    router.push.mockClear();
  });

  it("follows a path on this site, with its query and hash", async () => {
    expect(
      await pushedFor(
        `next=${encodeURIComponent("/matches/m1?tab=scorecard#top")}`,
      ),
    ).toBe("/matches/m1?tab=scorecard#top");
  });

  it("never leaves the site, whatever the target looks like", async () => {
    for (const query of [
      "redirect=/%5Cevil.example",
      "next=/%09/evil.example",
      "next=//evil.example",
      "next=https://evil.example/x",
      "redirect=javascript:alert(1)",
    ]) {
      router.push.mockClear();
      expect(await pushedFor(query)).toBe("/dashboard");
    }
  });

  it("goes to the dashboard with no target", async () => {
    expect(await pushedFor("")).toBe("/dashboard");
  });
});
