import { kv } from '@vercel/kv';

// Cache TTL in seconds
export const CACHE_TTL = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 1800,   // 30 minutes
  LONG: 7200,     // 2 hours
  DAY: 86400,     // 24 hours
  GEOCODING: 86400, // 24 hours for geocoding
  MARKET_PRICES: 3600, // 1 hour for market prices
};

// Cache service for Vercel KV
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await kv.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  async set(key: string, value: any, ttl: number = CACHE_TTL.MEDIUM): Promise<void> {
    try {
      await kv.set(key, JSON.stringify(value), { ex: ttl });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  async del(key: string): Promise<void> {
    try {
      await kv.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      const exists = await kv.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  },

  async has(key: string): Promise<boolean> {
    return this.exists(key);
  }
};

// Generate cache key
export function generateCacheKey(prefix: string, ...params: (string | number)[]): string {
  return `${prefix}:${params.join(':')}`;
}

// Decorator for caching function results
export function cached(ttl: number = CACHE_TTL.MEDIUM) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = generateCacheKey(propertyKey, ...args);

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);

      // Store in cache
      await cache.set(cacheKey, result, ttl);

      return result;
    };

    return descriptor;
  };
}