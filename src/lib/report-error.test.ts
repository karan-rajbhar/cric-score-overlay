import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeError,
  reportClientError,
  resetErrorReports,
} from "./report-error";

describe("reportClientError", () => {
  const beacon = vi.fn(() => true);

  beforeEach(() => {
    resetErrorReports();
    beacon.mockClear();
    Object.defineProperty(navigator, "sendBeacon", {
      value: beacon,
      configurable: true,
    });
  });
  afterEach(() => resetErrorReports());

  it("sends a report with the page URL", async () => {
    reportClientError({ kind: "error", message: "boom" });
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe("/api/client-error");
    expect(JSON.parse(await blob.text())).toMatchObject({
      kind: "error",
      message: "boom",
      url: window.location.href,
    });
  });

  it("sends each message once and at most 5 per page", () => {
    reportClientError({ kind: "error", message: "same" });
    reportClientError({ kind: "error", message: "same" });
    expect(beacon).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 10; i += 1) {
      reportClientError({ kind: "error", message: `m${i}` });
    }
    expect(beacon).toHaveBeenCalledTimes(5);
  });

  it("falls back to fetch when sendBeacon is unavailable", () => {
    Object.defineProperty(navigator, "sendBeacon", {
      value: undefined,
      configurable: true,
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    reportClientError({ kind: "error", message: "no beacon" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/client-error",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
    fetchSpy.mockRestore();
  });
});

describe("describeError", () => {
  it("handles errors, strings and other values", () => {
    expect(describeError(new Error("e")).message).toBe("e");
    expect(describeError("plain")).toEqual({ message: "plain" });
    expect(describeError(42)).toEqual({ message: "42" });
  });
});
