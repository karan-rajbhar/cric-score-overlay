"use client";

import * as React from "react";
import { BrandMark } from "~/components/brand";
import { Button } from "~/components/ds/button";
import { buildReportPdf, canShareFiles, downloadFile } from "./report-pdf";

type PdfState = "preparing" | "share" | "download" | "failed";

/**
 * The report as a PDF file, built ahead once the page has loaded: the
 * share sheet only opens straight from a tap, with no wait in between.
 */
function usePdfFile(fileName: string) {
  const [state, setState] = React.useState<PdfState>("preparing");
  const file = React.useRef<File | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const start = () => {
      const idle =
        window.requestIdleCallback ??
        ((f: () => void) => window.setTimeout(f, 200));
      idle(() => {
        buildReportPdf(fileName).then(
          (f) => {
            if (cancelled) return;
            file.current = f;
            setState(canShareFiles() ? "share" : "download");
          },
          (err: unknown) => {
            console.error("Share PDF: could not build the file", err);
            if (!cancelled) setState("failed");
          },
        );
      });
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
    };
  }, [fileName]);

  const send = React.useCallback(() => {
    const f = file.current;
    if (!f) return;
    if (state !== "share") return downloadFile(f);
    // The file alone: with text as well, some share targets (WhatsApp on
    // iOS) drop the file. The link and QR code are in the PDF.
    navigator.share({ files: [f] }).catch((e: unknown) => {
      // Cancelled: nothing to do. Refused (the tap expired): download.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        downloadFile(f);
      }
    });
  }, [state]);

  return { state, send };
}

const PDF_LABEL: Record<Exclude<PdfState, "failed">, string> = {
  preparing: "Preparing PDF…",
  share: "Share PDF",
  download: "Download PDF",
};

/**
 * The report's actions, on screen only (`#screen-toolbar` is left out of
 * the PDF and the print): share the PDF file, share the link, print, close.
 * If the PDF cannot be built its button goes; printing remains.
 */
export function ReportToolbar({
  fileName,
  matchUrl,
}: {
  fileName: string;
  matchUrl: string;
}) {
  const pdf = usePdfFile(fileName);
  const [linkCopied, setLinkCopied] = React.useState(false);

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: document.title, url: matchUrl }).catch(() => {});
    } else {
      void navigator.clipboard
        ?.writeText(matchUrl)
        .then(() => setLinkCopied(true));
    }
  };
  // Fonts first, or the print falls back to system faces.
  const print = () =>
    void (document.fonts?.ready ?? Promise.resolve()).then(() =>
      window.print(),
    );
  // Opened from the match page in its own window: close it; opened in this
  // tab: back to the match.
  const close = () =>
    window.opener ? window.close() : window.location.assign(matchUrl);

  return (
    <div
      id="screen-toolbar"
      className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur print:hidden"
    >
      <div className="mx-auto flex max-w-[52rem] flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BrandMark className="h-7 w-7" />
          Match report
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {pdf.state !== "failed" && (
            <Button
              id="btn-share-pdf"
              size="sm"
              disabled={pdf.state === "preparing"}
              data-file-name={fileName}
              onClick={pdf.send}
            >
              {PDF_LABEL[pdf.state]}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={shareLink}>
            {linkCopied ? "Link copied" : "Share link"}
          </Button>
          <Button size="sm" variant="outline" onClick={print}>
            <span>
              Print<span className="hidden sm:inline"> or save as PDF</span>
            </span>
          </Button>
          <Button size="sm" variant="ghost" onClick={close}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
