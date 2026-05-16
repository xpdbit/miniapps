// 成就管理路由 — /api/admin/achievements/*
import { Router, type Request, type Response } from 'express'
import prisma from './prisma'

const router = Router()

// GET /api/admin/achievements — 列表
router.get('/', async (_req: Request, res: Response) => {
  try {
    const achievements = await prisma.ftgAchievement.findMany({
      orderBy: { createdAt: 'desc' },
    })
    const rows = achievements.map((r) => ({
      id: r.achievementId,
      name: r.name,
      description: r.description,
      icon: r.iconUrl,
      conditionType: r.conditionType,
      conditionValue: r.conditionValue,
      themeId: r.themeId,
      themeName: null,
      isPreset: 1,
      sortOrder: 0,
      createdAt: r.createdAt,
    }))
    res.json({ success: true, data: { achievements: rows } })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// GET /api/admin/achievements/stats — 统计面板
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.sharedUser.count()

    const unlockedUsers = await prisma.ftgUserAchievement.findMany({
      where: { isUnlocked: true },
      distinct: ['userId'],
      select: { userId: true },
    })
    const unlockedUsersCount = unlockedUsers.length

    const achievementRates = await prisma.ftgAchievement.findMany({
      include: {
        _count: {
          select: {
            userAchievements: { where: { isUnlocked: true } },
          },
        },
      },
    })
    const rates = achievementRates.map((a) => {
      const unlockedCount = a._count.userAchievements
      const rate = totalUsers > 0
        ? Math.round(unlockedCount * 1000 / totalUsers) / 10
        : 0
      return {
        achievementId: a.achievementId,
        achievementName: a.name,
        unlockedCount,
        totalCount: totalUsers,
        rate,
      }
    })

    const recentUnlocks = await prisma.ftgUserAchievement.findMany({
      where: { isUnlocked: true },
      include: {
        achievement: { select: { name: true } },
        user: { select: { openid: true, nickname: true } },
      },
      orderBy: { unlockedAt: 'desc' },
      take: 20,
    })
    const unlocks = recentUnlocks.map((ua) => ({
      id: ua.id,
      achievementId: ua.achievementId,
      achievementName: ua.achievement.name,
      userOpenId: ua.user.openid,
      userName: ua.user.nickname,
      unlockedAt: ua.unlockedAt,
    }))

    const overallUnlockRate = totalUsers > 0
      ? Math.round(unlockedUsersCount * 10000 / totalUsers) / 100
      : 0

    res.json({
      success: true,
      data: {
        totalUsers,
        unlockedUsersCount,
        overallUnlockRate,
        achievementRates: rates,
        recentUnlocks: unlocks,
      },
    })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// PUT /api/admin/achievements/:id — 更新配置
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const achievementId = req.params.id as string
    const { icon, description, conditionValue, themeId } = req.body as {
      icon?: string
      description?: string
      conditionValue?: number
      themeId?: number | null
    }

    const data: {
      iconUrl?: string
      description?: string
      conditionValue?: number
      themeId?: string | null
    } = {}

    if (icon !== undefined) {
      data.iconUrl = icon
    }
    if (description !== undefined) {
      data.description = description
    }
    if (conditionValue !== undefined) {
      data.conditionValue = conditionValue
    }
    if (themeId !== undefined) {
      data.themeId = themeId !== null ? String(themeId) : null
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ success: false, message: '没有提供更新字段' })
      return
    }

    await prisma.ftgAchievement.update({
      where: { achievementId },
      data,
    })

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// GET /api/admin/achievements/:id/users — 已解锁用户列表
router.get('/:id/users', async (req: Request, res: Response) => {
  try {
    const achievementId = req.params.id as string
    const records = await prisma.ftgUserAchievement.findMany({
      where: { achievementId, isUnlocked: true },
      include: {
        user: { select: { openid: true, nickname: true } },
      },
      orderBy: { unlockedAt: 'desc' },
    })
    const rows = records.map((ua) => ({
      id: ua.id,
      userOpenId: ua.user.openid,
      userName: ua.user.nickname,
      unlockedAt: ua.unlockedAt,
    }))
    res.json({ success: true, data: { users: rows } })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// POST /api/admin/achievements/trigger — 手动触发成就检测
router.post('/trigger', async (_req: Request, res: Response) => {
  try {
    // 占位实现 — 实际成就检测逻辑由云函数或定时任务执行
    // 这里仅返回成功确认，未来可集成 achievement 服务
    res.json({ success: true, data: { unlocked: [] as string[] } })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

export default router
