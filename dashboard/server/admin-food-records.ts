// 食物记录管理路由 — /api/admin/food-records/*
// 查询 food_theme_generator 数据库，提供后台管理 CRUD
import { Router, type Request, type Response } from 'express'
import type { Prisma, FoodType } from '@prisma/client'
import prisma from './prisma'

const router = Router()

// GET /api/admin/food-records — 分页列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string || '20')))
    const offset = (page - 1) * pageSize

    const where: Prisma.FtgFoodRecordWhereInput = {}

    if (req.query.foodName) {
      // foodName is inside `data` JSON column — full-text search deferred
    }
    if (req.query.foodType) {
      where.food_type = req.query.foodType as FoodType
    }
    if (req.query.themeId) {
      where.theme_id = req.query.themeId as string
    }

    const createdAtFilter: Prisma.DateTimeFilter = {}
    if (req.query.startDate) {
      createdAtFilter.gte = new Date(req.query.startDate as string)
    }
    if (req.query.endDate) {
      createdAtFilter.lte = new Date(`${req.query.endDate as string}T23:59:59`)
    }
    if (Object.keys(createdAtFilter).length > 0) {
      where.created_at = createdAtFilter
    }

    // 默认不显示已删除记录
    if (req.query.showDeleted !== 'true') {
      where.is_deleted = false
    }

    const [records, total] = await Promise.all([
      prisma.ftgFoodRecord.findMany({
        where,
        include: { user: { select: { uuid: true, nickname: true } } },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: pageSize,
      }),
      prisma.ftgFoodRecord.count({ where }),
    ])

    const mapped = records.map((r) => ({
      id: r.id,
      foodName: r.foodName,
      foodType: r.foodType,
      thumbnailUrl: r.imageUrl,
      themeId: r.themeId,
      themeName: null,
      userOpenId: r.user.openid,
      calories: r.caloriesTotal,
      createdAt: r.createdAt,
      deletedAt: r.deletedAt,
    }))

    res.json({
      success: true,
      data: { records: mapped, total, page, pageSize },
    })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// GET /api/admin/food-records/:id — 详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const record = await prisma.ftgFoodRecord.findUnique({
      where: { id },
      include: { user: { select: { openid: true } } },
    })

    if (!record) {
      res.status(404).json({ success: false, message: '记录不存在' })
      return
    }

    const result: Record<string, unknown> = {
      id: record.id,
      foodName: record.foodName,
      foodType: record.foodType,
      thumbnailUrl: record.imageUrl,
      originalImageUrl: record.imageUrl,
      themeImageUrl: record.themeImageUrl,
      themeId: record.themeId,
      themeName: null,
      userOpenId: record.user.openid,
      calories: record.caloriesTotal,
      createdAt: record.createdAt,
      deletedAt: record.deletedAt,
    }

    const aiDescription = {
      short: record.aiDescShort || '',
      gameStyle: record.aiDescGameStyle || '',
      detail: record.aiDescDetail || '',
    }
    const nutrition = {
      protein: record.protein ?? 0,
      fat: record.fat ?? 0,
      carbs: record.carbs ?? 0,
    }
    const location = {
      latitude: record.latitude ?? 0,
      longitude: record.longitude ?? 0,
      locationName: record.locationName || '',
    }

    res.json({
      success: true,
      data: { record: { ...result, aiDescription, nutrition, location } },
    })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// DELETE /api/admin/food-records/:id — 软删除
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    await prisma.ftgFoodRecord.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// POST /api/admin/food-records/:id/restore — 恢复软删除
router.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    await prisma.ftgFoodRecord.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null },
    })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// POST /api/admin/food-records/batch-delete — 批量软删除
router.post('/batch-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body as { ids: number[] }
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, message: '请提供要删除的记录ID' })
      return
    }
    await prisma.ftgFoodRecord.updateMany({
      where: { id: { in: ids } },
      data: { isDeleted: true, deletedAt: new Date() },
    })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

export default router
