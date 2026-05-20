// =============================================================================
// 统一认证路由 — /api/auth/*
// 所有项目共享此认证端点，Dashboard Admin API (3001端口) 承载
// =============================================================================

import { Router, type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

const authRouter = Router()
const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production'
const ACCESS_TOKEN_EXPIRES = '15m'
const REFRESH_TOKEN_DAYS = 30
const BCRYPT_ROUNDS = 10

// ─── 工具函数 ────────────────────────────────────────────────

function signAccessToken(userUuid: string, role: string): string {
  return jwt.sign({ sub: userUuid, role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES })
}

async function signRefreshToken(userUuid: string): Promise<string> {
  const token = crypto.randomBytes(64).toString('hex')
  await prisma.userSession.create({
    data: {
      userUuid,
      refreshToken: token,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 86400000),
    },
  })
  return token
}

function generateUuid(): string {
  return crypto.randomUUID()
}

// ─── POST /api/auth/register — 账号密码注册 ──────────────────

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { nickname, password } = req.body

    if (!nickname || !password) {
      res.status(400).json({ code: 400, message: '昵称和密码不能为空' })
      return
    }
    if (password.length < 6) {
      res.status(400).json({ code: 400, message: '密码至少6位' })
      return
    }

    // 检查 nickname 是否已存在（作为 username 使用）
    const existing = await prisma.userAuth.findFirst({
      where: { authType: 'password', credential: nickname },
    })
    if (existing) {
      res.status(409).json({ code: 409, message: '该用户名已被注册' })
      return
    }

    const uuid = generateUuid()
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    // 创建用户 + 密码认证方式
    await prisma.user.create({
      data: {
        uuid,
        nickname,
        auths: {
          create: {
            authType: 'password',
            credential: passwordHash,
          },
        },
      },
    })

    const accessToken = signAccessToken(uuid, 'user')
    const refreshToken = await signRefreshToken(uuid)

    res.status(201).json({
      code: 201,
      message: '注册成功',
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: { uuid, nickname, role: 'user' },
      },
    })
  } catch (err: any) {
    console.error('[auth/register]', err.message)
    res.status(500).json({ code: 500, message: '注册失败，请稍后重试' })
  }
})

// ─── POST /api/auth/login — 账号密码登录 ─────────────────────

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { credential, password } = req.body

    if (!credential || !password) {
      res.status(400).json({ code: 400, message: '用户名和密码不能为空' })
      return
    }

    // 查找密码认证记录 — credential 存的是 nickname
    const authRecord = await prisma.userAuth.findFirst({
      where: {
        authType: 'password',
        credential: { not: '' },
      },
      include: { user: true },
    })

    // 遍历找到匹配的（因为 credential 存的是 bcrypt hash，需要逐个比较）
    // 优化方案：credential 字段改为存 nickname，另外用 password_hash 存哈希
    // 当前兼容旧数据：先查所有 password 类型，再 bcrypt.compare
    const allPasswordAuths = await prisma.userAuth.findMany({
      where: { authType: 'password' },
      include: { user: true },
    })

    // 先尝试精确匹配 nickname
    let matchedAuth = allPasswordAuths.find((a) => a.credential === credential)

    if (!matchedAuth) {
      // 尝试 bcrypt compare（兼容旧数据格式）
      for (const auth of allPasswordAuths) {
        const valid = await bcrypt.compare(credential, auth.credential).catch(() => false)
        if (valid) {
          matchedAuth = auth
          break
        }
      }
    }

    if (!matchedAuth) {
      res.status(401).json({ code: 401, message: '用户名或密码错误' })
      return
    }

    // 验证密码（如果 credential 存的是 nickname，需要重新设计）
    // 这里需要重新考虑：应该支持 { nickname } 去查 user，再查该 user 的 auths
    // 简化：直接用 credential 查 users.nickname，再查 user_auths
    const user = await prisma.user.findFirst({
      where: { nickname: credential },
      include: {
        auths: { where: { authType: 'password' } },
      },
    })

    if (!user || user.auths.length === 0) {
      res.status(401).json({ code: 401, message: '用户名或密码错误' })
      return
    }

    const passwordValid = await bcrypt.compare(password, user.auths[0]!.credential)
    if (!passwordValid) {
      res.status(401).json({ code: 401, message: '用户名或密码错误' })
      return
    }

    if (user.status === 'disabled') {
      res.status(403).json({ code: 403, message: '账号已被禁用' })
      return
    }

    const accessToken = signAccessToken(user.uuid, user.role)
    const refreshToken = await signRefreshToken(user.uuid)

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: { uuid: user.uuid, nickname: user.nickname, avatar_url: user.avatarUrl, role: user.role },
      },
    })
  } catch (err: any) {
    console.error('[auth/login]', err.message)
    res.status(500).json({ code: 500, message: '登录失败，请稍后重试' })
  }
})

// ─── POST /api/auth/wechat/login — 微信一键登录 ─────────────

authRouter.post('/wechat/login', async (req: Request, res: Response) => {
  try {
    const { wx_code } = req.body

    if (!wx_code) {
      res.status(400).json({ code: 400, message: '缺少微信授权码' })
      return
    }

    // TODO: 调微信 API 换 openid
    // const openid = await exchangeWechatCode(wx_code)
    // 开发环境降级：直接用 wx_code 作为 openid
    const openid = wx_code

    // 查找已有微信绑定
    const existingAuth = await prisma.userAuth.findUnique({
      where: { authType_credential: { authType: 'wechat', credential: openid } },
      include: { user: true },
    })

    if (existingAuth) {
      // 已有用户，直接登录
      const user = existingAuth.user
      if (user.status === 'disabled') {
        res.status(403).json({ code: 403, message: '账号已被禁用' })
        return
      }

      const accessToken = signAccessToken(user.uuid, user.role)
      const refreshToken = await signRefreshToken(user.uuid)

      res.json({
        code: 200,
        message: '登录成功',
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          user: { uuid: user.uuid, nickname: user.nickname, avatar_url: user.avatarUrl, role: user.role },
          is_new: false,
        },
      })
    } else {
      // 新用户 — 自动注册
      const uuid = generateUuid()
      await prisma.user.create({
        data: {
          uuid,
          nickname: `微信用户${uuid.slice(0, 8)}`,
          auths: {
            create: {
              authType: 'wechat',
              credential: openid,
              verifiedAt: new Date(),
            },
          },
        },
      })

      const accessToken = signAccessToken(uuid, 'user')
      const refreshToken = await signRefreshToken(uuid)

      res.status(201).json({
        code: 201,
        message: '注册并登录成功',
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          user: { uuid, nickname: `微信用户${uuid.slice(0, 8)}`, role: 'user' },
          is_new: true,
        },
      })
    }
  } catch (err: any) {
    console.error('[auth/wechat/login]', err.message)
    res.status(500).json({ code: 500, message: '微信登录失败' })
  }
})

// ─── POST /api/auth/phone/login — 手机号登录 ────────────────

authRouter.post('/phone/login', async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body

    if (!phone || !code) {
      res.status(400).json({ code: 400, message: '手机号和验证码不能为空' })
      return
    }

    // TODO: 验证短信验证码
    // const isValid = await verifySmsCode(phone, code)
    // 开发环境：code='000000' 跳过验证

    // 查找手机号绑定
    const existingAuth = await prisma.userAuth.findUnique({
      where: { authType_credential: { authType: 'phone', credential: phone } },
      include: { user: true },
    })

    if (!existingAuth) {
      res.status(404).json({ code: 404, message: '该手机号未注册' })
      return
    }

    const user = existingAuth.user
    if (user.status === 'disabled') {
      res.status(403).json({ code: 403, message: '账号已被禁用' })
      return
    }

    const accessToken = signAccessToken(user.uuid, user.role)
    const refreshToken = await signRefreshToken(user.uuid)

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: { uuid: user.uuid, nickname: user.nickname, avatar_url: user.avatarUrl, role: user.role },
      },
    })
  } catch (err: any) {
    console.error('[auth/phone/login]', err.message)
    res.status(500).json({ code: 500, message: '手机号登录失败' })
  }
})

// ─── POST /api/auth/refresh — 刷新 access_token ─────────────

authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body

    if (!refresh_token) {
      res.status(400).json({ code: 400, message: '缺少 refresh_token' })
      return
    }

    const session = await prisma.userSession.findUnique({
      where: { refreshToken: refresh_token },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      res.status(401).json({ code: 401, message: 'refresh_token 已过期，请重新登录' })
      return
    }

    const accessToken = signAccessToken(session.userUuid, session.user.role)

    res.json({
      code: 200,
      data: {
        access_token: accessToken,
        user: { uuid: session.user.uuid, nickname: session.user.nickname, role: session.user.role },
      },
    })
  } catch (err: any) {
    console.error('[auth/refresh]', err.message)
    res.status(500).json({ code: 500, message: '刷新失败' })
  }
})

// ─── POST /api/auth/logout — 登出 ───────────────────────────

authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body
    if (refresh_token) {
      await prisma.userSession.deleteMany({
        where: { refreshToken: refresh_token },
      })
    }
    res.json({ code: 200, message: '已登出' })
  } catch (err: any) {
    console.error('[auth/logout]', err.message)
    res.status(500).json({ code: 500, message: '登出失败' })
  }
})

// ─── POST /api/auth/bind — 追加绑定认证方式 (需登录态) ─────

authRouter.post('/bind', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ code: 401, message: '请先登录' })
      return
    }

    const token = authHeader.slice(7)
    let payload: { sub: string; role: string }
    try {
      payload = jwt.verify(token, JWT_SECRET) as any
    } catch {
      res.status(401).json({ code: 401, message: '登录已过期' })
      return
    }

    const { type, credential } = req.body // type: 'password' | 'wechat' | 'phone'
    if (!type || !credential) {
      res.status(400).json({ code: 400, message: '缺少绑定类型或凭证' })
      return
    }

    // 检查凭证是否已被绑定
    const existing = await prisma.userAuth.findFirst({
      where: { authType: type as any, credential },
    })
    if (existing) {
      res.status(409).json({ code: 409, message: '该凭证已被其他账号绑定' })
      return
    }

    let finalCredential = credential
    if (type === 'password') {
      finalCredential = await bcrypt.hash(credential, BCRYPT_ROUNDS)
    }

    await prisma.userAuth.create({
      data: {
        userUuid: payload.sub,
        authType: type as any,
        credential: finalCredential,
      },
    })

    res.json({ code: 200, message: '绑定成功' })
  } catch (err: any) {
    console.error('[auth/bind]', err.message)
    res.status(500).json({ code: 500, message: '绑定失败' })
  }
})

// ─── GET /api/auth/me — 获取当前用户信息 ─────────────────────

authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ code: 401, message: '未登录' })
      return
    }

    const token = authHeader.slice(7)
    let payload: { sub: string; role: string }
    try {
      payload = jwt.verify(token, JWT_SECRET) as any
    } catch {
      res.status(401).json({ code: 401, message: '登录已过期' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { uuid: payload.sub },
      select: { uuid: true, nickname: true, avatarUrl: true, role: true, status: true, createdAt: true },
    })

    if (!user) {
      res.status(404).json({ code: 404, message: '用户不存在' })
      return
    }

    res.json({ code: 200, data: { user } })
  } catch (err: any) {
    console.error('[auth/me]', err.message)
    res.status(500).json({ code: 500, message: '获取用户信息失败' })
  }
})

export default authRouter
