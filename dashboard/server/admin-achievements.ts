// 成就管理路由 — /api/admin/achievements/*
import { Router, type Request, type Response } from 'express'
import { pool } from './db'

const router = Router()

// GET /api/admin/achievements — 列表
router.get('/', async (_req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const [rows] = await conn.execute(
      `SELECT 
        achievement_id AS id,
        name,
        description,
        icon_url AS icon,
        condition_type AS conditionType,
        condition_value AS conditionValue,
        theme_id AS themeId,
        NULL AS themeName,
        1 AS isPreset,
        0 AS sortOrder,
        created_at AS createdAt
      FROM achievements
      ORDER BY created_at DESC`,
    )
    res.json({ success: true, data: { achievements: rows as Record<string, unknown>[] } })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

// GET /api/admin/achievements/stats — 统计面板
router.get('/stats', async (_req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const [totalResult] = await conn.execute(
      'SELECT COUNT(*) as totalUsers FROM users',
    )
    const totalUsers = (totalResult as Array<{ totalUsers: number }>)[0]?.totalUsers ?? 0
    const [unlockedResult] = await conn.execute(
      'SELECT COUNT(DISTINCT user_id) as unlockedUsersCount FROM user_achievements WHERE is_unlocked = 1',
    )
    const unlockedUsersCount = (unlockedResult as Array<{ unlockedUsersCount: number }>)[0]?.unlockedUsersCount ?? 0

    const [achievementRates] = await conn.execute(
      `SELECT 
        a.achievement_id AS achievementId,
        a.name AS achievementName,
        COUNT(ua.id) AS unlockedCount,
        (SELECT COUNT(*) FROM users) AS totalCount,
        ROUND(COUNT(ua.id) * 100.0 / GREATEST((SELECT COUNT(*) FROM users), 1), 1) AS rate
      FROM achievements a
      LEFT JOIN user_achievements ua ON ua.achievement_id = a.achievement_id AND ua.is_unlocked = 1
      GROUP BY a.id, a.achievement_id, a.name
      ORDER BY a.id`,
    )

    const [recentUnlocks] = await conn.execute(
      `SELECT 
        ua.id,
        ua.achievement_id AS achievementId,
        a.name AS achievementName,
        u.openid AS userOpenId,
        u.nickname AS userName,
        ua.unlocked_at AS unlockedAt
      FROM user_achievements ua
      LEFT JOIN achievements a ON a.achievement_id = ua.achievement_id
      LEFT JOIN users u ON u.id = ua.user_id
      WHERE ua.is_unlocked = 1
      ORDER BY ua.unlocked_at DESC
      LIMIT 20`,
    )

    const overallUnlockRate = totalUsers > 0
      ? Math.round(unlockedUsersCount * 10000 / totalUsers) / 100
      : 0

    res.json({
      success: true,
      data: {
        totalUsers,
        unlockedUsersCount,
        overallUnlockRate,
        achievementRates: achievementRates as Record<string, unknown>[],
        recentUnlocks: recentUnlocks as Record<string, unknown>[],
      },
    })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

// PUT /api/admin/achievements/:id — 更新配置
router.put('/:id', async (req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const achievementId = req.params.id
    const { icon, description, conditionValue, themeId } = req.body as {
      icon?: string
      description?: string
      conditionValue?: number
      themeId?: number | null
    }

    const updates: string[] = []
    const params: unknown[] = []

    if (icon !== undefined) {
      updates.push('icon_url = ?')
      params.push(icon)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      params.push(description)
    }
    if (conditionValue !== undefined) {
      updates.push('condition_value = ?')
      params.push(conditionValue)
    }
    if (themeId !== undefined) {
      updates.push('theme_id = ?')
      params.push(themeId)
    }

    if (updates.length === 0) {
      res.status(400).json({ success: false, message: '没有提供更新字段' })
      return
    }

    params.push(achievementId)
    await conn.execute(
      `UPDATE achievements SET ${updates.join(', ')} WHERE achievement_id = ?`,
      params as any[],
    )

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

// GET /api/admin/achievements/:id/users — 已解锁用户列表
router.get('/:id/users', async (req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const achievementId = req.params.id
    const [rows] = await conn.execute(
      `SELECT 
        ua.id,
        u.openid AS userOpenId,
        u.nickname AS userName,
        ua.unlocked_at AS unlockedAt
      FROM user_achievements ua
      LEFT JOIN users u ON u.id = ua.user_id
      WHERE ua.achievement_id = ? AND ua.is_unlocked = 1
      ORDER BY ua.unlocked_at DESC`,
      [achievementId],
    )
    res.json({ success: true, data: { users: rows as Record<string, unknown>[] } })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

// POST /api/admin/achievements/trigger — 手动触发成就检测
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    // 占位实现 — 实际成就检测逻辑由云函数或定时任务执行
    // 这里仅返回成功确认，未来可集成 achievement 服务
    res.json({ success: true, data: { unlocked: [] as string[] } })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

export default router
