"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "~/components/ui/button";

/**
 * Shares the match page link: the system share sheet where available
 * (phones), else copies the link, else opens WhatsApp with it. Crawlers
 * build the rich preview from the page's Open Graph metadata.
 */
export function ShareMatchButton({
  matchId,
  title,
  className,
}: {
  matchId: string;
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/matches/${matchId}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        // The user closed the sheet: nothing else to do.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleShare}
      aria-label={copied ? "Link copied" : "Share match"}
      className={className}
    >
      {copied ? <Check /> : <Share2 />}
      <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </Button>
  );
}
