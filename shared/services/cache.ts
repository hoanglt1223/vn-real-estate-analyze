// Shared cache service - can be used by both client and server
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes default

  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };
    this.cache.set(key, entry);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  size(): number {
    return this.cache.size;
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  // Get all keys (useful for debugging)
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Create a singleton instance
export const cache = new MemoryCache();

// Cleanup expired entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 10 * 60 * 1000);
}

// Generate cache keys for different data types
export function generateCacheKey(
  type: 'amenities' | 'infrastructure' | 'marketPrices' | 'geocoding' | 'locationSuggestions',
  params: Record<string, any>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  return `${type}:${sortedParams}`;
}

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  AMENITIES: 10 * 60 * 1000, // 10 minutes
  INFRASTRUCTURE: 30 * 60 * 1000, // 30 minutes
  MARKET_PRICES: 60 * 60 * 1000, // 1 hour
  GEOCODING: 24 * 60 * 60 * 1000, // 24 hours
  LOCATION_SUGGESTIONS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

export default cache;