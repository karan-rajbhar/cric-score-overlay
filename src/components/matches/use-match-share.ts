"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { buildExportSummary } from "~/lib/match-report";
import type { Match } from "~/lib/match-types";
import {
  matchShareMessage,
  matchShareUrl,
  shareImage,
} from "~/lib/share-match";

/**
 * Sharing a match as its summary image with a message
 * (`matchShareMessage`): the share sheet on phones and tablets, a download
 * elsewhere (`shareImage`). Browsers open the share sheet only right after
 * a tap, so `prepare` (on touch-down) starts the image and it is kept until
 * the match changes; if it still took too long, a toast offers to share it
 * with one more tap. `copyMessage`: where the image is downloaded, copy the
 * message too (the scorer pastes it with the image).
 */
export function useMatchShare(
  match: Match | null | undefined,
  { copyMessage = false }: { copyMessage?: boolean } = {},
) {
  const built = useRef<{ key: string; file: Promise<File> } | null>(null);
  const [busy, setBusy] = useState(false);

  const imageFor = useCallback((m: Match) => {
    const url = matchShareUrl(m.id);
    // What the image shows: a new one only when that changes.
    const key = JSON.stringify(buildExportSummary(m, url));
    if (built.current?.key !== key) {
      const file = import("./summary-image").then((mod) =>
        mod.summaryImageFile(m, url),
      );
      file.catch(() => {
        if (built.current?.key === key) built.current = null;
      });
      built.current = { key, file };
    }
    return built.current.file;
  }, []);

  const prepare = useCallback(() => {
    if (match) imageFor(match).catch(() => undefined);
  }, [match, imageFor]);

  const share = useCallback(async () => {
    if (!match) return;
    const text = matchShareMessage(match, matchShareUrl(match.id));
    setBusy(true);
    try {
      let file: File;
      try {
        file = await imageFor(match);
      } catch (err) {
        console.error("Share: could not draw the summary image", err);
        // The message alone, with its link.
        if (typeof navigator.share === "function") {
          await navigator.share({ text }).catch(() => undefined);
        } else {
          await navigator.clipboard?.writeText(text);
          toast.success("Message copied");
        }
        return;
      }
      const outcome = await shareImage(file, text);
      if (outcome === "expired") {
        toast("The image is ready to share", {
          action: {
            label: "Share",
            onClick: () => void shareImage(file, text),
          },
        });
      } else if (outcome === "downloaded") {
        const copied =
          copyMessage &&
          (await navigator.clipboard?.writeText(text).then(
            () => true,
            () => false,
          ));
        toast.success(
          copied
            ? "Summary image downloaded and message copied"
            : "Summary image downloaded",
        );
      }
    } finally {
      setBusy(false);
    }
  }, [match, imageFor, copyMessage]);

  return { prepare, share, busy };
}
