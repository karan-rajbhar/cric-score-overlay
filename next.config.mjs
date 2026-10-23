import { appRewrites, FRAME_HEADERS_SOURCE } from "./src/lib/next-rewrites.mjs";

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 */
await import("./src/env.js");

/**
 * Identifies this build to the service worker (`/sw.js?v=<id>`), so each
 * deploy installs a fresh worker and drops the previous build's caches. Set
 * once per build process; child workers inherit it through the environment.
 */
function buildId() {
  if (!process.env.CRICSCORE_BUILD_ID) {
    const sha =
      process.env.GIT_COMMIT_SHA ??
      process.env.COMMIT_SHA ??
      process.env.GITHUB_SHA ??
      "";
    process.env.CRICSCORE_BUILD_ID = [sha.slice(0, 12), Date.now().toString(36)]
      .filter(Boolean)
      .join("-");
  }
  return process.env.CRICSCORE_BUILD_ID;
}

/**
 * Security headers on every response. HSTS starts short (5 minutes) so a
 * mistake cannot lock the domain to HTTPS for long; raise it to a year
 * (`max-age=31536000`) once it has run cleanly in production. Features the
 * app never uses are switched off (it uses clipboard, Web Share, vibration
 * and the screen wake lock, which stay allowed).
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=300" }]
    : []),
];

/**
 * Clickjacking protection, plus the CSP directives that cannot break the
 * app's scripts. A script-src policy (nonces, Trusted Types) needs testing
 * in a browser first, so it is not here yet.
 */
const FRAME_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Content-Security-Policy",
    value:
      "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
  },
];

/**
 * Development over the Cloudflare tunnel: Cloudflare turns the dev server's
 * `no-cache` into a 4-hour browser cache (and caches `.js` at its edge), and
 * dev chunk names do not change with their content, so the browser would
 * keep running old code against fresh server HTML (hydration mismatches,
 * stale pages). `no-store` is respected by both.
 */
const DEV_NO_CACHE = [
  {
    source: "/_next/:path*",
    headers: [
      { key: "Cache-Control", value: "no-store, must-revalidate" },
      { key: "CDN-Cache-Control", value: "no-store" },
    ],
  },
];

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
  env: { NEXT_PUBLIC_BUILD_ID: buildId() },
  reactStrictMode: true,
  // Hosts the dev server may be opened from (Next.js refuses its dev
  // resources, HMR and chunks, to any other origin): the quick tunnels, and
  // the fixed tunnel host from .env.local (`npm run dev`).
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.loca.lt",
    ...(process.env.DEV_TUNNEL_HOST ? [process.env.DEV_TUNNEL_HOST] : []),
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "http", hostname: "127.0.0.1", port: "9199" },
      { protocol: "http", hostname: "localhost", port: "9199" },
    ],
  },
  async headers() {
    // The worker and its kill switch must never come from a cache.
    const noStore = [
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
    ];
    return [
      ...(process.env.NODE_ENV === "production" ? [] : DEV_NO_CACHE),
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Not on Firebase Auth's proxied helper pages (`/__/`), nor on the
      // overlays (`/overlay/<id>`, `/overlay/channel/<id>`), which streaming
      // tools may frame. Control rooms and setup pages stay unframeable.
      { source: FRAME_HEADERS_SOURCE, headers: FRAME_HEADERS },
      { source: "/sw.js", headers: noStore },
      { source: "/sw-config.json", headers: noStore },
      {
        source: "/offline.html",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
  async rewrites() {
    return appRewrites();
  },
};

export default config;
