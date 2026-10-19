import "server-only";
import { headers } from "next/headers";
import { getAdminFirestore } from "./firebase/admin";
import { AdminDataSource } from "./firebase/datasource-admin";
import type { DataSource } from "./firebase/datasource";
import { inningsSummaryEntry } from "./firebase/derive.mjs";
import { staleSummaryInnings } from "./firebase/innings-summary";
import type { ShareMatch } from "./match-share";
import { originFromHeaders } from "./request-origin";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The match document for link previews: 1 read (team snapshots and
 * innings_summary are on it), plus the innings in progress of a live match,
 * whose summary entry does not follow every ball. Null for bad ids, missing
 * matches or errors, so a preview never breaks the page.
 */
export async function loadShareMatch(
  matchId: string,
  ds?: DataSource,
): Promise<ShareMatch | null> {
  if (!UUID_REGEX.test(matchId)) return null;
  try {
    const source = ds ?? new AdminDataSource(getAdminFirestore());
    const match = (await source.getById(
      "matches",
      matchId,
    )) as unknown as ShareMatch | null;
    const stale = match ? staleSummaryInnings(match) : [];
    if (!match || !stale.length) return match;
    const fresh = new Map(
      (await source.getByIds("innings", stale)).map((d) => [d.id, d]),
    );
    return {
      ...match,
      innings_summary: (match.innings_summary ?? []).map((e) => {
        const doc = fresh.get(e.id);
        return doc ? (inningsSummaryEntry(doc) as unknown as typeof e) : e;
      }),
    };
  } catch (err) {
    console.error("loadShareMatch failed:", err);
    return null;
  }
}

/**
 * Public origin of the current request (App Hosting sits behind a proxy,
 * so the forwarded host wins). Link previews need absolute URLs, and the
 * Next.js fallback for a missing `metadataBase` is localhost.
 */
export async function requestOrigin(): Promise<string> {
  return originFromHeaders(await headers());
}
