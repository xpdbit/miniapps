import { getRedisClient, cacheExpire } from '../lib/redis'
import { getProviderConfig, type ProviderConfig } from './config-provider.service'

/* ========================================================================
 *  Provider 级限流 — Redis 滑动窗口（QPS / 小时 / 日）
 *
 *  Key 格式: ai:ratelimit:{provider}:{qps|hourly|daily}:{windowKey}
 *  ======================================================================== */

interface RateLimitResult {
  allowed: boolean
  retryAfter?: number // 秒
}

/**
 * 生成滑动窗口 Key（按秒/小时/天粒度）
 */
function getWindowKey(windowSec: number): string {
  const now = Math.floor(Date.now() / 1000)
  return String(Math.floor(now / windowSec))
}

function getRedisKey(provider: string, type: string, windowSec: number): string {
  return `ai:ratelimit:${provider}:${type}:${getWindowKey(windowSec)}`
}

/**
 * 检查并递增单个时间窗口
 */
async function checkWindow(
  provider: string,
  type: string,
  limit: number | undefined,
  windowSec: number,
): Promise<boolean> {
  if (!limit || limit <= 0) return true // 未设置限制 = 不限制

  try {
    const redis = getRedisClient()
    if (!redis) throw new Error('Redis unavailable')
    const key = getRedisKey(provider, type, windowSec)

    // INCR + EXPIRE 原子操作
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, windowSec + 1) // +1 秒容错
    }

    return count <= limit
  } catch {
    // Redis 不可用 → 放行（不阻塞业务）
    console.warn(`[rate-limiter] Redis 不可用，跳过限流检查 (${provider}/${type})`)
    return true
  }
}

/**
 * 检查 Provider 的所有限流维度
 */
export async function checkRateLimit(provider: string): Promise<RateLimitResult> {
  const providerConfig = await getProviderConfig(provider)

  // 如果 Provider 不存在或未配置限流，直接放行
  if (!providerConfig?.config) return { allowed: true }

  const { qpsLimit, hourlyLimit, dailyLimit } = providerConfig.config

  // 没有任何限流配置 → 放行
  if (!qpsLimit && !hourlyLimit && !dailyLimit) return { allowed: true }

  // 三个窗口并行检查
  const [qpsOk, hourlyOk, dailyOk] = await Promise.all([
    checkWindow(provider, 'qps', qpsLimit, 1),
    checkWindow(provider, 'hourly', hourlyLimit, 3600),
    checkWindow(provider, 'daily', dailyLimit, 86400),
  ])

  if (!qpsOk) return { allowed: false, retryAfter: 1 }
  if (!hourlyOk) return { allowed: false, retryAfter: 60 }
  if (!dailyOk) return { allowed: false, retryAfter: 300 }

  return { allowed: true }
}

/**
 * 检查 Provider 限流 — 如果超限则尝试回退链中的下一个 Provider
 */
export async function selectAvailableProvider(
  providers: ProviderConfig[],
): Promise<ProviderConfig | null> {
  // 按 weight 排序（低值优先）
  const sorted = [...providers].sort((a, b) => (a.config?.weight ?? 1) - (b.config?.weight ?? 1))

  for (const p of sorted) {
    const { allowed } = await checkRateLimit(p.provider)
    if (allowed) return p
    console.log(`[rate-limiter] Provider ${p.provider} 超限，尝试下一个...`)
  }

  return null
}
