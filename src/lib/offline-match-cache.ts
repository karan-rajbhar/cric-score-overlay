import type { Match, TeamPlayer } from '~/lib/match-types';

export interface CachedMatchData {
  match: Match;
  battingTeamPlayers: TeamPlayer[];
  bowlingTeamPlayers: TeamPlayer[];
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  lastOverBowlerId: string | null;
  cachedAt: number; // Date.now()
}

const CACHE_KEY_PREFIX = 'cric_match_cache_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function getStorageKey(matchId: string): string {
  return `${CACHE_KEY_PREFIX}${matchId}`;
}

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Cache match data for offline use. Called after every successful syncFromDb.
 * @param matchId - The ID of the match to cache.
 * @param data - The match data to cache.
 */
export function cacheMatchData(matchId: string, data: Omit<CachedMatchData, 'cachedAt'>): void {
  if (!isLocalStorageAvailable()) return;

  const key = getStorageKey(matchId);
  const cacheData: CachedMatchData = {
    ...data,
    cachedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    const errName = error instanceof Error ? error.name : (error as { name?: string })?.name;
    if (
      errName === 'QuotaExceededError' ||
      errName === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      (error as { code?: number })?.code === 22
    ) {
      console.warn('localStorage quota exceeded. Unable to cache match data.');
    } else {
      console.error('Error caching match data:', error);
    }
  }
}

/**
 * Retrieve cached match data. Returns null if not found or expired (>24h).
 * @param matchId - The ID of the match to retrieve.
 * @returns The cached match data, or null if not found or expired.
 */
export function getCachedMatchData(matchId: string): CachedMatchData | null {
  if (!isLocalStorageAvailable()) return null;

  const key = getStorageKey(matchId);
  try {
    const item = window.localStorage.getItem(key);
    if (!item) return null;

    const data = JSON.parse(item) as CachedMatchData;
    
    // Check expiration
    if (Date.now() - data.cachedAt > CACHE_EXPIRY_MS) {
      clearMatchCache(matchId);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error reading match cache:', error);
    return null;
  }
}

/**
 * Clear cached data for a match (e.g., when match completes).
 * @param matchId - The ID of the match to clear from cache.
 */
export function clearMatchCache(matchId: string): void {
  if (!isLocalStorageAvailable()) return;
  
  try {
    window.localStorage.removeItem(getStorageKey(matchId));
  } catch (error) {
    console.error('Error clearing match cache:', error);
  }
}

/**
 * Check if we have cached data for a match.
 * @param matchId - The ID of the match to check.
 * @returns true if unexpired cache data exists.
 */
export function hasMatchCache(matchId: string): boolean {
  // getCachedMatchData already handles localStorage availability and expiration checks
  return getCachedMatchData(matchId) !== null;
}
