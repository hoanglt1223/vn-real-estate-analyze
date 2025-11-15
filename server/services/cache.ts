// Re-export from shared cache service
import { cache, generateCacheKey, CACHE_TTL } from '../../shared/services/cache';
export { cache, generateCacheKey, CACHE_TTL };

// Decorator for caching function results
export function cached<T extends (...args: any[]) => Promise<any>>(
  keyGenerator: (...args: any[]) => string,
  ttl: number = 5 * 60 * 1000
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = keyGenerator(...args);

      // Try to get from cache first
      const cachedResult = cache.get(key);
      if (cachedResult !== null) {
        console.log(`Cache hit for ${key}`);
        return cachedResult;
      }

      // Cache miss - call original function
      console.log(`Cache miss for ${key}`);
      const result = await method.apply(this, args);

      // Cache the result
      if (result !== null && result !== undefined) {
        cache.set(key, result, ttl);
      }

      return result;
    };
  };
}