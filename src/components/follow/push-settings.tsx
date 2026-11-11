"use client";

import { useId } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { usePush } from "~/lib/push/use-push";
import { cn } from "~/lib/utils";
import { IOS_PUSH_NOTE, PUSH_EXPLANATION } from "./copy";

/** What the row says under "Notifications": the state, or why there is none. */
function stateLine(push: ReturnType<typeof usePush>): string {
  if (push.availability === "needs-install") return IOS_PUSH_NOTE;
  if (push.availability === "blocked")
    return "Blocked for CricScore in this browser's site settings.";
  return push.enabled ? "On for this device" : "Off";
}

/**
 * Notifications on this device: a row of More's "This device" card with
 * a switch, its state under the name (N29). The change shows in the row
 * itself, not in a toast. Hidden where push cannot work (no VAPID key in
 * this build, no service worker: dev and localhost, browsers without the
 * Push API).
 */
export function NotificationSettings() {
  const push = usePush();
  const id = useId();
  if (push.availability === "unconfigured" || push.availability === "unsupported") {
    return null;
  }
  const canSwitch = push.availability === "available" && push.enabled !== null;

  const toggle = async () => {
    if (push.enabled) {
      await push.disable();
      return;
    }
    const res = await push.enable();
    if (!res.ok && res.error) toast.error(res.error);
  };

  const body = (
    <>
      <Bell
        className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 self-start text-muted-foreground"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span id={`${id}-name`} className="block text-sm font-medium text-foreground">
          Notifications
        </span>
        <span id={`${id}-about`}>
          <span className="block text-xs text-muted-foreground">
            {stateLine(push)}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {PUSH_EXPLANATION}
          </span>
        </span>
      </span>
    </>
  );

  if (!canSwitch) {
    return <div className="flex items-center gap-3 px-4 py-3">{body}</div>;
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(push.enabled)}
      aria-labelledby={`${id}-name`}
      aria-describedby={`${id}-about`}
      onClick={() => void toggle()}
      disabled={push.busy}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-50"
    >
      {body}
      <span
        aria-hidden="true"
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors",
          push.enabled ? "bg-primary" : "bg-muted-foreground/40",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-card shadow-sm transition-transform motion-reduce:transition-none",
            push.enabled ? "translate-x-[1.125rem]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
