import { beforeEach, describe, expect, it, vi } from "vitest";

const getInitialUser = vi.fn();
vi.mock("~/lib/firebase/initial-user", () => ({
  getInitialUser: () => getInitialUser(),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("~/components/home/landing-page", () => ({
  LandingPage: () => "landing",
}));

import HomePage from "./page";

describe("Home", () => {
  beforeEach(() => getInitialUser.mockReset());

  it("sends a signed-in user to their home", async () => {
    getInitialUser.mockResolvedValue({ id: "u1" });
    await expect(HomePage()).rejects.toThrow("REDIRECT /dashboard");
  });

  it("shows visitors the landing page", async () => {
    getInitialUser.mockResolvedValue(null);
    expect((await HomePage()).type).toBeTypeOf("function");
  });
});
