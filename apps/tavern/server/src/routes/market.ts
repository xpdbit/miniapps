import { Router, Request, Response } from 'express'
import { optionalAuth, requireAuth, AuthenticatedRequest } from '../middleware/auth'
import * as marketService from '../services/market.service'
import * as socialService from '../services/social.service'

const router = Router()

// GET /api/v1/market - Market listing (official cards only)
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const sort = (req.query.sort as string) as 'latest' | 'popular' | 'mostLiked' | 'mostFaved' || 'latest'
    const tag = req.query.tag as string | undefined
    const cardType = req.query.cardType as string | undefined

    const result = await marketService.listMarket({ page, pageSize, sort, tag, cardType })
    res.json({ code: 0, message: 'ok', data: result })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// GET /api/v1/market/featured - Featured
router.get('/featured', async (_req: Request, res: Response) => {
  try {
    const items = await marketService.getFeatured()
    res.json({ code: 0, message: 'ok', data: items })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// GET /api/v1/market/search - Search
router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || ''
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const result = await marketService.searchMarket(q, page, pageSize)
    res.json({ code: 0, message: 'ok', data: result })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// GET /api/v1/market/tags - All tags
router.get('/tags', async (_req: Request, res: Response) => {
  try {
    const tags = await marketService.getTags()
    res.json({ code: 0, message: 'ok', data: tags })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// POST /api/v1/market/:id/like
router.post('/:id/like', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await socialService.like(req.user!.userId, req.params.id)
    res.json({ code: 0, message: 'ok', data: null })
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// DELETE /api/v1/market/:id/like
router.delete('/:id/like', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await socialService.unlike(req.user!.userId, req.params.id)
    res.json({ code: 0, message: 'ok', data: null })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// POST /api/v1/market/:id/fav
router.post('/:id/fav', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await socialService.fav(req.user!.userId, req.params.id)
    res.json({ code: 0, message: 'ok', data: null })
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// DELETE /api/v1/market/:id/fav
router.delete('/:id/fav', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await socialService.unfav(req.user!.userId, req.params.id)
    res.json({ code: 0, message: 'ok', data: null })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// GET /api/v1/market/favs - My favorites
router.get('/favs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const result = await socialService.getMyFavs(req.user!.userId, page)
    res.json({ code: 0, message: 'ok', data: result })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// GET /api/v1/market/:id - Public detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const card = await marketService.getMarketCard(req.params.id)
    if (!card) {
      res.status(404).json({ code: 404, message: '角色卡不存在', data: null })
      return
    }
    res.json({ code: 0, message: 'ok', data: card })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

export default router
