#!/usr/bin/env node
/**
 * Adds or removes a domain from the Firebase project's Auth "authorized
 * domains", so Google sign-in works from a temporary tunnel URL.
 *
 *   node scripts/firebase-auth-domain.mjs add <host>
 *   node scripts/firebase-auth-domain.mjs remove <host>
 *
 * Uses the service account in .env.local (FIREBASE_SERVICE_ACCOUNT_JSON).
 * Does nothing when the app runs on the emulators (they accept any domain).
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert } from "firebase-admin/app";

const [action, host] = process.argv.slice(2);
if (!action || !["add", "remove"].includes(action) || !host) {
  console.error("Usage: firebase-auth-domain.mjs add|remove <host>");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// .env.local first: loadEnvFile never overrides a variable already set.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(resolve(root, file));
  } catch {
    // Missing file: fall back to whatever else is set.
  }
}

if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR !== "false") {
  console.log("Emulators in use: no authorized domain change needed.");
  process.exit(0);
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
if (!raw) {
  console.error(
    "FIREBASE_SERVICE_ACCOUNT_JSON is not set; add the tunnel domain by hand in Firebase console → Authentication → Settings → Authorized domains.",
  );
  process.exit(1);
}
const account = JSON.parse(
  raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"),
);
const { access_token } = await cert(account).getAccessToken();
const base = `https://identitytoolkit.googleapis.com/admin/v2/projects/${account.project_id}/config`;
const headers = {
  Authorization: `Bearer ${access_token}`,
  "Content-Type": "application/json",
};

const config = await (await fetch(base, { headers })).json();
if (config.error) {
  console.error(`Could not read Auth config: ${config.error.message}`);
  process.exit(1);
}
/** @type {string[]} */
const current = config.authorizedDomains ?? [];
const next =
  action === "add"
    ? [...new Set([...current, host])]
    : current.filter((d) => d !== host);
if (next.length === current.length && action === "add" && current.includes(host)) {
  console.log(`${host} is already an authorized domain.`);
  process.exit(0);
}
if (next.length === current.length && action === "remove") {
  process.exit(0);
}

const res = await fetch(`${base}?updateMask=authorizedDomains`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ authorizedDomains: next }),
});
if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  console.error(
    `Could not update authorized domains: ${body.error?.message ?? res.status}`,
  );
  process.exit(1);
}
console.log(
  action === "add"
    ? `Google sign-in enabled for ${host} (project ${account.project_id}).`
    : `Removed ${host} from authorized domains.`,
);
