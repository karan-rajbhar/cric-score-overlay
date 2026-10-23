import { describe, expect, it } from "vitest";
import {
  applicationServerKey,
  isIosDevice,
  pushAvailability,
  type PushEnv,
} from "./client";

const env = (overrides: Partial<PushEnv> = {}): PushEnv => ({
  publicKey: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  nodeEnv: "production",
  swDisabledFlag: undefined,
  protocol: "https:",
  hostname: "cricscore.example",
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  permission: "default",
  isIos: false,
  standalone: false,
  ...overrides,
});

describe("pushAvailability", () => {
  it("needs a key, the service worker and the Push API", () => {
    expect(pushAvailability(env())).toBe("available");
    expect(pushAvailability(env({ publicKey: "" }))).toBe("unconfigured");
    expect(pushAvailability(env({ nodeEnv: "development" }))).toBe("unsupported");
    expect(pushAvailability(env({ hostname: "localhost" }))).toBe("unsupported");
    expect(pushAvailability(env({ swDisabledFlag: "true" }))).toBe("unsupported");
    expect(pushAvailability(env({ hasPushManager: false }))).toBe("unsupported");
    expect(pushAvailability(env({ permission: "denied" }))).toBe("blocked");
  });

  it("asks iPhone and iPad users to install the app first", () => {
    expect(pushAvailability(env({ isIos: true }))).toBe("needs-install");
    expect(pushAvailability(env({ isIos: true, standalone: true }))).toBe("available");
  });
});

describe("isIosDevice", () => {
  it("spots iPhone, and iPad posing as a Mac", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", "iPhone", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X)", "MacIntel", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X)", "MacIntel", 0)).toBe(false);
    expect(isIosDevice("Mozilla/5.0 (Linux; Android 14)", "Linux", 5)).toBe(false);
  });
});

describe("applicationServerKey", () => {
  it("decodes the base64url key to its 65 bytes", () => {
    const bytes = applicationServerKey(env().publicKey);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });
});
