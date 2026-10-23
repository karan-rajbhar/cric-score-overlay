// @vitest-environment node
import {
  createDecipheriv,
  createECDH,
  createPublicKey,
  hkdfSync,
  verify,
} from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  b64url,
  encryptPayload,
  fromB64url,
  sendWebPush,
  vapidJwt,
  vapidKeysFromEnv,
  type VapidKeys,
} from "./web-push";

// RFC 8291 Appendix A.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  cek: "oIhVW04MRdy2XN9CiKLxTg",
  nonce: "4h_95klXJ5E_qnoN",
  message:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

/** The user agent's side of RFC 8291: decrypts a message body. */
function decrypt(body: Buffer, uaPrivate: string, auth: string): string {
  const salt = body.subarray(0, 16);
  const idlen = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + idlen);
  const record = body.subarray(21 + idlen);
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(fromB64url(uaPrivate));
  const uaPublic = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(asPublic);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", secret, fromB64url(auth), info, 32));
  const cek = Buffer.from(
    hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16),
  );
  const nonce = Buffer.from(
    hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12),
  );
  expect(b64url(cek)).toBe(RFC.cek);
  expect(b64url(nonce)).toBe(RFC.nonce);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(record.subarray(record.length - 16));
  const padded = Buffer.concat([
    decipher.update(record.subarray(0, record.length - 16)),
    decipher.final(),
  ]);
  expect(padded.at(-1)).toBe(2);
  return padded.subarray(0, padded.length - 1).toString("utf8");
}

describe("encryptPayload", () => {
  it("matches the RFC 8291 example", () => {
    const body = encryptPayload(
      Buffer.from(RFC.plaintext),
      { p256dh: RFC.uaPublic, auth: RFC.auth },
      { salt: fromB64url(RFC.salt), serverPrivateKey: fromB64url(RFC.asPrivate) },
    );
    expect(b64url(body)).toBe(RFC.message);
    expect(decrypt(body, RFC.uaPrivate, RFC.auth)).toBe(RFC.plaintext);
  });

  it("uses a fresh key and salt per message", () => {
    const target = { p256dh: RFC.uaPublic, auth: RFC.auth };
    const a = encryptPayload(Buffer.from("hello"), target);
    const b = encryptPayload(Buffer.from("hello"), target);
    expect(a.equals(b)).toBe(false);
    const rfcSaltAndKey = (body: Buffer) =>
      decryptFresh(body, RFC.uaPrivate, RFC.auth);
    expect(rfcSaltAndKey(a)).toBe("hello");
  });

  it("refuses bad keys and oversized payloads", () => {
    expect(() =>
      encryptPayload(Buffer.from("x"), { p256dh: "AAAA", auth: RFC.auth }),
    ).toThrow();
    expect(() =>
      encryptPayload(Buffer.alloc(3001), { p256dh: RFC.uaPublic, auth: RFC.auth }),
    ).toThrow(/too large/);
  });
});

/** decrypt() without the RFC's fixed CEK / nonce checks. */
function decryptFresh(body: Buffer, uaPrivate: string, auth: string): string {
  const salt = body.subarray(0, 16);
  const asPublic = body.subarray(21, 21 + body.readUInt8(20));
  const record = body.subarray(21 + body.readUInt8(20));
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(fromB64url(uaPrivate));
  const info = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    ecdh.getPublicKey(),
    asPublic,
  ]);
  const ikm = Buffer.from(
    hkdfSync("sha256", ecdh.computeSecret(asPublic), fromB64url(auth), info, 32),
  );
  const key = (label: string, n: number) =>
    Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from(label), n));
  const decipher = createDecipheriv(
    "aes-128-gcm",
    key("Content-Encoding: aes128gcm\0", 16),
    key("Content-Encoding: nonce\0", 12),
  );
  decipher.setAuthTag(record.subarray(record.length - 16));
  const out = Buffer.concat([
    decipher.update(record.subarray(0, record.length - 16)),
    decipher.final(),
  ]);
  return out.subarray(0, out.length - 1).toString("utf8");
}

function keyPair(): VapidKeys {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    publicKey: b64url(ecdh.getPublicKey()),
    privateKey: b64url(ecdh.getPrivateKey()),
    subject: "mailto:test@example.com",
  };
}

describe("vapidJwt", () => {
  it("is an ES256 JWT for the push service origin, signed by the key", () => {
    const keys = keyPair();
    const jwt = vapidJwt("https://fcm.googleapis.com", keys, 1_700_000_000);
    const [h, p, s] = jwt.split(".");
    expect(JSON.parse(fromB64url(h!).toString())).toEqual({
      typ: "JWT",
      alg: "ES256",
    });
    expect(JSON.parse(fromB64url(p!).toString())).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: 1_700_000_000 + 12 * 3600,
      sub: "mailto:test@example.com",
    });
    const pub = fromB64url(keys.publicKey);
    const publicKey = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: b64url(pub.subarray(1, 33)),
        y: b64url(pub.subarray(33)),
      },
      format: "jwk",
    });
    expect(
      verify(
        "sha256",
        Buffer.from(`${h}.${p}`),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        fromB64url(s!),
      ),
    ).toBe(true);
  });
});

describe("vapidKeysFromEnv", () => {
  it("needs both keys of the right length", () => {
    const keys = keyPair();
    expect(vapidKeysFromEnv({})).toBeNull();
    expect(
      vapidKeysFromEnv({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: keys.publicKey }),
    ).toBeNull();
    expect(
      vapidKeysFromEnv({
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: "short",
      }),
    ).toBeNull();
    expect(
      vapidKeysFromEnv({
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: keys.privateKey,
        VAPID_SUBJECT: "https://cricscore.example",
      }),
    ).toEqual({ ...keys, subject: "https://cricscore.example" });
  });
});

describe("sendWebPush", () => {
  it("posts the encrypted body with VAPID headers and reports gone subscriptions", async () => {
    const keys = keyPair();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 410 }));
    const result = await sendWebPush(
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        p256dh: RFC.uaPublic,
        auth: RFC.auth,
      },
      JSON.stringify({ title: "Hi" }),
      keys,
      { ttl: 3600, topic: "match1", fetchImpl: fetchImpl as never },
    );
    expect(result).toEqual({ status: 410, gone: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit & { headers: Record<string, string>; body: Uint8Array },
    ];
    expect(url).toBe("https://fcm.googleapis.com/fcm/send/abc");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      TTL: "3600",
      "Content-Encoding": "aes128gcm",
      Topic: "match1",
      Urgency: "normal",
    });
    expect(init.headers.Authorization).toMatch(
      new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${keys.publicKey}$`),
    );
    expect(
      decryptFresh(Buffer.from(init.body), RFC.uaPrivate, RFC.auth),
    ).toBe('{"title":"Hi"}');
  });
});
