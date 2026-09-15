/**
 * In-memory micro-cache and promise deduplicator for cricket match data.
 * Protects database and server from "thundering herd" spikes when hundreds
 * of spectators simultaneously request live match state on delivery events.
 *
 * Employs LRU (Least Recently Used) eviction with a strict size cap to protect
 * against unbounded memory consumption, while maintaining O(1) performance
 * and zero external dependencies.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const MATCH_CACHE_TTL_MS = 2000; // 2 seconds micro-cache
const MAX_ENTRIES = 500; // Strict capacity cap for memory protection

class LruMicroCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private pending = new Map<string, Promise<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > MATCH_CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    // Refresh LRU order (delete and re-set)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= MAX_ENTRIES) {
      // Evict oldest entry in O(1)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  getPending<T>(key: string): Promise<T> | null {
    return (this.pending.get(key) as Promise<T>) ?? null;
  }

  setPending<T>(key: string, promise: Promise<T>): void {
    this.pending.set(key, promise);
  }

  clearPending(key: string): void {
    this.pending.delete(key);
  }

  invalidate(keyPrefix?: string): void {
    if (keyPrefix) {
      for (const key of Array.from(this.cache.keys())) {
        if (key === keyPrefix || key.includes(keyPrefix)) {
          this.cache.delete(key);
        }
      }
      for (const key of Array.from(this.pending.keys())) {
        if (key === keyPrefix || key.includes(keyPrefix)) {
          this.pending.delete(key);
        }
      }
    } else {
      this.cache.clear();
      this.pending.clear();
    }
  }

  size(): number {
    return this.cache.size;
  }
}

const matchStore = new LruMicroCache();

// Match Data Helpers
export function getCachedMatch<T>(matchId: string): T | null {
  return matchStore.get<T>(`match:${matchId}`);
}

export function setCachedMatch<T>(matchId: string, data: T): void {
  matchStore.set(`match:${matchId}`, data);
}

export function getPendingQuery<T>(matchId: string): Promise<T> | null {
  return matchStore.getPending<T>(`match:${matchId}`);
}

export function setPendingQuery<T>(matchId: string, promise: Promise<T>): void {
  matchStore.setPending(`match:${matchId}`, promise);
}

export function clearPendingQuery(matchId: string): void {
  matchStore.clearPending(`match:${matchId}`);
}

// Live State Helpers
export function getCachedLiveState<T>(matchId: string): T | null {
  return matchStore.get<T>(`live:${matchId}`);
}

export function setCachedLiveState<T>(matchId: string, data: T): void {
  matchStore.set(`live:${matchId}`, data);
}

export function getPendingLiveQuery<T>(matchId: string): Promise<T> | null {
  return matchStore.getPending<T>(`live:${matchId}`);
}

export function setPendingLiveQuery<T>(
  matchId: string,
  promise: Promise<T>,
): void {
  matchStore.setPending(`live:${matchId}`, promise);
}

export function clearPendingLiveQuery(matchId: string): void {
  matchStore.clearPending(`live:${matchId}`);
}

// Cache Invalidation
export function invalidateMatchCache(matchId?: string): void {
  matchStore.invalidate(matchId);
}
