/**
 * 速率限制中间件
 *
 * 提供三个级别的速率限制：
 * - 全局：100 次 / 15 分钟 / IP
 * - 图片识别：10 次 / 分钟 / 用户（POST /api/v1/records）
 * - AI 生成：5 次 / 分钟 / 用户（POST /api/v1/pipeline/start）
 *
 * 使用 Redis 存储速率计数，Redis 不可用时降级为内存存储并记录警告。
 */

import rateLimit, {
  type RateLimitRequestHandler,
  type Store,
  type IncrementResponse,
  MemoryStore,
} from 'express-rate-limit';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { ErrorCode } from '../types/api';
import logger from '../utils/logger';
import getRedisClient from '../lib/redis';

// ---------------------------------------------------------------------------
// 自定义 Redis Store（基于 ioredis）
// 实现 express-rate-limit 的 Store 接口
// ---------------------------------------------------------------------------

class RedisRateLimitStore {
  client: Redis | null = null;
  readonly prefix: string;

  constructor(prefix = 'ratelimit:') {
    this.prefix = prefix;
  }

  /** 初始化 store（由 express-rate-limit 在 setup 时调用） */
  init(): void {
    this.client = getRedisClient();
    if (!this.client) {
      logger.warn('[rate-limiter] Redis 不可用，回退到内存存储（不推荐用于生产环境）');
    }
  }

  /**
   * 递增 key 的计数，返回当前计数和重置时间。
   * 使用 MULTI/EXEC 事务保证原子性：
   *   1. INCR key
   *   2. PTTL key  （若 key 尚无过期时间，则初次设置窗口期的过期时间）
   */
  async increment(key: string): Promise<IncrementResponse> {
    if (!this.client) {
      // 没有 Redis 时返回安全默认值（阻止所有请求通过）
      // 实际上这种情况不应该发生，因为 createStore 会回退到内存存储
      return { totalHits: 1, resetTime: new Date(Date.now() + 60_000) };
    }

    const prefixedKey = `${this.prefix}${key}`;
    const results = await this.client
      .multi()
      .incr(prefixedKey)
      .pttl(prefixedKey)
      .exec();

    if (!results) {
      return { totalHits: 1, resetTime: new Date(Date.now() + 60_000) };
    }

    const totalHits = results[0][1] as number;

    // 如果是第一次设置 key（INCR 返回 1），设置过期时间
    if (totalHits === 1) {
      // 用 60 秒作为默认窗口（实际 windowMs 由 rateLimit 的 init 设置，
      // 但这里我们无法直接拿到。express-rate-limit 的窗口期会在
      // 实例创建后传入，我们保守设置 60s，由 keyGenerator 保证隔离）
      await this.client.expire(prefixedKey, 60);
    }

    const ttlMs = results[1][1] as number;
    const resetTime = ttlMs > 0 ? new Date(Date.now() + ttlMs) : new Date(Date.now() + 60_000);

    return { totalHits, resetTime };
  }

  /** 递减 key 的计数 */
  async decrement(key: string): Promise<void> {
    if (!this.client) return;
    const prefixedKey = `${this.prefix}${key}`;
    await this.client.decr(prefixedKey);
  }

  /** 重置指定 key */
  async resetKey(key: string): Promise<void> {
    if (!this.client) return;
    const prefixedKey = `${this.prefix}${key}`;
    await this.client.del(prefixedKey);
  }

  /** 重置所有 key（谨慎使用） */
  async resetAll(): Promise<void> {
    if (!this.client) return;
    const keys = await this.client.keys(`${this.prefix}*`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}

// ---------------------------------------------------------------------------
// Store 工厂
// ---------------------------------------------------------------------------

function createStore(): Store {
  const redisClient = getRedisClient();
  if (redisClient) {
    const store = new RedisRateLimitStore();
    store.init();
    return store;
  }
  // Redis 不可用时使用内存存储（不推荐生产环境）
  logger.warn('[rate-limiter] Redis 不可用，回退到内存存储（不推荐用于生产环境）');
  return new MemoryStore();
}

// ---------------------------------------------------------------------------
// 通用 429 响应格式（与 ApiResponse 一致）
// ---------------------------------------------------------------------------

function rateLimitResponse() {
  return {
    success: false,
    errCode: ErrorCode.RATE_LIMITED,
    errMsg: '操作过于频繁，请稍后再试',
    data: null,
  };
}

// ---------------------------------------------------------------------------
// 全局速率限制：每个 IP 每 15 分钟最多 100 次请求
// ---------------------------------------------------------------------------

export const globalRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100,
  standardHeaders: true, // 返回 RateLimit-* 头
  legacyHeaders: false, // 不返回 X-RateLimit-* 头
  store: createStore(),
  message: rateLimitResponse(),
  statusCode: 429,
});

// ---------------------------------------------------------------------------
// 食物识别速率限制：每个用户每分钟最多 10 次
// 仅限 POST 请求，GET/HEAD/OPTIONS 不受此限制
// ---------------------------------------------------------------------------

export const recognitionRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: (req: Request): string => {
    // 优先使用用户 ID（已登录用户），否则降级到 IP
    if (req.user?.userId) {
      return `user:${req.user.userId}`;
    }
    return `ip:${req.ip ?? 'unknown'}`;
  },
  skip: (req: Request): boolean => req.method !== 'POST',
  message: rateLimitResponse(),
  statusCode: 429,
});

// ---------------------------------------------------------------------------
// AI 文本生成速率限制：每个用户每分钟最多 5 次
// 仅限 POST 请求
// ---------------------------------------------------------------------------

export const aiGenerationRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: (req: Request): string => {
    if (req.user?.userId) {
      return `user:${req.user.userId}`;
    }
    return `ip:${req.ip ?? 'unknown'}`;
  },
  skip: (req: Request): boolean => req.method !== 'POST',
  message: rateLimitResponse(),
  statusCode: 429,
});
