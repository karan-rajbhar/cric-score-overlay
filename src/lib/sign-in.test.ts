import { describe, expect, it } from "vitest";
import { placeName, signInHref } from "./sign-in";

describe("signInHref (N31)", () => {
  it("comes back to the page, query included", () => {
    expect(signInHref("/tournaments/create?clubId=c1")).toBe(
      "/auth/login?redirect=%2Ftournaments%2Fcreate%3FclubId%3Dc1",
    );
  });

  it("has nowhere to come back to from the landing or sign-in page", () => {
    expect(signInHref("/")).toBe("/auth/login");
    expect(signInHref("/auth/login?redirect=/x")).toBe("/auth/login");
    expect(signInHref(null)).toBe("/auth/login");
  });
});

describe("placeName", () => {
  it("names the pages a person is sent to sign in from", () => {
    expect(placeName("/matches/create?clubId=c1")).toBe("New match");
    expect(placeName("/dashboard")).toBe("Home");
    expect(placeName("/matches/m1/players")).toBe("the match");
    expect(placeName("/clubs/c1?tab=stats")).toBe("the club");
    expect(placeName("/search?q=x")).toBeNull();
    expect(placeName("")).toBeNull();
  });
});
