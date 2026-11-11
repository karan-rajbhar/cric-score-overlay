"use client";

import { Toaster as Sonner } from "sonner";

/**
 * The app's toasts (N12): below the top bar on phones (and the iPhone's
 * status bar in the installed app), clear of the header on larger screens,
 * in the app's font and card look rather than the library's tinted fills.
 * State is told by a small coloured title, not a coloured box.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={{ top: "4.5rem" }}
      mobileOffset={{
        top: "calc(env(safe-area-inset-top) + 4.5rem)",
        left: "1rem",
        right: "1rem",
      }}
      style={{ fontFamily: "var(--font-sans)" }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !border !border-border/60 !bg-popover !text-popover-foreground !shadow-float !text-sm",
          description: "!text-muted-foreground",
          actionButton:
            "!h-8 !rounded-full !bg-primary !px-3 !text-primary-foreground",
          cancelButton: "!h-8 !rounded-full !bg-muted !px-3 !text-foreground",
          closeButton:
            "!border-border !bg-popover !text-muted-foreground hover:!text-foreground",
          error: "[&_[data-title]]:!text-destructive",
          success: "[&_[data-title]]:!text-success",
          warning: "[&_[data-title]]:!text-warning",
        },
      }}
    />
  );
}
