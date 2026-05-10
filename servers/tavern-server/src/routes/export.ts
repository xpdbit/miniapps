import { Router, Response } from 'express'
import { requireAuth } from '@/middleware/auth'
import type { AuthenticatedRequest } from '@/middleware/auth'
import * as exportService from '@/services/export.service'

const router = Router()

// GET /api/v1/characters/:id/export - Export as V2 JSON
router.get('/characters/:id/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await exportService.exportToV2(req.params.id)
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${data.data.name}.json"`)
    res.json(data)
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// POST /api/v1/characters/import - Import from V2 JSON
router.post('/characters/import', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const card = await exportService.importFromV2(req.body, req.user!.userId)
    res.status(201).json({ code: 0, data: card, message: '导入成功' })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

export default router