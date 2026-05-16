// Dashboard Stats API Routes
// 查询 miniapps 数据库提供仪表盘统计数据
import { Router, type Request, type Response } from 'express'
import prisma from './prisma'

const router = Router()

/** 聚合统计概览 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [totalUsers, totalFoodRecords, totalCheckIns, newUsersToday, recognitionsToday, checkInsToday, newUsersThisMonth] = await prisma.$transaction([
      prisma.sharedUser.count(),
      prisma.ftgFoodRecord.count(),
      prisma.ftgCheckin.count(),
      prisma.sharedUser.count({ where: { created_at: { gte: todayStart } } }),
      prisma.ftgFoodRecord.count({ where: { created_at: { gte: todayStart } } }),
      prisma.ftgCheckin.count({ where: { created_at: { gte: todayStart } } }),
      prisma.sharedUser.count({ where: { created_at: { gte: monthStart } } }),
    ])
    res.json({ success: true, data: { totalUsers, newUsersToday, newUsersThisMonth, totalFoodRecords, recognitionsToday, totalCheckIns, checkInsToday } })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

/** 近30天新用户趋势 */
router.get('/stats/user-trend', async (_req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const users = await prisma.sharedUser.findMany({
      where: { created_at: { gte: thirtyDaysAgo } },
      select: { created_at: true },
      orderBy: { created_at: 'asc' },
    })
    const grouped: Record<string, number> = {}
    for (const u of users) {
      const date = u.created_at.toISOString().slice(0, 10)
      grouped[date] = (grouped[date] || 0) + 1
    }
    const data = Object.entries(grouped).map(([date, value]) => ({ date, value }))
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

/** 近30天识别量趋势 */
router.get('/stats/recognition-trend', async (_req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const records = await prisma.ftgFoodRecord.findMany({
      where: { created_at: { gte: thirtyDaysAgo } },
      select: { created_at: true },
      orderBy: { created_at: 'asc' },
    })
    const grouped: Record<string, number> = {}
    for (const r of records) {
      const date = r.created_at.toISOString().slice(0, 10)
      grouped[date] = (grouped[date] || 0) + 1
    }
    const data = Object.entries(grouped).map(([date, value]) => ({ date, value }))
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

/** 食物类型分布 */
router.get('/stats/food-type-distribution', async (_req: Request, res: Response) => {
  try {
    const result = await prisma.ftgFoodRecord.groupBy({
      by: ['food_type'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })
    const data = result.map((r) => ({ type: r.food_type, value: r._count.id }))
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

/** 主题使用分布 */
router.get('/stats/theme-usage-distribution', async (_req: Request, res: Response) => {
  try {
    const themes = await prisma.ftgTheme.findMany({
      take: 10,
      orderBy: { usage_count: 'desc' },
      select: { name: true, theme_id: true },
    })
    const data = await Promise.all(
      themes.map((t) =>
        prisma.ftgFoodRecord
          .count({ where: { theme_id: t.theme_id, is_deleted: false } })
          .then((count) => ({ type: t.name, value: count })),
      ),
    )
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

export default router
