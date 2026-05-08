import Redis from 'ioredis';
import { env } from '../config/env';
import logger from '../utils/logger';

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    logger.warn('Redis URL not configured, caching disabled');
    return null;
  }
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    redisClient.on('error', (err: Error) => {
      logger.error('Redis connection error:', err.message);
    });
  }
  return redisClient;
}

// Cache key prefixes
export const CACHE_KEYS = {
  RECOGNIZE: (imageHash: string) => `recognize:${imageHash}`,
  TEXT_GEN: (foodName: string, themeId: string) => `textgen:${foodName}:${themeId}`,
} as const;

// Graceful get - returns null on any error or if Redis unavailable
export async function cacheGet(key: string): Promise<string | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;
    return await client.get(key);
  } catch (err) {
    logger.warn(`Redis get error for key ${key}:`, (err as Error).message);
    return null;
  }
}

// Set with TTL (seconds)
export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client) return false;
    await client.set(key, value, 'EX', ttlSeconds);
    return true;
  } catch (err) {
    logger.warn(`Redis set error for key ${key}:`, (err as Error).message);
    return false;
  }
}

export async function cacheDel(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client) return false;
    await client.del(key);
    return true;
  } catch (err) {
    logger.warn(`Redis del error for key ${key}:`, (err as Error).message);
    return false;
  }
}

// Cache recognition result for 24 hours
export async function cacheRecognizeResult(imageHash: string, result: unknown): Promise<void> {
  await cacheSet(CACHE_KEYS.RECOGNIZE(imageHash), JSON.stringify(result), 86400);
}

export async function getCachedRecognizeResult(imageHash: string): Promise<unknown | null> {
  const raw = await cacheGet(CACHE_KEYS.RECOGNIZE(imageHash));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Cache text generation for 1 hour
export async function cacheTextGen(foodName: string, themeId: string, text: unknown): Promise<void> {
  await cacheSet(CACHE_KEYS.TEXT_GEN(foodName, themeId), JSON.stringify(text), 3600);
}

export async function getCachedTextGen(foodName: string, themeId: string): Promise<unknown | null> {
  const raw = await cacheGet(CACHE_KEYS.TEXT_GEN(foodName, themeId));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default getRedisClient;
