// API 密钥管理路由 — /api/admin/api-keys/*
import { Router, type Request, type Response } from 'express'
import prisma from './prisma'

const router = Router()

// GET /api/admin/api-keys — 列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
    })
    res.json({
      success: true,
      data: {
        keys: keys.map((k) => ({
          id: k.id,
          serviceName: k.serviceName,
          keyValue: k.encryptedKey,
          status: k.isActive ? 'active' : 'inactive',
          active: k.isActive,
          createdAt: k.createdAt,
          lastUsedAt: k.lastUsedAt,
        })),
      },
    })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// POST /api/admin/api-keys — 创建
router.post('/', async (req: Request, res: Response) => {
  try {
    const { serviceName, keyValue } = req.body as { serviceName: string; keyValue: string }
    if (!serviceName || !keyValue) {
      res.status(400).json({ success: false, message: '服务名和密钥值不能为空' })
      return
    }

    // 使用固定的 userId=0 表示系统级 API Key（管理后台创建）
    const key = await prisma.apiKey.create({
      data: { userId: 0, serviceName, encryptedKey: keyValue, isActive: true },
    })

    res.status(201).json({
      success: true,
      data: {
        key: {
          id: key.id,
          serviceName: key.serviceName,
          keyValue: key.encryptedKey,
          status: 'active',
          active: true,
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
        },
      },
    })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// PUT /api/admin/api-keys/:id — 更新（启用/禁用/修改服务名）
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const { active, serviceName } = req.body as { active?: boolean; serviceName?: string }

    const data: { isActive?: boolean; serviceName?: string } = {}
    if (active !== undefined) data.isActive = active
    if (serviceName !== undefined) data.serviceName = serviceName

    if (Object.keys(data).length === 0) {
      res.status(400).json({ success: false, message: '没有提供更新字段' })
      return
    }

    await prisma.apiKey.update({ where: { id }, data })

    const key = await prisma.apiKey.findUniqueOrThrow({ where: { id } })

    res.json({
      success: true,
      data: {
        key: {
          id: key.id,
          serviceName: key.serviceName,
          keyValue: key.encryptedKey,
          status: key.isActive ? 'active' : 'inactive',
          active: key.isActive,
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
        },
      },
    })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// DELETE /api/admin/api-keys/:id — 删除
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    await prisma.apiKey.delete({ where: { id } })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

export default router
