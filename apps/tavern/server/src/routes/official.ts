import { Router, Request, Response } from 'express'
import * as marketService from '../services/market.service'

const router = Router()

// GET /api/v1/official/all - 获取所有已发布的官方卡片（用于客户端同步）
router.get('/all', async (_req: Request, res: Response) => {
  try {
    const cards = await marketService.getAllOfficialCards()
    res.json({ code: 0, data: cards, message: 'ok' })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

export default router
