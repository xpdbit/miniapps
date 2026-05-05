// Dashboard Stats API Routes
// 查询 food_theme_generator 数据库提供仪表盘统计数据

import { Router, type Request, type Response } from 'express'
import { pool } from './db'

const router = Router()

/** 聚合统计概览 */
router.get('/stats', async (_req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const [totalResult] = await conn.execute('SELECT COUNT(*) as totalUsers FROM users')
    const totalUsers = (totalResult as Array<{ totalUsers: number }>)[0]?.totalUsers ?? 0
    const [foodResult] = await conn.execute('SELECT COUNT(*) as totalFoodRecords FROM food_records')
    const totalFoodRecords = (foodResult as Array<{ totalFoodRecords: number }>)[0]?.totalFoodRecords ?? 0
    const [checkinResult] = await conn.execute('SELECT COUNT(*) as totalCheckIns FROM checkins')
    const totalCheckIns = (checkinResult as Array<{ totalCheckIns: number }>)[0]?.totalCheckIns ?? 0
    const [newUsersResult] = await conn.execute('SELECT COUNT(*) as newUsersToday FROM users WHERE DATE(created_at)=CURDATE()')
    const newUsersToday = (newUsersResult as Array<{ newUsersToday: number }>)[0]?.newUsersToday ?? 0
    const [recognitionsResult] = await conn.execute('SELECT COUNT(*) as recognitionsToday FROM food_records WHERE DATE(created_at)=CURDATE()')
    const recognitionsToday = (recognitionsResult as Array<{ recognitionsToday: number }>)[0]?.recognitionsToday ?? 0
    const [checkinsTodayResult] = await conn.execute('SELECT COUNT(*) as checkInsToday FROM checkins WHERE DATE(created_at)=CURDATE()')
    const checkInsToday = (checkinsTodayResult as Array<{ checkInsToday: number }>)[0]?.checkInsToday ?? 0
    const [newUsersMonthResult] = await conn.execute('SELECT COUNT(*) as newUsersThisMonth FROM users WHERE MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())')
    const newUsersThisMonth = (newUsersMonthResult as Array<{ newUsersThisMonth: number }>)[0]?.newUsersThisMonth ?? 0
    res.json({ success: true, data: { totalUsers, newUsersToday, newUsersThisMonth, totalFoodRecords, recognitionsToday, totalCheckIns, checkInsToday } })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

/** 近30天新用户趋势 */
router.get('/stats/user-trend', async (_req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const [rows] = await conn.execute('SELECT DATE(created_at) as date, COUNT(*) as value FROM users WHERE created_at>=DATE_SUB(CURDATE(),INTERVAL 30 DAY) GROUP BY DATE(created_at) ORDER BY date')
    res.json({ success: true, data: rows })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

/** 近30天识别量趋势 */
router.get('/stats/recognition-trend', async (_req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const [rows] = await conn.execute('SELECT DATE(created_at) as date, COUNT(*) as value FROM food_records WHERE created_at>=DATE_SUB(CURDATE(),INTERVAL 30 DAY) GROUP BY DATE(created_at) ORDER BY date')
    res.json({ success: true, data: rows })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

/** 食物类型分布 */
router.get('/stats/food-type-distribution', async (_req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const [rows] = await conn.execute('SELECT food_type as type, COUNT(*) as value FROM food_records GROUP BY food_type ORDER BY value DESC LIMIT 10')
    res.json({ success: true, data: rows })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

/** 主题使用分布 */
router.get('/stats/theme-usage-distribution', async (_req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    // 注意：审阅 themes 表结构，列名可能为主题名
    // themes.name 为主题名称，统计各主题在 food_records 中的使用次数
    const [rows] = await conn.execute('SELECT t.name as type, COUNT(fr.id) as value FROM themes t LEFT JOIN food_records fr ON fr.theme_id = t.theme_id AND fr.is_deleted = 0 GROUP BY t.id, t.name ORDER BY value DESC LIMIT 10')
    res.json({ success: true, data: rows })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

export default router
