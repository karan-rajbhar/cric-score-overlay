/**
 * Shared Firebase configuration (safe for both server and browser).
 *
 * Local development runs entirely against the Firebase Emulator Suite, so
 * every value has a `demo-` default: no Firebase project is required to run
 * and test the app on a laptop.
 */

import { env } from "~/env.js";

export const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8088,
  storage: 9199,
  ui: 4000,
} as const;

export const firebaseProjectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

export const firebaseStorageBucket =
  env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${firebaseProjectId}.appspot.com`;

export const firebaseWebConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:
    env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    `${firebaseProjectId}.firebaseapp.com`,
  projectId: firebaseProjectId,
  storageBucket: firebaseStorageBucket,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

/** True when the app should talk to the local emulator suite. */
export const useFirebaseEmulators =
  env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true";

/**
 * Host the browser uses to reach the emulators. Defaults to the loopback
 * address; set `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST` to your LAN IP when
 * testing from a phone on the same network.
 */
export const firebaseEmulatorHost =
  env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST ?? "127.0.0.1";

/** Firestore collection that carries realtime broadcast messages. */
export const BROADCAST_COLLECTION = "broadcasts";

/** How long a broadcast message is kept before Firestore TTL removes it. */
export const BROADCAST_TTL_MS = 10 * 60 * 1000;
