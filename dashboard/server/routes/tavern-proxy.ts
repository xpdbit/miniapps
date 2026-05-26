import { Router, Request, Response } from 'express'
import axios from 'axios'

const router = Router()
const TAVERN_API = process.env.TAVERN_API_URL || 'http://tavern-server:3002/api/v1'
const TAVERN_ADMIN_TOKEN = process.env.TAVERN_ADMIN_TOKEN || ''

if (!TAVERN_ADMIN_TOKEN) {
  console.warn('[Tavern Proxy] TAVERN_ADMIN_TOKEN not set — relying on dashboard JWT passthrough')
}

/**
 * 统一代理处理：转换路径 + 认证
 * 前端请求：/api/admin/tavern/pending
 * Express 挂载在 /api/admin/tavern，req.path = /pending
 * 目标 URL = {TAVERN_API}/admin/pending
 *
 * 认证：如果配置了 TAVERN_ADMIN_TOKEN，用它替换 Authorization header。
 * 否则透传用户的 dashboard JWT（不兼容 tavern-server requireAdmin, 需配置一致）。
 */
async function proxyRequest(
  req: Request,
  res: Response,
  method: 'get' | 'post' | 'put' | 'delete',
): Promise<void> {
  try {
    // req.path 是挂载点之后剩余路径，如 /dashboard/stats → 去掉前导斜杠得到 dashboard/stats
    const subPath = req.path.replace(/^\//, '')

    // 管理类操作需要 /admin/ 前缀，普通操作直接路由到 /v1/ 下
    // characters: Dashboard 管理面板需要查看所有角色（admin 视图），而非仅自己的角色
    const adminOps = [
      'dashboard/', 'model', 'sync-', 'pending', 'approve/', 'reject/',
      'ban/', 'logs/', 'chats', 'keys', 'import', 'characters', 'users',
      'announcements', 'reports',
    ]
    const needsAdminPrefix = adminOps.some(op => subPath.startsWith(op))
    const targetPath = needsAdminPrefix ? `admin/${subPath}` : subPath
    const targetUrl = `${TAVERN_API}/${targetPath}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (TAVERN_ADMIN_TOKEN) {
      headers['Authorization'] = `Bearer ${TAVERN_ADMIN_TOKEN}`
    } else if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization
    }

    const response = await axios({
      method,
      url: targetUrl,
      headers,
      params: method === 'get' ? req.query : undefined,
      data: ['post', 'put'].includes(method) ? req.body : undefined,
      timeout: 10000,
      validateStatus: () => true,
    })

    res.status(response.status).json(response.data)
  } catch (err: unknown) {
    const error = err as { response?: { status?: number; data?: unknown }; message?: string; code?: string }
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      res.status(502).json({ success: false, message: `Tavern server unreachable: ${error.message}` })
    } else {
      res.status(error.response?.status ?? 500).json(error.response?.data ?? { success: false, message: 'Proxy error' })
    }
  }
}

// Router 挂载在 /api/admin/tavern，此处 req.path 已是去除了 mount prefix 的剩余路径
// 无需再按 /tavern 前缀过滤 — 所有到达此 router 的请求都是 tavern 代理请求
router.use((req: Request, res: Response) => {
  const method = req.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'
  if (['get', 'post', 'put', 'delete'].includes(method)) {
    void proxyRequest(req, res, method)
  } else {
    res.status(405).json({ success: false, message: 'Method not allowed' })
  }
})

export default router
