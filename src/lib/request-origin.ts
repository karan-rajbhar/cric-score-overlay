/**
 * Public origin of a request from its headers. App Hosting (and the dev
 * tunnel) sit behind a proxy, so the forwarded host wins over `Host`, and
 * the request URL's own origin is the server's internal address: links
 * and QR codes built from it do not open on a phone.
 */
export function originFromHeaders(h: Pick<Headers, "get">): string {
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3005")
    .split(",")[0]!
    .trim();
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}
