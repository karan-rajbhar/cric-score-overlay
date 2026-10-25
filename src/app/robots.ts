import type { MetadataRoute } from "next";

/**
 * Keeps crawlers off pages that are not content but cost a server render
 * and Firestore reads per fetch: the OBS overlay, the scoring screen, the
 * printable report (already noindex), signed-in areas, search, the design
 * reference, the API and Firebase Auth's helper pages. Match, player,
 * team, club and tournament pages stay crawlable, and so does each match's
 * link preview image (`/matches/<id>/og`).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/__/",
        "/overlay/",
        "/matches/*/score",
        "/matches/*/report",
        "/clubs/*/stats-report",
        "/clubs/*/stats.csv",
        "/dashboard",
        "/invitations",
        "/search",
        "/design",
      ],
    },
  };
}
