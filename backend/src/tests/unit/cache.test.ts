import { getCachedData, setCachedData, invalidateCache, generateCacheKey } from '../../utils/cache';
import redis from '../../config/redis';

describe('Cache Utilities', () => {
  afterAll(async () => {
    await redis.quit();
  });

  test('should generate consistent cache keys', () => {
    const key1 = generateCacheKey('incident', '123');
    const key2 = generateCacheKey('incident', '123');
    expect(key1).toBe(key2);
    expect(key1).toBe('incident:123');
  });

  test('should set and get cached data', async () => {
    const key = 'test:data:' + Date.now();
    const data = { id: '123', name: 'Test' };

    await setCachedData(key, data, 60);
    const retrieved = await getCachedData(key);

    expect(retrieved).toEqual(data);

    // Clean up
    await redis.del(key);
  });

  test('should return null for non-existent key', async () => {
    const result = await getCachedData('non-existent-key');
    expect(result).toBeNull();
  });

  test('should invalidate cache by pattern', async () => {
    const keys = [
      'incident:123:data',
      'incident:123:events',
      'incident:456:data',
    ];

    // Set cache data
    for (const key of keys) {
      await setCachedData(key, { test: 'data' }, 60);
    }

    // Invalidate incident:123:*
    await invalidateCache('incident:123:*');

    // Check results
    const result1 = await getCachedData('incident:123:data');
    const result2 = await getCachedData('incident:123:events');
    const result3 = await getCachedData('incident:456:data');

    expect(result1).toBeNull();
    expect(result2).toBeNull();
    expect(result3).not.toBeNull();

    // Clean up
    await redis.del('incident:456:data');
  });
});
