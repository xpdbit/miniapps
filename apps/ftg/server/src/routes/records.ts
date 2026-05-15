/**
 * 食物记录路由 - CRUD、搜索、统计
 */
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import * as recordService from '../services/food-record.service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// 所有记录路由需要登录
router.use(requireAuth);

/**
 * POST /api/v1/records
 * 创建食物记录（multipart: image + 字段）
 */
router.post('/', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const formData: Record<string, unknown> = { ...req.body };
    if (req.file?.buffer) {
      formData.imageBuffer = req.file.buffer;
    }
    const record = await recordService.create(userId, formData);
    res.status(201).json({ success: true, errCode: 0, errMsg: 'ok', data: record });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 7000, errMsg: (error as Error).message, data: null });
  }
});

/**
 * GET /api/v1/records
 * 分页查询食物记录，支持筛选
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { page, limit, foodType, themeId } = req.query as Record<string, string | undefined>;
    const result = await recordService.listByUser(userId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      foodType,
      themeId,
    });
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: result });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 7000, errMsg: (error as Error).message, data: null });
  }
});

/**
 * GET /api/v1/records/search?q=keyword
 * 按食物名称搜索
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const keyword = req.query.q as string | undefined;
    if (!keyword) {
      res.status(400).json({ success: false, errCode: 1001, errMsg: '缺少搜索关键词', data: null });
      return;
    }
    const result = await recordService.search(userId, keyword);
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: result });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 7000, errMsg: (error as Error).message, data: null });
  }
});

/**
 * GET /api/v1/records/stats
 * 食物记录统计
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const stats = await recordService.getStats(userId);
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: stats });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 7000, errMsg: (error as Error).message, data: null });
  }
});

/**
 * GET /api/v1/records/:id
 * 获取单条记录详情
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, errCode: 1001, errMsg: '无效的记录 ID', data: null });
      return;
    }
    const record = await recordService.getById(id, userId);
    if (!record) {
      res.status(404).json({ success: false, errCode: 1003, errMsg: '记录不存在', data: null });
      return;
    }
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: record });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 7000, errMsg: (error as Error).message, data: null });
  }
});

/**
 * DELETE /api/v1/records/:id
 * 软删除食物记录
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, errCode: 1001, errMsg: '无效的记录 ID', data: null });
      return;
    }
    await recordService.softDelete(id, userId);
    res.json({ success: true, errCode: 0, errMsg: '删除成功', data: null });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 7000, errMsg: (error as Error).message, data: null });
  }
});

export default router;
