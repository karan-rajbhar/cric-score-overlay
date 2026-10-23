// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryDataSource } from "~/lib/firebase/datasource";
import {
  MAX_DEVICES,
  PUSH_SUBSCRIPTIONS,
  isAllowedPushEndpoint,
  parseSubscription,
  removeSubscription,
  saveSubscription,
  subscriptionId,
  subscriptionsOfUsers,
} from "./subscriptions";

const P256DH =
  "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
const AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
const endpoint = (n: number | string) => `https://fcm.googleapis.com/fcm/send/device${n}`;
const sub = (n: number | string) => ({ endpoint: endpoint(n), p256dh: P256DH, auth: AUTH });

let ds: MemoryDataSource;
beforeEach(() => {
  ds = new MemoryDataSource({});
});

describe("isAllowedPushEndpoint", () => {
  it("accepts browser push services over https only", () => {
    expect(isAllowedPushEndpoint(endpoint(1))).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://db5p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://evil.example/fcm.googleapis.com")).toBe(false);
    expect(isAllowedPushEndpoint("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedPushEndpoint("not a url")).toBe(false);
  });
});

describe("parseSubscription", () => {
  it("takes PushSubscription.toJSON() and checks the keys", () => {
    expect(
      parseSubscription({ endpoint: endpoint(1), expirationTime: null, keys: { p256dh: P256DH, auth: AUTH } }),
    ).toEqual(sub(1));
    expect(parseSubscription({ endpoint: endpoint(1), keys: { p256dh: "AAAA", auth: AUTH } })).toBeNull();
    expect(parseSubscription({ endpoint: endpoint(1), keys: { p256dh: P256DH, auth: "x" } })).toBeNull();
    expect(parseSubscription({ endpoint: "https://evil.example/x", keys: { p256dh: P256DH, auth: AUTH } })).toBeNull();
    expect(parseSubscription(null)).toBeNull();
  });
});

describe("saving and removing", () => {
  it("keys a device by its endpoint and moves it to whoever signs in", async () => {
    await saveSubscription(ds, "u1", sub(1));
    await saveSubscription(ds, "u2", sub(1));
    const doc = await ds.getById(PUSH_SUBSCRIPTIONS, subscriptionId(endpoint(1)));
    expect(doc).toMatchObject({ user_id: "u2", endpoint: endpoint(1) });
    expect(await subscriptionsOfUsers(ds, ["u1"])).toEqual([]);
  });

  it("keeps at most MAX_DEVICES per user, dropping the oldest", async () => {
    for (let i = 0; i <= MAX_DEVICES; i += 1) {
      await saveSubscription(ds, "u1", sub(i), new Date(Date.UTC(2026, 0, 1, 0, i)));
    }
    const devices = await subscriptionsOfUsers(ds, ["u1"]);
    expect(devices).toHaveLength(MAX_DEVICES);
    expect(devices.map((d) => d.endpoint)).not.toContain(endpoint(0));
  });

  it("removes only the user's own device", async () => {
    await saveSubscription(ds, "u1", sub(1));
    expect(await removeSubscription(ds, "u2", endpoint(1))).toBe(false);
    expect(await removeSubscription(ds, "u1", endpoint(1))).toBe(true);
    expect(await subscriptionsOfUsers(ds, ["u1"])).toEqual([]);
  });
});
