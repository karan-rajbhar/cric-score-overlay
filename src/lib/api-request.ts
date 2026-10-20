import type { NextRequest } from "next/server";

/**
 * Checks shared by the JSON routes that act for a signed-in user
 * (`/api/scoring/replay`, `/api/overlay/command`). The session cookie is
 * SameSite=Lax, so they also require a same-origin `Origin` header (the
 * check Next.js applies to server actions) and a JSON body, which a
 * cross-site form cannot send.
 */

/** The request's `Origin` is this host (behind a proxy: X-Forwarded-Host). */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  return Boolean(host) && originHost === host;
}

/** Whether the request declares a JSON body. */
export function isJsonRequest(request: NextRequest): boolean {
  const type = request.headers.get("content-type") ?? "";
  return /^application\/json\s*(;|$)/i.test(type);
}

/** The body as text, or null once it exceeds `max` bytes. */
export async function readCapped(
  request: NextRequest,
  max: number,
): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
