"use client";

import { X } from "lucide-react";
import { setUpdateOffer, useUpdateOffer } from "~/lib/pwa/update-offer";

/**
 * "New version available · Reload": a thin strip at the top of the page,
 * in the flow, so it covers nothing (N12). "Not now" puts it away until
 * the next visit.
 */
export function UpdateStrip() {
  const offer = useUpdateOffer();
  if (!offer) return null;
  return (
    <div
      role="status"
      className="flex min-h-11 items-center justify-center gap-3 bg-primary-soft py-1 pl-4 pr-1 text-sm text-primary-soft-foreground"
    >
      <span className="min-w-0">
        {offer.note ?? "A new version of CricScore is ready."}
      </span>
      {!offer.note && (
        <button
          type="button"
          onClick={offer.reload}
          className="min-h-11 shrink-0 rounded-full px-3 font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reload
        </button>
      )}
      <button
        type="button"
        onClick={() => setUpdateOffer(null)}
        aria-label="Not now"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
