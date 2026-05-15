import { PrismaClient, Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { config as appConfig } from '../config';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

let redisClient: Redis | null = null;

/**
 * 获取懒连接 Redis 客户端
 * 仅在首次调用时创建连接，之后复用
 */
function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  if (!appConfig.redisUrl) return null;

  redisClient = new Redis(appConfig.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
  });

  redisClient.on('error', (err: Error) => {
    logger.error('Redis 连接错误:', err);
  });

  return redisClient;
}

const CACHE_TTL = 300; // 5 分钟
const CACHE_PREFIX = 'game1:config:';

/**
 * 获取单个配置值（Redis 缓存优先，缓存 TTL 300s）
 * - 缓存命中直接返回
 * - 缓存未命中回查数据库并写入缓存
 * - 数据库中不存在则抛出 NotFoundError
 */
export async function getConfig(key: string): Promise<unknown> {
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(`${CACHE_PREFIX}${key}`);
      if (cached !== null) {
        return JSON.parse(cached) as unknown;
      }
    } catch (err) {
      logger.error('Redis 读取错误:', err);
    }
  }

  const row = await prisma.game1Config.findUnique({ where: { key } });
  if (!row) throw new NotFoundError(`配置项 ${key} 不存在`);

  if (redis) {
    try {
      await redis.set(`${CACHE_PREFIX}${key}`, JSON.stringify(row.value), 'EX', CACHE_TTL);
    } catch (err) {
      logger.error('Redis 写入错误:', err);
    }
  }

  return row.value;
}

/**
 * 获取所有配置键名列表
 */
export async function getConfigKeys(): Promise<string[]> {
  const rows = await prisma.game1Config.findMany({
    select: { key: true },
    orderBy: { key: 'asc' },
  });
  return rows.map((r) => r.key);
}

/**
 * 更新配置值（upsert），递增 version，清除 Redis 缓存
 */
export async function updateConfig(key: string, value: unknown, updatedBy?: string): Promise<void> {
  await prisma.game1Config.upsert({
    where: { key },
    update: {
      value: value as Prisma.InputJsonValue,
      version: { increment: 1 },
      updatedBy: updatedBy ?? null,
    },
    create: {
      key,
      value: value as Prisma.InputJsonValue,
      updatedBy: updatedBy ?? null,
    },
  });

  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`${CACHE_PREFIX}${key}`);
    } catch (err) {
      logger.error('Redis 删除错误:', err);
    }
  }
}

/**
 * 批量获取多个配置值
 * - 优先从缓存批量读取（使用 mget）
 * - 未命中部分回查数据库并回填缓存
 * - 数据库中不存在的键会被忽略
 */
export async function getConfigs(keys: string[]): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  const uncachedKeys: string[] = [];

  const redis = getRedis();
  if (redis) {
    try {
      const cacheKeys = keys.map((k) => `${CACHE_PREFIX}${k}`);
      const cachedValues = await redis.mget(cacheKeys);
      for (let i = 0; i < keys.length; i++) {
        if (cachedValues[i] !== null) {
          results[keys[i]] = JSON.parse(cachedValues[i] as string) as unknown;
        } else {
          uncachedKeys.push(keys[i]);
        }
      }
    } catch (err) {
      logger.error('Redis 批量读取错误:', err);
      uncachedKeys.push(...keys);
    }
  } else {
    uncachedKeys.push(...keys);
  }

  if (uncachedKeys.length > 0) {
    const rows = await prisma.game1Config.findMany({
      where: { key: { in: uncachedKeys } },
    });

    for (const row of rows) {
      results[row.key] = row.value;
      if (redis) {
        try {
          await redis.set(`${CACHE_PREFIX}${row.key}`, JSON.stringify(row.value), 'EX', CACHE_TTL);
        } catch (err) {
          logger.error('Redis 批量写入错误:', err);
        }
      }
    }
  }

  return results;
}
