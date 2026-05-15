import { Router, Response } from 'express'
import { requireAdmin } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'
import * as moderationService from '../services/moderation.service'

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
    await moderationService.approve(req.params.id, req.user!.userId)
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
    await moderationService.reject(req.params.id, req.user!.userId, reason)
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
    await moderationService.ban(req.params.id, req.user!.userId, reason)
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

export default router