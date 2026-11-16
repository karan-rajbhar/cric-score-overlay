import type { Metadata } from "next";

/**
 * A page's link preview (Open Graph / Twitter): its title and description
 * and the card image its route draws at `<url>/og` (1200x630), as the
 * match page has.
 */
export function linkPreview({
  title,
  description,
  url,
  imageUrl = `${url}/og`,
}: {
  title: string;
  description: string;
  url: string;
  /** The card's address when it is not plain `<url>/og` (a `?v=` key). */
  imageUrl?: string;
}): Metadata {
  const image = { url: imageUrl, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "CricScore",
      url,
      title,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}
