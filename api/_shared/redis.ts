import Redis from 'ioredis';

// Redis client for caching
let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    console.warn('REDIS_URL not configured, caching disabled');
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis(process.env.REDIS_URL);
      
      redisClient.on('error', (err) => {
        console.error('Redis connection error:', err);
      });

      redisClient.on('connect', () => {
        console.log('Connected to Redis');
      });
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      return null;
    }
  }

  return redisClient;
}

// Cache utilities
export async function cacheSet(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error('Redis cache set error:', error);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Redis cache get error:', error);
    return null;
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.error('Redis cache delete error:', error);
  }
}

// Translation cache utilities
export function getTranslationCacheKey(text: string, sourceLang: string, targetLang: string): string {
  // Create a simple hash of the translation request
  const hash = Buffer.from(`${text}-${sourceLang}-${targetLang}`).toString('base64');
  return `translation:${hash}`;
}

export async function getCachedTranslation(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  const key = getTranslationCacheKey(text, sourceLang, targetLang);
  return await cacheGet<string>(key);
}

export async function setCachedTranslation(
  text: string, 
  sourceLang: string, 
  targetLang: string, 
  translation: string
): Promise<void> {
  const key = getTranslationCacheKey(text, sourceLang, targetLang);
  // Cache translations for 7 days
  await cacheSet(key, translation, 7 * 24 * 3600);
}
