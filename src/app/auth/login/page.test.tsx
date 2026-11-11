import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = { push: vi.fn(), refresh: vi.fn() };
const params = { value: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => params.value,
}));
const auth = { user: { id: "u1" } as { id: string } | null };
vi.mock("~/lib/auth", () => ({
  useAuth: () => ({
    user: auth.user,
    signInWithGoogle: vi.fn(),
    redirectError: null,
    signingIn: false,
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

describe("the sign-in page and its URL (N8)", () => {
  it("never shows text from the URL as its own error, and survives a stray %", () => {
    auth.user = null;
    params.value = new URLSearchParams(
      "error=oauth_error&message=Send%20your%20password%20to%20x%25",
    );
    render(<LoginPage />);
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/send your password/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    auth.user = { id: "u1" };
  });
});
