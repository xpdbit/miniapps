import { Router, Response } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import { requireAuth } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'

const router = Router()

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

const uploadSchema = z.object({
  filename: z.string().min(1).max(200),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  data: z.string().min(1), // base64 encoded, without data:... prefix
})

// POST /api/v1/upload — 上传文件（base64 JSON 模式）
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { filename, mimeType, data } = uploadSchema.parse(req.body)

    // 验证文件名安全
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    if (!safeFilename || safeFilename.length > 200) {
      res.status(400).json({ code: 400, message: '文件名不合法', data: null })
      return
    }

    // 解码 base64
    let buffer: Buffer
    try {
      buffer = Buffer.from(data, 'base64')
    } catch {
      res.status(400).json({ code: 400, message: '文件数据格式错误', data: null })
      return
    }

    if (buffer.length > MAX_FILE_SIZE) {
      res.status(400).json({ code: 400, message: `文件大小超过 ${MAX_FILE_SIZE / 1024 / 1024}MB 限制`, data: null })
      return
    }

    // 生成唯一文件名
    const ext = path.extname(safeFilename)
    const uniqueName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`

    // 保存文件
    const filePath = path.join(UPLOAD_DIR, uniqueName)
    fs.writeFileSync(filePath, buffer)

    // 返回文件 URL（相对路径，由 Nginx 或其他静态文件服务提供）
    const url = `/uploads/${uniqueName}`

    res.json({
      code: 0,
      message: 'ok',
      data: { url, filename: uniqueName, size: buffer.length },
    })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
      return
    }
    console.error('[upload]', (err as Error).message)
    res.status(500).json({ code: 500, message: '上传失败', data: null })
  }
})

export default router
