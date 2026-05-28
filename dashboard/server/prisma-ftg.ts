/**
 * FTG 数据库 (food_theme_generator) Prisma Client
 * Dashboard 通过此客户端跨库查询 FTG 统计数据
 *
 * 注意：miniapps 和 food_theme_generator 是独立数据库，
 * schema-miniapps.prisma 的 PrismaClient 不包含 FTG 模型。
 * 此处创建独立连接，使用 $queryRaw 执行跨库查询。
 */
import { PrismaClient } from '@prisma/client'

const ftgPrisma = new PrismaClient({
  datasourceUrl: process.env.FTG_DATABASE_URL,
  log: process.env.NODE_ENV === 'development' ? [] : ['error'],
})

export default ftgPrisma

// ============================================================
// FTG 表名常量（避免硬编码）
// ============================================================
export const FTG_TABLES = {
  FOOD_RECORDS: 'ftg_food_records',
  CHECKINS: 'ftg_checkins',
  THEMES: 'ftg_themes',
} as const

// ============================================================
// 类型安全的 FTG 查询 helpers
// ============================================================

export interface FtgStats {
  totalFoodRecords: number
  totalCheckIns: number
  recognitionsToday: number
  checkInsToday: number
}

export async function getFtgStats(todayStart: Date): Promise<FtgStats> {
  const results = await ftgPrisma.$queryRawUnsafe<
    Array<{ cnt: number }>
  >(
    `SELECT COUNT(*) as cnt FROM ${FTG_TABLES.FOOD_RECORDS}`
  )
  const totalFoodRecords = Number(results[0]?.cnt ?? 0)

  const checkinResults = await ftgPrisma.$queryRawUnsafe<
    Array<{ cnt: number }>
  >(
    `SELECT COUNT(*) as cnt FROM ${FTG_TABLES.CHECKINS}`
  )
  const totalCheckIns = Number(checkinResults[0]?.cnt ?? 0)

  const todayRecords = await ftgPrisma.$queryRawUnsafe<
    Array<{ cnt: number }>
  >(
    `SELECT COUNT(*) as cnt FROM ${FTG_TABLES.FOOD_RECORDS} WHERE created_at >= ?`,
    todayStart
  )
  const recognitionsToday = Number(todayRecords[0]?.cnt ?? 0)

  const todayCheckins = await ftgPrisma.$queryRawUnsafe<
    Array<{ cnt: number }>
  >(
    `SELECT COUNT(*) as cnt FROM ${FTG_TABLES.CHECKINS} WHERE created_at >= ?`,
    todayStart
  )
  const checkInsToday = Number(todayCheckins[0]?.cnt ?? 0)

  return { totalFoodRecords, totalCheckIns, recognitionsToday, checkInsToday }
}

export interface TrendPoint {
  date: string
  value: number
}

export async function getRecognitionTrend(since: Date): Promise<TrendPoint[]> {
  const rows = await ftgPrisma.$queryRawUnsafe<
    Array<{ d: string; cnt: number }>
  >(
    `SELECT DATE(created_at) as d, COUNT(*) as cnt
     FROM ${FTG_TABLES.FOOD_RECORDS}
     WHERE created_at >= ?
     GROUP BY DATE(created_at)
     ORDER BY d ASC`,
    since
  )
  return rows.map((r) => ({ date: r.d, value: Number(r.cnt) }))
}

export interface FoodTypeDist {
  type: string
  value: number
}

export async function getFoodTypeDistribution(): Promise<FoodTypeDist[]> {
  const rows = await ftgPrisma.$queryRawUnsafe<
    Array<{ food_type: string; cnt: number }>
  >(
    `SELECT food_type, COUNT(*) as cnt
     FROM ${FTG_TABLES.FOOD_RECORDS}
     GROUP BY food_type
     ORDER BY cnt DESC
     LIMIT 10`
  )
  return rows.map((r) => ({ type: r.food_type, value: Number(r.cnt) }))
}

export interface ThemeUsage {
  type: string
  value: number
}

export async function getThemeUsageDistribution(): Promise<ThemeUsage[]> {
  const rows = await ftgPrisma.$queryRawUnsafe<
    Array<{ name: string; theme_id: string; cnt: number }>
  >(
    `SELECT t.name, t.theme_id, COUNT(f.id) as cnt
     FROM ${FTG_TABLES.THEMES} t
     LEFT JOIN ${FTG_TABLES.FOOD_RECORDS} f ON f.theme_id = t.theme_id AND f.is_deleted = 0
     GROUP BY t.theme_id, t.name
     ORDER BY cnt DESC
     LIMIT 10`
  )
  return rows.map((r) => ({ type: r.name, value: Number(r.cnt) }))
}
