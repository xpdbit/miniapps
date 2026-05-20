import { Router, Response } from 'express'
import { requireAdmin } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'
import * as moderationService from '../services/moderation.service'
import prisma from '../utils/prisma'
import { z } from 'zod'

// ─── adminToken 认证时 userId 被硬编码为 'admin'，需解析为真实 DB 用户 ID ───
let cachedSystemUserId: string | null = null

async function resolveAdminUserId(): Promise<string> {
  if (cachedSystemUserId) return cachedSystemUserId
  const sysUser = await prisma.sharedUser.upsert({
    where: { openid: 'builtin_system' },
    create: {
      uuid: 'builtin_system_uuid',
      openid: 'builtin_system',
      nickname: '酒馆系统',
      dailyQuota: 99999,
      role: 'ADMIN',
    },
    update: {}, // 已存在则无需修改
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
        include: {
          creator: { select: { id: true, nickname: true } },
        },
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
        creatorId,
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
      include: {
        creator: { select: { id: true, nickname: true } },
      },
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
      prisma.tavernChatMessage.deleteMany({ where: { session: { characterId: req.params.id } } }),
      prisma.tavernChatSession.deleteMany({ where: { characterId: req.params.id } }),
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
    const [totalCharacters, totalChats, activeUsers, pendingReviews] = await Promise.all([
      prisma.tavernCard.count(),
      prisma.tavernChatSession.count(),
      prisma.sharedUser.count({
        where: {
          chatSessions: {
            some: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) } },
          },
        },
      }),
      prisma.tavernCard.count({ where: { status: 'PENDING' } }),
    ])

    res.json({
      code: 0,
      data: { totalCharacters, totalChats, activeUsers, pendingReviews },
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
    if (characterId) where.characterId = characterId
    if (userId) where.userId = userId

    const [items, total] = await Promise.all([
      prisma.tavernChatSession.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, nickname: true } },
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
          userId: s.userId,
          userName: s.user.nickname || '匿名',
          characterId: s.characterId,
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
        include: { user: { select: { id: true, nickname: true } } },
      }),
      prisma.tavernApiKey.count({ where }),
    ])

    res.json({
      code: 0,
      data: {
        items: items.map(k => ({
          id: k.id,
          userId: k.userId,
          userName: k.user.nickname || '匿名',
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
            creatorId,
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

export default router
