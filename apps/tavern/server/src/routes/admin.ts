import { Router, Response } from 'express'
import { requireAdmin } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'
import * as moderationService from '../services/moderation.service'
import { getAllTemplates } from '../services/ai-scripts/registry'
import { gameStateStore } from '../services/ai-scripts/game-state-store'
import { parseEventLog } from '../services/ai-scripts/parser'
import prisma from '../utils/prisma'
import { z } from 'zod'

// ─── adminToken 认证时 userId 被硬编码为 'admin'，直接返回 admin 用户 UUID ───
let cachedSystemUserId: string | null = null

async function resolveAdminUserId(): Promise<string> {
  if (cachedSystemUserId) return cachedSystemUserId
  // 查找或创建系统管理员用户（tavern 库自持用户模型）
  const sysUser = await prisma.tavernUser.upsert({
    where: { uuid: 'admin-001' },
    create: {
      uuid: 'admin-001',
      nickname: '酒馆系统',
      role: 'ADMIN',
    },
    update: {},
    select: { id: true },
  })
  cachedSystemUserId = sysUser.id
  return sysUser.id
}

/** 将 adminToken 认证的虚拟 userId 解析为真实 DB 用户 ID */
async function resolveRealUserId(req: AuthenticatedRequest): Promise<string> {
  if (req.user!.userId === 'admin') return resolveAdminUserId()
  return req.user!.userId
}

const router = Router()

// All admin routes require admin authentication
router.use(requireAdmin)

// GET /api/v1/admin/pending - Pending review list
router.get('/pending', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const result = await moderationService.getPendingList(page)
    res.json({ code: 0, data: result, message: 'ok' })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// POST /api/v1/admin/approve/:id
router.post('/approve/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await moderationService.approve(req.params.id, await resolveRealUserId(req))
    res.json({ code: 0, data: null, message: '已通过' })
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
    if (err.message === 'INVALID_STATUS') return res.status(400).json({ code: 400, message: '当前状态不允许审核', data: null })
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// POST /api/v1/admin/reject/:id
router.post('/reject/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reason = req.body.reason || '未通过审核'
    await moderationService.reject(req.params.id, await resolveRealUserId(req), reason)
    res.json({ code: 0, data: null, message: '已拒绝' })
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
    if (err.message === 'INVALID_STATUS') return res.status(400).json({ code: 400, message: '当前状态不允许审核', data: null })
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// POST /api/v1/admin/ban/:id
router.post('/ban/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reason = req.body.reason || '违规内容'
    await moderationService.ban(req.params.id, await resolveRealUserId(req), reason)
    res.json({ code: 0, data: null, message: '已封禁' })
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// GET /api/v1/admin/logs/:cardId
router.get('/logs/:cardId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await moderationService.getLogs(req.params.cardId)
    res.json({ code: 0, data: logs, message: 'ok' })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// ─── Dashboard 综合管理端点 ──────────────────────────────────────────

// GET /api/v1/admin/characters - 列出所有角色卡（管理员视图）
router.get('/characters', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const cardType = req.query.cardType as string | undefined
    const status = req.query.status as string | undefined
    const search = req.query.search as string | undefined
    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (cardType) where.cardType = cardType
    if (status) where.status = status
    if (search) where.name = { contains: search }

    const [items, total] = await Promise.all([
      prisma.tavernCard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.tavernCard.count({ where }),
    ])

    res.json({ code: 0, data: { items, total, page, pageSize }, message: 'ok' })
  } catch (err: any) {
    console.error('[Admin] GET /characters failed:', err)
    res.status(500).json({ code: 500, message: err.message || '数据库查询失败', data: null })
  }
})

// POST /api/v1/admin/characters - 管理员创建角色卡
const createCardSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  avatar: z.string().optional(),
  prompt: z.string().optional(),
  scenario: z.string().optional(),
  firstMsg: z.string().optional().default(''),
  cardType: z.enum(['CHARACTER', 'MECHANISM', 'MAP', 'BACKGROUND']).optional().default('CHARACTER'),
})

router.post('/characters', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createCardSchema.parse(req.body)
    const creatorId = await resolveRealUserId(req)
    const card = await prisma.tavernCard.create({
      data: {
        name: data.name,
        description: data.description,
        tags: data.tags,
        avatar: data.avatar,
        prompt: data.prompt,
        scenario: data.scenario,
        firstMsg: data.firstMsg,
        cardType: data.cardType,
        isOfficial: true, // 管理员创建的都是官方卡片
        userUuid: creatorId,
        status: 'PUBLISHED',
      },
    })
    res.status(201).json({ code: 0, data: card, message: '创建成功' })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
    }
    res.status(500).json({ code: 500, message: (err as Error).message, data: null })
  }
})

// PUT /api/v1/admin/characters/:id - 管理员更新角色卡
const updateCardSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  avatar: z.string().optional(),
  prompt: z.string().optional(),
  scenario: z.string().optional(),
  firstMsg: z.string().optional(),
  cardType: z.enum(['CHARACTER', 'MECHANISM', 'MAP', 'BACKGROUND']).optional(),
})

router.put('/characters/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = updateCardSchema.parse(req.body)
    const card = await prisma.tavernCard.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
        ...(data.prompt !== undefined && { prompt: data.prompt }),
        ...(data.scenario !== undefined && { scenario: data.scenario }),
        ...(data.firstMsg !== undefined && { firstMsg: data.firstMsg }),
        ...(data.cardType !== undefined && { cardType: data.cardType }),
      },
    })
    res.json({ code: 0, data: card, message: '更新成功' })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
    }
    res.status(500).json({ code: 500, message: (err as Error).message, data: null })
  }
})

// POST /api/v1/admin/batch-approve - 批量批准角色卡
router.post('/batch-approve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body as { ids: string[] }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ code: 400, message: '请提供要批准的卡片 ID 列表', data: null })
    }

    let count = 0
    for (const id of ids) {
      try {
        await moderationService.approve(id, await resolveRealUserId(req))
        count++
      } catch {
        // 跳过无法批准的卡片
      }
    }

    res.json({ code: 0, data: { approved: count, total: ids.length }, message: `已批准 ${count}/${ids.length} 张卡片` })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// POST /api/v1/admin/export - 导出角色卡为 JSON
router.post('/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body as { ids: string[] }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ code: 400, message: '请提供要导出的卡片 ID 列表', data: null })
    }

    const cards = await prisma.tavernCard.findMany({
      where: { id: { in: ids } },
    })

    res.json({
      code: 0,
      data: cards,
      message: `成功导出 ${cards.length} 张卡片`,
    })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// DELETE /api/v1/admin/characters/:id - 删除角色卡（锁定卡片不可删除）
router.delete('/characters/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const card = await prisma.tavernCard.findUnique({ where: { id: req.params.id } })
    if (!card) return res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
    if (card.locked) return res.status(403).json({ code: 403, message: '卡片已锁定，无法删除', data: null })

    // 级联删除关联数据
    await prisma.$transaction([
      prisma.tavernCardLike.deleteMany({ where: { cardId: req.params.id } }),
      prisma.tavernCardFav.deleteMany({ where: { cardId: req.params.id } }),
      prisma.tavernChatMessage.deleteMany({ where: { session: { character: { id: req.params.id } } } }),
      prisma.tavernChatSession.deleteMany({ where: { character: { id: req.params.id } } }),
      prisma.tavernCard.delete({ where: { id: req.params.id } }),
    ])

    res.json({ code: 0, data: null, message: '已删除' })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// POST /api/v1/admin/characters/:id/lock - 锁定卡片
router.post('/characters/:id/lock', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const card = await prisma.tavernCard.findUnique({ where: { id: req.params.id } })
    if (!card) return res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
    if (card.locked) return res.json({ code: 0, data: null, message: '卡片已锁定' })

    await prisma.tavernCard.update({
      where: { id: req.params.id },
      data: { locked: true },
    })

    res.json({ code: 0, data: null, message: '已锁定' })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// POST /api/v1/admin/characters/:id/unlock - 解锁卡片
router.post('/characters/:id/unlock', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const card = await prisma.tavernCard.findUnique({ where: { id: req.params.id } })
    if (!card) return res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
    if (!card.locked) return res.json({ code: 0, data: null, message: '卡片未锁定' })

    await prisma.tavernCard.update({
      where: { id: req.params.id },
      data: { locked: false },
    })

    res.json({ code: 0, data: null, message: '已解锁' })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// GET /api/v1/admin/dashboard/stats - 仪表盘统计
router.get('/dashboard/stats', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [totalCharacters, totalChats, pendingReviews] = await Promise.all([
      prisma.tavernCard.count({ where: { deletedAt: null } }),
      prisma.tavernChatSession.count(),
      prisma.tavernCard.count({ where: { status: 'PENDING', deletedAt: null } }),
    ])
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const activeUsersResult = await prisma.tavernChatSession.groupBy({
      by: ['userUuid'],
      where: { lastMessageAt: { gte: sevenDaysAgo } },
    })

    res.json({
      code: 0,
      data: { totalCharacters, totalChats, activeUsers: activeUsersResult.length, pendingReviews },
      message: 'ok',
    })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// ─── 聊天监控端点 ────────────────────────────────────────────────────

// GET /api/v1/admin/chats - 聊天会话列表（管理员视图）
router.get('/chats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const characterId = req.query.characterId as string | undefined
    const userId = req.query.userId as string | undefined
    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (characterId) where.cardId = characterId
    if (userId) where.userUuid = userId

    const [items, total] = await Promise.all([
      prisma.tavernChatSession.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          character: { select: { id: true, name: true } },
        },
      }),
      prisma.tavernChatSession.count({ where }),
    ])

    res.json({
      code: 0,
      data: {
        items: items.map(s => ({
          id: s.id,
          userUuid: s.userUuid,
          userName: s.userUuid || '匿名',
          characterId: s.cardId,
          characterName: s.character.name,
          messageCount: s.messageCount,
          createdAt: s.createdAt,
          lastMessageAt: s.updatedAt,
        })),
        total,
        page,
        pageSize,
      },
      message: 'ok',
    })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// GET /api/v1/admin/chats/stats - 聊天统计
router.get('/chats/stats', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [totalChatsToday, activeConversations, totalMessages, sessionCount] = await Promise.all([
      prisma.tavernChatSession.count({ where: { createdAt: { gte: today } } }),
      prisma.tavernChatSession.count({
        where: { updatedAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
      }),
      prisma.tavernChatMessage.count(),
      prisma.tavernChatSession.count(),
    ])

    const averageSessionLength = sessionCount > 0
      ? Math.round(totalMessages / sessionCount)
      : 0

    res.json({
      code: 0,
      data: { totalChatsToday, activeConversations, totalMessages, averageSessionLength },
      message: 'ok',
    })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// GET /api/v1/admin/chats/:chatId/messages - 会话消息列表
router.get('/chats/:chatId/messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 100
    const skip = (page - 1) * pageSize

    const [items, total] = await Promise.all([
      prisma.tavernChatMessage.findMany({
        where: { sessionId: req.params.chatId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.tavernChatMessage.count({ where: { sessionId: req.params.chatId } }),
    ])

    res.json({ code: 0, data: { items, total, page, pageSize }, message: 'ok' })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// ─── Key 管理端点 ──────────────────────────────────────────────────────

// GET /api/v1/admin/keys - API Key 列表（管理员视图）
router.get('/keys', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const userId = req.query.userId as string | undefined
    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId

    const [items, total] = await Promise.all([
      prisma.tavernApiKey.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.tavernApiKey.count({ where }),
    ])

    res.json({
      code: 0,
      data: {
        items: items.map(k => ({
          id: k.id,
          userUuid: k.userUuid,
          provider: k.provider,
          isActive: k.isActive,
          createdAt: k.createdAt,
        })),
        total,
        page,
        pageSize,
      },
      message: 'ok',
    })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// POST /api/v1/admin/keys/:keyId/revoke - 吊销 API Key
router.post('/keys/:keyId/revoke', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const key = await prisma.tavernApiKey.update({
      where: { id: req.params.keyId },
      data: { isActive: false },
    })
    res.json({ code: 0, data: key, message: '已吊销' })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// ─── JSON 批量导入端点 ────────────────────────────────────────────────

const importSchema = z.object({
  cards: z.array(z.object({
    name: z.string().min(1).max(50),
    description: z.string().optional().default(''),
    tags: z.array(z.string()).optional().default([]),
    avatar: z.string().optional(),
    prompt: z.string().optional(),
    scenario: z.string().optional(),
    firstMsg: z.string().optional().default(''),
    cardType: z.enum(['CHARACTER', 'MECHANISM', 'MAP', 'BACKGROUND']).optional().default('CHARACTER'),
  })).min(1).max(100),
})

// POST /api/v1/admin/import - 批量导入角色卡 JSON
router.post('/import', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cards } = importSchema.parse(req.body)
    const creatorId = await resolveRealUserId(req)
    let created = 0
    let failed = 0
    const errors: string[] = []

    for (const cardData of cards) {
      try {
        await prisma.tavernCard.create({
          data: {
            name: cardData.name,
            description: cardData.description,
            tags: cardData.tags,
            avatar: cardData.avatar,
            prompt: cardData.prompt,
            scenario: cardData.scenario,
            firstMsg: cardData.firstMsg,
            cardType: cardData.cardType,
            isOfficial: true,
            userUuid: creatorId,
            status: 'PUBLISHED',
          },
        })
        created++
      } catch (e: unknown) {
        failed++
        errors.push(`[${cardData.name}]: ${(e as Error).message}`)
      }
    }

    res.json({
      code: 0,
      data: { created, failed, errors },
      message: `成功导入 ${created}/${cards.length} 张卡片`,
    })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
    }
    res.status(500).json({ code: 500, message: (err as Error).message, data: null })
  }
})

// ─── 用户管理端点 ──────────────────────────────────────────────────────

// GET /api/v1/admin/users - 用户列表（管理员视图）
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const search = req.query.search as string | undefined
    const skip = (page - 1) * pageSize

    // 从 miniapps.users 获取用户列表，join tavern 统计
    let userQuery = `
      SELECT u.uuid, u.nickname, u.role, u.status, u.created_at,
        COALESCE(tcs.session_count, 0) as session_count,
        COALESCE(tcs.message_count, 0) as message_count,
        COALESCE(tcs.tokens_used, 0) as tokens_used
      FROM miniapps.users u
      LEFT JOIN (
        SELECT user_uuid,
          COUNT(*) as session_count,
          SUM(message_count) as message_count,
          SUM(token_count) as tokens_used
        FROM ai_tavern.ChatSession
        GROUP BY user_uuid
      ) tcs ON tcs.user_uuid = u.uuid
    `
    const countQuery = `SELECT COUNT(*) as total FROM miniapps.users u`
    const params: string[] = []

    if (search) {
      userQuery += ` WHERE u.nickname LIKE ?`
      params.push(`%${search}%`)
    }

    userQuery += ` ORDER BY u.created_at DESC LIMIT ${pageSize} OFFSET ${skip}`

    const [rows, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(userQuery, ...params) as Promise<any[]>,
      prisma.$queryRawUnsafe(
        search ? `SELECT COUNT(*) as total FROM miniapps.users u WHERE u.nickname LIKE ?` : countQuery,
        ...(search ? [`%${search}%`] : []),
      ) as Promise<any[]>,
    ])

    const total = Number((countResult as any[])[0]?.total ?? 0)

    // 查询每个用户创建的角色卡数量
    const userUuids = (rows as any[]).map((r: any) => r.uuid)
    let cardCounts: Record<string, number> = {}
    if (userUuids.length > 0) {
      const cardRows = await prisma.$queryRawUnsafe(
        `SELECT user_uuid, COUNT(*) as cnt FROM ai_tavern.Card WHERE user_uuid IN (${userUuids.map(() => '?').join(',')}) GROUP BY user_uuid`,
        ...userUuids,
      ) as any[]
      for (const row of cardRows) {
        cardCounts[row.user_uuid] = Number(row.cnt)
      }
    }

    const items = (rows as any[]).map((r: any) => ({
      uuid: r.uuid,
      nickname: r.nickname,
      role: r.role,
      status: r.status,
      sessionCount: Number(r.session_count),
      messageCount: Number(r.message_count),
      tokensUsed: Number(r.tokens_used),
      cardCount: cardCounts[r.uuid] ?? 0,
      createdAt: r.created_at,
    }))

    res.json({ code: 0, data: { items, total, page, pageSize }, message: 'ok' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[admin] GET /users error:', msg)
    res.status(500).json({ code: 500, message: msg, data: null })
  }
})

// POST /api/v1/admin/users/:uuid/ban - 封禁/解封用户
const banUserSchema = z.object({
  action: z.enum(['ban', 'unban']),
  reason: z.string().optional().default('管理员操作'),
})

router.post('/users/:uuid/ban', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, reason } = banUserSchema.parse(req.body)

    // 查找用户
    const userRows = await prisma.$queryRawUnsafe(
      `SELECT uuid, status FROM miniapps.users WHERE uuid = ? LIMIT 1`,
      req.params.uuid,
    ) as any[]
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在', data: null })
    }

    const newStatus = action === 'ban' ? 'disabled' : 'active'
    if (userRows[0].status === newStatus) {
      return res.json({ code: 0, data: null, message: `用户已是 ${newStatus === 'disabled' ? '封禁' : '正常'} 状态` })
    }

    await prisma.$executeRawUnsafe(
      `UPDATE miniapps.users SET status = ? WHERE uuid = ?`,
      newStatus,
      req.params.uuid,
    )

    // 记录审核日志
    await prisma.tavernModerationLog.create({
      data: {
        targetType: 'user',
        targetId: req.params.uuid,
        action,
        reason,
        userUuid: req.user!.userId,
      },
    })

    res.json({ code: 0, data: null, message: action === 'ban' ? '已封禁' : '已解封' })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
    }
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[admin] POST /users/:uuid/ban error:', msg)
    res.status(500).json({ code: 500, message: msg, data: null })
  }
})

// PUT /api/v1/admin/users/:uuid/role - 修改用户角色
const updateRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
})

router.put('/users/:uuid/role', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role } = updateRoleSchema.parse(req.body)

    await prisma.$executeRawUnsafe(
      `UPDATE miniapps.users SET role = ? WHERE uuid = ?`,
      role,
      req.params.uuid,
    )

    // 同步更新 tavern_users
    await prisma.tavernUser.upsert({
      where: { uuid: req.params.uuid },
      create: { uuid: req.params.uuid, role },
      update: { role },
    })

    res.json({ code: 0, data: null, message: `角色已更新为 ${role}` })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
    }
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[admin] PUT /users/:uuid/role error:', msg)
    res.status(500).json({ code: 500, message: msg, data: null })
  }
})

// PUT /api/v1/admin/users/:uuid/tier - 修改用户等级
const updateTierSchema = z.object({
  tier: z.enum(['FREE', 'PAID', 'TESTER']),
})

router.put('/users/:uuid/tier', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tier } = updateTierSchema.parse(req.body)

    await prisma.tavernUserTier.upsert({
      where: { userUuid: req.params.uuid },
      create: { userUuid: req.params.uuid, tier, dailyQuotaMax: tier === 'FREE' ? 20 : tier === 'PAID' ? 50 : 99999 },
      update: { tier },
    })

    res.json({ code: 0, data: null, message: `用户等级已更新为 ${tier}` })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
    }
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ code: 500, message: msg, data: null })
  }
})

// ─── 公告管理 ──────────────────────────────────────────────────────

// 使用 JSON 文件存储公告（无需新增 DB 表）
import fs from 'fs'
import path from 'path'

interface Announcement {
  id: string; title: string; content: string; active: boolean; createdAt: string; updatedAt: string;
}

const ANNO_FILE = path.resolve(process.cwd(), 'data', 'announcements.json')

function readAnnouncements(): Announcement[] {
  try { if (fs.existsSync(ANNO_FILE)) return JSON.parse(fs.readFileSync(ANNO_FILE, 'utf-8')) } catch { /* ignore */ }
  return []
}
function writeAnnouncements(list: Announcement[]): void {
  const dir = path.dirname(ANNO_FILE); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(ANNO_FILE, JSON.stringify(list, null, 2), 'utf-8')
}

router.get('/announcements', async (_req: AuthenticatedRequest, res: Response) => {
  try { res.json({ code: 0, data: readAnnouncements(), message: 'ok' }) } catch (err: unknown) { res.status(500).json({ code: 500, message: (err as Error).message, data: null }) }
})

const annoSchema = z.object({ title: z.string().min(1).max(100), content: z.string().min(1).max(5000) })
router.post('/announcements', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, content } = annoSchema.parse(req.body)
    const now = new Date().toISOString()
    const a: Announcement = { id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6), title, content, active: true, createdAt: now, updatedAt: now }
    const list = readAnnouncements(); list.unshift(a); writeAnnouncements(list)
    res.json({ code: 0, data: a, message: '创建成功' })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
    res.status(500).json({ code: 500, message: (err as Error).message, data: null })
  }
})

router.put('/announcements/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, content, active } = req.body as { title?: string; content?: string; active?: boolean }
    const list = readAnnouncements(); const idx = list.findIndex(a => a.id === req.params.id)
    if (idx === -1) return res.status(404).json({ code: 404, message: '公告不存在', data: null })
    if (title !== undefined) list[idx].title = title
    if (content !== undefined) list[idx].content = content
    if (active !== undefined) list[idx].active = active
    list[idx].updatedAt = new Date().toISOString(); writeAnnouncements(list)
    res.json({ code: 0, data: list[idx], message: '更新成功' })
  } catch (err: unknown) { res.status(500).json({ code: 500, message: (err as Error).message, data: null }) }
})

router.delete('/announcements/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = readAnnouncements(); const filtered = list.filter(a => a.id !== req.params.id)
    if (filtered.length === list.length) return res.status(404).json({ code: 404, message: '公告不存在', data: null })
    writeAnnouncements(filtered)
    res.json({ code: 0, data: null, message: '已删除' })
  } catch (err: unknown) { res.status(500).json({ code: 500, message: (err as Error).message, data: null }) }
})

// ─── 模型同步与管理 ──────────────────────────────────────────────────

// PUT /api/v1/admin/models/:modelId — 管理模型（开关/改等级/改配额）
const modelUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  minTier: z.enum(['FREE', 'PAID', 'TESTER']).optional(),
  minLevel: z.number().min(1).max(99).optional(),
  quotaCost: z.number().min(0).max(999).optional(),
})

router.put('/models/:modelId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = modelUpdateSchema.parse(req.body)
    const model = await prisma.tavernModelMeta.update({
      where: { modelId: req.params.modelId },
      data: {
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.minTier !== undefined && { minTier: data.minTier }),
        ...(data.minLevel !== undefined && { minLevel: data.minLevel }),
        ...(data.quotaCost !== undefined && { quotaCost: data.quotaCost }),
      },
    })
    res.json({ code: 0, data: model, message: '更新成功' })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
    }
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ code: 500, message: msg, data: null })
  }
})

// GET /api/v1/admin/announcements — 获取公告列表
router.get('/announcements', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // 使用 system messages 表或 JSON 配置存储公告
    // 简单实现：从数据库读取，若无专用表则返回空
    res.json({ code: 0, data: [], message: 'ok' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ code: 500, message: msg, data: null })
  }
})

// POST /api/v1/admin/models/:id — 管理模型（开关/改等级/改配额）

// POST /api/v1/admin/sync-models — 从各服务商 API 同步最新模型列表
router.post('/sync-models', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const { syncAllModels } = await import('../services/model-sync.service')
    // 使用系统管理员 UUID（admin-001）以确保能查找到对应的 One API Key
    const results = await syncAllModels('admin-001')
    const failed = results.filter(r => r.error)
    res.json({ code: 0, data: {
      results,
      summary: {
        total: results.length,
        success: results.length - failed.length,
        failed: failed.length,
        added: results.reduce((s, r) => s + r.added, 0),
        updated: results.reduce((s, r) => s + r.updated, 0),
      },
    }, message: '操作成功' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[admin] sync-models error:', msg)
    res.status(500).json({ code: 500, message: msg, data: null })
  }
})

// GET /api/v1/admin/models — 模型列表（分页）
router.get('/models', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const provider = req.query.provider as string | undefined
    const search = req.query.search as string | undefined
    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (provider) where.provider = provider
    if (search) {
      where.OR = [
        { modelId: { contains: search } },
        { displayName: { contains: search } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.tavernModelMeta.findMany({
        where,
        orderBy: [{ provider: 'asc' }, { sortOrder: 'asc' }],
        skip,
        take: pageSize,
      }),
      prisma.tavernModelMeta.count({ where }),
    ])

    res.json({ code: 0, data: { items, total, page, pageSize }, message: 'ok' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[admin] GET /models error:', msg)
    res.status(500).json({ code: 500, message: msg, data: null })
  }
})

// GET /api/v1/admin/model-stats — 获取模型统计信息
router.get('/model-stats', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const total = await prisma.tavernModelMeta.count()
    const active = await prisma.tavernModelMeta.count({ where: { isActive: true } })
    const byProvider = await prisma.tavernModelMeta.groupBy({
      by: ['provider'],
      _count: { modelId: true },
      where: { isActive: true },
    })
    res.json({ code: 0, data: { total, active, byProvider }, message: '操作成功' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[admin] model-stats error:', msg)
    res.status(500).json({ code: 500, message: msg, data: null })
  }
})

// ═══════════════════════════════════════════════════════════════
// AI Script 管理端点
// ═══════════════════════════════════════════════════════════════

// GET /api/v1/admin/ai-scripts/registry — 事件注册表
router.get('/ai-scripts/registry', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = getAllTemplates()
    res.json({ code: 0, data: templates, message: 'ok' })
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

// GET /api/v1/admin/ai-scripts/state/:saveId — 游戏状态
router.get('/ai-scripts/state/:saveId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await gameStateStore.getState(req.params.saveId)
    if (!state) {
      res.status(404).json({ code: 404, message: '状态不存在', data: null })
      return
    }
    res.json({ code: 0, data: state, message: 'ok' })
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

// PUT /api/v1/admin/ai-scripts/state/:saveId — 编辑游戏状态
router.put('/ai-scripts/state/:saveId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await gameStateStore.setState(req.params.saveId, req.body)
    res.json({ code: 0, data: null, message: '状态已更新' })
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

// GET /api/v1/admin/ai-scripts/logs/:saveId — 事件日志
router.get('/ai-scripts/logs/:saveId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500)
    const offset = parseInt(req.query.offset as string) || 0
    const messages = await prisma.tavernChatMessage.findMany({
      where: { sessionId: req.params.saveId, role: 'system' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: { id: true, content: true, createdAt: true },
    })
    const logs = messages.map((msg) => ({
      id: msg.id,
      createdAt: msg.createdAt,
      events: parseEventLog(msg.content),
    }))
    res.json({ code: 0, data: logs, message: 'ok' })
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

export default router
