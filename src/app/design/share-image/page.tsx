"use client";

import { useEffect, useState } from "react";
import { SAMPLE_MATCH } from "../match/sample-match";

/*
 * Dev-only: the match summary image a share sends, in both orientations,
 * drawn by the real code (`summary-image.ts`) from the sample match:
 * landscape for link previews and desktops, portrait for phones' chats.
 */
export default function ShareImageDesignPage() {
  const [images, setImages] = useState<{ landscape: string; portrait: string } | null>(null);
  useEffect(() => {
    let live = true;
    void import("~/components/matches/summary-image").then(async (mod) => {
      const url = "https://cricscore.example/matches/preview";
      const [landscape, portrait] = await Promise.all([
        mod.summaryImageFile(SAMPLE_MATCH.finished, url),
        mod.summaryImageFile(SAMPLE_MATCH.finished, url, { portrait: true }),
      ]);
      if (live) {
        setImages({
          landscape: URL.createObjectURL(landscape),
          portrait: URL.createObjectURL(portrait),
        });
      }
    });
    return () => {
      live = false;
    };
  }, []);
  return (
    <main className="space-y-6 p-4">
      <h1 className="text-lg font-semibold">Match summary image</h1>
      {!images ? (
        <p className="text-sm text-muted-foreground">Drawing…</p>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <figure className="space-y-2">
            <figcaption className="text-sm text-muted-foreground">
              Portrait, 1080 by 1512 (phones), shown at a chat&apos;s width
            </figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images.portrait} alt="Portrait summary" width={330} />
          </figure>
          <figure className="space-y-2">
            <figcaption className="text-sm text-muted-foreground">
              Landscape, 1200 by 675, at the same width
            </figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images.landscape} alt="Landscape summary" width={330} />
          </figure>
        </div>
      )}
    </main>
  );
}
