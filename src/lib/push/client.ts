/**
 * Browser side of push notifications. Push needs the service worker, which
 * exists only in production over https (see ~/lib/pwa/service-worker), and
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY; without either, every helper here reports
 * push as unavailable and does nothing. On iPhone and iPad push works only
 * in the app added to the Home Screen.
 */

import { shouldRegisterServiceWorker } from "~/lib/pwa/service-worker";

const SUBSCRIPTION_ROUTE = "/api/push/subscription";

/** POST / DELETE to the subscription route (same origin, JSON). */
async function callSubscriptionRoute(
  method: "POST" | "DELETE",
  body: unknown,
): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(SUBSCRIPTION_ROUTE, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";

export type PushAvailability =
  /** No VAPID key in this build. */
  | "unconfigured"
  /** No service worker here (dev, localhost) or no Push API. */
  | "unsupported"
  /** iPhone / iPad in a browser tab: install the app first. */
  | "needs-install"
  /** The user blocked notifications for this site. */
  | "blocked"
  | "available";

export interface PushEnv {
  publicKey: string;
  nodeEnv: string | undefined;
  swDisabledFlag: string | undefined;
  protocol: string;
  hostname: string;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: string;
  isIos: boolean;
  standalone: boolean;
}

export function pushAvailability(env: PushEnv): PushAvailability {
  if (!env.publicKey) return "unconfigured";
  if (
    !shouldRegisterServiceWorker({
      nodeEnv: env.nodeEnv,
      disabledFlag: env.swDisabledFlag,
      protocol: env.protocol,
      hostname: env.hostname,
      supported: env.hasServiceWorker,
    })
  ) {
    return "unsupported";
  }
  if (env.isIos && !env.standalone) return "needs-install";
  if (!env.hasPushManager || !env.hasNotification) return "unsupported";
  if (env.permission === "denied") return "blocked";
  return "available";
}

/** iPhone, iPad (iPadOS reports itself as a Mac with touch). */
export function isIosDevice(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): boolean {
  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

export function currentPushEnv(): PushEnv {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    publicKey: VAPID_PUBLIC_KEY,
    nodeEnv: process.env.NODE_ENV,
    swDisabledFlag: process.env.NEXT_PUBLIC_SW_DISABLED,
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification: "Notification" in window,
    permission:
      "Notification" in window ? Notification.permission : "unsupported",
    isIos: isIosDevice(
      navigator.userAgent,
      navigator.platform ?? "",
      navigator.maxTouchPoints ?? 0,
    ),
    standalone:
      nav.standalone === true ||
      window.matchMedia?.("(display-mode: standalone)").matches === true,
  };
}

/** The VAPID public key as the bytes `pushManager.subscribe` wants. */
export function applicationServerKey(publicKey: string): Uint8Array<ArrayBuffer> {
  const base64 = publicKey.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function registration(waitMs: number): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  const existing = await navigator.serviceWorker
    .getRegistration()
    .catch(() => undefined);
  if (existing?.active) return existing;
  if (waitMs <= 0) return existing ?? null;
  return withTimeout(navigator.serviceWorker.ready, waitMs);
}

/** This device's subscription, if push is on here. */
export async function getDeviceSubscription(): Promise<PushSubscription | null> {
  const reg = await registration(0);
  return (await reg?.pushManager?.getSubscription().catch(() => null)) ?? null;
}

/**
 * Asks for permission, subscribes this device and saves the subscription
 * on the server.
 */
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (pushAvailability(currentPushEnv()) !== "available") {
    return { ok: false, error: "Notifications are not available here" };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "Notifications were not allowed" };
  }
  const reg = await registration(10_000);
  if (!reg?.pushManager) {
    return { ok: false, error: "Notifications are not available here" };
  }
  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(VAPID_PUBLIC_KEY),
      }));
    const res = await callSubscriptionRoute("POST", sub.toJSON());
    if (!res.ok) {
      await sub.unsubscribe().catch(() => undefined);
      return {
        ok: false,
        error:
          res.status === 401
            ? "Sign in to turn on notifications"
            : "Could not turn on notifications",
      };
    }
    return { ok: true };
  } catch (err) {
    console.error("enablePush failed:", err);
    return { ok: false, error: "Could not turn on notifications" };
  }
}

/** Turns push off on this device and forgets it on the server. */
export async function disablePush(): Promise<void> {
  const sub = await getDeviceSubscription();
  if (!sub) return;
  await callSubscriptionRoute("DELETE", { endpoint: sub.endpoint }).catch(
    () => undefined,
  );
  await sub.unsubscribe().catch(() => undefined);
}

/**
 * Sign-out: this device stops receiving the user's notifications. Bounded
 * (the server forgets the device while the session still exists; the
 * browser drops the subscription even if that call fails).
 */
export async function removeDevicePush(): Promise<void> {
  try {
    await withTimeout(disablePush(), 3000);
  } catch {
    // Best effort: a stale server record is deleted on the next send (410).
  }
}
