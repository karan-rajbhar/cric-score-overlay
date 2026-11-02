import type { Metadata } from "next";
import { matchShareSummary } from "~/lib/match-share";
import { loadShareMatch, requestOrigin } from "~/lib/match-share-server";
import {
  cachedForMetadata,
  LIVE_METADATA_TTL_MS,
  TITLE_TTL_MS,
} from "~/lib/metadata-cache";
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
  const match = await cachedForMetadata(
    `match:${id}`,
    () => loadShareMatch(id),
    (m) => (m.status === "completed" ? TITLE_TTL_MS : LIVE_METADATA_TTL_MS),
  );
  if (!match) return { title: "Match" };

  const summary = matchShareSummary(match);
  const origin = await requestOrigin();
  const url = `${origin}/matches/${id}`;
  const image = {
    url: `${url}/og?v=${encodeURIComponent(summary.version)}`,
    width: 1200,
    height: 630,
    alt: summary.title,
  };
  return {
    title: summary.title,
    description: summary.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "CricScore",
      url,
      title: summary.title,
      description: summary.description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: summary.title,
      description: summary.description,
      images: [image.url],
    },
  };
}

export default function Page() {
  return <MatchDetailsPage />;
}
