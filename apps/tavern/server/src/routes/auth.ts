import { Router, Response } from 'express'
import axios from 'axios'
import prisma from '../utils/prisma'
import { config } from '../config'
import jwt from 'jsonwebtoken'
import { requireAuth, optionalAuth } from '../middleware/auth'
import { AuthenticatedRequest } from '../types'
import { getUserTier, ensureUserTier } from '../services/tier.service'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production'
const AUTH_API_URL = process.env.AUTH_API_URL || 'http://localhost:3001'

// POST /api/v1/auth/login — 委托统一认证
router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, credential, password } = req.body

    // 账号密码登录 → 代理到 Dashboard /api/auth/login
    if (credential && password) {
      const response = await axios.post(`${AUTH_API_URL}/api/auth/login`, {
        credential,
        password,
      })
      if (response.data.code !== 200) {
        res.status(401).json({ code: 401, message: response.data.message || '用户名或密码错误', data: null })
        return
      }
      const { access_token, refresh_token, user } = response.data.data
      await ensureUserTier(user.uuid)
      res.json({
        code: 0, message: 'ok',
        data: { access_token, refresh_token, user: { uuid: user.uuid, nickname: user.nickname, avatar_url: user.avatar_url, role: user.role } },
      })
      return
    }

    // 微信登录 → 代理到 Dashboard /api/auth/wechat/login
    if (code) {
      // 首先通过微信 API 换取 openid（保留此逻辑用于 dev 降级）
      let wxCode = code
      if (code.startsWith('dev_') || code.startsWith('test_')) {
        // 开发环境：直接传 code 给 Dashboard（Dashboard 也会处理 dev_ 前缀）
      } else {
        // 真实微信 code：先换 openid，再传给 Dashboard
        try {
          const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
            params: { appid: config.wechatAppId, secret: config.wechatAppSecret, js_code: code, grant_type: 'authorization_code' },
            timeout: 5000,
          })
          if (wxRes.data.errcode) {
            res.status(400).json({ code: 400, message: '微信登录失败: ' + (wxRes.data.errmsg || 'code 无效'), data: null })
            return
          }
          wxCode = wxRes.data.openid
        } catch {
          res.status(502).json({ code: 502, message: '微信服务暂不可用', data: null })
          return
        }
      }

      const response = await axios.post(`${AUTH_API_URL}/api/auth/wechat/login`, { wx_code: wxCode })
      if (response.data.code !== 200 && response.data.code !== 201) {
        res.status(401).json({ code: 401, message: response.data.message || '微信登录失败', data: null })
        return
      }
      const { access_token, refresh_token, user } = response.data.data
      await ensureUserTier(user.uuid)
      res.json({
        code: 0, message: 'ok',
        data: {
          access_token, refresh_token,
          user: { uuid: user.uuid, nickname: user.nickname, avatar_url: user.avatar_url, role: user.role },
          is_new: response.data.code === 201,
        },
      })
      return
    }

    res.status(400).json({ code: 400, message: '缺少登录凭证', data: null })
  } catch (err) {
    console.error('[auth/login]', (err as Error).message)
    res.status(500).json({ code: 500, message: '登录服务异常', data: null })
  }
})

// POST /api/v1/auth/wechat/login — 微信一键登录
router.post('/wechat/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { wx_code } = req.body
    if (!wx_code) {
      res.status(400).json({ code: 400, message: '缺少微信授权码', data: null })
      return
    }

    // 代理到 Dashboard /api/auth/wechat/login
    const response = await axios.post(`${AUTH_API_URL}/api/auth/wechat/login`, { wx_code })
    if (response.data.code !== 200 && response.data.code !== 201) {
      res.status(401).json({ code: 401, message: response.data.message || '微信登录失败', data: null })
      return
    }
    const { access_token, refresh_token, user } = response.data.data
    await ensureUserTier(user.uuid)
    res.json({
      code: 0, message: 'ok',
      data: {
        access_token, refresh_token,
        user: { uuid: user.uuid, nickname: user.nickname, avatar_url: user.avatar_url, role: user.role },
        is_new: response.data.code === 201,
      },
    })
  } catch (err) {
    console.error('[auth/wechat/login]', (err as Error).message)
    res.status(500).json({ code: 500, message: '登录服务异常', data: null })
  }
})

// GET /api/v1/auth/me — 获取当前用户信息
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userUuid = req.user!.userId // middleware 将 JWT payload.sub 存为 userId

    // 从 Dashboard 获取用户基本信息
    let nickname = '酒馆旅人'
    let avatar_url: string | null = null
    let role = 'user'

    try {
      const meRes = await axios.get(`${AUTH_API_URL}/api/auth/me`, {
        headers: { Authorization: req.headers.authorization || '' },
      })
      if (meRes.data.code === 200 && meRes.data.data?.user) {
        nickname = meRes.data.data.user.nickname || nickname
        avatar_url = meRes.data.data.user.avatar_url || null
        role = meRes.data.data.user.role || role
      }
    } catch {
      // 降级：使用 JWT 中的信息
    }

    // 从 tavern 库获取 tier 和配额
    let tier = null
    try {
      tier = await getUserTier(userUuid)
    } catch {
      // ignore
    }

    res.json({
      code: 0, message: 'ok',
      data: {
        user: {
          uuid: userUuid,
          nickname,
          avatar_url,
          role,
        },
        tier,
        daily_quota: tier?.maxDailyQuota ?? 20,
        used_quota: 0,
      },
    })
  } catch {
    res.status(500).json({ code: 500, message: '服务器内部错误', data: null })
  }
})

// GET /api/v1/auth/wechat/code — 获取微信临时 code（仅开发/H5 环境）
router.get('/wechat/code', async (_req: AuthenticatedRequest, res: Response) => {
  // 在开发环境返回 test code，生产环境返回错误
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ code: 403, message: '仅开发环境可用', data: null })
    return
  }
  const devCode = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  res.json({ code: 0, data: { code: devCode } })
})

export default router
