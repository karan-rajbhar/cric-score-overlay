/**
 * Firebase Admin SDK bootstrap (server only).
 *
 * Server actions, route handlers and server components talk to Firestore,
 * Auth and Storage through the Admin SDK, which bypasses security rules.
 * Authorization is therefore enforced in the server actions themselves
 * (exactly as before, where the server client carried the user session).
 */

import "server-only";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import {
  EMULATOR_PORTS,
  firebaseEmulatorHost,
  firebaseProjectId,
  firebaseStorageBucket,
  useFirebaseEmulators,
} from "./config";

const SERVER_EMULATOR_HOST =
  process.env.FIREBASE_EMULATOR_HOST_SERVER ?? "127.0.0.1";

function configureEmulatorEnvironment(): void {
  if (!useFirebaseEmulators) return;
  // The Next.js server always runs on the same machine as the emulators,
  // so prefer loopback even when the browser is pointed at a LAN address.
  const host =
    firebaseEmulatorHost === "127.0.0.1" || firebaseEmulatorHost === "localhost"
      ? firebaseEmulatorHost
      : SERVER_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST ??= `${host}:${EMULATOR_PORTS.firestore}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `${host}:${EMULATOR_PORTS.auth}`;
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= `${host}:${EMULATOR_PORTS.storage}`;
  process.env.STORAGE_EMULATOR_HOST ??= `http://${host}:${EMULATOR_PORTS.storage}`;
}

function buildCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const json = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    return cert(JSON.parse(json));
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }
  return undefined;
}

let firestoreConfigured = false;

export function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  configureEmulatorEnvironment();

  const credential = useFirebaseEmulators ? undefined : buildCredential();
  return initializeApp({
    projectId: firebaseProjectId,
    storageBucket: firebaseStorageBucket,
    ...(credential ? { credential } : {}),
  });
}

export function getAdminFirestore(): Firestore {
  const db = getFirestore(getAdminApp());
  if (!firestoreConfigured) {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // settings() can only be called once per instance; ignore re-entry.
    }
    firestoreConfigured = true;
  }
  return db;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}
