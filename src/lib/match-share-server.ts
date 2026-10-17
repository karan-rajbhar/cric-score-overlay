import "server-only";
import { headers } from "next/headers";
import { getAdminFirestore } from "./firebase/admin";
import { AdminDataSource } from "./firebase/datasource-admin";
import type { DataSource } from "./firebase/datasource";
import type { ShareMatch } from "./match-share";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The match document for link previews: 1 read (team snapshots and
 * innings_summary are on it). Null for bad ids, missing matches or errors,
 * so a preview never breaks the page.
 */
export async function loadShareMatch(
  matchId: string,
  ds?: DataSource,
): Promise<ShareMatch | null> {
  if (!UUID_REGEX.test(matchId)) return null;
  try {
    const source = ds ?? new AdminDataSource(getAdminFirestore());
    return (await source.getById(
      "matches",
      matchId,
    )) as unknown as ShareMatch | null;
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
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3005";
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  return `${proto}://${host.split(",")[0]!.trim()}`;
}
