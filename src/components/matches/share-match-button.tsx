"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "~/components/ds/button";
import { matchShareUrl, shareMatch } from "~/lib/share-match";

/**
 * Shares the match page link, with `text` (the score so far) when given:
 * the system share sheet where available (phones), else copies both, else
 * opens WhatsApp with them. `copied` is true for a moment after copying.
 * Crawlers build the rich preview from the page's Open Graph metadata.
 */
export function useShareLink(matchId: string, title: string, text?: string) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const outcome = await shareMatch(matchShareUrl(matchId), title, text);
    if (outcome === "copied") {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };
  return { copied, share };
}

/** The match's link in one tap: for a match with only a link to send. */
export function ShareMatchButton({
  matchId,
  title,
  text,
  className,
  label = "Share link",
  iconOnly = false,
}: {
  matchId: string;
  title: string;
  /** Message sent with the link; defaults to the title. */
  text?: string;
  className?: string;
  label?: string;
  /** Round icon buttons: no word beside the icon on any screen. */
  iconOnly?: boolean;
}) {
  const { copied, share } = useShareLink(matchId, title, text);

  return (
    <Button
      type="button"
      variant="surface"
      size="sm"
      onClick={share}
      aria-label={copied ? "Link copied" : label}
      className={className}
    >
      {copied ? <Check /> : <Share2 />}
      {!iconOnly && (
        <span className="hidden sm:inline">{copied ? "Copied" : label}</span>
      )}
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </Button>
  );
}
