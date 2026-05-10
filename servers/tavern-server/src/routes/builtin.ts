import { Router, Request, Response } from 'express'
import prisma from '@/utils/prisma'

const router = Router()

// GET /api/v1/builtin/characters - Get built-in characters
router.get('/characters', async (_req: Request, res: Response) => {
  try {
    const characters = await prisma.characterCard.findMany({
      where: { creator: { openid: 'builtin_system' } },
      select: {
        id: true, name: true, avatar: true, description: true,
        personality: true, firstMsg: true, scenario: true,
        tags: true, chatCount: true, likeCount: true,
      },
    })
    res.json({ code: 0, data: characters, message: 'ok' })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

export default router