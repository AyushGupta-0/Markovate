import redis from '../config/redis';
import { config } from '../config';

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

export async function setCachedData(
  key: string,
  data: any,
  ttl: number = config.cache.ttl
): Promise<void> {
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

export function generateCacheKey(prefix: string, ...parts: string[]): string {
  return `${prefix}:${parts.join(':')}`;
}
