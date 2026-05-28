import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'
import prisma from '../utils/prisma'

const router = Router()

const reportSchema = z.object({
  targetType: z.enum(['card', 'user', 'message']),
  targetId: z.string().min(1),
  reason: z.string().min(1).max(500),
  category: z.enum(['inappropriate', 'spam', 'copyright', 'other']).optional().default('inappropriate'),
})

// POST /api/v1/reports — 举报不当内容
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetType, targetId, reason, category } = reportSchema.parse(req.body)

    await prisma.tavernModerationLog.create({
      data: {
        targetType: `report_${targetType}`,
        targetId,
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

export default router
