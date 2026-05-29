import Redis from 'ioredis'
import { config } from '../config'
import logger from '../utils/logger'

let redisClient: Redis | null = null

export function getRedisClient(): Redis | null {
  if (!config.redisUrl) {
    logger.warn('[redis] REDIS_URL not configured, caching disabled')
    return null
  }
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) return null
        return Math.min(times * 200, 2000)
      },
      lazyConnect: true,
    })
    redisClient.on('error', (err: Error) => {
      logger.error('[redis] Connection error:', err.message)
    })
  }
  return redisClient
}

export async function cacheGet(key: string): Promise<string | null> {
  try {
    const client = getRedisClient()
    if (!client) return null
    return await client.get(key)
  } catch (err) {
    logger.warn(`[redis] get error for key ${key}:`, (err as Error).message)
    return null
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  try {
    const client = getRedisClient()
    if (!client) return false
    await client.set(key, value, 'EX', ttlSeconds)
    return true
  } catch (err) {
    logger.warn(`[redis] set error for key ${key}:`, (err as Error).message)
    return false
  }
}

export async function cacheDel(key: string): Promise<boolean> {
  try {
    const client = getRedisClient()
    if (!client) return false
    await client.del(key)
    return true
  } catch (err) {
    logger.warn(`[redis] del error for key ${key}:`, (err as Error).message)
    return false
  }
}

export async function cacheIncr(key: string): Promise<number> {
  try {
    const client = getRedisClient()
    if (!client) return 0
    return await client.incr(key)
  } catch (err) {
    logger.warn(`[redis] incr error for key ${key}:`, (err as Error).message)
    return 0
  }
}

export async function cacheExpire(key: string, seconds: number): Promise<boolean> {
  try {
    const client = getRedisClient()
    if (!client) return false
    await client.expire(key, seconds)
    return true
  } catch (err) {
    logger.warn(`[redis] expire error for key ${key}:`, (err as Error).message)
    return false
  }
}
