import { Router, Response } from 'express'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import { getUserTier, getAvailableModels } from '../services/tier.service'
import { discoverModels } from '../services/model-discovery.service'
import { getDecryptedKey } from '../services/key.service'
import { getProviders } from '../services/config-provider.service'
import { success } from '../utils/response'

const router = Router()

// GET /api/v1/user/tier — 获取当前用户的等级与配额
router.get('/user/tier', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tierInfo = await getUserTier(req.user!.userId)
    res.json(success(tierInfo))
  } catch (err) {
    console.error('[tier] get user tier error:', err)
    res.status(500).json({ code: 500, message: '服务器内部错误', data: null })
  }
})

// 🆕 GET /api/v1/models/providers — 获取可用 Provider 列表（来自 Dashboard）
router.get('/models/providers', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const providers = await getProviders()
    // 只返回前端需要的字段（不暴露 apiKey）
    const safeList = providers.map(p => ({
      provider: p.provider,
      name: p.name,
      isFree: ['tongyi', 'opencode', 'deepseek'].includes(p.provider),
      baseUrl: p.baseUrl || '',
    }))
    res.json(success(safeList))
  } catch (err) {
    console.error('[tier] get providers error:', err)
    res.status(500).json({ code: 500, message: '服务器内部错误', data: null })
  }
})

// GET /api/v1/models — 获取当前用户可用的 AI 模型列表（酒馆自持模型，来自 ModelMeta）
router.get('/models', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const models = await getAvailableModels(req.user!.userId)
    res.json(success(models))
  } catch (err) {
    console.error('[tier] get models error:', err)
    res.status(500).json({ code: 500, message: '服务器内部错误', data: null })
  }
})

// GET /api/v1/models/discover/:provider — 从指定服务商官方 API 获取可用模型列表
router.get('/models/discover/:provider', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider } = req.params
    const userId = req.user!.userId

    // 获取用户为该服务商配置的 API Key
    let decryptedKey: { key: string; baseUrl?: string } | null = null
    try {
      decryptedKey = await getDecryptedKey(userId, provider)
    } catch (keyErr: unknown) {
      const keyMsg = keyErr instanceof Error ? keyErr.message : '密钥解密失败'
      console.error(`[tier] getDecryptedKey error for ${provider}:`, keyMsg)
      res.status(400).json({ code: 400, message: `密钥配置异常，请重新添加 ${provider} 的 API Key`, data: null })
      return
    }

    if (!decryptedKey) {
      res.status(400).json({ code: 400, message: `未配置 ${provider} 的 API Key`, data: null })
      return
    }

    try {
      const models = await discoverModels(provider, decryptedKey.key, decryptedKey.baseUrl)
      res.json(success(models))
    } catch (discoverErr: unknown) {
      const discoverMsg = discoverErr instanceof Error ? discoverErr.message : '发现模型失败'
      console.error(`[tier] discover models error for ${provider}:`, discoverMsg)
      // 外部 API 调用失败返回 502，不是服务器自身 500
      res.status(502).json({ code: 502, message: `${provider} API 请求失败: ${discoverMsg}`, data: null })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '发现模型失败'
    console.error(`[tier] discover models unexpected error:`, message)
    res.status(500).json({ code: 500, message: '服务器内部错误', data: null })
  }
})

export default router
