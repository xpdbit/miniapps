// Dashboard Stats API Routes
// 跨库查询 miniapps (User) + food_theme_generator (FTG 业务表) 提供仪表盘统计
import { Router, type Request, type Response } from 'express'
import prisma from './prisma'
import {
  getFtgStats,
  getRecognitionTrend,
  getFoodTypeDistribution,
  getThemeUsageDistribution,
} from './prisma-ftg'

const router = Router()

/** 聚合统计概览 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    // miniapps 库：用户统计
    const [totalUsers, newUsersToday, newUsersThisMonth] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    ])

    // food_theme_generator 库：FTG 业务统计
    const ftgStats = await getFtgStats(todayStart)

    res.json({
      success: true,
      data: {
        totalUsers,
        newUsersToday,
        newUsersThisMonth,
        totalFoodRecords: ftgStats.totalFoodRecords,
        recognitionsToday: ftgStats.recognitionsToday,
        totalCheckIns: ftgStats.totalCheckIns,
        checkInsToday: ftgStats.checkInsToday,
      },
    })
  } catch (e) {
    console.error('[Dashboard] 获取统计概览失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

/** 近30天新用户趋势 */
router.get('/stats/user-trend', async (_req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const users = await prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    const grouped: Record<string, number> = {}
    for (const u of users) {
      const date = u.createdAt.toISOString().slice(0, 10)
      grouped[date] = (grouped[date] || 0) + 1
    }
    const data = Object.entries(grouped).map(([date, value]) => ({ date, value }))
    res.json({ success: true, data })
  } catch (e) {
    console.error('[Dashboard] 获取用户趋势失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

/** 近30天识别量趋势 */
router.get('/stats/recognition-trend', async (_req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const data = await getRecognitionTrend(thirtyDaysAgo)
    res.json({ success: true, data })
  } catch (e) {
    console.error('[Dashboard] 获取识别趋势失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

/** 食物类型分布 */
router.get('/stats/food-type-distribution', async (_req: Request, res: Response) => {
  try {
    const data = await getFoodTypeDistribution()
    res.json({ success: true, data })
  } catch (e) {
    console.error('[Dashboard] 获取食物类型分布失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

/** 主题使用分布 */
router.get('/stats/theme-usage-distribution', async (_req: Request, res: Response) => {
  try {
    const data = await getThemeUsageDistribution()
    res.json({ success: true, data })
  } catch (e) {
    console.error('[Dashboard] 获取主题使用分布失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

export default router
