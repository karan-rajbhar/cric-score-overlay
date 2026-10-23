import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource } from "~/lib/firebase/datasource";
import { RateLimiter } from "./rate-limit";
import {
  createRemoteToken,
  hashSecret,
  PRODUCER_TOKENS,
  remoteTokenStatus,
  revokeRemoteTokens,
  tokenIdOf,
  verifyRemoteToken,
} from "./remote-token";
import { isRemoteAction, remoteCommandFor } from "./remote-actions";

describe("remote tokens", () => {
  it("stores only a hash and verifies the token for its match (1 read)", async () => {
    const ds = new MemoryDataSource();
    const token = await createRemoteToken(ds, "m1", "u1");
    expect(token).toMatch(/^[\w-]{12}\.[\w-]{43}$/);

    const [row] = ds.all(PRODUCER_TOKENS);
    const secret = token.split(".")[1]!;
    expect(row).toMatchObject({
      id: tokenIdOf(token),
      match_id: "m1",
      secret_hash: hashSecret(secret),
      created_by: "u1",
    });
    expect(JSON.stringify(row)).not.toContain(secret);

    const before = ds.billedReads;
    expect(await verifyRemoteToken(ds, token)).toBe("m1");
    expect(ds.billedReads - before).toBe(1);
  });

  it("refuses a wrong secret, an unknown id or a malformed token", async () => {
    const ds = new MemoryDataSource();
    const token = await createRemoteToken(ds, "m1", "u1");
    const [id, secret] = token.split(".") as [string, string];
    const flipped = secret.slice(0, -1) + (secret.endsWith("A") ? "B" : "A");
    expect(await verifyRemoteToken(ds, `${id}.${flipped}`)).toBeNull();
    expect(await verifyRemoteToken(ds, `AAAAAAAAAAAA.${secret}`)).toBeNull();

    const before = ds.billedReads;
    expect(await verifyRemoteToken(ds, "not-a-token")).toBeNull();
    expect(await verifyRemoteToken(ds, `${id}/x.${secret}`)).toBeNull();
    expect(ds.billedReads).toBe(before);
  });

  it("revokes, and regenerating replaces the old token", async () => {
    const ds = new MemoryDataSource();
    const first = await createRemoteToken(ds, "m1", "u1");
    const other = await createRemoteToken(ds, "m2", "u1");
    const second = await createRemoteToken(ds, "m1", "u2");
    expect(await verifyRemoteToken(ds, first)).toBeNull();
    expect(await verifyRemoteToken(ds, second)).toBe("m1");
    expect((await remoteTokenStatus(ds, "m1")).active).toBe(true);

    expect(await revokeRemoteTokens(ds, "m1")).toBe(1);
    expect(await verifyRemoteToken(ds, second)).toBeNull();
    expect(await remoteTokenStatus(ds, "m1")).toEqual({
      active: false,
      created_at: null,
    });
    // Another match's token is untouched.
    expect(await verifyRemoteToken(ds, other)).toBe("m2");
  });
});

describe("RateLimiter", () => {
  it("allows 5 a second per key, then refuses until the window moves", () => {
    const limiter = new RateLimiter(5, 1000);
    const t = 10_000;
    for (let i = 0; i < 5; i++) expect(limiter.allow("a", t + i)).toBe(true);
    expect(limiter.allow("a", t + 10)).toBe(false);
    expect(limiter.allow("b", t + 10)).toBe(true);
    expect(limiter.allow("a", t + 1001)).toBe(true);
  });

  it("forgets the oldest keys beyond its cap", () => {
    const limiter = new RateLimiter(1, 1000, 2);
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("b", 0)).toBe(true);
    expect(limiter.allow("c", 0)).toBe(true);
    // "a" was dropped, so it starts afresh.
    expect(limiter.allow("a", 1)).toBe(true);
    expect(limiter.allow("c", 1)).toBe(false);
  });
});

describe("remote actions", () => {
  it("maps each action to a producer command", () => {
    expect(isRemoteAction("four")).toBe(true);
    expect(isRemoteAction("drop-tables")).toBe(false);
    expect(remoteCommandFor("scorebar-hide", null, 1)).toEqual({
      type: "TOGGLE_BUG",
      visible: false,
      timestamp: 1,
    });
    expect(remoteCommandFor("wicket", null, 1)).toMatchObject({
      type: "TRIGGER_STING",
      stingType: "wicket",
    });
    expect(remoteCommandFor("batting-card", 1).broadcastView).toBe("2");
    expect(remoteCommandFor("batting-card", 2).broadcastView).toBe("4");
    expect(remoteCommandFor("bowling-card", 2).broadcastView).toBe("5");
    expect(remoteCommandFor("next-sponsor").type).toBe("NEXT_SPONSOR");
    expect(remoteCommandFor("clear").type).toBe("PANIC_CLEAR");
  });
});
