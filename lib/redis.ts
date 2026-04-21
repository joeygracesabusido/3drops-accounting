import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

const getRedisClient = () => {
  if (!redisUrl) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('REDIS_URL is not defined in production. Caching will be disabled.');
    }
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    client.on('error', (err) => {
      console.error('Redis error:', err);
    });

    return client;
  } catch (error) {
    console.error('Failed to initialize Redis client:', error);
    return null;
  }
};

export const redis = getRedisClient();

/**
 * Cache utility functions
 */
export const cache = {
  get: async <T>(key: string): Promise<T | null> => {
    if (!redis) return null;
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error getting cache for key ${key}:`, error);
      return null;
    }
  },

  set: async (key: string, value: unknown, ttlSeconds: number = 3600): Promise<void> => {
    if (!redis) return;
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      console.error(`Error setting cache for key ${key}:`, error);
    }
  },

  del: async (key: string): Promise<void> => {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch (error) {
      console.error(`Error deleting cache for key ${key}:`, error);
    }
  },

  /**
   * Delete keys matching a pattern (e.g., "employees:*")
   */
  delByPattern: async (pattern: string): Promise<void> => {
    if (!redis) return;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error(`Error deleting cache by pattern ${pattern}:`, error);
    }
  }
};
