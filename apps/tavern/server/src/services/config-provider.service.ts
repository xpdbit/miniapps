import axios from 'axios'
import { config } from '../config'
import { getRedisClient } from '../lib/redis'

/* ========================================================================
 *  AI Provider 统一配置源 — Dashboard 主控 + Redis 缓存 + Env 兜底
 *
 *  降级链: Dashboard API → Redis(5min TTL) → 内存缓存 → Env 种子
 *  ======================================================================== */

export interface ProviderConfig {
  id: string
  provider: string
  name: string
  apiKey?: string
  baseUrl?: string
  config?: {
    qpsLimit?: number
    hourlyLimit?: number
    dailyLimit?: number
    weight?: number
    priority?: number
    fallbackProviders?: string[]
    models?: string[]
    apiFormat?: 'openai' | 'anthropic' | 'google'
  }
  isActive: boolean
  sortOrder: number
  modelsScope?: string
}

interface DashboardProviderResponse {
  success: boolean
  data: {
    providers: ProviderConfig[]
  }
}

const ADMIN_API_URL = process.env.ADMIN_API_URL || 'http://localhost:3001/api/v1'
const CACHE_KEY = 'ai:providers'
const CACHE_TTL = 300 // 5 分钟 Redis TTL
const REFRESH_INTERVAL = 60_000 // 60s 轮询间隔

let memoryCache: ProviderConfig[] = []
let lastFetchTime = 0

/**
 * 环境变量种子 — 仅 3 个免费 Provider，作为最后防线
 */
function getEnvFallbackProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = []

  if (config.dashscopeApiKey) {
    providers.push({
      id: 'env-tongyi',
      provider: 'tongyi',
      name: '通义千问 (ENV)',
      apiKey: config.dashscopeApiKey,
      baseUrl: '',
      config: { apiFormat: 'openai', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'], weight: 1 },
      isActive: true,
      sortOrder: 0,
    })
  }

  if (config.opencodeApiKey) {
    providers.push({
      id: 'env-opencode',
      provider: 'opencode',
      name: 'OpenCode Go (ENV)',
      apiKey: config.opencodeApiKey,
      baseUrl: config.opencodeBaseUrl,
      config: { apiFormat: 'openai', models: ['big-pickle', 'minimax-m2.5-free', 'deepseek-v4-flash', 'deepseek-v4-pro'], weight: 2 },
      isActive: true,
      sortOrder: 1,
    })
  }

  if (config.deepseekApiKey) {
    providers.push({
      id: 'env-deepseek',
      provider: 'deepseek',
      name: 'DeepSeek (ENV)',
      apiKey: config.deepseekApiKey,
      baseUrl: 'https://api.deepseek.com',
      config: { apiFormat: 'openai', models: ['deepseek-chat', 'deepseek-reasoner'], weight: 3 },
      isActive: true,
      sortOrder: 2,
    })
  }

  return providers
}

/**
 * 从 Dashboard Admin API 拉取 Provider 列表
 */
async function fetchFromDashboard(): Promise<ProviderConfig[]> {
  const response = await axios.get<DashboardProviderResponse>(
    `${ADMIN_API_URL}/admin/ai-manager/public`,
    { timeout: 5000 },
  )
  return response.data?.data?.providers || []
}

/**
 * 获取所有激活的 Provider 配置
 */
export async function getProviders(): Promise<ProviderConfig[]> {
  const now = Date.now()

  // 60s 内的内存缓存直接返回
  if (memoryCache.length > 0 && now - lastFetchTime < REFRESH_INTERVAL) {
    return memoryCache
  }

  try {
    // 1. 尝试从 Dashboard 拉取
    const dashboardProviders = await fetchFromDashboard()
    if (dashboardProviders.length > 0) {
      memoryCache = dashboardProviders.filter(p => p.isActive)
      lastFetchTime = now

      // 写入 Redis 缓存（异步，不阻塞）
      try {
        const redis = getRedisClient()
        if (redis) {
          await redis.set(CACHE_KEY, JSON.stringify(memoryCache), 'EX', CACHE_TTL)
        }
      } catch {
        // Redis 不可用时静默跳过
      }

      console.log(`[config-provider] 从 Dashboard 加载了 ${memoryCache.length} 个 Provider`)
      return memoryCache
    }
  } catch (err) {
    console.warn('[config-provider] Dashboard 不可用:', (err as Error).message)
  }

  // 2. 降级到 Redis 缓存
  try {
    const redis = getRedisClient()
    if (!redis) throw new Error('Redis unavailable')
    const cached = await redis.get(CACHE_KEY)
    if (cached) {
      memoryCache = JSON.parse(cached)
      lastFetchTime = now
      console.log(`[config-provider] 从 Redis 缓存加载了 ${memoryCache.length} 个 Provider`)
      return memoryCache
    }
  } catch {
    // Redis 不可用时静默跳过
  }

  // 3. 降级到内存缓存
  if (memoryCache.length > 0) {
    console.log(`[config-provider] 使用内存缓存 (${memoryCache.length} 个 Provider)`)
    return memoryCache
  }

  // 4. 最后防线：环境变量种子
  const fallback = getEnvFallbackProviders()
  console.warn(`[config-provider] ⚠️ 所有外部源不可用，降级到环境变量种子 (${fallback.length} 个 Provider)`)
  memoryCache = fallback
  lastFetchTime = now
  return fallback
}

/**
 * 获取单个 Provider 配置
 */
export async function getProviderConfig(provider: string): Promise<ProviderConfig | null> {
  const providers = await getProviders()
  return providers.find(p => p.provider === provider) || null
}

/**
 * 获取某个模型可用的 Provider 列表（按权重排序）
 */
export async function getProvidersForModel(modelId: string): Promise<ProviderConfig[]> {
  const providers = await getProviders()
  return providers
    .filter(p => {
      // 如果 Provider 声明了支持的模型列表，只匹配包含该模型的
      if (p.config?.models && p.config.models.length > 0) {
        return p.config.models.includes(modelId)
      }
      return true // 未声明 models 则对所有模型可用
    })
    .sort((a, b) => (a.config?.weight ?? 1) - (b.config?.weight ?? 1))
}

/**
 * 启动时预热缓存（在 app.ts 中调用）
 */
export async function warmupConfigProvider(): Promise<void> {
  console.log('[config-provider] 启动预热...')
  await getProviders()
  console.log('[config-provider] 预热完成')
}
