import { describe, expect, it } from "vitest";
import { originFromHeaders } from "./request-origin";

describe("originFromHeaders", () => {
  it("prefers the forwarded host and protocol (App Hosting, tunnel)", () => {
    const h = new Headers({
      host: "0.0.0.0:8080",
      "x-forwarded-host": "cricscore.altorstudio.com, proxy.internal",
      "x-forwarded-proto": "https,http",
    });
    expect(originFromHeaders(h)).toBe("https://cricscore.altorstudio.com");
  });

  it("falls back to Host, http for local addresses", () => {
    expect(originFromHeaders(new Headers({ host: "localhost:3005" }))).toBe(
      "http://localhost:3005",
    );
    expect(originFromHeaders(new Headers({ host: "example.org" }))).toBe(
      "https://example.org",
    );
  });
});
