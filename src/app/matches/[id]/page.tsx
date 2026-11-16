import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { matchShareSummary } from "~/lib/match-share";
import { loadShareMatch, requestOrigin } from "~/lib/match-share-server";
import {
  cachedForMetadata,
  LIVE_METADATA_TTL_MS,
  TITLE_TTL_MS,
} from "~/lib/metadata-cache";
import { linkPreview } from "~/lib/link-preview";
import { MatchDetailsPage } from "./match-detail";

/**
 * Link previews (Open Graph / Twitter) for a shared match: title and score
 * from the match document (1 read, remembered across requests because a
 * prefetch runs this too) and a generated image (`./og`). The page itself
 * stays a client component fed by realtime listeners.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await sharedMatch(id);
  if (!match) return { title: "Match not found" };

  const summary = matchShareSummary(match);
  const origin = await requestOrigin();
  const url = `${origin}/matches/${id}`;
  return linkPreview({
    title: summary.title,
    description: summary.description,
    url,
    // A new image whenever the score changes.
    imageUrl: `${url}/og?v=${encodeURIComponent(summary.version)}`,
  });
}

/**
 * The match document both use, read once: the metadata's read is reused, so
 * the page itself costs nothing for a match that exists. A missing one is
 * not remembered (a match made a moment later must open).
 */
function sharedMatch(id: string) {
  return cachedForMetadata(
    `match:${id}`,
    () => loadShareMatch(id),
    (m) => (m.status === "completed" ? TITLE_TTL_MS : LIVE_METADATA_TTL_MS),
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // A match that is not there gets the app's not-found screen (and a 404),
  // not a database error with a Try again that cannot help (N6).
  const match = await sharedMatch((await params).id);
  if (!match) notFound();
  // The same read: its score and result in the first HTML, before any
  // script (a phone on slow data waited for the whole bundle to see it).
  const summary = matchShareSummary(match);
  return (
    <MatchDetailsPage
      preview={{
        sides: summary.sides.map((s) => ({
          name: s.name,
          score: s.score,
          overs: s.overs,
        })),
        footer: summary.footer,
      }}
    />
  );
}
