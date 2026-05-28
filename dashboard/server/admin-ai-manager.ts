// AI Provider 统一配置管理路由 — /api/v1/admin/ai-manager/*
// 集中管理所有 AI 提供商（API Key、Base URL、负载均衡配置）
// 替代原来各项目独立的环境变量配置
import { Router, type Request, type Response } from 'express'
import prisma from './prisma'
import { authenticate } from './admin-auth'

const router = Router()

// =============================================================================
// 默认 Provider 种子数据（匹配 ai-proxy.service.ts PROVIDER_CONFIGS）
// =============================================================================
const DEFAULT_PROVIDERS: Array<{
  provider: string
  name: string
  baseUrl: string
  apiFormat: 'openai' | 'anthropic' | 'google'
}> = [
  { provider: 'tongyi', name: '通义千问', baseUrl: '', apiFormat: 'openai' },
  { provider: 'opencode', name: 'OpenCode Go', baseUrl: 'https://opencode.ai/zen/go/v1', apiFormat: 'openai' },
  { provider: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com', apiFormat: 'openai' },
  { provider: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiFormat: 'openai' },
  { provider: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com', apiFormat: 'anthropic' },
  { provider: 'google', name: 'Google', baseUrl: 'https://generativelanguage.googleapis.com', apiFormat: 'google' },
  { provider: 'zhipu', name: '智谱', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiFormat: 'openai' },
  { provider: 'moonshot', name: '月之暗面', baseUrl: 'https://api.moonshot.cn', apiFormat: 'openai' },
  { provider: 'minimax', name: 'MiniMax', baseUrl: 'https://api.minimaxi.com', apiFormat: 'openai' },
  { provider: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api', apiFormat: 'openai' },
  { provider: 'oneapi', name: 'One API', baseUrl: '', apiFormat: 'openai' },
]

// =============================================================================
// 辅助函数：将 Prisma 模型转为安全 API 响应（可控制是否包含敏感字段）
// =============================================================================
interface ProviderRecord {
  id: string
  provider: string
  name: string
  apiKey: string | null
  baseUrl: string | null
  config: unknown
  isActive: boolean
  sortOrder: number
  modelsScope: string | null
  createdAt: Date
  updatedAt: Date
}

function formatProvider(p: ProviderRecord, sensitive = true) {
  return {
    id: p.id,
    provider: p.provider,
    name: p.name,
    baseUrl: p.baseUrl,
    config: p.config,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
    modelsScope: p.modelsScope,
    ...(sensitive ? { apiKey: p.apiKey } : {}),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

// =============================================================================
// 公开端点（无需认证，仅返回非敏感字段）
// =============================================================================

// GET /ai-manager/public — 获取所有启用 Provider 的配置（供 tavern 等后端调用）
router.get('/public', async (_req: Request, res: Response) => {
  try {
    const providers = await prisma.dashboardAiProvider.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    res.json({
      success: true,
      data: {
        providers: providers.map((p) => formatProvider(p, true)),
      },
    })
  } catch (e) {
    console.error('[AI-Manager] 获取公开 Provider 列表失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// =============================================================================
// 以下所有路由需要认证
// =============================================================================

// GET /ai-manager — 列出所有 Provider（支持 isActive 筛选）
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { isActive } = req.query as { isActive?: string }
    const where: { isActive?: boolean } = {}
    if (isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    const providers = await prisma.dashboardAiProvider.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    })

    res.json({
      success: true,
      data: {
        providers: providers.map((p) => formatProvider(p)),
      },
    })
  } catch (e) {
    console.error('[AI-Manager] 获取 Provider 列表失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// GET /ai-manager/:provider — 获取单个 Provider 详情
router.get('/:provider', authenticate, async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider as string
    const record = await prisma.dashboardAiProvider.findUnique({
      where: { provider },
    })

    if (!record) {
      res.status(404).json({ success: false, message: `Provider '${provider}' 不存在` })
      return
    }

    res.json({
      success: true,
      data: { provider: formatProvider(record) },
    })
  } catch (e) {
    console.error('[AI-Manager] 获取 Provider 详情失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// POST /ai-manager — 创建/更新 Provider（按 provider 名称 upsert）
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      provider,
      name,
      apiKey,
      baseUrl,
      config,
      isActive,
      sortOrder,
      modelsScope,
    } = req.body as {
      provider: string
      name?: string
      apiKey?: string | null
      baseUrl?: string | null
      config?: Record<string, unknown> | null
      isActive?: boolean
      sortOrder?: number
      modelsScope?: string | null
    }

    if (!provider) {
      res.status(400).json({ success: false, message: 'provider 名称不能为空' })
      return
    }

    // 查找已有记录的 display name（如果未提供 name）
    let displayName = name
    if (!displayName) {
      const existing = await prisma.dashboardAiProvider.findUnique({
        where: { provider },
      })
      displayName = existing?.name || DEFAULT_PROVIDERS.find((d) => d.provider === provider)?.name || provider
    }

    const record = await prisma.dashboardAiProvider.upsert({
      where: { provider },
      update: {
        name: displayName,
        apiKey: apiKey !== undefined ? apiKey : undefined,
        baseUrl: baseUrl !== undefined ? baseUrl : undefined,
        config: config !== undefined ? config : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        sortOrder: sortOrder !== undefined ? sortOrder : undefined,
        modelsScope: modelsScope !== undefined ? modelsScope : undefined,
      },
      create: {
        provider,
        name: displayName,
        apiKey: apiKey ?? null,
        baseUrl: baseUrl ?? DEFAULT_PROVIDERS.find((d) => d.provider === provider)?.baseUrl ?? null,
        config: config ?? null,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
        modelsScope: modelsScope ?? null,
      },
    })

    res.json({
      success: true,
      data: { provider: formatProvider(record) },
    })
  } catch (e) {
    console.error('[AI-Manager] 创建/更新 Provider 失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// PUT /ai-manager/:provider — 更新 Provider 配置
router.put('/:provider', authenticate, async (req: Request, res: Response) => {
  try {
    const providerName = req.params.provider as string
    const { name, apiKey, baseUrl, config, isActive, sortOrder, modelsScope } = req.body as {
      name?: string
      apiKey?: string | null
      baseUrl?: string | null
      config?: Record<string, unknown> | null
      isActive?: boolean
      sortOrder?: number
      modelsScope?: string | null
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (apiKey !== undefined) data.apiKey = apiKey
    if (baseUrl !== undefined) data.baseUrl = baseUrl
    if (config !== undefined) data.config = config
    if (isActive !== undefined) data.isActive = isActive
    if (sortOrder !== undefined) data.sortOrder = sortOrder
    if (modelsScope !== undefined) data.modelsScope = modelsScope

    if (Object.keys(data).length === 0) {
      res.status(400).json({ success: false, message: '没有提供更新字段' })
      return
    }

    const record = await prisma.dashboardAiProvider.update({
      where: { provider: providerName },
      data,
    })

    res.json({
      success: true,
      data: { provider: formatProvider(record) },
    })
  } catch (e) {
    console.error('[AI-Manager] 更新 Provider 失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// DELETE /ai-manager/:provider — 删除 Provider
router.delete('/:provider', authenticate, async (req: Request, res: Response) => {
  try {
    const providerName = req.params.provider as string
    await prisma.dashboardAiProvider.delete({ where: { provider: providerName } })
    res.json({ success: true, message: `Provider '${providerName}' 已删除` })
  } catch (e) {
    console.error('[AI-Manager] 删除 Provider 失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// POST /ai-manager/:provider/test — 测试 Provider 连接（使用存储的 API Key）
router.post('/:provider/test', authenticate, async (req: Request, res: Response) => {
  try {
    const providerName = req.params.provider as string
    const record = await prisma.dashboardAiProvider.findUnique({
      where: { provider: providerName },
    })

    if (!record) {
      res.status(404).json({ success: false, message: `Provider '${providerName}' 不存在` })
      return
    }

    if (!record.apiKey) {
      res.status(400).json({ success: false, message: '未配置 API Key，无法测试' })
      return
    }

    // 简单连通性测试：发送一个最小请求到 Base URL
    try {
      const defaultConfig = DEFAULT_PROVIDERS.find((d) => d.provider === providerName)
      const testBaseUrl = record.baseUrl || defaultConfig?.baseUrl || ''

      if (!testBaseUrl) {
        res.status(400).json({
          success: false,
          message: '未配置 Base URL 且无默认地址，无法测试',
        })
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const axios = require('axios')
      const response = await axios.get(`${testBaseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${record.apiKey}` },
        timeout: 10000,
        validateStatus: null,
      })

      // 200/401/403 都说明连通性正常（401=Key无效但服务可达）
      const isReachable = response.status < 500
      res.json({
        success: true,
        data: {
          reachable: isReachable,
          statusCode: response.status,
          message: isReachable
            ? response.status === 200
              ? '连接成功，API Key 有效'
              : `服务可达 (HTTP ${response.status})，请检查 API Key 权限`
            : `服务不可达 (HTTP ${response.status})`,
        },
      })
    } catch (err) {
      const message = (err as Error).message
      res.json({
        success: true,
        data: {
          reachable: false,
          statusCode: null,
          message: `连接失败: ${message}`,
        },
      })
    }
  } catch (e) {
    console.error('[AI-Manager] 测试 Provider 失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// POST /ai-manager/sync — 从内置列表同步（播种）默认 Provider
router.post('/sync', authenticate, async (req: Request, res: Response) => {
  try {
    const results: Array<{ provider: string; action: string }> = []

    for (const dp of DEFAULT_PROVIDERS) {
      const existing = await prisma.dashboardAiProvider.findUnique({
        where: { provider: dp.provider },
      })

      if (existing) {
        // 只更新 name 和 baseUrl（不覆盖已有的 apiKey/config）
        await prisma.dashboardAiProvider.update({
          where: { provider: dp.provider },
          data: {
            name: dp.name,
            baseUrl: existing.baseUrl ?? dp.baseUrl,
          },
        })
        results.push({ provider: dp.provider, action: 'updated' })
      } else {
        await prisma.dashboardAiProvider.create({
          data: {
            provider: dp.provider,
            name: dp.name,
            baseUrl: dp.baseUrl || null,
            isActive: true,
            sortOrder: 0,
          },
        })
        results.push({ provider: dp.provider, action: 'created' })
      }
    }

    res.json({
      success: true,
      data: { results },
      message: `同步完成：创建 ${results.filter((r) => r.action === 'created').length} 个，更新 ${results.filter((r) => r.action === 'updated').length} 个`,
    })
  } catch (e) {
    console.error('[AI-Manager] 同步默认 Provider 失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

export default router
