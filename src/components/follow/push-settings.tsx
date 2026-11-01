"use client";

import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { usePush } from "~/lib/push/use-push";
import { IOS_PUSH_NOTE, PUSH_EXPLANATION } from "./copy";

const rowClass =
  "flex min-h-[44px] w-full items-center gap-3 rounded-full px-3.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50";

/**
 * Notifications on this device, on the More page. Hidden where push
 * cannot work (no VAPID key in this build, no service worker: dev and
 * localhost, browsers without the Push API).
 */
export function NotificationSettings() {
  const push = usePush();
  if (push.availability === "unconfigured" || push.availability === "unsupported") {
    return null;
  }

  const toggle = async () => {
    if (push.enabled) {
      await push.disable();
      toast.success("Notifications are off on this device");
      return;
    }
    const res = await push.enable();
    if (res.ok) toast.success("Notifications are on");
    else if (res.error) toast.error(res.error);
  };

  return (
    <section aria-labelledby="notification-settings" className="space-y-1">
      <h2
        id="notification-settings"
        className="mb-1.5 px-3 text-xs font-medium text-muted-foreground/75"
      >
        Notifications
      </h2>
      <p className="px-3.5 text-xs text-muted-foreground">{PUSH_EXPLANATION}</p>
      {push.availability === "needs-install" && (
        <p className="px-3.5 text-xs text-muted-foreground">{IOS_PUSH_NOTE}</p>
      )}
      {push.availability === "blocked" && (
        <p className="px-3.5 text-xs text-muted-foreground">
          Notifications are blocked for CricScore in this browser&apos;s site
          settings.
        </p>
      )}
      {push.availability === "available" && push.enabled !== null && (
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={push.busy}
          className={rowClass}
        >
          {push.enabled ? (
            <BellOff className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden="true" />
          ) : (
            <Bell className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden="true" />
          )}
          {push.enabled ? "Turn off on this device" : "Turn on notifications"}
        </button>
      )}
    </section>
  );
}
