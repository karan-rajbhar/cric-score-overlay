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

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
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
