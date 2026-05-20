// API 密钥管理路由 — /api/admin/api-keys/*
import { Router, type Request, type Response } from 'express'
import prisma from './prisma'

const router = Router()

// GET /api/admin/api-keys — 列表
router.get('/', async (_req: Request, res: Response) => {
  try {
    const keys = await prisma.ftgApiKey.findMany({
      orderBy: { created_at: 'desc' },
    })
    res.json({
      success: true,
      data: {
        keys: keys.map((k) => ({
          id: k.id,
          serviceName: k.service_name,
          keyValue: k.encrypted_key,
          status: k.is_active ? 'active' : 'inactive',
          active: k.is_active,
          createdAt: k.created_at,
          lastUsedAt: k.last_used_at,
        })),
      },
    })
  } catch (e) {
    console.error('[Admin] 获取API密钥列表失败:', e)
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

    const key = await prisma.ftgApiKey.create({
      data: { service_name: serviceName, encrypted_key: keyValue, is_active: true },
    })

    res.status(201).json({
      success: true,
      data: {
        key: {
          id: key.id,
          serviceName: key.service_name,
          keyValue: key.encrypted_key,
          status: 'active',
          active: true,
          createdAt: key.created_at,
          lastUsedAt: key.last_used_at,
        },
      },
    })
  } catch (e) {
    console.error('[Admin] 创建API密钥失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// PUT /api/admin/api-keys/:id — 更新（启用/禁用/修改服务名）
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { active, serviceName } = req.body as { active?: boolean; serviceName?: string }

    const data: { is_active?: boolean; service_name?: string } = {}
    if (active !== undefined) data.is_active = active
    if (serviceName !== undefined) data.service_name = serviceName

    if (Object.keys(data).length === 0) {
      res.status(400).json({ success: false, message: '没有提供更新字段' })
      return
    }

    await prisma.ftgApiKey.update({ where: { id }, data })

    const key = await prisma.ftgApiKey.findUniqueOrThrow({ where: { id } })

    res.json({
      success: true,
      data: {
        key: {
          id: key.id,
          serviceName: key.service_name,
          keyValue: key.encrypted_key,
          status: key.is_active ? 'active' : 'inactive',
          active: key.is_active,
          createdAt: key.created_at,
          lastUsedAt: key.last_used_at,
        },
      },
    })
  } catch (e) {
    console.error('[Admin] 更新API密钥失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// DELETE /api/admin/api-keys/:id — 删除
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    await prisma.ftgApiKey.delete({ where: { id } })
    res.json({ success: true })
  } catch (e) {
    console.error('[Admin] 删除API密钥失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

export default router
