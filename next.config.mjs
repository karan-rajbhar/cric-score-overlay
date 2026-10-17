/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 */
await import("./src/env.js");

/**
 * Serves Firebase Auth's helper pages from our own origin so Google sign-in
 * works on browsers that partition third-party storage (Safari/iOS). With
 * `authDomain` set to the app's domain, the SDK loads `/__/auth/*` (handler,
 * iframe) and `/__/firebase/init.json` from here; we proxy them to the
 * project's firebaseapp.com host. Skipped with the emulators, which serve
 * these pages themselves.
 * https://firebase.google.com/docs/auth/web/redirect-best-practices
 *
 * @returns {{ source: string; destination: string }[]}
 */
export function firebaseAuthProxyRewrites() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true" || !projectId) {
    return [];
  }
  const origin = `https://${projectId}.firebaseapp.com`;
  return [
    { source: "/__/auth/:path*", destination: `${origin}/__/auth/:path*` },
    {
      source: "/__/firebase/:path*",
      destination: `${origin}/__/firebase/:path*`,
    },
  ];
}

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

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
  env: { NEXT_PUBLIC_BUILD_ID: buildId() },
  reactStrictMode: true,
  allowedDevOrigins: ["*.trycloudflare.com", "*.loca.lt"],
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
      { source: "/sw.js", headers: noStore },
      { source: "/sw-config.json", headers: noStore },
      {
        source: "/offline.html",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
  async rewrites() {
    return {
      // Checked before app routes, so nothing in the app can shadow `/__/`.
      beforeFiles: firebaseAuthProxyRewrites(),
      afterFiles: [
        {
          source: "/:handle(@[a-zA-Z0-9_]{3,30})",
          destination: "/players/:handle",
        },
      ],
      fallback: [],
    };
  },
};

export default config;
