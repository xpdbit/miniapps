import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import axios from 'axios'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import prisma from '../utils/prisma'
import { config } from '../config'
import jwt from 'jsonwebtoken'
import { requireAuth } from '../middleware/auth'
import { AuthenticatedRequest } from '../types'
import { getUserTier, ensureUserTier } from '../services/tier.service'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production'
const ACCESS_EXPIRES = '15m'
const REFRESH_DAYS = 30

// 登录端点严限流（防暴力破解）
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁，请稍后再试', data: null },
})

function signAccessToken(uuid: string, role: string): string {
  return jwt.sign({ sub: uuid, role }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES })
}

// POST /api/v1/auth/login — 直连 miniapps 库处理登录
router.post('/login', loginLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, credential, password } = req.body

    // 账号密码登录
    if (credential && password) {
      // 从 miniapps.users 查用户（通过 nickname）
      const rows = await prisma.$queryRaw`SELECT u.uuid, u.nickname, u.avatar_url, u.role, u.status, ua.credential as pwd_hash FROM miniapps.users u INNER JOIN miniapps.user_auths ua ON u.uuid = ua.user_uuid AND ua.auth_type = 'password' WHERE u.nickname = ${credential} LIMIT 1` as any[]
      const user = rows[0]
      if (!user) {
        res.status(401).json({ code: 401, message: '用户名或密码错误', data: null })
        return
      }
      const valid = await bcrypt.compare(password, user.pwd_hash)
      if (!valid) {
        res.status(401).json({ code: 401, message: '用户名或密码错误', data: null })
        return
      }
      if (user.status === 'disabled') {
        res.status(403).json({ code: 403, message: '账号已被禁用', data: null })
        return
      }

      const accessToken = signAccessToken(user.uuid, user.role)
      const refreshToken = crypto.randomBytes(64).toString('hex')
      await prisma.$executeRaw`INSERT INTO miniapps.user_sessions (id, user_uuid, refresh_token, expires_at, created_at) VALUES (${crypto.randomUUID()}, ${user.uuid}, ${refreshToken}, ${new Date(Date.now() + REFRESH_DAYS * 86400000)}, NOW())`

      await ensureUserTier(user.uuid)
      res.json({
        code: 0, message: 'ok',
        data: { access_token: accessToken, refresh_token: refreshToken, user: { uuid: user.uuid, nickname: user.nickname, avatar_url: user.avatar_url, role: user.role } },
      })
      return
    }

    // 微信登录
    if (code) {
      let openid = code
      if (!code.startsWith('dev_') && !code.startsWith('test_')) {
        try {
          const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
            params: { appid: config.wechatAppId, secret: config.wechatAppSecret, js_code: code, grant_type: 'authorization_code' },
            timeout: 5000,
          })
          if (wxRes.data.errcode) {
            res.status(400).json({ code: 400, message: '微信登录失败: ' + (wxRes.data.errmsg || 'code 无效'), data: null })
            return
          }
          openid = wxRes.data.openid
        } catch {
          res.status(502).json({ code: 502, message: '微信服务暂不可用', data: null })
          return
        }
      }

      // 查微信绑定
      const wxRows = await prisma.$queryRaw`SELECT u.uuid, u.nickname, u.avatar_url, u.role, u.status FROM miniapps.users u INNER JOIN miniapps.user_auths ua ON u.uuid = ua.user_uuid AND ua.auth_type = 'wechat' AND ua.credential = ${openid} LIMIT 1` as any[]
      let user = wxRows[0]
      let isNew = false

      if (!user) {
        // 新用户自动注册
        const newUuid = crypto.randomUUID()
        const nickname = `微信用户${newUuid.slice(0, 8)}`
        await prisma.$executeRaw`INSERT INTO miniapps.users (uuid, nickname, role, status, created_at, updated_at) VALUES (${newUuid}, ${nickname}, 'user', 'active', NOW(), NOW())`
        await prisma.$executeRaw`INSERT INTO miniapps.user_auths (id, user_uuid, auth_type, credential, verified_at, created_at) VALUES (${crypto.randomUUID()}, ${newUuid}, 'wechat', ${openid}, NOW(), NOW())`
        user = { uuid: newUuid, nickname, avatar_url: null, role: 'user', status: 'active' }
        isNew = true
      }

      if (user.status === 'disabled') {
        res.status(403).json({ code: 403, message: '账号已被禁用', data: null })
        return
      }

      const accessToken = signAccessToken(user.uuid, user.role)
      const refreshToken = crypto.randomBytes(64).toString('hex')
      await prisma.$executeRaw`INSERT INTO miniapps.user_sessions (id, user_uuid, refresh_token, expires_at, created_at) VALUES (${crypto.randomUUID()}, ${user.uuid}, ${refreshToken}, ${new Date(Date.now() + REFRESH_DAYS * 86400000)}, NOW())`

      await ensureUserTier(user.uuid)
      res.json({
        code: 0, message: 'ok',
        data: {
          access_token: accessToken, refresh_token: refreshToken,
          user: { uuid: user.uuid, nickname: user.nickname, avatar_url: user.avatar_url, role: user.role },
          is_new: isNew,
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
router.post('/wechat/login', loginLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { wx_code } = req.body
    if (!wx_code) {
      res.status(400).json({ code: 400, message: '缺少微信授权码', data: null })
      return
    }

    let openid = wx_code
    // 非 dev/test code 需要进行 jscode2session 交换获取真实 openid
    if (!wx_code.startsWith('dev_') && !wx_code.startsWith('test_')) {
      try {
        const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
          params: { appid: config.wechatAppId, secret: config.wechatAppSecret, js_code: wx_code, grant_type: 'authorization_code' },
          timeout: 5000,
        })
        if (wxRes.data.errcode) {
          res.status(400).json({ code: 400, message: '微信登录失败: ' + (wxRes.data.errmsg || 'code 无效'), data: null })
          return
        }
        openid = wxRes.data.openid
      } catch {
        res.status(502).json({ code: 502, message: '微信服务暂不可用', data: null })
        return
      }
    }

    // 查微信绑定
    const wxRows = await prisma.$queryRaw`SELECT u.uuid, u.nickname, u.avatar_url, u.role, u.status FROM miniapps.users u INNER JOIN miniapps.user_auths ua ON u.uuid = ua.user_uuid AND ua.auth_type = 'wechat' AND ua.credential = ${openid} LIMIT 1` as any[]
    let user = wxRows[0]
    let isNew = false

    if (!user) {
      // 新用户自动注册
      const newUuid = crypto.randomUUID()
      const nickname = `微信用户${newUuid.slice(0, 8)}`
      await prisma.$executeRaw`INSERT INTO miniapps.users (uuid, nickname, role, status, created_at, updated_at) VALUES (${newUuid}, ${nickname}, 'user', 'active', NOW(), NOW())`
      await prisma.$executeRaw`INSERT INTO miniapps.user_auths (id, user_uuid, auth_type, credential, verified_at, created_at) VALUES (${crypto.randomUUID()}, ${newUuid}, 'wechat', ${openid}, NOW(), NOW())`
      user = { uuid: newUuid, nickname, avatar_url: null, role: 'user', status: 'active' }
      isNew = true
    }

    if (user.status === 'disabled') {
      res.status(403).json({ code: 403, message: '账号已被禁用', data: null })
      return
    }

    const accessToken = signAccessToken(user.uuid, user.role)
    const refreshToken = crypto.randomBytes(64).toString('hex')
    await prisma.$executeRaw`INSERT INTO miniapps.user_sessions (id, user_uuid, refresh_token, expires_at, created_at) VALUES (${crypto.randomUUID()}, ${user.uuid}, ${refreshToken}, ${new Date(Date.now() + REFRESH_DAYS * 86400000)}, NOW())`

    await ensureUserTier(user.uuid)
    res.json({
      code: 0, message: 'ok',
      data: {
        access_token: accessToken, refresh_token: refreshToken,
        user: { uuid: user.uuid, nickname: user.nickname, avatar_url: user.avatar_url, role: user.role },
        is_new: isNew,
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
    const userUuid = req.user!.userId

    let nickname = '酒馆旅人'
    let avatar_url: string | null = null
    let role = 'user'

    // 从 miniapps.users 获取用户信息
    try {
      const rows = await prisma.$queryRaw`SELECT nickname, avatar_url, role FROM miniapps.users WHERE uuid = ${userUuid} LIMIT 1` as any[]
      if (rows.length > 0) {
        nickname = rows[0].nickname || nickname
        avatar_url = rows[0].avatar_url || null
        role = rows[0].role || role
      }
    } catch {
      // 降级：使用 JWT 信息
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
        user: { uuid: userUuid, nickname, avatar_url, role },
        tier,
        daily_quota: tier?.maxDailyQuota ?? 20,
        used_quota: tier?.dailyQuotaUsed ?? 0,
      },
    })
  } catch {
    res.status(500).json({ code: 500, message: '服务器内部错误', data: null })
  }
})

// POST /api/v1/auth/refresh — 刷新 access_token
router.post('/refresh', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refresh_token } = req.body
    if (!refresh_token) {
      res.status(400).json({ code: 400, message: '缺少 refresh_token', data: null })
      return
    }

    // 查找有效 session
    const rows = await prisma.$queryRaw`
      SELECT us.user_uuid, u.role
      FROM miniapps.user_sessions us
      JOIN miniapps.users u ON u.uuid = us.user_uuid
      WHERE us.refresh_token = ${refresh_token}
        AND us.expires_at > NOW()
        AND u.status = 'active'
      LIMIT 1
    ` as any[]

    if (!rows || rows.length === 0) {
      res.status(401).json({ code: 401, message: 'refresh_token 无效或已过期，请重新登录', data: null })
      return
    }

    const session = rows[0]
    const userUuid = session.user_uuid
    const userRole = session.role

    // 删除旧 session
    await prisma.$executeRaw`DELETE FROM miniapps.user_sessions WHERE refresh_token = ${refresh_token}`

    // 签发新 token
    const accessToken = signAccessToken(userUuid, userRole)
    const newRefreshToken = crypto.randomBytes(64).toString('hex')
    await prisma.$executeRaw`INSERT INTO miniapps.user_sessions (id, user_uuid, refresh_token, expires_at, created_at) VALUES (${crypto.randomUUID()}, ${userUuid}, ${newRefreshToken}, ${new Date(Date.now() + REFRESH_DAYS * 86400000)}, NOW())`

    res.json({
      code: 0, message: 'ok',
      data: { access_token: accessToken, refresh_token: newRefreshToken },
    })
  } catch (err) {
    console.error('[auth/refresh]', (err as Error).message)
    res.status(500).json({ code: 500, message: 'Token 刷新失败', data: null })
  }
})

// POST /api/v1/auth/forgot-password — 发送密码重置邮件（占位，需配置邮件服务）
router.post('/forgot-password', loginLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { credential } = req.body
    if (!credential) {
      res.status(400).json({ code: 400, message: '请输入用户名', data: null })
      return
    }

    // 查找用户
    const rows = await prisma.$queryRaw`SELECT u.uuid FROM miniapps.users u WHERE u.nickname = ${credential} LIMIT 1` as any[]
    if (!rows || rows.length === 0) {
      // 不暴露用户是否存在
      res.json({ code: 0, message: '如果该用户存在，重置链接已发送', data: null })
      return
    }

    // 生成重置 token（简化：直接生成一次性 token 存入 session）
    const resetToken = crypto.randomBytes(32).toString('hex')
    await prisma.$executeRaw`INSERT INTO miniapps.user_sessions (id, user_uuid, refresh_token, expires_at, created_at) VALUES (${crypto.randomUUID()}, ${rows[0].uuid}, ${'reset_' + resetToken}, ${new Date(Date.now() + 3600000)}, NOW())`

    // 生产环境应发送邮件，此处返回 token（仅开发）
    res.json({ code: 0, message: '重置链接已生成', data: process.env.NODE_ENV !== 'production' ? { reset_token: resetToken } : null })
  } catch (err) {
    console.error('[auth/forgot-password]', (err as Error).message)
    res.status(500).json({ code: 500, message: '服务异常', data: null })
  }
})

// POST /api/v1/auth/reset-password — 重置密码
router.post('/reset-password', loginLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reset_token, new_password } = req.body
    if (!reset_token || !new_password || new_password.length < 6) {
      res.status(400).json({ code: 400, message: '参数错误', data: null })
      return
    }

    // 验证 reset token
    const rows = await prisma.$queryRaw`
      SELECT us.user_uuid FROM miniapps.user_sessions us
      WHERE us.refresh_token = ${'reset_' + reset_token}
        AND us.expires_at > NOW()
      LIMIT 1
    ` as any[]

    if (!rows || rows.length === 0) {
      res.status(400).json({ code: 400, message: '重置链接已过期或无效', data: null })
      return
    }

    // 更新密码
    const hashedPwd = await bcrypt.hash(new_password, 10)
    await prisma.$executeRaw`UPDATE miniapps.user_auths SET credential = ${hashedPwd} WHERE user_uuid = ${rows[0].user_uuid} AND auth_type = 'password'`

    // 删除已用 reset token
    await prisma.$executeRaw`DELETE FROM miniapps.user_sessions WHERE refresh_token = ${'reset_' + reset_token}`

    res.json({ code: 0, message: '密码已重置，请重新登录', data: null })
  } catch (err) {
    console.error('[auth/reset-password]', (err as Error).message)
    res.status(500).json({ code: 500, message: '服务异常', data: null })
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

// ─── 用户设置 ──────────────────────────────────────────────────────

// GET /api/v1/auth/profile — 获取用户偏好设置
router.get('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userUuid = req.user!.userId

    let profile = await prisma.tavernUserProfile.findUnique({ where: { userUuid } })
    if (!profile) {
      profile = await prisma.tavernUserProfile.create({
        data: { userUuid },
      })
    }

    res.json({ code: 0, data: profile, message: 'ok' })
  } catch (err) {
    console.error('[auth/profile]', (err as Error).message)
    res.status(500).json({ code: 500, message: '服务异常', data: null })
  }
})

// PUT /api/v1/auth/profile — 更新用户偏好设置
const profileSchema = z.object({
  defaultModel: z.string().optional(),
  defaultTemp: z.number().min(0).max(2).optional(),
  preferredLocale: z.string().optional(),
})

router.put('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = profileSchema.parse(req.body)
    const userUuid = req.user!.userId

    const profile = await prisma.tavernUserProfile.upsert({
      where: { userUuid },
      create: { userUuid, ...data },
      update: data,
    })

    res.json({ code: 0, data: profile, message: 'ok' })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
      return
    }
    console.error('[auth/profile/update]', (err as Error).message)
    res.status(500).json({ code: 500, message: '服务异常', data: null })
  }
})

// ─── 账号管理 ──────────────────────────────────────────────────────

// DELETE /api/v1/auth/account — 注销账号
router.delete('/account', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userUuid = req.user!.userId

    // 软删除：禁用用户
    await prisma.$executeRaw`UPDATE miniapps.users SET status = 'disabled', deleted_at = NOW() WHERE uuid = ${userUuid}`

    // 清除所有 session
    await prisma.$executeRaw`DELETE FROM miniapps.user_sessions WHERE user_uuid = ${userUuid}`

    res.json({ code: 0, message: '账号已注销', data: null })
  } catch (err) {
    console.error('[auth/account/delete]', (err as Error).message)
    res.status(500).json({ code: 500, message: '服务异常', data: null })
  }
})

// GET /api/v1/auth/export — 导出用户数据
router.get('/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userUuid = req.user!.userId

    // 收集用户数据
    const [userRows, sessions, cards, chats] = await Promise.all([
      prisma.$queryRaw`SELECT uuid, nickname, avatar_url, role, status, created_at FROM miniapps.users WHERE uuid = ${userUuid} LIMIT 1` as Promise<any[]>,
      prisma.tavernChatSession.findMany({ where: { userUuid }, include: { messages: { orderBy: { createdAt: 'asc' } } } }),
      prisma.tavernCard.findMany({ where: { userUuid } }),
      prisma.tavernChatMessage.findMany({ where: { session: { userUuid } }, orderBy: { createdAt: 'asc' } }),
    ])

    res.json({
      code: 0,
      data: {
        user: userRows[0] || null,
        sessions: sessions.map(s => ({
          id: s.id, title: s.title, characterId: s.cardId,
          messageCount: s.messageCount, createdAt: s.createdAt,
          messages: s.messages.map(m => ({ role: m.role, content: m.content, createdAt: m.createdAt })),
        })),
        cards: cards.map(c => ({ id: c.id, name: c.name, status: c.status, createdAt: c.createdAt })),
        exportedAt: new Date().toISOString(),
      },
      message: 'ok',
    })
  } catch (err) {
    console.error('[auth/export]', (err as Error).message)
    res.status(500).json({ code: 500, message: '服务异常', data: null })
  }
})

export default router
