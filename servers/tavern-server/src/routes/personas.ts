import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '@/middleware/auth'
import type { AuthenticatedRequest } from '@/middleware/auth'
import * as personaService from '@/services/persona.service'

const router = Router()
const createSchema = z.object({ name: z.string().min(1).max(50), description: z.string().max(500).optional(), avatar: z.string().optional() })

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try { const items = await personaService.listPersonas(req.user!.userId); res.json({ code: 0, data: items, message: 'ok' }) }
  catch (err: unknown) { const e = err as Error; res.status(500).json({ code: 500, message: e.message, data: null }) }
})

router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createSchema.parse(req.body)
    const persona = await personaService.createPersona(req.user!.userId, data)
    res.status(201).json({ code: 0, data: persona, message: 'ok' })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
    const e = err as Error; res.status(500).json({ code: 500, message: e.message, data: null })
  }
})

router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try { const data = createSchema.partial().parse(req.body); const p = await personaService.updatePersona(req.params.id, req.user!.userId, data); res.json({ code: 0, data: p, message: 'ok' }) }
  catch (err: unknown) { const e = err as Error; if (e.message === 'FORBIDDEN') return res.status(403).json({ code: 403, message: '无权操作', data: null }); res.status(500).json({ code: 500, message: e.message, data: null }) }
})

router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try { await personaService.deletePersona(req.params.id, req.user!.userId); res.json({ code: 0, data: null, message: 'ok' }) }
  catch (err: unknown) { const e = err as Error; if (e.message === 'FORBIDDEN') return res.status(403).json({ code: 403, message: '无权操作', data: null }); res.status(500).json({ code: 500, message: e.message, data: null }) }
})

router.post('/:id/default', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try { await personaService.setDefault(req.params.id, req.user!.userId); res.json({ code: 0, message: 'ok', data: null }) }
  catch (err: unknown) { const e = err as Error; if (e.message === 'FORBIDDEN') return res.status(403).json({ code: 403, message: '无权操作', data: null }); res.status(500).json({ code: 500, message: e.message, data: null }) }
})

export default router