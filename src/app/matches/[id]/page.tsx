import type { Metadata } from "next";
import { matchShareSummary } from "~/lib/match-share";
import { loadShareMatch, requestOrigin } from "~/lib/match-share-server";
import { MatchDetailsPage } from "./match-detail";

/**
 * Link previews (Open Graph / Twitter) for a shared match: title and score
 * from the match document (1 read) and a generated image (`./og`). The
 * page itself stays a client component fed by realtime listeners.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await loadShareMatch(id);
  if (!match) return { title: "Match — CricScore" };

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
    title: `${summary.title} | CricScore`,
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
