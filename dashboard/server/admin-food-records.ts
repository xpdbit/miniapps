// 食物记录管理路由 — /api/admin/food-records/*
// 查询 food_theme_generator 数据库，提供后台管理 CRUD
import { Router, type Request, type Response } from 'express'
import { pool } from './db'

const router = Router()

// GET /api/admin/food-records — 分页列表
router.get('/', async (req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string || '20')))
    const offset = (page - 1) * pageSize

    const conditions: string[] = []
    const params: unknown[] = []

    if (req.query.foodName) {
      conditions.push('fr.food_name LIKE ?')
      params.push(`%${req.query.foodName}%`)
    }
    if (req.query.foodType) {
      conditions.push('fr.food_type = ?')
      params.push(req.query.foodType)
    }
    if (req.query.themeId) {
      conditions.push('fr.theme_id = ?')
      params.push(req.query.themeId)
    }
    if (req.query.startDate) {
      conditions.push('fr.created_at >= ?')
      params.push(req.query.startDate)
    }
    if (req.query.endDate) {
      conditions.push('fr.created_at <= ?')
      params.push(`${req.query.endDate}T23:59:59`)
    }

    // 默认不显示已删除记录
    if (req.query.showDeleted !== 'true') {
      conditions.push('fr.is_deleted = 0')
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const [countRows] = await conn.execute(
      `SELECT COUNT(*) as total FROM food_records fr ${where}`,
      params as any[],
    )
    const total = (countRows as Array<{ total: number }>)[0]?.total ?? 0

    const [rows] = await conn.execute(
      `SELECT 
        fr.id,
        fr.food_name AS foodName,
        fr.food_type AS foodType,
        fr.image_url AS thumbnailUrl,
        fr.theme_id AS themeId,
        NULL AS themeName,
        u.openid AS userOpenId,
        fr.calories_total AS calories,
        fr.created_at AS createdAt,
        fr.deleted_at AS deletedAt
      FROM food_records fr
      LEFT JOIN users u ON u.id = fr.user_id
      ${where}
      ORDER BY fr.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params as any[], String(pageSize), String(offset)],
    )

    res.json({
      success: true,
      data: { records: rows as Record<string, unknown>[], total, page, pageSize },
    })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

// GET /api/admin/food-records/:id — 详情
router.get('/:id', async (req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const id = parseInt(req.params.id as string)
    const [rows] = await conn.execute(
      `SELECT 
        fr.id,
        fr.food_name AS foodName,
        fr.food_type AS foodType,
        fr.image_url AS thumbnailUrl,
        fr.image_url AS originalImageUrl,
        fr.theme_image_url AS themeImageUrl,
        fr.theme_id AS themeId,
        NULL AS themeName,
        u.openid AS userOpenId,
        fr.calories_total AS calories,
        fr.ai_desc_short AS aiDescShort,
        fr.ai_desc_game_style AS aiDescGameStyle,
        fr.ai_desc_detail AS aiDescDetail,
        fr.protein,
        fr.fat,
        fr.carbs,
        fr.latitude,
        fr.longitude,
        fr.location_name AS locationName,
        fr.created_at AS createdAt,
        fr.deleted_at AS deletedAt
      FROM food_records fr
      LEFT JOIN users u ON u.id = fr.user_id
      WHERE fr.id = ?`,
      [id],
    )

    const record = (rows as Array<Record<string, unknown>>)[0]
    if (!record) {
      res.status(404).json({ success: false, message: '记录不存在' })
      return
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

    // 删除辅助字段
    delete record.aiDescShort
    delete record.aiDescGameStyle
    delete record.aiDescDetail
    delete record.protein
    delete record.fat
    delete record.carbs
    delete record.latitude
    delete record.longitude
    delete record.locationName

    res.json({
      success: true,
      data: { record: { ...record, aiDescription, nutrition, location } },
    })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

// DELETE /api/admin/food-records/:id — 软删除
router.delete('/:id', async (req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const id = parseInt(req.params.id as string)
    await conn.execute(
      'UPDATE food_records SET is_deleted = 1, deleted_at = NOW() WHERE id = ?',
      [id],
    )
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

// POST /api/admin/food-records/:id/restore — 恢复软删除
router.post('/:id/restore', async (req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const id = parseInt(req.params.id as string)
    await conn.execute(
      'UPDATE food_records SET is_deleted = 0, deleted_at = NULL WHERE id = ?',
      [id],
    )
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

// POST /api/admin/food-records/batch-delete — 批量软删除
router.post('/batch-delete', async (req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const { ids } = req.body as { ids: number[] }
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, message: '请提供要删除的记录ID' })
      return
    }
    const placeholders = ids.map(() => '?').join(',')
    await conn.execute(
      `UPDATE food_records SET is_deleted = 1, deleted_at = NOW() WHERE id IN (${placeholders})`,
      ids,
    )
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

export default router
