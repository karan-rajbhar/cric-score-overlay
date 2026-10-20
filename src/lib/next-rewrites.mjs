/**
 * The app's URL rewrites (`next.config.mjs`). Kept out of the config file
 * so tests can import them: Firebase App Hosting replaces `next.config.mjs`
 * at build time with a wrapper that exports only the default config, and a
 * test importing anything else from it fails the build's type check.
 */

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
 * Every rewrite, by phase.
 *
 * @returns {{
 *   beforeFiles: { source: string; destination: string }[];
 *   afterFiles: { source: string; destination: string }[];
 *   fallback: { source: string; destination: string }[];
 * }}
 */
export function appRewrites() {
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
}
