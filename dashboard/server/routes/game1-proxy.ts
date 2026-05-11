import { Router, Request, Response } from 'express'
import axios from 'axios'

const router = Router()
const GAME1_API = process.env.GAME1_API_URL || 'http://game1-server:3001/api/v1/game1'
const GAME1_ADMIN_TOKEN = process.env.GAME1_ADMIN_TOKEN || ''

if (!GAME1_ADMIN_TOKEN) {
  console.warn('[Game1 Proxy] GAME1_ADMIN_TOKEN not set — Game1 admin API calls will fail (403 Forbidden)')
  console.warn('[Game1 Proxy] Set GAME1_ADMIN_TOKEN to match game1-server\'s ADMIN_TOKEN env var')
}

/**
 * 统一代理处理：转换路径 + 注入 admin token 认证
 * 前端请求：GET /api/admin/game1/players
 * Express 挂载在 /api/admin，所以 req.path = /game1/players
 * 提取子路径后拼接：{GAME1_API}/admin/players
 *
 * 认证：Dashboard 使用 GAME1_ADMIN_TOKEN 作为 Bearer token，
 * 匹配 game1-server requireAdmin 中间件的 adminToken 检查。
 */
async function proxyRequest(
  req: Request,
  res: Response,
  method: 'get' | 'post' | 'put' | 'delete',
): Promise<void> {
  try {
    // 关键修复：req.path = /game1/players，提取子路径
    const subPath = req.path.replace(/^\/game1\//, '')
    const targetUrl = `${GAME1_API}/admin/${subPath}`

    // 使用 GAME1_ADMIN_TOKEN 认证（与 game1-server 的 ADMIN_TOKEN 保持一致）
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (GAME1_ADMIN_TOKEN) {
      headers['Authorization'] = `Bearer ${GAME1_ADMIN_TOKEN}`
    } else if (req.headers.authorization) {
      // 兜底：透传用户 token（但通常不兼容 requireAdmin）
      headers['Authorization'] = req.headers.authorization
    }

    const response = await axios({
      method,
      url: targetUrl,
      headers,
      params: method === 'get' ? req.query : undefined,
      data: ['post', 'put'].includes(method) ? req.body : undefined,
      timeout: 10000,
      validateStatus: () => true, // 透传所有状态码，让前端处理
    })

    res.status(response.status).json(response.data)
  } catch (err: unknown) {
    const error = err as { response?: { status?: number; data?: unknown }; message?: string; code?: string }
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      res.status(502).json({ success: false, message: `Game1 server unreachable: ${error.message}` })
    } else {
      res.status(error.response?.status ?? 500).json(error.response?.data ?? { success: false, message: 'Proxy error' })
    }
  }
}

// 使用 router.use() 避免 Express5 path-to-regexp v8 的兼容问题
// use() 接受字符串路径前缀，不经过 path-to-regexp 匹配
router.use('/game1', (req: Request, res: Response) => {
  const method = req.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'
  if (['get', 'post', 'put', 'delete'].includes(method)) {
    void proxyRequest(req, res, method)
  } else {
    res.status(405).json({ success: false, message: 'Method not allowed' })
  }
})

export default router
