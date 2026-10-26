import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({ values: new Map<string, string>() }));
const getUserFromSessionCookie = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.values.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));
vi.mock("./session", async () => {
  const names = await import("./session-cookie");
  return { ...names, getUserFromSessionCookie };
});

import { getInitialUser } from "./initial-user";
import { SESSION_COOKIE_NAME } from "./session-cookie";

const user = {
  id: "u1",
  email: "a@b.com",
  phone: null,
  user_metadata: {},
};

beforeEach(() => {
  cookieStore.values.clear();
  getUserFromSessionCookie.mockReset();
});

describe("getInitialUser", () => {
  it("returns the user of a valid session cookie", async () => {
    cookieStore.values.set(SESSION_COOKIE_NAME, "cookie-value");
    getUserFromSessionCookie.mockResolvedValue(user);
    await expect(getInitialUser()).resolves.toEqual(user);
    expect(getUserFromSessionCookie).toHaveBeenCalledWith("cookie-value");
  });

  it("is null without a cookie or with one that does not verify", async () => {
    getUserFromSessionCookie.mockResolvedValue(null);
    await expect(getInitialUser()).resolves.toBeNull();
    cookieStore.values.set(SESSION_COOKIE_NAME, "expired");
    await expect(getInitialUser()).resolves.toBeNull();
  });

  it("never throws into the layout", async () => {
    cookieStore.values.set(SESSION_COOKIE_NAME, "cookie-value");
    getUserFromSessionCookie.mockRejectedValue(new Error("admin down"));
    await expect(getInitialUser()).resolves.toBeNull();
  });
});
