// 成就管理路由 — /api/admin/achievements/*
import { Router, type Request, type Response } from 'express'
import prisma from './prisma'

const router = Router()

// GET /api/admin/achievements — 列表
router.get('/', async (_req: Request, res: Response) => {
  try {
    const achievements = await prisma.ftgAchievement.findMany({
      orderBy: { created_at: 'desc' },
    })
    const rows = achievements.map((r) => ({
      id: r.achievement_id,
      name: r.name,
      description: r.description,
      icon: r.icon_url,
      conditionType: r.condition_type,
      conditionValue: r.condition_value,
      themeId: r.theme_id,
      themeName: null,
      isPreset: 1,
      sortOrder: 0,
      createdAt: r.created_at,
    }))
    res.json({ success: true, data: { achievements: rows } })
  } catch (e) {
    console.error('[Admin] 获取成就列表失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// GET /api/admin/achievements/stats — 统计面板
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.sharedUser.count()

    const unlockedUsers = await prisma.ftgUserAchievement.findMany({
      where: { is_unlocked: true },
      distinct: ['user_id'],
      select: { user_id: true },
    })
    const unlockedUsersCount = unlockedUsers.length

    const achievementRates = await prisma.ftgAchievement.findMany({
      include: {
        _count: {
          select: {
            userAchievements: { where: { is_unlocked: true } },
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
        achievementId: a.achievement_id,
        achievementName: a.name,
        unlockedCount,
        totalCount: totalUsers,
        rate,
      }
    })

    const recentUnlocks = await prisma.ftgUserAchievement.findMany({
      where: { is_unlocked: true },
      include: {
        achievement: { select: { name: true } },
        user: { select: { uuid: true, nickname: true } },
      },
      orderBy: { unlocked_at: 'desc' },
      take: 20,
    })
    const unlocks = recentUnlocks.map((ua) => ({
      id: ua.id,
      achievementId: ua.achievement_id,
      achievementName: ua.achievement.name,
      userOpenId: ua.user.uuid,
      userName: ua.user.nickname,
      unlockedAt: ua.unlocked_at,
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
    console.error('[Admin] 获取成就统计失败:', e)
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
      themeId?: string | null
    }

    const data: {
      icon_url?: string
      description?: string
      condition_value?: number
      theme_id?: string | null
    } = {}

    if (icon !== undefined) {
      data.icon_url = icon
    }
    if (description !== undefined) {
      data.description = description
    }
    if (conditionValue !== undefined) {
      data.condition_value = conditionValue
    }
    if (themeId !== undefined) {
      data.theme_id = themeId ?? null
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ success: false, message: '没有提供更新字段' })
      return
    }

    await prisma.ftgAchievement.update({
      where: { achievement_id: achievementId },
      data,
    })

    res.json({ success: true })
  } catch (e) {
    console.error('[Admin] 更新成就失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// GET /api/admin/achievements/:id/users — 已解锁用户列表
router.get('/:id/users', async (req: Request, res: Response) => {
  try {
    const achievementId = req.params.id as string
    const records = await prisma.ftgUserAchievement.findMany({
      where: { achievement_id: achievementId, is_unlocked: true },
      include: {
        user: { select: { uuid: true, nickname: true } },
      },
      orderBy: { unlocked_at: 'desc' },
    })
    const rows = records.map((ua) => ({
      id: ua.id,
      userOpenId: ua.user.uuid,
      userName: ua.user.nickname,
      unlockedAt: ua.unlocked_at,
    }))
    res.json({ success: true, data: { users: rows } })
  } catch (e) {
    console.error('[Admin] 获取成就用户列表失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// POST /api/admin/achievements/trigger — 手动触发成就检测
router.post('/trigger', async (_req: Request, res: Response) => {
  try {
    // 占位实现 — 实际成就检测逻辑由云函数或定时任务执行
    res.json({ success: true, data: { unlocked: [] as string[] } })
  } catch (e) {
    console.error('[Admin] 触发成就检测失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

export default router
