"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { getTotalPendingCount } from "~/lib/offline-queue";
import { initInstallPrompt } from "~/lib/pwa/install-prompt";
import {
  cacheCurrentPage,
  removeServiceWorkers,
  serviceWorkerUrl,
  shouldPromptUpdate,
  shouldRegisterServiceWorker,
} from "~/lib/pwa/service-worker";

const UPDATE_TOAST_ID = "sw-update";
const PENDING_RECHECK_MS = 15_000;

function registrationEnv() {
  return {
    nodeEnv: process.env.NODE_ENV,
    disabledFlag: process.env.NEXT_PUBLIC_SW_DISABLED,
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    supported: "serviceWorker" in navigator,
  };
}

function whenIdle(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout: 5000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 1500);
  return () => window.clearTimeout(id);
}

/**
 * Registers `public/sw.js` in production (https, not localhost), offers a
 * quiet "Reload" when a new version is waiting, and otherwise removes any
 * worker on this origin (dev, `NEXT_PUBLIC_SW_DISABLED=true`).
 */
export function ServiceWorkerRegistrar() {
  const pathname = usePathname();

  useEffect(() => {
    initInstallPrompt();
    const env = registrationEnv();
    if (!env.supported) return;
    if (!shouldRegisterServiceWorker(env)) {
      // Dev / kill switch: make sure nothing stale controls this origin.
      void removeServiceWorkers();
      return;
    }

    let cancelled = false;
    let reloading = false;
    let recheck: number | undefined;
    const sw = navigator.serviceWorker;

    const offerUpdate = (reg: ServiceWorkerRegistration) => {
      window.clearTimeout(recheck);
      if (cancelled || !reg.waiting || !sw.controller) return;
      const ready = shouldPromptUpdate({
        hasWaitingWorker: true,
        pendingCount: getTotalPendingCount(),
      });
      if (!ready) {
        // Queued scoring actions first; ask again once they have synced.
        recheck = window.setTimeout(() => offerUpdate(reg), PENDING_RECHECK_MS);
        return;
      }
      toast("New version available", {
        id: UPDATE_TOAST_ID,
        duration: Infinity,
        closeButton: true,
        action: {
          label: "Reload",
          onClick: () => {
            // A ball may have been queued since the prompt appeared.
            if (getTotalPendingCount() > 0 || !reg.waiting) {
              toast.info("Reload after your offline balls have synced.");
              offerUpdate(reg);
              return;
            }
            reloading = true;
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    };

    const onControllerChange = () => {
      if (reloading) window.location.reload();
    };
    sw.addEventListener("controllerchange", onControllerChange);

    sw.register(serviceWorkerUrl(process.env.NEXT_PUBLIC_BUILD_ID), {
      scope: "/",
      updateViaCache: "none",
    })
      .then((reg) => {
        if (cancelled) return;
        offerUpdate(reg);
        // First install: once active, keep what this page already loaded.
        void sw.ready.then(() => {
          if (!cancelled) whenIdle(() => void cacheCurrentPage());
        });
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed") offerUpdate(reg);
          });
        });
      })
      .catch((err: unknown) => {
        console.warn("Service worker registration failed:", err);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(recheck);
      sw.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  // Keep each page (scoring pages are cached for offline use by the worker)
  // and the assets it loaded before the worker took control.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (!shouldRegisterServiceWorker(registrationEnv())) return;
    return whenIdle(() => void cacheCurrentPage());
  }, [pathname]);

  return null;
}
