"use client";

import { useRouter } from "next/navigation";
import { FileText, ImageIcon, Link2 } from "lucide-react";
import { toast } from "sonner";
import { ShareMenu } from "~/components/ds/share-menu";
import type { Match } from "~/lib/match-types";
import { useShareLink } from "./share-match-button";
import { useMatchShare } from "./use-match-share";

/**
 * What a finished match has to send, behind one Share button: its link, the
 * summary image (the share sheet on phones, a download elsewhere) and the
 * printable report, a page that shares or prints as a PDF. The image starts
 * when the menu opens, because browsers open the share sheet only right
 * after a tap. The ball-by-ball data (Cricsheet) is in the ⋯ menu.
 */
export function MatchShareMenu({
  match,
  title,
  text,
  className,
}: {
  match: Match;
  title: string;
  /** Message sent with the link. */
  text?: string;
  className?: string;
}) {
  const router = useRouter();
  const link = useShareLink(match.id, title, text);
  const image = useMatchShare(match);

  const openReport = () => {
    try {
      const reportUrl = `/matches/${match.id}/report`;
      const isMobile = window.innerWidth < 768;
      const w = window.open(
        reportUrl,
        "_blank",
        isMobile ? undefined : "width=860,height=950",
      );
      if (!w) router.push(reportUrl);
    } catch (err) {
      console.error("Match report error:", err);
      toast.error("Could not open the match report");
    }
  };

  return (
    <>
      <ShareMenu
        className={className}
        done={link.copied}
        onOpenChange={(open) => {
          if (open) image.prepare();
        }}
        items={[
          {
            label: "Share link",
            icon: Link2,
            onSelect: () => void link.share(),
          },
          {
            label: "Share image",
            icon: ImageIcon,
            disabled: image.busy,
            onSelect: () => void image.share(),
          },
          { label: "Match report", icon: FileText, onSelect: openReport },
        ]}
      />
      <span role="status" className="sr-only">
        {link.copied ? "Link copied" : ""}
      </span>
    </>
  );
}
