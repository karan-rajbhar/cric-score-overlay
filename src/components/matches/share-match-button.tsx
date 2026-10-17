"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { matchShareUrl, shareMatch } from "~/lib/share-match";

/**
 * Shares the match page link: the system share sheet where available
 * (phones), else copies the link, else opens WhatsApp with it. Crawlers
 * build the rich preview from the page's Open Graph metadata.
 */
export function ShareMatchButton({
  matchId,
  title,
  text,
  className,
  label = "Share match",
}: {
  matchId: string;
  title: string;
  /** Message sent with the link; defaults to the title. */
  text?: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const outcome = await shareMatch(matchShareUrl(matchId), title, text);
    if (outcome === "copied") {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleShare}
      aria-label={copied ? "Link copied" : label}
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
