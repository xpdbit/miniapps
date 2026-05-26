/**
 * 模型同步服务 — 从各 AI 服务商 API 拉取最新模型列表，更新 TavernModelMeta
 *
 * 触发方式:
 *   1. 每日 00:00 cron (通过 admin 定时任务)
 *   2. Dashboard admin 手动触发 (POST /v1/admin/sync-models)
 *
 * 同步策略:
 *   - FREE 模型: 系统内置（tongyi, opencode），来自 env 配置，不通过 API 拉取
 *   - PAID 模型: 从各服务商 /models API 实时拉取
 *   - 已有模型: update 更新 displayName/description
 *   - 新模型: insert 插入
 *   - 已下架模型: 标记 isActive=false (而非删除)
 */

import axios from 'axios'
import prisma from '../utils/prisma'
import { config } from '../config'
import { decrypt } from '../utils/crypto'

interface ModelSyncResult {
  provider: string
  added: number
  updated: number
  deactivated: number
  error?: string
}

/* ========================================================================
 *  内置 FREE 模型（不自同步，仅用于校准）
 *  ======================================================================== */

const BUILTIN_FREE_MODELS = [
  { modelId: 'qwen-turbo',           displayName: '通义千问 Turbo',    provider: 'tongyi',   description: '快速响应，适合日常对话',     icon: '⚡', minTier: 'FREE' as const, quotaCost: 1, sortOrder: 10 },
  { modelId: 'qwen-plus',            displayName: '通义千问 Plus',     provider: 'tongyi',   description: '更强能力，适合复杂任务',     icon: '✨', minTier: 'FREE' as const, quotaCost: 1, sortOrder: 20 },
  { modelId: 'qwen-max',             displayName: '通义千问 Max',      provider: 'tongyi',   description: '最强模型，适合极限挑战',     icon: '🔥', minTier: 'FREE' as const, quotaCost: 2, sortOrder: 30 },
  { modelId: 'big-pickle',           displayName: 'Big Pickle',        provider: 'opencode', description: '免费大模型 · OpenCode Go',  icon: '🥒', minTier: 'FREE' as const, quotaCost: 1, sortOrder: 40 },
  { modelId: 'minimax-m2.5-free',    displayName: 'MiniMax M2.5 Free', provider: 'opencode', description: '免费对话 · OpenCode Go',     icon: '🆓', minTier: 'FREE' as const, quotaCost: 1, sortOrder: 50 },
  { modelId: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', provider: 'opencode', description: '免费推理 · OpenCode Go',     icon: '⚡', minTier: 'FREE' as const, quotaCost: 1, sortOrder: 60 },
  { modelId: 'deepseek-v4-pro',   displayName: 'DeepSeek V4 Pro',   provider: 'opencode', description: '深度推理 · OpenCode Go',     icon: '🧠', minTier: 'FREE' as const, quotaCost: 2, sortOrder: 65 },
]

/* ========================================================================
 *  可同步的 PAID 服务商配置
 *  ======================================================================== */

interface ProviderSyncConfig {
  provider: string
  baseUrl: string
  endpoint: string
  authType: 'bearer' | 'x-api-key'
  modelListPath: string
  modelIdField: string
  modelNameField?: string
  transformId?: (id: string) => string
  needApiKey: boolean  // 是否需要有效的用户 API Key 才能同步
  useCustomBaseUrl?: boolean  // One API 等服务商使用用户自定义 baseUrl
}

const SYNCABLE_PROVIDERS: ProviderSyncConfig[] = [
  {
    provider: 'openai', baseUrl: 'https://api.openai.com', endpoint: '/v1/models',
    authType: 'bearer', modelListPath: 'data', modelIdField: 'id', modelNameField: 'id', needApiKey: true,
  },
  {
    provider: 'deepseek', baseUrl: 'https://api.deepseek.com', endpoint: '/models',
    authType: 'bearer', modelListPath: 'data', modelIdField: 'id', modelNameField: 'id', needApiKey: true,
  },
  {
    provider: 'anthropic', baseUrl: 'https://api.anthropic.com', endpoint: '/v1/models',
    authType: 'x-api-key', modelListPath: 'data', modelIdField: 'id', modelNameField: 'display_name', needApiKey: true,
  },
  {
    provider: 'google', baseUrl: 'https://generativelanguage.googleapis.com', endpoint: '/v1beta/models',
    authType: 'bearer', modelListPath: 'models', modelIdField: 'name', modelNameField: 'displayName',
    transformId: (id: string) => id.replace(/^models\//, ''), needApiKey: true,
  },
  {
    provider: 'zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', endpoint: '/models',
    authType: 'bearer', modelListPath: 'data', modelIdField: 'id', modelNameField: 'id', needApiKey: true,
  },
  {
    provider: 'moonshot', baseUrl: 'https://api.moonshot.cn', endpoint: '/v1/models',
    authType: 'bearer', modelListPath: 'data', modelIdField: 'id', modelNameField: 'id', needApiKey: true,
  },
  {
    provider: 'minimax', baseUrl: 'https://api.minimaxi.com', endpoint: '/v1/models',
    authType: 'bearer', modelListPath: 'data', modelIdField: 'id', modelNameField: 'id', needApiKey: true,
  },
  {
    provider: 'openrouter', baseUrl: 'https://openrouter.ai/api', endpoint: '/api/v1/models',
    authType: 'bearer', modelListPath: 'data', modelIdField: 'id', modelNameField: 'name', needApiKey: true,
  },
  {
    provider: 'oneapi', baseUrl: '', endpoint: '/v1/models',
    authType: 'bearer', modelListPath: 'data', modelIdField: 'id', modelNameField: 'id', needApiKey: true,
    // One API 使用用户配置的自定义 baseUrl，不从固定 URL 拉取
    useCustomBaseUrl: true,
  },
]

/* ========================================================================
 *  系统级 env API Key 映射
 *  ======================================================================== */

/**
 * 如果系统在 .env 中配置了某服务商的 API Key，可以直接用于同步模型列表。
 * key: SYNCABLE_PROVIDERS 中的 provider name
 * value: 返回该 provider 的 API Key（来自 config）或 null
 */
const SYSTEM_API_KEYS: Record<string, string | undefined> = {
  deepseek: config.deepseekApiKey || undefined,
}

/* ========================================================================
 *  主同步函数
 *  ======================================================================== */

/**
 * 同步所有服务商的模型到 TavernModelMeta
 * @param adminUserId 触发同步的管理员 UUID（用于获取 API Key）
 * @returns 同步结果列表
 */
export async function syncAllModels(adminUserId: string): Promise<ModelSyncResult[]> {
  const results: ModelSyncResult[] = []

  // 1. 确保内置 FREE 模型存在（始终激活）
  const freeModelCount = await syncBuiltinFreeModels()

  // 2. 批量查询所有活跃 API Key 的 provider（避免逐个查询）
  const allActiveKeys = await prisma.tavernApiKey.findMany({
    where: { isActive: true },
    select: { provider: true, userUuid: true, keyValue: true, baseUrl: true },
  })
  const providersWithKeys = new Set(allActiveKeys.map(k => k.provider))
  
  // 也检查管理员自己的 key
  const adminKeys = allActiveKeys.filter(k => k.userUuid === adminUserId)
  const adminProviders = new Set(adminKeys.map(k => k.provider))

  console.log(`[sync-models] FREE models: ${freeModelCount}, providers with active keys: ${[...providersWithKeys].join(', ') || '(none)'}`)

  // 3. 逐个服务商同步 PAID 模型（仅同步有 key 的服务商）
  const skippedProviders: string[] = []
  for (const syncConfig of SYNCABLE_PROVIDERS) {
    try {
      // 跳过无 key 的服务商
      if (!providersWithKeys.has(syncConfig.provider)) {
        skippedProviders.push(syncConfig.provider)
        continue
      }

      let apiKey: string | null = null
      let effectiveBaseUrl = syncConfig.baseUrl

      // 检查系统级 env key（如果 .env 中有该服务商的 key，优先使用）
      const systemKey = SYSTEM_API_KEYS[syncConfig.provider]
      if (systemKey) {
        apiKey = systemKey
      }

      if (!apiKey) {
        // 优先使用管理员的 key
        const adminKey = adminKeys.find(k => k.provider === syncConfig.provider)
        if (adminKey) {
          try {
            const stored = JSON.parse(adminKey.keyValue)
            apiKey = decrypt(stored.encrypted, stored.iv, stored.tag)
            if (syncConfig.useCustomBaseUrl) {
              effectiveBaseUrl = adminKey.baseUrl || effectiveBaseUrl
            }
          } catch {
            continue // 解密失败 → 跳过
          }
        } else {
          // 使用任意用户的 key
          const anyKey = allActiveKeys.find(k => k.provider === syncConfig.provider)
          if (anyKey) {
            try {
              const stored = JSON.parse(anyKey.keyValue)
              apiKey = decrypt(stored.encrypted, stored.iv, stored.tag)
              if (syncConfig.useCustomBaseUrl) {
                effectiveBaseUrl = anyKey.baseUrl || effectiveBaseUrl
              }
            } catch {
              continue
            }
          }
        }
      }

      if (!apiKey) {
        skippedProviders.push(syncConfig.provider)
        continue
      }

      // One API 等服务商必须有自定义 baseUrl
      if (syncConfig.useCustomBaseUrl && !effectiveBaseUrl) {
        skippedProviders.push(syncConfig.provider)
        continue
      }

      // 调用服务商 API 获取模型列表
      const models = await fetchProviderModels({ ...syncConfig, baseUrl: effectiveBaseUrl }, apiKey!)
      if (models.length === 0) {
        results.push({ provider: syncConfig.provider, added: 0, updated: 0, deactivated: 0, error: '返回空列表' })
        continue
      }

      // 更新数据库
      const { added, updated } = await upsertModels(syncConfig.provider, models)
      results.push({ provider: syncConfig.provider, added, updated, deactivated: 0 })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ provider: syncConfig.provider, added: 0, updated: 0, deactivated: 0, error: msg })
    }
  }

  // 4. 记录同步日志
  const synced = results.filter(r => !r.error)
  const failed = results.filter(r => r.error)

  if (skippedProviders.length > 0) {
    console.log(`[sync-models] Skipped ${skippedProviders.length} providers (no API key): ${skippedProviders.join(', ')}`)
  }
  console.log(`[sync-models] Synced ${synced.length} providers (${failed.length} had errors), total added=${results.reduce((s,r) => s+r.added, 0)}, updated=${results.reduce((s,r) => s+r.updated, 0)}`)
  return results
}

/**
 * 同步内置 FREE 模型（永远激活）
 * 跳过已存在的模型，避免每次启动重复 upsert
 */
async function syncBuiltinFreeModels(): Promise<number> {
  // 批量查询所有已存在的 FREE 模型
  const existingModels = await prisma.tavernModelMeta.findMany({
    where: { modelId: { in: BUILTIN_FREE_MODELS.map(m => m.modelId) } },
    select: { modelId: true },
  })
  const existingIds = new Set(existingModels.map(e => e.modelId))
  
  let upserted = 0
  for (const m of BUILTIN_FREE_MODELS) {
    if (!existingIds.has(m.modelId)) {
      await prisma.tavernModelMeta.create({
        data: {
          modelId: m.modelId, displayName: m.displayName, provider: m.provider,
          description: m.description, icon: m.icon, minTier: m.minTier,
          minLevel: 1, quotaCost: m.quotaCost, sortOrder: m.sortOrder, isActive: true,
        },
      })
      upserted++
    }
  }
  
  if (upserted > 0) {
    console.log(`[sync-models] Created ${upserted} new FREE models`)
  }
  return existingIds.size
}

/* ========================================================================
 *  从服务商 API 拉取模型列表
 *  ======================================================================== */

async function fetchProviderModels(config: ProviderSyncConfig, apiKey: string): Promise<Array<{ id: string; name: string }>> {
  const url = `${config.baseUrl}${config.endpoint}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (config.authType === 'bearer') {
    headers['Authorization'] = `Bearer ${apiKey}`
  } else if (config.authType === 'x-api-key') {
    headers['x-api-key'] = apiKey
  }

  const resp = await axios.get(url, { headers, timeout: 15000 })
  if (resp.status !== 200) {
    throw new Error(`API 返回 ${resp.status}`)
  }

  // 按路径提取模型列表
  const rawList = resolvePath(resp.data, config.modelListPath)
  if (!Array.isArray(rawList)) {
    throw new Error(`模型列表格式异常: ${typeof rawList}`)
  }

  return rawList.map((item: Record<string, unknown>) => {
    let id = String(resolvePath(item, config.modelIdField) ?? '')
    const name = String(
      (config.modelNameField ? resolvePath(item, config.modelNameField) : id) ?? id
    )
    if (config.transformId) id = config.transformId(id)
    return { id, name }
  }).filter(m => m.id && m.id.length > 0)
}

/* ========================================================================
 *  更新/插入模型到数据库
 *  ======================================================================== */

async function upsertModels(provider: string, models: Array<{ id: string; name: string }>): Promise<{ added: number; updated: number }> {
  let added = 0
  let updated = 0

  // 获取该服务商已有的模型 ID 集合
  const existing = await prisma.tavernModelMeta.findMany({
    where: { provider },
    select: { modelId: true },
  })
  const existingIds = new Set(existing.map(e => e.modelId))
  const fetchedIds = new Set(models.map(m => m.id))

  for (const m of models) {
    if (existingIds.has(m.id)) {
      await prisma.tavernModelMeta.update({
        where: { modelId: m.id },
        data: { displayName: m.name, isActive: true },
      })
      updated++
    } else {
      await prisma.tavernModelMeta.create({
        data: {
          modelId: m.id, displayName: m.name, provider,
          description: `来自 ${provider} 官方 API`, minTier: 'PAID',
          minLevel: 1, quotaCost: 2, sortOrder: 500, isActive: true,
        },
      })
      added++
    }
  }

  // 标记已下架模型
  const removed = existing.filter(e => !fetchedIds.has(e.modelId))
  if (removed.length > 0) {
    await prisma.tavernModelMeta.updateMany({
      where: { modelId: { in: removed.map(r => r.modelId) } },
      data: { isActive: false },
    })
  }

  return { added, updated }
}

/* ========================================================================
 *  工具函数
 *  ======================================================================== */

function resolvePath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}
