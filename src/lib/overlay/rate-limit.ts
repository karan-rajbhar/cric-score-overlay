/**
 * Sliding-window rate limit kept in memory, per server instance: at most
 * `limit` hits per key within `windowMs`. Enough to stop a stuck Stream
 * Deck button or a script hammering the remote route before it costs
 * Firestore reads; it is not a global quota (each instance counts alone).
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    /** Keys remembered at most; the oldest are dropped first. */
    private readonly maxKeys = 10_000,
  ) {}

  /** Records a hit for `key`; false when it is over the limit. */
  allow(key: string, now = Date.now()): boolean {
    const since = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > since);
    const allowed = recent.length < this.limit;
    if (allowed) recent.push(now);
    // Re-insert so the Map's order stays least-recently-used first.
    this.hits.delete(key);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest !== undefined) this.hits.delete(oldest);
    }
    return allowed;
  }

  /** Forgets every key (tests). */
  reset(): void {
    this.hits.clear();
  }
}

/** The Stream Deck remote route's limit: 5 requests a second per token. */
export const remoteRateLimiter = new RateLimiter(5, 1000);
