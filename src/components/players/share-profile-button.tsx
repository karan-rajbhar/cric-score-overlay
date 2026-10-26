"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";

/** Opens the share sheet where there is one, else copies the link. */
export function ShareProfileButton({ name }: { name: string }) {
  const share = async () => {
    const url = window.location.origin + window.location.pathname;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `${name} on CricScore`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    } catch (error) {
      // Closing the share sheet is not an error.
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not share the link");
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs"
      onClick={() => void share()}
    >
      <Share2 className="h-3.5 w-3.5 text-primary" />
      <span>Share</span>
    </Button>
  );
}
