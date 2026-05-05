// API 密钥管理路由 — /api/admin/api-keys/*
import { Router, type Request, type Response } from 'express'
import { pool } from './db'

const router = Router()

// GET /api/admin/api-keys — 列表
router.get('/', async (req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const [rows] = await conn.execute(
      `SELECT 
        ak.id,
        ak.service_name AS serviceName,
        ak.encrypted_key AS keyValue,
        CASE WHEN ak.is_active = 1 THEN 'active' ELSE 'inactive' END AS status,
        ak.is_active AS active,
        ak.created_at AS createdAt,
        ak.last_used_at AS lastUsedAt
      FROM api_keys ak
      ORDER BY ak.created_at DESC`,
    )
    res.json({ success: true, data: { keys: rows as Record<string, unknown>[] } })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

// POST /api/admin/api-keys — 创建
router.post('/', async (req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const { serviceName, keyValue } = req.body as { serviceName: string; keyValue: string }
    if (!serviceName || !keyValue) {
      res.status(400).json({ success: false, message: '服务名和密钥值不能为空' })
      return
    }

    // 使用固定的 userId=0 表示系统级 API Key（管理后台创建）
    const [result] = await conn.execute(
      'INSERT INTO api_keys (user_id, service_name, encrypted_key, is_active) VALUES (?, ?, ?, 1)',
      [0, serviceName, keyValue],
    )

    const insertResult = result as { insertId: number }
    const [rows] = await conn.execute(
      `SELECT 
        id, service_name AS serviceName, encrypted_key AS keyValue,
        'active' AS status, 1 AS active,
        created_at AS createdAt, last_used_at AS lastUsedAt
      FROM api_keys WHERE id = ?`,
      [insertResult.insertId],
    )

    res.status(201).json({
      success: true,
      data: { key: (rows as Array<Record<string, unknown>>)[0] },
    })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

// PUT /api/admin/api-keys/:id — 更新（启用/禁用/修改服务名）
router.put('/:id', async (req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const id = parseInt(req.params.id as string)
    const { active, serviceName } = req.body as { active?: boolean; serviceName?: string }

    const updates: string[] = []
    const params: unknown[] = []

    if (active !== undefined) {
      updates.push('is_active = ?')
      params.push(active ? 1 : 0)
    }
    if (serviceName !== undefined) {
      updates.push('service_name = ?')
      params.push(serviceName)
    }

    if (updates.length === 0) {
      res.status(400).json({ success: false, message: '没有提供更新字段' })
      return
    }

    params.push(id)
    await conn.execute(`UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?`, params as any[])

    const [rows] = await conn.execute(
      `SELECT 
        id, service_name AS serviceName, encrypted_key AS keyValue,
        CASE WHEN is_active = 1 THEN 'active' ELSE 'inactive' END AS status,
        is_active AS active,
        created_at AS createdAt, last_used_at AS lastUsedAt
      FROM api_keys WHERE id = ?`,
      [id],
    )

    res.json({
      success: true,
      data: { key: (rows as Array<Record<string, unknown>>)[0] },
    })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

// DELETE /api/admin/api-keys/:id — 删除
router.delete('/:id', async (req: Request, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const id = parseInt(req.params.id as string)
    await conn.execute('DELETE FROM api_keys WHERE id = ?', [id])
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message })
  } finally {
    conn.release()
  }
})

export default router
