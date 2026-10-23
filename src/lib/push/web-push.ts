/**
 * Web Push from the server with node:crypto alone (no `web-push` package):
 * VAPID authentication (RFC 8292, an ES256 JWT) and the `aes128gcm`
 * payload encryption (RFC 8291 over RFC 8188), one record per message.
 *
 * Configured by NEXT_PUBLIC_VAPID_PUBLIC_KEY (the application server key
 * browsers subscribe with, base64url, 65 bytes) and VAPID_PRIVATE_KEY
 * (base64url, 32 bytes); VAPID_SUBJECT (mailto: or https:) is optional.
 * Without both keys push is off. Generate a pair with
 * `node scripts/generate-vapid-keys.mjs`.
 */

import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  hkdfSync,
  randomBytes,
  sign,
  type KeyObject,
} from "node:crypto";

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface PushTarget {
  endpoint: string;
  /** The browser's ECDH public key (base64url, 65 bytes). */
  p256dh: string;
  /** The browser's auth secret (base64url, 16 bytes). */
  auth: string;
}

export interface SendOptions {
  /** Seconds the push service keeps an undelivered message. */
  ttl: number;
  /** Replaces an undelivered message with the same topic (<= 32 chars). */
  topic?: string;
  urgency?: "very-low" | "low" | "normal" | "high";
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface SendResult {
  status: number;
  /** The subscription no longer exists (404 / 410): delete it. */
  gone: boolean;
}

const RECORD_SIZE = 4096;
/** Plaintext limit for one record (4096 - 16 tag - 1 delimiter, rounded). */
export const MAX_PAYLOAD_BYTES = 3000;
const JWT_LIFETIME_SECONDS = 12 * 60 * 60;
const DEFAULT_SUBJECT = "mailto:push@cricscore.invalid";

export function b64url(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

export function fromB64url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

/** Push keys from the environment, or null when push is not configured. */
export function vapidKeysFromEnv(
  env: Record<string, string | undefined> = process.env,
): VapidKeys | null {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  if (fromB64url(publicKey).length !== 65) return null;
  if (fromB64url(privateKey).length !== 32) return null;
  const subject = env.VAPID_SUBJECT?.trim();
  return {
    publicKey,
    privateKey,
    subject:
      subject && /^(mailto:|https:\/\/)/.test(subject) ? subject : DEFAULT_SUBJECT,
  };
}

const signingKeys = new Map<string, KeyObject>();

function signingKey(keys: VapidKeys): KeyObject {
  let key = signingKeys.get(keys.privateKey);
  if (!key) {
    const pub = fromB64url(keys.publicKey);
    key = createPrivateKey({
      key: {
        kty: "EC",
        crv: "P-256",
        d: keys.privateKey,
        x: b64url(pub.subarray(1, 33)),
        y: b64url(pub.subarray(33, 65)),
      },
      format: "jwk",
    });
    signingKeys.set(keys.privateKey, key);
  }
  return key;
}

/** The VAPID JWT for a push service origin (RFC 8292). */
export function vapidJwt(
  audience: string,
  keys: VapidKeys,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    Buffer.from(
      JSON.stringify({
        aud: audience,
        exp: nowSeconds + JWT_LIFETIME_SECONDS,
        sub: keys.subject,
      }),
    ),
  );
  const input = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(input), {
    key: signingKey(keys),
    dsaEncoding: "ieee-p1363",
  });
  return `${input}.${b64url(signature)}`;
}

function hkdf(ikm: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
  return Buffer.from(hkdfSync("sha256", ikm, salt, info, length));
}

/**
 * The encrypted body for one subscription (RFC 8291): a header (salt,
 * record size, the server's ephemeral public key) and one record. `salt`
 * and `serverPrivateKey` are for tests only (RFC 8291 Appendix A).
 */
export function encryptPayload(
  plaintext: Uint8Array,
  target: Pick<PushTarget, "p256dh" | "auth">,
  testing?: { salt: Buffer; serverPrivateKey: Buffer },
): Buffer {
  if (plaintext.length > MAX_PAYLOAD_BYTES) {
    throw new Error("Push payload too large");
  }
  const uaPublic = fromB64url(target.p256dh);
  const authSecret = fromB64url(target.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) {
    throw new Error("Invalid push subscription keys");
  }
  const ecdh = createECDH("prime256v1");
  if (testing) ecdh.setPrivateKey(testing.serverPrivateKey);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const ecdhSecret = ecdh.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    uaPublic,
    asPublic,
  ]);
  const ikm = hkdf(ecdhSecret, authSecret, keyInfo, 32);
  const salt = testing?.salt ?? randomBytes(16);
  const cek = hkdf(ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12);

  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  // One record, so it is the last: delimiter 0x02, no padding.
  const record = Buffer.concat([
    cipher.update(Buffer.concat([Buffer.from(plaintext), Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, record]);
}

/** Sends one message; never throws for an HTTP error status. */
export async function sendWebPush(
  target: PushTarget,
  payload: string,
  keys: VapidKeys,
  options: SendOptions,
): Promise<SendResult> {
  const body = encryptPayload(Buffer.from(payload, "utf8"), target);
  const audience = new URL(target.endpoint).origin;
  const headers: Record<string, string> = {
    TTL: String(Math.max(0, Math.floor(options.ttl))),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    Authorization: `vapid t=${vapidJwt(audience, keys)}, k=${keys.publicKey}`,
    Urgency: options.urgency ?? "normal",
  };
  if (options.topic) headers.Topic = options.topic;
  const res = await (options.fetchImpl ?? fetch)(target.endpoint, {
    method: "POST",
    headers,
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  });
  return { status: res.status, gone: res.status === 404 || res.status === 410 };
}
