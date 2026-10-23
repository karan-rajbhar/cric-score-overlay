#!/usr/bin/env node
/**
 * Prints a new VAPID key pair for push notifications (base64url, P-256):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY (build and runtime, public)
 *   VAPID_PRIVATE_KEY            (runtime only, a secret)
 * Keep the pair: changing it invalidates every device's subscription.
 *
 *   node scripts/generate-vapid-keys.mjs
 */
import { createECDH } from "node:crypto";

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
console.log(
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString("base64url")}`,
);
const key = ecdh.getPrivateKey();
const padded = Buffer.concat([Buffer.alloc(Math.max(0, 32 - key.length)), key]);
console.log(`VAPID_PRIVATE_KEY=${padded.toString("base64url")}`);
