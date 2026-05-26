import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import * as characterService from '../services/character.service'
import prisma from '../utils/prisma'

const router = Router()

const createSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().min(1).max(2000),
  firstMsg: z.string().min(1).max(500),
  avatar: z.string().optional(),
  prompt: z.string().max(5000).optional(),
  scenario: z.string().max(1000).optional(),
  tags: z.array(z.string().max(20)).max(10).optional(),
  cardType: z.enum(['CHARACTER', 'MECHANISM', 'MAP', 'BACKGROUND']).optional().default('CHARACTER'),
})

// GET /api/v1/characters - My character list
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const result = await characterService.listMyCharacters(req.user!.userId, page, pageSize)
    res.json({ code: 0, message: 'ok', data: result })
  } catch (err: unknown) {
    const error = err as Error
    res.status(500).json({ code: 500, message: error.message, data: null })
  }
})

// POST /api/v1/characters - Create character
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createSchema.parse(req.body)
    const card = await characterService.createCharacter(data, req.user!.userId)
    res.status(201).json({ code: 0, message: 'ok', data: card })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
      return
    }
    const error = err as Error
    res.status(500).json({ code: 500, message: error.message, data: null })
  }
})

// GET /api/v1/characters/:id - Character detail
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const card = await characterService.getCharacterDetail(req.params.id)
    if (!card) {
      res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
      return
    }
    res.json({ code: 0, message: 'ok', data: card })
  } catch (err: unknown) {
    const error = err as Error
    res.status(500).json({ code: 500, message: error.message, data: null })
  }
})

// PUT /api/v1/characters/:id - Update character
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createSchema.partial().parse(req.body)
    const card = await characterService.updateCharacter(req.params.id, req.user!.userId, data)
    res.json({ code: 0, message: 'ok', data: card })
  } catch (err: unknown) {
    const error = err as Error
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
    } else if (error.message === 'FORBIDDEN') {
      res.status(403).json({ code: 403, message: '无权操作', data: null })
    } else {
      res.status(500).json({ code: 500, message: error.message, data: null })
    }
  }
})

// DELETE /api/v1/characters/:id - Delete character
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await characterService.deleteCharacter(req.params.id, req.user!.userId)
    res.json({ code: 0, message: 'ok', data: null })
  } catch (err: unknown) {
    const error = err as Error
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
    } else if (error.message === 'FORBIDDEN') {
      res.status(403).json({ code: 403, message: '无权操作', data: null })
    } else {
      res.status(500).json({ code: 500, message: error.message, data: null })
    }
  }
})

// POST /api/v1/characters/:id/publish - Submit for review
router.post('/:id/publish', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const card = await characterService.publishCharacter(req.params.id, req.user!.userId)
    res.json({ code: 0, message: '已提交审核', data: card })
  } catch (err: unknown) {
    const error = err as Error
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
    } else if (error.message === 'FORBIDDEN') {
      res.status(403).json({ code: 403, message: '无权操作', data: null })
    } else if (error.message === 'INVALID_STATUS') {
      res.status(400).json({ code: 400, message: '当前状态不允许提交审核', data: null })
    } else {
      res.status(500).json({ code: 500, message: error.message, data: null })
    }
  }
})

// POST /api/v1/characters/:id/report — 举报不当内容
const reportSchema = z.object({
  reason: z.string().min(1).max(500),
  category: z.enum(['inappropriate', 'spam', 'copyright', 'other']).optional().default('inappropriate'),
})

router.post('/:id/report', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason, category } = reportSchema.parse(req.body)
    const cardId = req.params.id

    // 查找卡片确认存在
    const card = await prisma.tavernCard.findUnique({ where: { id: cardId } })
    if (!card) {
      res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
      return
    }

    // 记录举报
    await prisma.tavernModerationLog.create({
      data: {
        targetType: 'card_report',
        targetId: cardId,
        action: 'report',
        reason: `[${category}] ${reason}`,
        userUuid: req.user!.userId,
      },
    })

    res.json({ code: 0, message: '举报已提交', data: null })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
      return
    }
    res.status(500).json({ code: 500, message: (err as Error).message, data: null })
  }
})

// GET /api/v1/characters/:id/revisions — 卡片版本历史
router.get('/:id/revisions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const revisions = await prisma.tavernCardRevision.findMany({
      where: { cardId: req.params.id },
      orderBy: { revision: 'desc' },
      select: {
        id: true,
        revision: true,
        changeSummary: true,
        createdBy: true,
        createdAt: true,
      },
    })

    res.json({ code: 0, data: revisions, message: 'ok' })
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: (err as Error).message, data: null })
  }
})

// POST /api/v1/characters/:id/revisions/:revisionId/rollback — 回滚到指定版本
router.post('/:id/revisions/:revisionId/rollback', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const card = await prisma.tavernCard.findUnique({ where: { id: req.params.id } })
    if (!card) {
      res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
      return
    }
    if (card.userUuid !== req.user!.userId && req.user!.role !== 'ADMIN') {
      res.status(403).json({ code: 403, message: '无权操作', data: null })
      return
    }

    const revision = await prisma.tavernCardRevision.findUnique({ where: { id: req.params.revisionId } })
    if (!revision || revision.cardId !== req.params.id) {
      res.status(404).json({ code: 404, message: '版本不存在', data: null })
      return
    }

    const snapshot = revision.snapshot as Record<string, unknown>

    const updated = await prisma.tavernCard.update({
      where: { id: req.params.id },
      data: {
        name: snapshot.name as string,
        description: snapshot.description as string,
        prompt: snapshot.prompt as string | null,
        scenario: snapshot.scenario as string | null,
        firstMsg: snapshot.firstMsg as string | null,
        version: { increment: 1 },
      },
    })

    // 创建新版本记录（标记为 rollback）
    await prisma.tavernCardRevision.create({
      data: {
        cardId: req.params.id,
        revision: revision.revision + 1,
        snapshot: snapshot as never,
        changeSummary: `回滚到版本 ${revision.revision}`,
        createdBy: req.user!.userId,
      },
    })

    res.json({ code: 0, data: updated, message: '回滚成功' })
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: (err as Error).message, data: null })
  }
})

export default router
