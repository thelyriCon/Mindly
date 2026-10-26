/**
 * Discovery Feed Cache & Pre-Warming Service
 * Manages persistent storage, background pre-warming, and intelligent TTL caching
 * for Mindly's Practical Knowledge & Skill Discovery catalogue.
 */
import { MicroArticle } from '../types';
import { api } from './api';
import { persistenceEngine } from './persistence';

const CACHE_PREFIX = 'mindly_discovery_cache_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface DiscoveryCacheEntry {
  userId: string;
  timestamp: number;
  articles: MicroArticle[];
  version: string;
}

/**
 * Returns a storage key isolated by user account to prevent cross-account leakage.
 */
function getStorageKey(userId?: string | null): string {
  const cleanId = userId && userId.trim() ? userId.trim() : 'guest';
  return `${CACHE_PREFIX}${cleanId}`;
}

export const discoveryFeedService = {
  /**
   * Retrieves valid cached discovery articles for the current user.
   * Returns null if cache is absent or corrupted.
   */
  getCachedSuggestions(userId?: string | null): {
    articles: MicroArticle[];
    timestamp: number;
    isExpired: boolean;
  } | null {
    try {
      const key = getStorageKey(userId);
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const data: DiscoveryCacheEntry = JSON.parse(raw);
      if (!data || !Array.isArray(data.articles) || data.articles.length === 0) {
        return null;
      }

      // Verify user isolation
      const expectedUser = userId && userId.trim() ? userId.trim() : 'guest';
      if (data.userId !== expectedUser) {
        return null;
      }

      const age = Date.now() - (data.timestamp || 0);
      const isExpired = age > CACHE_TTL_MS;

      return {
        articles: data.articles,
        timestamp: data.timestamp,
        isExpired,
      };
    } catch (err) {
      console.warn('[DiscoveryCache] Error reading cache:', err);
      return null;
    }
  },

  /**
   * Persists suggestions to both LocalStorage and IndexedDB persistence engine.
   */
  saveSuggestions(userId: string | null | undefined, articles: MicroArticle[]): void {
    if (!Array.isArray(articles) || articles.length === 0) return;

    const expectedUser = userId && userId.trim() ? userId.trim() : 'guest';
    const entry: DiscoveryCacheEntry = {
      userId: expectedUser,
      timestamp: Date.now(),
      articles,
      version: '2.0',
    };

    try {
      const key = getStorageKey(userId);
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (err) {
      console.warn('[DiscoveryCache] Could not save to localStorage:', err);
    }

    // Also backup to persistenceEngine for offline durability
    try {
      persistenceEngine.saveUserProfile({
        ...(persistenceEngine as any).userProfile,
        lastDiscoveryTimestamp: entry.timestamp,
      } as any).catch(() => {});
    } catch {}
  },

  /**
   * Pre-warms the discovery feed in the background when the application boots.
   * Does not block UI or Home. If valid cache exists, skips network call.
   */
  async prewarm(userId?: string | null, interests: string[] = []): Promise<MicroArticle[] | null> {
    const cached = this.getCachedSuggestions(userId);
    if (cached && !cached.isExpired && cached.articles.length > 0) {
      return cached.articles;
    }

    try {
      const res = await api.getMicroArticles(interests);
      if (res && Array.isArray(res.articles) && res.articles.length > 0) {
        this.saveSuggestions(userId, res.articles);
        return res.articles;
      }
    } catch (err) {
      console.warn('[DiscoveryFeedService] Background pre-warm error:', err);
    }

    return cached?.articles || null;
  },

  /**
   * Fetches fresh suggestions or returns cached items if valid.
   */
  async getOrFetchSuggestions(options: {
    userId?: string | null;
    interests?: string[];
    forceRefresh?: boolean;
  }): Promise<{ articles: MicroArticle[]; fromCache: boolean }> {
    const { userId, interests = [], forceRefresh = false } = options;

    if (!forceRefresh) {
      const cached = this.getCachedSuggestions(userId);
      if (cached && cached.articles.length > 0) {
        return { articles: cached.articles, fromCache: true };
      }
    }

    // Fetch fresh from backend
    const res = await api.getMicroArticles(interests);
    if (res && Array.isArray(res.articles) && res.articles.length > 0) {
      this.saveSuggestions(userId, res.articles);
      return { articles: res.articles, fromCache: false };
    }

    // Fallback to cache if network returned empty
    const cachedFallback = this.getCachedSuggestions(userId);
    if (cachedFallback && cachedFallback.articles.length > 0) {
      return { articles: cachedFallback.articles, fromCache: true };
    }

    return { articles: [], fromCache: false };
  },
};
